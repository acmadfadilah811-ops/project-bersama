"""Item PAKET lewat /order-items/ memotong stok komponen, dan order dari bot
WA/agent luar menautkan Product bila namanya persis (2026-09-24).

Lihat api/services/order_stock.py dan order_actions._cocokkan_produk_persis."""
import uuid

from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import CustomUser, Divisi, Order, OrderItem, TahapProses
from api.product_models import Product, ProductPackage, ProductPackageItem, ProductStockMovement


class OrderItemPaketStokPotongTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_paket_stok', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.komponen_a = Product.objects.create(
            nama='Komponen A', harga_beli=1000, harga_jual_toko=5000, qty_stok=20, lacak_inventori=True,
        )
        self.komponen_b = Product.objects.create(
            nama='Komponen B', harga_beli=1000, harga_jual_toko=5000, qty_stok=5, lacak_inventori=True,
        )
        self.paket = ProductPackage.objects.create(
            nama='Paket Combo', sku='PKT-COMBO', harga_jual_offline=15000,
            publikasi=True, tampil_pos=True,
        )
        ProductPackageItem.objects.create(paket=self.paket, product=self.komponen_a, qty=2)
        ProductPackageItem.objects.create(paket=self.paket, product=self.komponen_b, qty=1)
        self.order = Order.objects.create(nomor_wa='081234567891', nama='Siti')

    def _tambah_paket(self, qty):
        return self.client.post('/api/order-items/', {
            'order': self.order.id, 'paket': self.paket.id, 'qty': qty,
            'jenis_produk': 'Paket Combo', 'harga_jual': 1,
        }, format='json')

    def test_item_paket_memotong_stok_semua_komponen_sekali(self):
        response = self._tambah_paket(3)
        self.assertEqual(response.status_code, 201, response.content)
        self.komponen_a.refresh_from_db()
        self.komponen_b.refresh_from_db()
        self.assertEqual(self.komponen_a.qty_stok, 14)  # 20 - 3*2
        self.assertEqual(self.komponen_b.qty_stok, 2)   # 5 - 3*1

        item = OrderItem.objects.get(pk=response.data['id'])
        self.assertTrue(item.stok_dikurangi)
        self.assertEqual(ProductStockMovement.objects.filter(order=self.order, tipe='penjualan').count(), 2)

        # Edit lagi tidak memotong ulang.
        response2 = self.client.patch(f'/api/order-items/{item.id}/', {'qty': 4}, format='json')
        self.assertEqual(response2.status_code, 200, response2.content)
        self.komponen_a.refresh_from_db()
        self.assertEqual(self.komponen_a.qty_stok, 14)

    def test_salah_satu_komponen_kurang_stok_menolak_dan_tidak_mengubah_apa_pun(self):
        response = self._tambah_paket(6)  # butuh B = 6 > stok 5 (A cukup: 12 <= 20)
        self.assertEqual(response.status_code, 400, response.content)
        self.komponen_a.refresh_from_db()
        self.komponen_b.refresh_from_db()
        self.assertEqual(self.komponen_a.qty_stok, 20)
        self.assertEqual(self.komponen_b.qty_stok, 5)
        self.assertFalse(ProductStockMovement.objects.filter(order=self.order).exists())

    def test_paket_dari_checkout_pos_tidak_dipotong_dobel_saat_diedit(self):
        kasir = CustomUser.objects.create_user(username='kasir_paket_stok', password='x', role='kasir')
        self.client.force_authenticate(kasir)
        divisi = Divisi.objects.create(nama='Produksi Paket')
        TahapProses.objects.create(nama='Cetak', divisi=divisi, urutan=1)
        res = self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Paket DP', 'nomor_wa': '081200000077',
            'items': [{'package_id': self.paket.id, 'qty': 2}],
            'jumlah_bayar': 30000, 'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': kasir.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.komponen_a.refresh_from_db()
        self.assertEqual(self.komponen_a.qty_stok, 16)  # 20 - 2*2

        item = OrderItem.objects.get(order_id=res.data['id'], paket=self.paket)
        self.assertTrue(item.stok_dikurangi)
        self.client.force_authenticate(self.owner)
        edit = self.client.patch(f'/api/order-items/{item.id}/', {'qty': 3}, format='json')
        self.assertEqual(edit.status_code, 200, edit.content)
        self.komponen_a.refresh_from_db()
        self.assertEqual(self.komponen_a.qty_stok, 16)  # tetap, tidak dobel


class OrderWaTautanProdukTests(APITestCase):
    """Stok tidak dipotong saat draft WA dibuat, tapi terpotong sekali saat
    staff menyimpan item di Antrean WA."""

    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_wa_link', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.mendoan = Product.objects.create(
            nama='Mendoan', harga_beli=1000, harga_jual_toko=5000, qty_stok=50, lacak_inventori=True,
        )

    def _buat(self, jenis_produk, qty=2):
        from api.services.order_actions import buat_order_dari_items
        order_id, _ = buat_order_dari_items(
            nomor_wa='081200000055', nama_kontak='Budi WA', nama_order='Budi WA',
            items=[{'jenis_produk': jenis_produk, 'qty': qty}],
        )
        return OrderItem.objects.get(order_id=order_id)

    def test_nama_persis_tertaut_tanpa_beda_huruf_besar_kecil_dan_stok_belum_dipotong(self):
        item = self._buat('mendoan')
        self.assertEqual(item.product_id, self.mendoan.id)
        self.assertFalse(item.stok_dikurangi)
        self.mendoan.refresh_from_db()
        self.assertEqual(self.mendoan.qty_stok, 50)

        res = self.client.patch(f'/api/order-items/{item.id}/', {
            'product': self.mendoan.id, 'harga_jual': 10000,
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.mendoan.refresh_from_db()
        self.assertEqual(self.mendoan.qty_stok, 48)

    def test_nama_mirip_tapi_tidak_persis_tidak_ditautkan(self):
        self.assertIsNone(self._buat('Mendoan Keju').product_id)
        self.assertIsNone(self._buat('mend').product_id)

    def test_nama_ambigu_tidak_ditautkan(self):
        Product.objects.create(nama='MENDOAN', harga_jual_toko=6000, qty_stok=5, lacak_inventori=True)
        self.assertIsNone(self._buat('Mendoan').product_id)

    def test_produk_bervarian_dan_nonaktif_tidak_ditautkan(self):
        Product.objects.create(nama='Kaos Polos', harga_jual_toko=50000, has_variant=True)
        Product.objects.create(nama='Produk Lama', harga_jual_toko=1000, is_active=False)
        self.assertIsNone(self._buat('Kaos Polos').product_id)
        self.assertIsNone(self._buat('Produk Lama').product_id)

    def test_umum_tidak_ditautkan(self):
        Product.objects.create(nama='Umum', harga_jual_toko=1000, qty_stok=5)
        self.assertIsNone(self._buat('Umum').product_id)
