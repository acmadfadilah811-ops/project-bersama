"""Regresi 4 temuan audit Transaksi POS Terminal 2026-09-08:

1. Produk yang sama muncul di >=2 baris cart dalam 1 transaksi (mis. produk
   meteran, ukuran berbeda-beda per baris) -- stok & bahan baku (BoM) HARUS
   terpotong utk TOTAL qty gabungan, bukan cuma baris terakhir (lost update).
2. Void transaksi yang punya baris begini harus memulihkan stok/FIFO/HPP
   sepenuhnya (bukan dobel/kurang).
3. "Blokir jual di bawah harga beli" (Pengaturan POS) harus benar-benar
   menolak di server, bukan cuma di client.
4. "Blokir jual jika stok kosong" toggle harus benar-benar bisa dimatikan
   (izinkan backorder) -- sebelumnya toggle ini tidak berefek sama sekali.
5. idempotency_key checkout Lunas -- retry (klien timeout, request
   sebenarnya sukses di server) tidak boleh memposting transaksi dobel.

Catatan: harga item di payload SELALU diabaikan create_sale() untuk produk
katalog biasa (harga dihitung ulang server dari harga_jual_toko lewat
hitung_harga_produk, "harga tidak dipercaya dari browser") -- test di sini
mengatur harga_jual_toko produk langsung, bukan mengandalkan field 'harga'
di payload untuk mengontrol harga final.
"""
import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api.models import BillOfMaterials, BoMItem, InventoryItem, RestockHistory, SystemConfig
from api.pos_models import POSSale
from api.product_models import Product, ProductStockMovement

User = get_user_model()


class PosMultilineSameProductTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_multi', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)

        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test POS Multi', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='HPP Test POS Multi', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='51000', defaults={'name': 'HPP Test', 'account_type': 'expense', 'classification': expense})

        self.product = Product.objects.create(
            nama='Banner Meteran', harga_beli=5000, harga_jual_toko=20000,
            qty_stok=100, lacak_inventori=True,
        )
        self.bahan = InventoryItem.objects.create(
            nama='Tinta Banner Multi', stok=100.0, satuan='ml', kategori='Bahan Baku', cost_per_unit=1000,
        )
        self.bom = BillOfMaterials.objects.create(product=self.product, nama='BoM Banner Meteran')
        BoMItem.objects.create(bom=self.bom, inventory_item=self.bahan, qty_required_per_unit=2.0)

    def _jual_dua_baris(self, qty1=5, qty2=3):
        return self.client.post('/api/pos/sales/', {
            'items': [
                {'product_id': self.product.id, 'qty': qty1, 'harga': 20000},
                {'product_id': self.product.id, 'qty': qty2, 'harga': 20000},
            ],
            'status': 'paid', 'dibayar': 20000 * (qty1 + qty2), 'metode_bayar': 'tunai',
        }, format='json')

    def test_stok_terpotong_total_gabungan_bukan_cuma_baris_terakhir(self):
        response = self._jual_dua_baris(qty1=5, qty2=3)
        self.assertEqual(response.status_code, 201, response.content)

        self.product.refresh_from_db()
        # Sebelum fix: baris ke-2 menimpa hasil baris ke-1 dgn qty_stok basi
        # -> stok akhir hanya berkurang 3 (bukan 8). Ini bukti utama fix.
        self.assertEqual(self.product.qty_stok, Decimal('92'), "Stok harus berkurang 8 (5+3), bukan cuma baris terakhir.")

        movements = ProductStockMovement.objects.filter(product=self.product, tipe='penjualan')
        self.assertEqual(movements.count(), 1, "Harus SATU movement gabungan, bukan 2 movement per baris.")
        movement = movements.first()
        self.assertEqual(movement.qty, Decimal('8'))
        self.assertEqual(movement.stok_awal, Decimal('100'))
        self.assertEqual(movement.stok_akhir, Decimal('92'))

    def test_bom_terpotong_total_gabungan_tidak_di_skip_baris_kedua(self):
        response = self._jual_dua_baris(qty1=5, qty2=3)
        self.assertEqual(response.status_code, 201, response.content)

        self.bahan.refresh_from_db()
        # 2.0 per unit * 8 unit total = 16.0, BUKAN cuma 2.0*5=10.0 (kalau
        # baris kedua ke-skip oleh marker dedup RestockHistory).
        self.assertEqual(self.bahan.stok, 100.0 - 16.0)
        sale = POSSale.objects.get(pk=response.data['id'])
        self.assertEqual(
            RestockHistory.objects.filter(item=self.bahan, keterangan__icontains=f'POS {sale.nomor}').count(), 1,
        )

    def test_void_memulihkan_stok_dan_bom_sepenuhnya(self):
        response = self._jual_dua_baris(qty1=5, qty2=3)
        sale_id = response.data['id']

        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('92'))

        void_res = self.client.post(f'/api/pos/sales/{sale_id}/void/', {}, format='json')
        self.assertEqual(void_res.status_code, 200, void_res.content)

        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('100'), "Stok harus pulih penuh ke 100, bukan dobel/kurang.")

        pengembalian = ProductStockMovement.objects.filter(product=self.product, tipe='pengembalian')
        self.assertEqual(pengembalian.count(), 1)
        self.assertEqual(pengembalian.first().qty, Decimal('8'))


class PosBlokirHargaDibawahModalTest(APITestCase):
    """_validasi_aturan_pos() sebelumnya tidak pernah dipanggil sama sekali --
    setelan "blokir jual di bawah harga beli" tidak punya efek apa pun di
    server. Harga katalog (harga_jual_toko) diatur LANGSUNG di bawah
    harga_beli -- create_sale() menghitung ulang harga dari katalog lewat
    hitung_harga_produk(), payload 'harga' tidak dipercaya untuk produk biasa."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_harga', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Produk Rugi', harga_beli=10000, harga_jual_toko=5000,
            qty_stok=5, lacak_inventori=True,
        )

    def _set_ext(self, **overrides):
        cfg, _ = SystemConfig.objects.get_or_create(key='pos_ext_settings', defaults={'value': '{}'})
        current = json.loads(cfg.value or '{}')
        current.update(overrides)
        cfg.value = json.dumps(current)
        cfg.save()

    def _jual(self):
        return self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1, 'harga': 5000}],
            'status': 'paid', 'dibayar': 5000, 'metode_bayar': 'tunai',
        }, format='json')

    def test_aktif_menolak_di_server(self):
        self._set_ext(block_sell_less_than_buy_price=True)
        response = self._jual()
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('bawah harga beli', response.data.get('error', ''))
        self.assertEqual(POSSale.objects.count(), 0)

    def test_nonaktif_mengizinkan(self):
        self._set_ext(block_sell_less_than_buy_price=False)
        response = self._jual()
        self.assertEqual(response.status_code, 201, response.content)


class PosBlokirStokKosongTest(APITestCase):
    """Toggle "blokir jual jika stok kosong" sebelumnya tidak berefek apa pun
    -- create_sale() hard-block insufficient stock tanpa memeriksa toggle ini
    sama sekali."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_stok_toggle', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Produk Stok Toggle', harga_beli=10000, harga_jual_toko=25000,
            qty_stok=5, lacak_inventori=True,
        )

    def _jual(self, qty):
        return self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': qty, 'harga': 25000}],
            'status': 'paid', 'dibayar': 25000 * qty, 'metode_bayar': 'tunai',
        }, format='json')

    def test_default_aktif_menolak_oversell(self):
        response = self._jual(qty=999)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('tidak mencukupi', response.data.get('error', ''))

    def test_dimatikan_mengizinkan_backorder(self):
        SystemConfig.objects.update_or_create(
            key='pos_stok_blokir_jual_jika_kosong', defaults={'value': 'False'},
        )
        response = self._jual(qty=999)
        self.assertEqual(response.status_code, 201, response.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('5') - Decimal('999'), "Stok tetap dipotong (boleh minus/backorder).")


class PosCheckoutIdempotencyTest(APITestCase):
    """create_sale() sebelumnya tidak punya mekanisme dedup idempotency sama
    sekali -- retry checkout Lunas (timeout klien, request sebenarnya sukses
    di server) bisa memposting transaksi dobel."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_idem', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Produk Idempotensi', harga_beli=10000, harga_jual_toko=25000,
            qty_stok=50, lacak_inventori=True,
        )

    def _jual(self, idem_key):
        return self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1, 'harga': 25000}],
            'status': 'paid', 'dibayar': 25000, 'metode_bayar': 'tunai',
            'idempotency_key': idem_key,
        }, format='json')

    def test_key_sama_dikirim_dua_kali_tidak_membuat_transaksi_dobel(self):
        key = 'idem-key-retry-timeout-0001'
        first = self._jual(key)
        self.assertEqual(first.status_code, 201, first.content)

        second = self._jual(key)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(second.data['id'], first.data['id'], "Request kedua harus mengembalikan sale yang SAMA, bukan bikin baru.")

        self.assertEqual(POSSale.objects.filter(idempotency_key=key).count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('49'), "Stok cuma boleh terpotong SEKALI, bukan dua kali.")

    def test_key_berbeda_tetap_membuat_transaksi_terpisah(self):
        first = self._jual('idem-key-a')
        second = self._jual('idem-key-b')
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 201, second.content)
        self.assertNotEqual(first.data['id'], second.data['id'])

    def test_tanpa_idempotency_key_tetap_berfungsi_seperti_biasa(self):
        response = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1, 'harga': 25000}],
            'status': 'paid', 'dibayar': 25000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
