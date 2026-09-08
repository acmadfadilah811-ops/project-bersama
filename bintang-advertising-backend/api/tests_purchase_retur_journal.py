"""Regresi audit 2026-09-08 -- 2 bug ditemukan di alur Pembelian:

1. post_stock_journal() menghitung `amount` dari `document.items` (relasi
   StockInDocumentItem/StockOutDocumentItem, diisi alur "Stok Masuk/Keluar"
   manual). PurchaseViewSet._apply_purchase_stock() (dipakai receive() dan
   post_retur()) TIDAK PERNAH mengisi `items` -- cuma `movements`
   (ProductStockMovement). Akibatnya amount selalu 0, jurnal tidak pernah
   terposting. `post_retur()` DIPAKAI FRONTEND NYATA (Pembelian > tab Retur),
   jadi ini bug produksi sungguhan, bukan cuma teoretis. Dibuktikan langsung
   di production 2026-09-08 lewat percobaan retur end-to-end (data test
   sudah dibersihkan).

2. create_retur() mensyaratkan PO sumber harus 'lunas' dulu, tanpa
   pengecualian. Keputusan user 2026-09-08: retur barang cacat boleh
   diajukan sebelum lunas, ASALKAN ada konfirmasi kerusakan tertulis
   (konfirmasi_kerusakan) dengan penanggung jawab jelas (dibuat_oleh).
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry
from api.product_models import Product, ProductCategory, Purchase, PurchaseItem, PurchasePayment

User = get_user_model()


class PurchaseReturJournalTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_retur_test', password='x', role='owner')
        self.client.force_authenticate(self.owner)

        kategori = ProductCategory.objects.create(nama='Kategori Retur Test', key='test-kat-retur')
        self.product = Product.objects.create(
            nama='Produk Retur Test', kategori=kategori, sku='TEST-RETUR-1',
            qty_stok=Decimal('20'), lacak_inventori=True, harga_beli=Decimal('10000'),
        )

        asset_cls = AccountClassification.objects.create(
            name='Persediaan Retur Test', account_type='asset', code_range_start=11000, code_range_end=11999,
        )
        liability_cls = AccountClassification.objects.create(
            name='Hutang Retur Test', account_type='liability', code_range_start=21000, code_range_end=21999,
        )
        inventory = Account.objects.create(code='11403', name='Persediaan Uji Retur', account_type='asset', classification=asset_cls)
        payable = Account.objects.create(code='21004', name='Hutang Uji Retur', account_type='liability', classification=liability_cls)
        advance = Account.objects.create(code='11703', name='Uang Muka Uji Retur', account_type='asset', classification=asset_cls)
        AccountingSettings.objects.create(
            accounting_start_date=date.today(), is_active=True,
            purchase_inventory_account=inventory, purchase_payable_account=payable,
            purchase_advance_account=advance,
        )

        self.purchase = Purchase.objects.create(
            nomor='PB-RETUR-TEST-1', tanggal=date.today(), dibuat_oleh=self.owner,
            receive_status='diterima', payment_status='lunas', status='selesai',
        )
        PurchaseItem.objects.create(
            purchase=self.purchase, product=self.product, qty=Decimal('5'), harga_beli=Decimal('10000'),
        )

    def test_post_retur_actually_posts_journal_entry(self):
        """Bug #1: sebelum fix, amount selalu 0 -> journal tidak pernah dibuat."""
        create_resp = self.client.post(f'/api/purchases/{self.purchase.id}/create-retur/', {}, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        retur_id = create_resp.data['id']

        add_item_resp = self.client.post(
            f'/api/purchases/{retur_id}/add-item/',
            {'product': self.product.id, 'qty': 2, 'harga_beli': 10000}, format='json',
        )
        self.assertEqual(add_item_resp.status_code, status.HTTP_201_CREATED)

        post_resp = self.client.post(f'/api/purchases/{retur_id}/post-retur/', {}, format='json')
        self.assertEqual(post_resp.status_code, status.HTTP_200_OK)

        entries = JournalEntry.objects.filter(source_type=JournalEntry.SourceType.STOCK_OUT)
        self.assertEqual(entries.count(), 1, 'Jurnal retur stok harus terposting, bukan silently skipped.')
        entry = entries.first()
        total_debit = sum(line.debit for line in entry.lines.all())
        self.assertEqual(total_debit, Decimal('20000'), '2 unit x Rp10.000 = Rp20.000.')

        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('18'), 'Stok harus berkurang 2 (20 - 2).')

    def test_retur_belum_lunas_ditolak_tanpa_konfirmasi_kerusakan(self):
        """Bug #2: PO belum lunas + tanpa konfirmasi kerusakan -> ditolak."""
        self.purchase.payment_status = 'sebagian'
        self.purchase.save(update_fields=['payment_status'])

        resp = self.client.post(f'/api/purchases/{self.purchase.id}/create-retur/', {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('belum lunas', resp.data['error'].lower())

    def test_retur_belum_lunas_diizinkan_dengan_konfirmasi_kerusakan(self):
        """Bug #2 (fix): retur barang cacat boleh sebelum lunas, ASAL ada
        konfirmasi kerusakan -- dan penanggung jawabnya tercatat jelas."""
        self.purchase.payment_status = 'sebagian'
        self.purchase.save(update_fields=['payment_status'])

        resp = self.client.post(
            f'/api/purchases/{self.purchase.id}/create-retur/',
            {'konfirmasi_kerusakan': 'Kemasan penyok, isi produk retak 2 pcs.'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['konfirmasi_kerusakan'], 'Kemasan penyok, isi produk retak 2 pcs.')
        self.assertEqual(resp.data['dibuat_oleh_nama'], self.owner.username)

    def test_retur_belum_diterima_tetap_ditolak(self):
        """receive_status != 'diterima' tetap ditolak apa pun payment_status-nya."""
        self.purchase.receive_status = 'tunda'
        self.purchase.save(update_fields=['receive_status'])

        resp = self.client.post(
            f'/api/purchases/{self.purchase.id}/create-retur/',
            {'konfirmasi_kerusakan': 'Barang cacat'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
