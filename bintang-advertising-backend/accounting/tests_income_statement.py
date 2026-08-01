"""Laba Rugi (Akuntansi > Laba Rugi Satu/Multi Periode) — dihitung dari
`accounting.JournalEntry` per klasifikasi COA, bukan kode akun hardcode.

Titik kritis yang dibuktikan: akun kontra (mis. "Return Penjualan" di
klasifikasi Pendapatan tapi account_type revenue dengan is_contra=True) harus
otomatis bernilai NEGATIF supaya subtotal section bisa dijumlah rata (flat
sum) tanpa perlakuan khusus di frontend — sesuai desain UI lama.
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from accounting.models import Account, AccountClassification
from accounting.services.journal import create_journal_entry
from accounting.services.ledger import get_income_statement

User = get_user_model()


class IncomeStatementServiceTest(TestCase):
    def setUp(self):
        self.pendapatan_cls = AccountClassification.objects.create(
            name='Pendapatan', account_type='revenue', code_range_start=40000, code_range_end=49999,
        )
        self.hpp_cls = AccountClassification.objects.create(
            name='Harga Pokok Penjualan', account_type='expense', code_range_start=50000, code_range_end=59999,
        )
        self.pengeluaran_cls = AccountClassification.objects.create(
            name='Pengeluaran', account_type='expense', code_range_start=60000, code_range_end=69999,
        )
        self.kas_cls = AccountClassification.objects.create(
            name='Kas & Bank IS', account_type='asset', code_range_start=10000, code_range_end=19999,
        )

        self.penjualan = Account.objects.create(
            code='40991', name='Penjualan IS', account_type='revenue', classification=self.pendapatan_cls,
        )
        self.return_penjualan = Account.objects.create(
            code='46991', name='Return Penjualan IS', account_type='revenue', is_contra=True,
            classification=self.pendapatan_cls,
        )
        self.hpp = Account.objects.create(
            code='51991', name='HPP IS', account_type='expense', classification=self.hpp_cls,
        )
        self.gaji = Account.objects.create(
            code='60991', name='Biaya Gaji IS', account_type='expense', classification=self.pengeluaran_cls,
        )
        self.kas = Account.objects.create(
            code='11991', name='Kas IS', account_type='asset', classification=self.kas_cls,
        )

    def _post(self, debit_account, kredit_account, amount, d=None):
        create_journal_entry(
            date=d or date.today(),
            lines=[
                {'account': debit_account, 'debit': Decimal(amount), 'kredit': 0},
                {'account': kredit_account, 'debit': 0, 'kredit': Decimal(amount)},
            ],
            description='Test IS',
        )

    def test_revenue_and_contra_revenue_net_correctly(self):
        # Penjualan Rp 500.000 (Dr Kas / Kr Penjualan)
        self._post(self.kas, self.penjualan, '500000')
        # Return Penjualan Rp 50.000 (Dr Return Penjualan / Kr Kas) — akun
        # kontra menerima entri di sisi "salah" (debit) untuk revenue.
        self._post(self.return_penjualan, self.kas, '50000')

        result = get_income_statement(date.today(), date.today())
        pendapatan_rows = {r['code']: r['amount'] for r in result['pendapatan']}
        self.assertEqual(pendapatan_rows['40991'], Decimal('500000'))
        self.assertEqual(pendapatan_rows['46991'], Decimal('-50000'))
        # Subtotal = flat sum, otomatis net 450.000 karena kontra sudah negatif.
        self.assertEqual(result['subtotal_pendapatan'], Decimal('450000'))

    def test_gross_and_net_profit_calculation(self):
        self._post(self.kas, self.penjualan, '1000000')
        self._post(self.hpp, self.kas, '400000')
        self._post(self.gaji, self.kas, '150000')

        result = get_income_statement(date.today(), date.today())
        self.assertEqual(result['subtotal_pendapatan'], Decimal('1000000'))
        self.assertEqual(result['subtotal_hpp'], Decimal('400000'))
        self.assertEqual(result['total_laba_kotor'], Decimal('600000'))
        self.assertEqual(result['total_biaya_operasional'], Decimal('150000'))
        self.assertEqual(result['laba_bersih'], Decimal('450000'))

    def test_outside_date_range_excluded(self):
        self._post(self.kas, self.penjualan, '999999', d=date(2020, 1, 1))
        result = get_income_statement(date.today(), date.today())
        self.assertEqual(result['subtotal_pendapatan'], Decimal('0'))


class IncomeStatementViewTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='is_owner', password='pw12345', role='owner')
        self.kasir = User.objects.create_user(username='is_kasir', password='pw12345', role='kasir')
        self.client = APIClient()

        cls = AccountClassification.objects.create(
            name='Pendapatan', account_type='revenue', code_range_start=40000, code_range_end=49999,
        )
        kas_cls = AccountClassification.objects.create(
            name='Kas & Bank IS View', account_type='asset', code_range_start=10000, code_range_end=19999,
        )
        self.penjualan = Account.objects.create(code='40992', name='Penjualan View', account_type='revenue', classification=cls)
        self.kas = Account.objects.create(code='11992', name='Kas View', account_type='asset', classification=kas_cls)
        create_journal_entry(
            date=date.today(),
            lines=[
                {'account': self.kas, 'debit': Decimal('200000'), 'kredit': 0},
                {'account': self.penjualan, 'debit': 0, 'kredit': Decimal('200000')},
            ],
            description='Test IS View',
        )

    def test_endpoint_returns_real_data(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/income-statement/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = {r['code']: r['amount'] for r in res.data['pendapatan']}
        self.assertEqual(Decimal(str(rows['40992'])), Decimal('200000'))

    def test_endpoint_rejected_for_non_manager(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.get('/api/accounting/reports/income-statement/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_endpoint_returns_real_xlsx_file(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/income-statement/export/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        self.assertIn('attachment; filename="laba-rugi-', res['Content-Disposition'])
        self.assertGreater(len(res.content), 0)

    def test_export_endpoint_rejected_for_non_manager(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.get('/api/accounting/reports/income-statement/export/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
