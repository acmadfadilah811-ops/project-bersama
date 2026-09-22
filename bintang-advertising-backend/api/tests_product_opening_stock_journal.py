"""Jejak akuntansi "saldo awal" (Opening Stock, istilah Frappe/ERPNext) saat
produk/varian BARU dibuat dengan stok awal > 0 -- baik lewat Tambah Produk
manual (ProductViewSet/ProductVariantViewSet.perform_create) maupun impor
CSV (import_products). Sebelumnya qty_stok langsung ditulis tanpa StockLayer
FIFO maupun jurnal sama sekali (pelanggaran M8), ditemukan user 2026-09-22
saat menanyakan kenapa akuntansi tidak bisa "membaca" penambahan produk
lewat import.

Beda dari penyesuaian stok (StockOpnameDocument -> akun 81000 Penyesuaian
Barang): stok awal produk baru dijurnal Debit Persediaan(11400) / Kredit
akun Saldo Awal (AccountingSettings.opening_balance_equity_account) --
supaya tidak menggembungkan laba/rugi periode berjalan, mengikuti pola
Frappe/ERPNext yang memisahkan "Opening Stock" dari "Stock Adjustment"."""
import io
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry
from .product_models import Product, ProductStockMovement, ProductVariant, StockLayer

User = get_user_model()


def _setup_accounts():
    equity, _ = AccountClassification.objects.get_or_create(name='Ekuitas Test', defaults={'account_type': 'equity'})
    asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test', defaults={'account_type': 'asset'})
    inventory, _ = Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
    saldo_awal, _ = Account.objects.get_or_create(code='34000', defaults={'name': 'Saldo Awal Test', 'account_type': 'equity', 'classification': equity})
    AccountingSettings.objects.create(
        accounting_start_date=date(2026, 1, 1), opening_balance_equity_account=saldo_awal,
    )
    return inventory, saldo_awal


class ProductCreateOpeningStockJournalTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_saldo_awal', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.inventory, self.saldo_awal = _setup_accounts()

    def test_produk_baru_dengan_stok_awal_membuat_layer_dan_jurnal(self):
        r = self.client.post('/api/products/', {
            'nama': 'Produk Saldo Awal Manual', 'harga_beli': '15000', 'harga_jual_toko': '25000',
            'qty_stok': '4', 'lacak_inventori': True,
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        product = Product.objects.get(nama='Produk Saldo Awal Manual')

        layer = StockLayer.objects.get(product=product, variant=None)
        self.assertEqual(layer.qty_masuk, Decimal('4'))
        self.assertEqual(layer.sumber_tipe, 'saldo_awal')

        movement = ProductStockMovement.objects.get(product=product, tipe='saldo_awal')
        self.assertEqual(movement.qty, Decimal('4'))
        self.assertEqual(movement.user, self.owner)

        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.OPENING_BALANCE, source_id=movement.id)
        debit_line = entry.lines.get(account=self.inventory)
        kredit_line = entry.lines.get(account=self.saldo_awal)
        self.assertEqual(debit_line.debit, Decimal('60000'))  # 4 x 15000
        self.assertEqual(kredit_line.kredit, Decimal('60000'))

    def test_produk_baru_tanpa_stok_tidak_membuat_layer_atau_jurnal(self):
        r = self.client.post('/api/products/', {
            'nama': 'Produk Tanpa Stok', 'harga_beli': '15000', 'harga_jual_toko': '25000', 'qty_stok': '0',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        product = Product.objects.get(nama='Produk Tanpa Stok')
        self.assertFalse(StockLayer.objects.filter(product=product).exists())
        self.assertFalse(ProductStockMovement.objects.filter(product=product).exists())

    def test_pengaturan_akuntansi_belum_lengkap_tetap_buat_produk_dan_layer_tanpa_jurnal(self):
        AccountingSettings.objects.all().delete()
        r = self.client.post('/api/products/', {
            'nama': 'Produk Tanpa Setting Akuntansi', 'harga_beli': '10000', 'harga_jual_toko': '20000', 'qty_stok': '2',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        product = Product.objects.get(nama='Produk Tanpa Setting Akuntansi')
        self.assertTrue(StockLayer.objects.filter(product=product).exists())
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.OPENING_BALANCE).exists())


class ProductVariantCreateOpeningStockJournalTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_saldo_awal_varian', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.inventory, self.saldo_awal = _setup_accounts()
        self.product = Product.objects.create(nama='Produk Induk Varian', has_variant=True)

    def test_varian_baru_dengan_stok_awal_membuat_layer_dan_jurnal(self):
        r = self.client.post('/api/product-variants/', {
            'product': self.product.id, 'nama_varian': 'Merah', 'harga_beli': '8000',
            'harga_jual_toko': '15000', 'qty_stok': '10',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        variant = ProductVariant.objects.get(product=self.product, nama_varian='Merah')

        layer = StockLayer.objects.get(product=self.product, variant=variant)
        self.assertEqual(layer.qty_masuk, Decimal('10'))

        movement = ProductStockMovement.objects.get(variant=variant, tipe='saldo_awal')
        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.OPENING_BALANCE, source_id=movement.id)
        self.assertEqual(entry.lines.get(account=self.inventory).debit, Decimal('80000'))  # 10 x 8000


class ImportProductsOpeningStockJournalTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_saldo_awal_impor', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.inventory, self.saldo_awal = _setup_accounts()

    def _csv(self, isi):
        return SimpleUploadedFile('produk.csv', isi.encode('utf-8'), content_type='text/csv')

    def test_produk_baru_hasil_impor_dengan_stok_membuat_layer_dan_jurnal(self):
        isi = "name,category,buy_price,pos_sell_price,stock_qty\nProduk Impor Saldo Awal,Kategori,12000,20000,6\n"
        r = self.client.post('/api/products/import-products/', {'file': self._csv(isi)}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)

        product = Product.objects.get(nama='Produk Impor Saldo Awal')
        layer = StockLayer.objects.get(product=product, variant=None)
        self.assertEqual(layer.qty_masuk, Decimal('6'))

        movement = ProductStockMovement.objects.get(product=product, tipe='saldo_awal')
        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.OPENING_BALANCE, source_id=movement.id)
        self.assertEqual(entry.lines.get(account=self.inventory).debit, Decimal('72000'))  # 6 x 12000

    def test_impor_ulang_produk_yang_sudah_ada_tidak_membuat_saldo_awal_kedua(self):
        isi = "name,category,buy_price,pos_sell_price,stock_qty\nProduk Impor Update,Kategori,10000,18000,5\n"
        self.client.post('/api/products/import-products/', {'file': self._csv(isi)}, format='multipart')
        product = Product.objects.get(nama='Produk Impor Update')
        self.assertEqual(ProductStockMovement.objects.filter(product=product, tipe='saldo_awal').count(), 1)

        isi2 = "name,category,buy_price,pos_sell_price,stock_qty\nProduk Impor Update,Kategori,10000,18000,9\n"
        r2 = self.client.post('/api/products/import-products/', {'file': self._csv(isi2)}, format='multipart')
        self.assertEqual(r2.status_code, 200, r2.content)
        # Update tidak menambah entri saldo_awal kedua (bukan produk baru lagi).
        self.assertEqual(ProductStockMovement.objects.filter(product=product, tipe='saldo_awal').count(), 1)

    def test_produk_dengan_varian_hasil_impor_membuat_saldo_awal_per_varian(self):
        isi = (
            "name,variant_names,buy_price,pos_sell_price,stock_qty\n"
            "Produk Varian Impor,Merah,7000,13000,3\n"
            "Produk Varian Impor,Biru,7500,14000,4\n"
        )
        r = self.client.post('/api/products/import-products/', {'file': self._csv(isi)}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)

        product = Product.objects.get(nama='Produk Varian Impor')
        merah = ProductVariant.objects.get(product=product, nama_varian='Merah')
        biru = ProductVariant.objects.get(product=product, nama_varian='Biru')

        self.assertTrue(StockLayer.objects.filter(product=product, variant=merah, qty_masuk=Decimal('3')).exists())
        self.assertTrue(StockLayer.objects.filter(product=product, variant=biru, qty_masuk=Decimal('4')).exists())
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.OPENING_BALANCE).count(), 2,
        )
