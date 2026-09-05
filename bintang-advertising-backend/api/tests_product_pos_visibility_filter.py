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

from api.product_models import Product

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
