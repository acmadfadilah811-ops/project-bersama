"""Regresi: impor produk lewat CSV (ProductViewSet.import_products) tidak
pernah mencatat ProductActivityLog sama sekali -- beda dengan Tambah/Ubah
Produk manual yang sudah tercatat (perform_create/perform_update). Produk
hasil impor CSV jadi tidak punya jejak siapa & kapan sama sekali di menu
Log produk. Ditemukan user 2026-09-22 saat mengecek kenapa produk lama
(hasil impor) tidak punya riwayat log."""
import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from .product_models import Product, ProductActivityLog

User = get_user_model()

URL = '/api/products/import-products/'


def _csv_file(nama_kolom='name', nilai='Produk Impor Uji'):
    isi = f"{nama_kolom},category,buy_price,pos_sell_price,stock_qty\n{nilai},Kategori Uji,10000,20000,5\n"
    return SimpleUploadedFile('produk.csv', isi.encode('utf-8'), content_type='text/csv')


class ImportProductsActivityLogTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_import_log_test', password='x', role='owner')
        self.client.force_authenticate(self.owner)

    def test_produk_baru_hasil_impor_tercatat_di_activity_log(self):
        r = self.client.post(URL, {'file': _csv_file(nilai='Produk Impor Baru')}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)

        produk = Product.objects.get(nama='Produk Impor Baru')
        log = ProductActivityLog.objects.filter(product=produk).first()
        self.assertIsNotNone(log, 'Produk hasil impor CSV harus punya ProductActivityLog.')
        self.assertEqual(log.aksi, 'Menambahkan produk')
        self.assertEqual(log.user_id, self.owner.id)
        self.assertIsNotNone(log.created_at)

    def test_produk_diperbarui_lewat_impor_tercatat_sebagai_memperbarui(self):
        # Impor pertama: produk baru.
        self.client.post(URL, {'file': _csv_file(nilai='Produk Impor Update')}, format='multipart')
        produk = Product.objects.get(nama='Produk Impor Update')
        self.assertEqual(ProductActivityLog.objects.filter(product=produk).count(), 1)

        # Impor kedua, nama sama -> jalur update, bukan create.
        r2 = self.client.post(URL, {'file': _csv_file(nilai='Produk Impor Update')}, format='multipart')
        self.assertEqual(r2.status_code, 200, r2.content)

        # Urut lewat id (bukan created_at) -- auto_now_add bisa sama persis
        # antar 2 baris kalau tereksekusi dalam microsecond yang sama
        # (flaky saat suite besar berjalan cepat), id selalu naik sesuai
        # urutan insert jadi deterministik.
        logs = ProductActivityLog.objects.filter(product=produk).order_by('id')
        self.assertEqual(logs.count(), 2)
        self.assertEqual(logs.last().aksi, 'Memperbarui produk')
        self.assertEqual(logs.last().user_id, self.owner.id)

    def test_mode_pratinjau_tidak_membuat_log(self):
        r = self.client.post(URL, {'file': _csv_file(nilai='Produk Pratinjau'), 'preview': 'true'}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.data.get('preview'))
        self.assertFalse(Product.objects.filter(nama='Produk Pratinjau').exists())
        self.assertEqual(ProductActivityLog.objects.count(), 0)
