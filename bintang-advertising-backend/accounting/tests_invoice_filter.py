"""Filter Invoice (`GET /accounting/journal-entries/`) — kategori transaksi.

Invoice.jsx (frontend) memetakan 16 label kategori Indonesia ke kombinasi
source_type/is_reversal/description_prefix di sini. Test ini membuktikan
kontrak filter itu benar-benar memisahkan data, termasuk retur (jurnal
pembalik via `reversed_entry`) dan Pendapatan vs Pengeluaran (dibedakan lewat
awalan description, karena `cash_transaction` tidak punya source_type
terpisah untuk arahnya).
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.test import TestCase

from accounting.models import Account, AccountClassification, JournalEntry
from accounting.services.journal import create_journal_entry

User = get_user_model()


class InvoiceFilterTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='invoice_owner', password='pw12345', role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        asset_cls = AccountClassification.objects.create(
            name='Kas Test IF', account_type='asset', code_range_start=10000, code_range_end=19999,
        )
        revenue_cls = AccountClassification.objects.create(
            name='Penjualan Test IF', account_type='revenue', code_range_start=40000, code_range_end=49999,
        )
        self.kas = Account.objects.create(code='11991', name='Kas IF', account_type='asset', classification=asset_cls)
        self.penjualan = Account.objects.create(code='41991', name='Penjualan IF', account_type='revenue', classification=revenue_cls)

    def _post(self, source_type, amount='100000', description='Test'):
        return create_journal_entry(
            date=date.today(),
            lines=[
                {'account': self.kas, 'debit': Decimal(amount), 'kredit': 0, 'description': description},
                {'account': self.penjualan, 'debit': 0, 'kredit': Decimal(amount), 'description': description},
            ],
            description=description,
            source_type=source_type,
        )

    def _list(self, **params):
        params.setdefault('date_from', str(date.today()))
        params.setdefault('date_to', str(date.today()))
        res = self.client.get('/api/accounting/journal-entries/', params)
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        return payload['results'] if isinstance(payload, dict) else payload

    def test_source_type_filters_to_matching_entries_only(self):
        self._post('pos_sale', description='POS-A')
        self._post('purchase', description='PURCHASE-A')
        rows = self._list(source_type='pos_sale')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['source_type'], 'pos_sale')

    def test_source_type_accepts_comma_separated_list(self):
        self._post('pos_sale', description='POS-B')
        self._post('order_payment', description='ORDER-B')
        self._post('purchase', description='PURCHASE-B')
        rows = self._list(source_type='pos_sale,order_payment')
        self.assertEqual(len(rows), 2)
        self.assertEqual({r['source_type'] for r in rows}, {'pos_sale', 'order_payment'})

    def test_is_reversal_separates_original_from_retur(self):
        original = self._post('pos_sale', description='POS-ASLI')
        reversal = create_journal_entry(
            date=date.today(),
            lines=[
                {'account': self.penjualan, 'debit': Decimal('100000'), 'kredit': 0, 'description': 'Retur POS-ASLI'},
                {'account': self.kas, 'debit': 0, 'kredit': Decimal('100000'), 'description': 'Retur POS-ASLI'},
            ],
            description='Retur POS-ASLI',
            source_type='pos_sale',
        )
        reversal.reversed_entry = original
        reversal.save(update_fields=['reversed_entry'])

        original_only = self._list(source_type='pos_sale', is_reversal='false')
        self.assertEqual([r['entry_number'] for r in original_only], [original.entry_number])

        retur_only = self._list(source_type='pos_sale', is_reversal='true')
        self.assertEqual([r['entry_number'] for r in retur_only], [reversal.entry_number])

    def test_description_prefix_separates_pendapatan_vs_pengeluaran(self):
        self._post('cash_transaction', description='Pendapatan CTX-0001')
        self._post('cash_transaction', description='Pengeluaran CTX-0002')

        pendapatan = self._list(source_type='cash_transaction', description_prefix='Pendapatan')
        self.assertEqual(len(pendapatan), 1)
        self.assertTrue(pendapatan[0]['description'].startswith('Pendapatan'))

        pengeluaran = self._list(source_type='cash_transaction', description_prefix='Pengeluaran')
        self.assertEqual(len(pengeluaran), 1)
        self.assertTrue(pengeluaran[0]['description'].startswith('Pengeluaran'))
