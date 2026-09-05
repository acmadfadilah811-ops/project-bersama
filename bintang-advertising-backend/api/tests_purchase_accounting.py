"""Regresi: post_stock_journal() harus gagal dengan pesan jelas (400), bukan
crash 500, saat modul akuntansi belum aktif.

Bug ditemukan lewat audit VPS produksi 2026-09-05: purchase_accounting.py
cuma import `ValidationError as DjangoValidationError` (Django), tapi baris
terakhir `except DjangoValidationError as exc: raise ValidationError(...)`
memakai `ValidationError` polos yang TIDAK PERNAH di-import — jadi setiap
kali create_journal_entry() menolak (mis. AccountingSettings.is_active=False,
kondisi normal di instalasi baru sebelum wizard Pengaturan Awal selesai),
handler except-nya sendiri crash NameError sebelum sempat kasih pesan error
ke user. Dampak nyata: tombol "Selesai" Pembelian/Stok Masuk selalu
Server Error 500 kosong selama akuntansi belum diaktifkan.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings
from api.customer_models import Supplier
from api.product_models import (
    Product, ProductCategory, ProductStockMovement, Purchase, StockInDocument, StockInDocumentItem,
)
from api.services.purchase_accounting import post_stock_journal

User = get_user_model()


class PostStockJournalAccountingInactiveTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_purchase_acc_test', password='password123', role='owner',
        )
        self.kategori = ProductCategory.objects.create(nama='Test Kategori PA', key='test-kat-pa')
        self.produk = Product.objects.create(
            nama='Produk Uji Purchase Accounting', kategori=self.kategori,
            sku='TEST-PA-1', qty_stok=0, lacak_inventori=True, harga_beli=0,
        )
        self.document = StockInDocument.objects.create(tanggal=date.today(), supplier='Supplier Uji')
        StockInDocumentItem.objects.create(
            document=self.document, product=self.produk,
            harga_beli=Decimal('10000'), qty=Decimal('5'),
        )

    def _configure_purchase_account_mappings(self):
        """Isi mapping akun Pembelian - dibutuhkan supaya test is_active di
        bawah benar-benar mengisolasi gate itu (bukan gagal duluan di
        pengecekan mapping)."""
        asset_cls = AccountClassification.objects.create(
            name='Persediaan Test PA', account_type='asset', code_range_start=11000, code_range_end=11999,
        )
        liability_cls = AccountClassification.objects.create(
            name='Hutang Test PA', account_type='liability', code_range_start=21000, code_range_end=21999,
        )
        inventory = Account.objects.create(code='11401', name='Persediaan Uji', account_type='asset', classification=asset_cls)
        payable = Account.objects.create(code='21001', name='Hutang Uji', account_type='liability', classification=liability_cls)
        advance = Account.objects.create(code='11701', name='Uang Muka Uji', account_type='asset', classification=asset_cls)
        return inventory, payable, advance

    def test_raises_clean_validation_error_when_accounting_inactive(self):
        inventory, payable, advance = self._configure_purchase_account_mappings()
        # is_active TIDAK diset True - reproduksi persis kondisi VPS produksi
        # (default instalasi baru sebelum wizard Pengaturan Awal selesai).
        AccountingSettings.objects.create(
            accounting_start_date=date.today(), is_active=False,
            purchase_inventory_account=inventory, purchase_payable_account=payable,
            purchase_advance_account=advance,
        )
        with self.assertRaises(ValidationError) as ctx:
            post_stock_journal(self.document, self.owner, direction='in')
        # Harus DRF ValidationError yang bisa diserialize jadi 400 rapi,
        # bukan NameError/exception mentah lain.
        self.assertIn('akuntansi', str(ctx.exception).lower())

    def test_raises_clean_validation_error_when_mappings_not_configured(self):
        # Bug kedua ditemukan saat menulis test di atas: get_purchase_account_mappings()
        # dipanggil TANPA try/except sama sekali sebelum perbaikan - Django
        # ValidationError-nya lolos mentah (DRF tidak otomatis serialize itu
        # jadi 400 rapi). AccountingSettings sengaja tanpa mapping akun sama
        # sekali di sini.
        AccountingSettings.objects.create(accounting_start_date=date.today(), is_active=True)
        with self.assertRaises(ValidationError) as ctx:
            post_stock_journal(self.document, self.owner, direction='in')
        self.assertIn('mapping akun pembelian', str(ctx.exception).lower())


class PostDocumentEndpointRollbackTests(APITestCase):
    """Regresi bug KEDUA (lebih serius) yang ditemukan langsung dari data
    produksi: StockInDocumentViewSet.post_document() dan
    PurchaseWorkflowView.update_status() sama-sama @transaction.atomic, tapi
    menangkap ValidationError dari post_stock_in_document() lalu return
    Response biasa TANPA transaction.set_rollback(True) - melanggar M5
    (Aturan Engineering: "jurnal gagal = seluruh transaksi rollback").
    Akibatnya Django mengira transaksi sukses dan COMMIT status='selesai'
    + stok yang sudah bertambah + ProductStockMovement, padahal API bilang
    gagal (400) ke user. Dibuktikan langsung di VPS produksi 2026-09-05:
    dokumen tetap 'selesai' walau endpoint balas 400."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_rollback_test', password='password123', role='owner',
        )
        self.client.force_authenticate(user=self.owner)
        self.kategori = ProductCategory.objects.create(nama='Test Kategori Rollback', key='test-kat-rb')
        self.produk = Product.objects.create(
            nama='Produk Uji Rollback', kategori=self.kategori,
            sku='TEST-RB-1', qty_stok=0, lacak_inventori=True, harga_beli=0,
        )
        # AccountingSettings sengaja is_active=False (tanpa mapping akun sama
        # sekali) - reproduksi persis kondisi VPS produksi saat bug ditemukan.
        AccountingSettings.objects.create(accounting_start_date=date.today(), is_active=False)

    def test_stock_in_post_document_rolls_back_on_journal_failure(self):
        document = StockInDocument.objects.create(tanggal=date.today(), supplier='Supplier Uji Rollback')
        StockInDocumentItem.objects.create(
            document=document, product=self.produk, harga_beli=Decimal('10000'), qty=Decimal('5'),
        )

        resp = self.client.post(f'/api/stock-in-documents/{document.id}/post-document/')
        self.assertEqual(resp.status_code, 400)

        document.refresh_from_db()
        self.produk.refresh_from_db()
        # Sebelum fix: status jadi 'selesai' dan qty_stok bertambah walau
        # response 400 - persis yang dibuktikan manual di VPS produksi.
        self.assertEqual(document.status, 'draft')
        self.assertEqual(self.produk.qty_stok, 0)
        self.assertEqual(ProductStockMovement.objects.filter(product=self.produk).count(), 0)


class PostStockJournalSupplierAkunHutangTests(APITestCase):
    """Supplier.akun_hutang (Pengaturan Supplier) sebelumnya bisa diisi &
    tampil di layar tapi tidak pernah benar-benar dipakai saat posting
    jurnal stok masuk - selalu jatuh ke akun hutang global, terlepas dari
    pengaturan supplier (ditemukan lewat audit produksi 2026-09-05)."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_supplier_akun_test', password='x', role='owner',
        )
        self.kategori = ProductCategory.objects.create(nama='Test Kategori Supplier Akun', key='test-kat-sa')
        self.produk = Product.objects.create(
            nama='Produk Uji Supplier Akun', kategori=self.kategori,
            sku='TEST-SA-1', qty_stok=0, lacak_inventori=True, harga_beli=0,
        )

        asset_cls = AccountClassification.objects.create(
            name='Persediaan Test SA', account_type='asset', code_range_start=11000, code_range_end=11999,
        )
        liability_cls = AccountClassification.objects.create(
            name='Hutang Test SA', account_type='liability', code_range_start=21000, code_range_end=21999,
        )
        inventory = Account.objects.create(code='11402', name='Persediaan Uji SA', account_type='asset', classification=asset_cls)
        self.payable_default = Account.objects.create(code='21002', name='Hutang Default Uji', account_type='liability', classification=liability_cls)
        self.payable_supplier = Account.objects.create(code='21003', name='Hutang Supplier Khusus Uji', account_type='liability', classification=liability_cls)
        advance = Account.objects.create(code='11702', name='Uang Muka Uji SA', account_type='asset', classification=asset_cls)
        AccountingSettings.objects.create(
            accounting_start_date=date.today(), is_active=True,
            purchase_inventory_account=inventory, purchase_payable_account=self.payable_default,
            purchase_advance_account=advance,
        )

        self.supplier = Supplier.objects.create(nama='CV Uji Akun Hutang', akun_hutang=self.payable_supplier)
        self.purchase = Purchase.objects.create(nomor='PO-SA-TEST', tanggal=date.today(), supplier_ref=self.supplier)
        self.document = StockInDocument.objects.create(
            tanggal=date.today(), supplier=self.supplier.nama, purchase=self.purchase,
        )
        StockInDocumentItem.objects.create(
            document=self.document, product=self.produk,
            harga_beli=Decimal('10000'), qty=Decimal('5'),
        )

    def test_stock_in_journal_pakai_akun_hutang_supplier_bukan_default(self):
        entry = post_stock_journal(self.document, self.owner, direction='in')
        lines = entry.lines.all()
        self.assertTrue(lines.filter(account=self.payable_supplier, kredit=Decimal('50000')).exists())
        self.assertFalse(lines.filter(account=self.payable_default).exists())

    def test_stock_in_journal_tetap_pakai_default_saat_supplier_tanpa_akun_hutang(self):
        self.supplier.akun_hutang = None
        self.supplier.save(update_fields=['akun_hutang'])

        entry = post_stock_journal(self.document, self.owner, direction='in')
        lines = entry.lines.all()
        self.assertTrue(lines.filter(account=self.payable_default, kredit=Decimal('50000')).exists())
