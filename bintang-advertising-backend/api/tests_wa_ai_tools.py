"""Tool AI bot WA (api/services/wa_ai_tools.py) — cari_produk & hitung_harga_produk
harus membaca katalog Product/ProductPackage NYATA (bukan teks hardcode atau
ProductPrice legacy), dan jalankan_tool tidak boleh bocorkan traceback mentah
ke AI/pelanggan kalau ada error."""

from django.test import TestCase

from .product_models import Product, ProductCategory, ProductPackage
from .services.wa_ai_tools import cari_produk, hitung_harga_produk, jalankan_tool


class CariProdukTest(TestCase):
    def setUp(self):
        self.kategori = ProductCategory.objects.create(nama='Banner')
        self.produk = Product.objects.create(
            nama='Banner Flexi 280gr', kategori=self.kategori, price_type='per_m2',
            harga_jual_toko=25000, is_active=True,
        )
        Product.objects.create(nama='Produk Nonaktif', is_active=False)
        self.paket = ProductPackage.objects.create(nama='Paket Grand Opening', publikasi=True, harga_jual_offline=500000)

    def test_cari_produk_by_kata_kunci_nama(self):
        hasil = cari_produk('banner')
        self.assertTrue(hasil['ok'])
        nama_hasil = [p['nama'] for p in hasil['produk']]
        self.assertIn('Banner Flexi 280gr', nama_hasil)

    def test_cari_produk_tidak_mengembalikan_produk_nonaktif(self):
        hasil = cari_produk('')
        nama_hasil = [p['nama'] for p in hasil['produk']]
        self.assertNotIn('Produk Nonaktif', nama_hasil)

    def test_cari_produk_ikut_kembalikan_paket(self):
        hasil = cari_produk('grand opening')
        nama_paket = [p['nama'] for p in hasil['paket']]
        self.assertIn('Paket Grand Opening', nama_paket)

    def test_cari_produk_kosong_saat_tidak_cocok(self):
        hasil = cari_produk('produk-yang-tidak-ada-xyz')
        self.assertEqual(hasil['produk'], [])
        self.assertIn('catatan', hasil)

    def test_hitung_harga_produk_per_m2(self):
        hasil = hitung_harga_produk(product_id=self.produk.id, qty=1, panjang=2, lebar=1)
        self.assertTrue(hasil['ok'])
        self.assertEqual(hasil['total'], 50000.0)

    def test_hitung_harga_produk_tanpa_dimensi_ditolak_bukan_ditaksir(self):
        hasil = hitung_harga_produk(product_id=self.produk.id, qty=1)
        self.assertFalse(hasil['ok'])
        self.assertIn('error', hasil)

    def test_hitung_harga_produk_id_tidak_ada(self):
        hasil = hitung_harga_produk(product_id=999999, qty=1)
        self.assertFalse(hasil['ok'])


class JalankanToolTest(TestCase):
    def test_tool_tidak_dikenal(self):
        hasil = jalankan_tool('tool_ngawur', {})
        self.assertFalse(hasil['ok'])

    def test_argumen_tidak_valid_tidak_bocorkan_traceback(self):
        hasil = jalankan_tool('cari_produk', {'argumen_ngawur': 'x'})
        self.assertFalse(hasil['ok'])
        self.assertNotIn('Traceback', hasil.get('error', ''))
