"""Regresi: /api/products/?is_active=true (dikirim Kasir — PosTerminal.jsx,
ProductListPage.jsx) tidak pernah benar-benar ditegakkan di backend. Produk
yang sudah dinonaktifkan (is_active=False) TETAP muncul & bisa dijual di
Kasir meski Kasir secara eksplisit minta hanya produk aktif. Toggle "Tidak
Tersedia di POS Offline" (Product.tidak_tersedia_offline_pos, menu Produk >
Ketersediaan) juga sama sekali tidak berpengaruh ke katalog Kasir.

Dibuktikan lewat query langsung ke server produksi (produk nonaktif tetap
muncul di hasil ?is_active=true) sebelum diperbaiki. Ditemukan & diperbaiki
2026-09-06 atas pertanyaan user, audit modul Kasir/Produk.
"""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.product_models import Product, ProductCategory, ProductPackage

User = get_user_model()


class ProductPosVisibilityFilterTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_visibility', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.aktif = Product.objects.create(
            nama='Banner Aktif', harga_beli=10000, harga_jual_toko=50000,
            is_active=True, tidak_tersedia_offline_pos=False,
        )
        self.nonaktif = Product.objects.create(
            nama='Banner Nonaktif', harga_beli=10000, harga_jual_toko=50000,
            is_active=False, tidak_tersedia_offline_pos=False,
        )
        self.sembunyi_pos = Product.objects.create(
            nama='Banner Sembunyi POS', harga_beli=10000, harga_jual_toko=50000,
            is_active=True, tidak_tersedia_offline_pos=True,
        )

    def test_is_active_true_menyaring_produk_nonaktif(self):
        res = self.client.get('/api/products/', {'is_active': 'true', 'page_size': 100})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data['results']}
        self.assertIn(self.aktif.id, ids)
        self.assertNotIn(self.nonaktif.id, ids)

    def test_is_active_true_menyaring_produk_disembunyikan_dari_pos(self):
        res = self.client.get('/api/products/', {'is_active': 'true', 'page_size': 100})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data['results']}
        self.assertIn(self.aktif.id, ids)
        self.assertNotIn(self.sembunyi_pos.id, ids)

    def test_tanpa_param_is_active_semua_produk_tetap_tampil(self):
        """Halaman Produk (admin) sengaja tidak kirim is_active — harus tetap
        melihat produk nonaktif/disembunyikan supaya bisa dikelola lagi."""
        res = self.client.get('/api/products/', {'page_size': 100})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data['results']}
        self.assertIn(self.aktif.id, ids)
        self.assertIn(self.nonaktif.id, ids)
        self.assertIn(self.sembunyi_pos.id, ids)

    def test_is_active_false_menampilkan_hanya_yang_nonaktif(self):
        res = self.client.get('/api/products/', {'is_active': 'false', 'page_size': 100})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data['results']}
        self.assertIn(self.nonaktif.id, ids)
        self.assertNotIn(self.aktif.id, ids)


class ProductCategoryTampilPosFilterTests(APITestCase):
    """Regresi: kategori dengan tampil_pos=False (menu Produk > Kategori,
    "Tampilkan di POS") tetap muncul di filter kategori Kasir > Katalog Produk
    (ProductListPage.jsx) meski PosTerminal.jsx sudah menyaringnya sendiri di
    frontend. Ditemukan & diperbaiki 2026-09-06 atas laporan user."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_cat_pos', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.tampil = ProductCategory.objects.create(nama='Cetak Foto', tampil_pos=True)
        self.sembunyi = ProductCategory.objects.create(nama='Bahan Baku Internal', tampil_pos=False)

    def test_tampil_pos_true_menyaring_kategori_disembunyikan(self):
        res = self.client.get('/api/product-categories/', {'tampil_pos': 'true'})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn(self.tampil.id, ids)
        self.assertNotIn(self.sembunyi.id, ids)

    def test_tanpa_param_semua_kategori_tetap_tampil(self):
        """Halaman admin Kategori sengaja tidak kirim param ini — harus tetap
        melihat & bisa kelola semua kategori."""
        res = self.client.get('/api/product-categories/')
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn(self.tampil.id, ids)
        self.assertIn(self.sembunyi.id, ids)


class ProductPackagePosVisibilityFilterTests(APITestCase):
    """Regresi: paket produk yang disembunyikan dari POS (tampil_pos=False),
    belum dipublikasikan (publikasi=False), atau habis stok (habis_stok=True)
    tetap muncul di Antrean WA (WaOrderQueue.jsx) karena hanya menyaring
    publikasi & habis_stok di frontend, lupa tampil_pos — beda dengan
    PosTerminal.jsx yang sudah benar. Ditemukan & diperbaiki 2026-09-06."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_paket_pos', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.siap = ProductPackage.objects.create(
            nama='Paket Wisuda Hemat', publikasi=True, tampil_pos=True, habis_stok=False,
        )
        self.sembunyi_pos = ProductPackage.objects.create(
            nama='Paket Internal', publikasi=True, tampil_pos=False, habis_stok=False,
        )
        self.belum_publikasi = ProductPackage.objects.create(
            nama='Paket Draft', publikasi=False, tampil_pos=True, habis_stok=False,
        )
        self.habis = ProductPackage.objects.create(
            nama='Paket Habis', publikasi=True, tampil_pos=True, habis_stok=True,
        )

    def test_filter_pos_menyaring_tidak_siap_jual(self):
        res = self.client.get('/api/product-packages/', {
            'publikasi': 'true', 'tampil_pos': 'true', 'habis_stok': 'false', 'page_size': 100,
        })
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {row['id'] for row in rows}
        self.assertIn(self.siap.id, ids)
        self.assertNotIn(self.sembunyi_pos.id, ids)
        self.assertNotIn(self.belum_publikasi.id, ids)
        self.assertNotIn(self.habis.id, ids)

    def test_tanpa_param_semua_paket_tetap_tampil(self):
        """Halaman admin Paket Produk sengaja tidak kirim param ini."""
        res = self.client.get('/api/product-packages/', {'page_size': 100})
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {row['id'] for row in rows}
        self.assertIn(self.siap.id, ids)
        self.assertIn(self.sembunyi_pos.id, ids)
        self.assertIn(self.belum_publikasi.id, ids)
        self.assertIn(self.habis.id, ids)
