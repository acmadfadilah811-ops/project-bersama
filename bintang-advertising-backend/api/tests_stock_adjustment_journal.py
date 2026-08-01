"""Jurnal penyesuaian nilai stok untuk Stok Keluar (non-transfer) dan Opname.

Akun: 11400 Persediaan vs 81000 Penyesuaian Barang. Nilai dihitung dari HPP
FIFO nyata (stock_fifo), bukan harga_beli produk saja.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, JournalEntry
from api.product_models import (
    Product, StockLayer, StockOutDocument, StockOutDocumentItem,
    StockOpnameDocument, StockOpnameDocumentItem,
)

User = get_user_model()


class StockAdjustmentJournalTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_adj', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(nama='Produk Adjustment', qty_stok=Decimal('10'), harga_beli=Decimal('5000'))
        StockLayer.objects.create(
            product=self.product, variant=None, tanggal_masuk=date(2026, 7, 1),
            qty_masuk=Decimal('10'), sisa_qty=Decimal('10'), harga_beli=Decimal('5000'),
            sumber_tipe='saldo_awal', sumber_nomor='SEED',
        )

        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='Penyesuaian Test', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='81000', defaults={'name': 'Penyesuaian Barang Test', 'account_type': 'expense', 'classification': expense})

    def test_stock_out_rusak_posts_adjustment_journal(self):
        document = StockOutDocument.objects.create(nomor='OUT-RUSAK-001', tanggal=date(2026, 7, 30), alasan='rusak', dibuat_oleh=self.owner)
        StockOutDocumentItem.objects.create(document=document, product=self.product, qty=Decimal('3'))

        response = self.client.post(f'/api/stock-out-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('7'))
        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_OUT, source_id=document.id)
        total = sum(line.debit for line in entry.lines.all())
        self.assertEqual(total, Decimal('15000'))  # 3 x 5000 HPP FIFO

    def test_stock_out_transfer_does_not_post_journal(self):
        document = StockOutDocument.objects.create(nomor='OUT-TRANSFER-001', tanggal=date(2026, 7, 30), alasan='transfer', dibuat_oleh=self.owner)
        StockOutDocumentItem.objects.create(document=document, product=self.product, qty=Decimal('2'))

        response = self.client.post(f'/api/stock-out-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.STOCK_OUT, source_id=document.id).exists())

    def test_stock_out_journal_idempotent(self):
        document = StockOutDocument.objects.create(nomor='OUT-IDEMPOTEN-001', tanggal=date(2026, 7, 30), alasan='rusak', dibuat_oleh=self.owner)
        StockOutDocumentItem.objects.create(document=document, product=self.product, qty=Decimal('1'))
        self.client.post(f'/api/stock-out-documents/{document.id}/post-document/', {}, format='json')

        second = self.client.post(f'/api/stock-out-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)  # sudah 'selesai'
        self.assertEqual(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.STOCK_OUT, source_id=document.id).count(), 1)

    def test_opname_defisit_posts_journal(self):
        document = StockOpnameDocument.objects.create(nomor='OPN-DEFISIT-001', tanggal=date(2026, 7, 30), dibuat_oleh=self.owner)
        StockOpnameDocumentItem.objects.create(document=document, product=self.product, stok_sistem=Decimal('10'), stok_aktual=Decimal('6'))

        response = self.client.post(f'/api/stock-opname-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal('6'))
        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_OPNAME, source_id=document.id)
        total_debit = sum(line.debit for line in entry.lines.all())
        total_kredit = sum(line.kredit for line in entry.lines.all())
        self.assertEqual(total_debit, total_kredit)
        self.assertEqual(total_debit, Decimal('20000'))  # 4 unit x 5000 HPP FIFO

    def test_opname_surplus_posts_journal(self):
        document = StockOpnameDocument.objects.create(nomor='OPN-SURPLUS-001', tanggal=date(2026, 7, 30), dibuat_oleh=self.owner)
        StockOpnameDocumentItem.objects.create(document=document, product=self.product, stok_sistem=Decimal('10'), stok_aktual=Decimal('13'))

        response = self.client.post(f'/api/stock-opname-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_OPNAME, source_id=document.id)
        total_debit = sum(line.debit for line in entry.lines.all())
        self.assertEqual(total_debit, Decimal('15000'))  # 3 unit surplus x 5000 harga_beli produk

    def test_opname_no_change_does_not_post_journal(self):
        document = StockOpnameDocument.objects.create(nomor='OPN-SAMA-001', tanggal=date(2026, 7, 30), dibuat_oleh=self.owner)
        StockOpnameDocumentItem.objects.create(document=document, product=self.product, stok_sistem=Decimal('10'), stok_aktual=Decimal('10'))

        response = self.client.post(f'/api/stock-opname-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.STOCK_OPNAME, source_id=document.id).exists())
