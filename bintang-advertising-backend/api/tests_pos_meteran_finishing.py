"""Item POS meteran (price_type='per_m2') & Finishing sebelumnya dikirim TANPA
product_id (dianggap item kustom) — akibatnya addon (wajib product) dan
potong stok otomatis tidak pernah jalan untuk keduanya, dan harga dipercaya
mentah-mentah dari klien (bukan dihitung ulang server, M6). Test ini
membuktikan perbaikannya: product/variant tetap tertaut, harga dihitung
ulang di server lewat kalkulator resmi (product_pricing.hitung_harga), addon
& potong stok otomatis ikut jalan, dan qty per addon independen dari qty
item induknya."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from . import stock_fifo
from .product_models import Addon, Product, ProductStockMovement, SaleItemAddon


class PosMeteranFinishingTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_meteran', password='x', role='owner')
        self.client.force_authenticate(self.owner)

        self.banner = Product.objects.create(
            nama='Banner Flexi Meteran', price_type='per_m2', harga_jual_toko=25000,
            qty_stok=100, lacak_inventori=True,
        )
        self.kartu_nama = Product.objects.create(
            nama='Kartu Nama Flat', price_type='flat', harga_jual_toko=50000,
            qty_stok=20, lacak_inventori=True,
        )
        self.bahan_mata_ayam = Product.objects.create(
            nama='Mata Ayam (bahan)', harga_beli=500, harga_jual_toko=0,
            qty_stok=100, lacak_inventori=True,
        )
        stock_fifo.create_layer(self.bahan_mata_ayam, None, 100, 500, timezone.localdate())

        self.addon = Addon.objects.create(
            nama='Mata Ayam', harga=Decimal('5000'), is_active=True,
            linked_product=self.bahan_mata_ayam, linked_qty=Decimal('2'),
        )
        self.addon.applies_to.add(self.banner)
        self.addon.applies_to.add(self.kartu_nama)

    def test_meteran_dihitung_ulang_server_bukan_dipercaya_dari_klien(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.banner.id, 'qty': 2,
                'panjang': 2, 'lebar': 3,
                'harga': 1,  # harga karangan klien — harus diabaikan total
            }],
            'status': 'paid', 'dibayar': 300000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # luas = 2x3 = 6 m2, harga/m2 = 25000 -> per lembar 150000, qty 2 -> 300000
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('300000'))
        item = res.data['items'][0]
        self.assertEqual(Decimal(str(item['harga_snapshot'])), Decimal('150000'))
        self.assertEqual(item['product'], self.banner.id)
        self.assertEqual(item['panjang'], 2.0)
        self.assertEqual(item['lebar'], 3.0)

    def test_flat_dengan_ukuran_ikut_dikali_luas_paksa_per_m2(self):
        # Bug uang ditemukan & diperbaiki 2026-08-12: kasir bisa pakai mode
        # "Meteran (P x L)" utk produk APA PUN di Detail Item POS, tidak
        # cuma yang price_type='per_m2' di katalog. Tanpa fix ini, checkout
        # akan diam-diam mengabaikan panjang/lebar utk produk 'flat' dan
        # menagih harga flat polos — beda dari yang kasir/pelanggan lihat.
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.kartu_nama.id, 'qty': 1,
                'panjang': 2, 'lebar': 3,
            }],
            'status': 'paid', 'dibayar': 300000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # kartu_nama harga_jual_toko=50000 dipakai sbg tarif per m2: luas 6 x 50000 = 300000
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('300000'))
        item = res.data['items'][0]
        self.assertEqual(Decimal(str(item['harga_snapshot'])), Decimal('300000'))
        self.assertEqual(item['panjang'], 2.0)
        self.assertEqual(item['lebar'], 3.0)

    def test_flat_tanpa_ukuran_tetap_harga_flat_biasa(self):
        # Tanpa P x L diisi (mode Unit Biasa), harga flat tetap apa adanya —
        # paksa_per_m2 tidak boleh ikut2an nyala kalau kasir tidak isi ukuran.
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.kartu_nama.id, 'qty': 2}],
            'status': 'paid', 'dibayar': 100000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('100000'))

    def test_meteran_tanpa_ukuran_ditolak_bukan_ditaksir(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.banner.id, 'qty': 1}],
            'status': 'paid', 'dibayar': 100000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_meteran_bisa_pakai_addon(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.banner.id, 'qty': 1, 'panjang': 1, 'lebar': 1,
                'addon_ids': [self.addon.id],
            }],
            'status': 'paid', 'dibayar': 30000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # luas 1m2 x 25000 = 25000 + addon 5000 = 30000
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('30000'))
        self.assertTrue(SaleItemAddon.objects.filter(pos_sale_item__sale_id=res.data['id']).exists())

    def test_meteran_memotong_stok_produk(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.banner.id, 'qty': 3, 'panjang': 1, 'lebar': 1}],
            'status': 'paid', 'dibayar': 75000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.banner.refresh_from_db()
        self.assertEqual(self.banner.qty_stok, Decimal('97'))  # 100 - 3

    def test_finishing_biaya_ditambahkan_dan_tetap_bisa_addon_dan_potong_stok(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.kartu_nama.id, 'qty': 2,
                'finishing_biaya': 3000,
                'addon_ids': [self.addon.id],
            }],
            'status': 'paid', 'dibayar': 116000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # 2 x (50000 + 3000) + 2 x 5000(addon) = 106000 + 10000 = 116000
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('116000'))
        self.kartu_nama.refresh_from_db()
        self.assertEqual(self.kartu_nama.qty_stok, Decimal('18'))  # 20 - 2
        self.assertTrue(SaleItemAddon.objects.filter(pos_sale_item__sale_id=res.data['id']).exists())

    def test_qty_addon_independen_dari_qty_item_induk(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.kartu_nama.id, 'qty': 1,
                'addons': [{'id': self.addon.id, 'qty': 3}],
            }],
            'status': 'paid', 'dibayar': 65000, 'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # 1 x 50000 + 3 x 5000(addon qty independen) = 65000
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('65000'))
        addon_link = SaleItemAddon.objects.get(pos_sale_item__sale_id=res.data['id'])
        self.assertEqual(addon_link.qty, Decimal('3'))
        self.assertEqual(addon_link.subtotal, Decimal('15000'))
        # linked_qty (2) * addon qty (3) = 6 bahan terpakai, bukan ikut qty item (1)
        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('94'))  # 100 - 6
