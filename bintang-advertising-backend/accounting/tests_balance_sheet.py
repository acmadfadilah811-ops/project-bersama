"""Neraca (Akuntansi > Neraca) — saldo Aset/Kewajiban/Modal kumulatif per
klasifikasi COA, dari `accounting.JournalEntry`.

Titik kritis: akun kontra (mis. "Akumulasi Penyusutan", "Prive") harus
otomatis bernilai NEGATIF supaya subtotal section flat-sum tetap benar, dan
Neraca harus BALANCE (Total Aset == Total Kewajiban + Modal) setelah baris
"Pendapatan periode ini" ditambahkan ke Modal.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from accounting.models import Account, AccountClassification, AccountingSettings
from accounting.services.journal import create_journal_entry
from accounting.services.ledger import get_balance_sheet, get_cash_flow, get_cash_flow_detail, get_changes_in_equity

User = get_user_model()


class BalanceSheetServiceTest(TestCase):
    def setUp(self):
        self.kas_cls = AccountClassification.objects.create(
            name='Kas & Bank', account_type='asset', code_range_start=11101, code_range_end=11199,
        )
        self.perlengkapan_cls = AccountClassification.objects.create(
            name='Perlengkapan', account_type='asset', code_range_start=11500, code_range_end=11599,
        )
        self.akum_perlengkapan_cls = AccountClassification.objects.create(
            name='Akumulasi penyusutan perlengkapan', account_type='asset',
            code_range_start=11600, code_range_end=11699,
        )
        self.hutang_cls = AccountClassification.objects.create(
            name='Kewajiban Jangka Pendek', account_type='liability', code_range_start=21000, code_range_end=21999,
        )
        self.ekuitas_cls = AccountClassification.objects.create(
            name='Ekuitas', account_type='equity', code_range_start=30000, code_range_end=39999,
        )
        self.pendapatan_cls = AccountClassification.objects.create(
            name='Pendapatan', account_type='revenue', code_range_start=40000, code_range_end=49999,
        )

        self.kas = Account.objects.create(code='11991', name='Kas BS', account_type='asset', classification=self.kas_cls)
        self.peralatan = Account.objects.create(code='11591', name='Peralatan BS', account_type='asset', classification=self.perlengkapan_cls)
        self.akum_penyusutan = Account.objects.create(
            code='11691', name='Akumulasi Penyusutan BS', account_type='asset', is_contra=True,
            classification=self.akum_perlengkapan_cls,
        )
        self.hutang = Account.objects.create(code='21991', name='Hutang BS', account_type='liability', classification=self.hutang_cls)
        self.modal = Account.objects.create(code='31991', name='Modal BS', account_type='equity', classification=self.ekuitas_cls)
        self.prive = Account.objects.create(code='32991', name='Prive BS', account_type='equity', is_contra=True, classification=self.ekuitas_cls)
        self.penjualan = Account.objects.create(code='40991', name='Penjualan BS', account_type='revenue', classification=self.pendapatan_cls)

    def _post(self, debit_account, kredit_account, amount, d=None):
        create_journal_entry(
            date=d or date.today(),
            lines=[
                {'account': debit_account, 'debit': Decimal(amount), 'kredit': 0},
                {'account': kredit_account, 'debit': 0, 'kredit': Decimal(amount)},
            ],
            description='Test BS',
        )

    def test_contra_asset_reduces_subtotal(self):
        # Beli peralatan tunai 1.000.000
        self._post(self.peralatan, self.kas, '1000000')
        # Penyusutan 100.000: Kredit akumulasi penyusutan (lawan: modal, supaya jurnal balance)
        self._post(self.modal, self.akum_penyusutan, '100000')

        result = get_balance_sheet(date.today() - timedelta(days=1), date.today())
        peralatan_row = next(r for r in result['aset_lancar'] if r['code'] == '11591')
        akum_row = next(r for r in result['aset_lancar'] if r['code'] == '11691')
        self.assertEqual(peralatan_row['amount'], Decimal('1000000'))
        self.assertEqual(akum_row['amount'], Decimal('-100000'))

    def test_balance_sheet_balances_after_current_period_income(self):
        # Modal awal 5.000.000 tunai
        self._post(self.kas, self.modal, '5000000')
        # Penjualan tunai 200.000 (menambah kas & laba periode ini)
        self._post(self.kas, self.penjualan, '200000')

        result = get_balance_sheet(date.today(), date.today())
        self.assertEqual(result['total_aset'], result['total_kewajiban_modal'])
        modal_periode_ini = next(r for r in result['modal'] if r['name'] == 'Pendapatan periode ini')
        self.assertEqual(modal_periode_ini['amount'], Decimal('200000'))

    def test_current_period_income_labeled_with_configured_closing_account(self):
        laba_ditahan = Account.objects.create(
            code='31995', name='Laba Ditahan', account_type='equity', classification=self.ekuitas_cls,
        )
        AccountingSettings.objects.create(accounting_start_date=date.today(), closing_account=laba_ditahan)

        self._post(self.kas, self.modal, '5000000')
        self._post(self.kas, self.penjualan, '200000')

        result = get_balance_sheet(date.today(), date.today())
        modal_periode_ini = next(r for r in result['modal'] if 'Pendapatan periode ini' in r['name'])
        self.assertEqual(modal_periode_ini['name'], 'Pendapatan periode ini (Laba Ditahan)')
        self.assertEqual(modal_periode_ini['code'], '31995')
        self.assertEqual(modal_periode_ini['amount'], Decimal('200000'))
        # Baris ini nilai terhitung, bukan mutasi jurnal nyata pada akun closing —
        # id tetap None supaya tidak bisa di-drilldown seolah-olah saldo tercatat.
        self.assertIsNone(modal_periode_ini['id'])

    def test_prive_reduces_equity_subtotal(self):
        self._post(self.kas, self.modal, '1000000')
        self._post(self.prive, self.kas, '150000')

        result = get_balance_sheet(date.today(), date.today())
        prive_row = next(r for r in result['modal'] if r['code'] == '32991')
        self.assertEqual(prive_row['amount'], Decimal('-150000'))

    def test_changes_in_equity_uses_posted_journals_and_income_statement(self):
        period_start = date.today().replace(day=1)
        self._post(self.kas, self.modal, '1000000', period_start - timedelta(days=1))
        self._post(self.kas, self.modal, '500000', period_start)
        self._post(self.prive, self.kas, '100000', period_start)
        self._post(self.kas, self.penjualan, '300000', period_start)

        result = get_changes_in_equity(period_start, period_start)

        self.assertEqual(result['modal_awal'], Decimal('1000000'))
        self.assertEqual(result['investasi_kurun_waktu'], Decimal('500000'))
        self.assertEqual(result['penarikan'], Decimal('100000'))
        self.assertEqual(result['total_laba'], Decimal('300000'))
        self.assertEqual(result['modal_akhir_periode'], Decimal('1700000'))

    def test_cash_flow_reconciles_cash_opening_and_closing_balances(self):
        period_start = date.today().replace(day=1)
        persediaan_cls = AccountClassification.objects.create(
            name='Persediaan', account_type='asset', code_range_start=11400, code_range_end=11499,
        )
        aset_tetap_cls = AccountClassification.objects.create(
            name='Aktiva Tetap', account_type='asset', code_range_start=12000, code_range_end=12999,
        )
        persediaan = Account.objects.create(code='11491', name='Persediaan CF', account_type='asset', classification=persediaan_cls)
        aset_tetap = Account.objects.create(code='12091', name='Aset Tetap CF', account_type='asset', classification=aset_tetap_cls)
        self._post(self.kas, self.modal, '1000000', period_start - timedelta(days=1))
        self._post(self.kas, self.penjualan, '300000', period_start)
        self._post(persediaan, self.kas, '250000', period_start)
        self._post(aset_tetap, self.kas, '200000', period_start)
        self._post(self.kas, self.hutang, '400000', period_start)
        self._post(self.kas, self.modal, '500000', period_start)

        result = get_cash_flow(period_start, period_start)

        self.assertEqual(result['saldo_kas_awal'], Decimal('1000000'))
        self.assertEqual(result['subtotal_operasional'], Decimal('50000'))
        self.assertEqual(result['subtotal_investasi'], Decimal('-200000'))
        self.assertEqual(result['subtotal_pendanaan'], Decimal('900000'))
        self.assertEqual(result['total_kenaikan_kas'], Decimal('750000'))
        self.assertEqual(result['saldo_kas_akhir'], Decimal('1750000'))

    def test_cash_flow_detail_returns_real_cash_lines_with_running_amount(self):
        period_start = date.today().replace(day=1)
        self._post(self.kas, self.penjualan, '25000', period_start)
        self._post(self.kas, self.penjualan, '25000', period_start)

        result = get_cash_flow_detail(period_start, period_start, 'penerimaan_pelanggan', page_size=1)

        self.assertEqual(result['count'], 2)
        self.assertEqual(result['page'], 1)
        self.assertEqual(result['total_pages'], 2)
        self.assertEqual(result['results'][0]['account_code'], '11991')
        self.assertEqual(result['results'][0]['debit'], Decimal('25000'))
        self.assertEqual(result['results'][0]['amount'], Decimal('25000'))

        next_page = get_cash_flow_detail(period_start, period_start, 'penerimaan_pelanggan', page=2, page_size=1)
        self.assertEqual(next_page['page'], 2)
        self.assertEqual(len(next_page['results']), 1)
        self.assertEqual(next_page['results'][0]['amount'], Decimal('50000'))


class BalanceSheetViewTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='bs_owner', password='pw12345', role='owner')
        self.kasir = User.objects.create_user(username='bs_kasir', password='pw12345', role='kasir')
        self.client = APIClient()

        kas_cls = AccountClassification.objects.create(
            name='Kas & Bank', account_type='asset', code_range_start=11101, code_range_end=11199,
        )
        ekuitas_cls = AccountClassification.objects.create(
            name='Ekuitas', account_type='equity', code_range_start=30000, code_range_end=39999,
        )
        self.kas = Account.objects.create(code='11992', name='Kas View BS', account_type='asset', classification=kas_cls)
        self.modal = Account.objects.create(code='31992', name='Modal View BS', account_type='equity', classification=ekuitas_cls)
        create_journal_entry(
            date=date.today(),
            lines=[
                {'account': self.kas, 'debit': Decimal('750000'), 'kredit': 0},
                {'account': self.modal, 'debit': 0, 'kredit': Decimal('750000')},
            ],
            description='Test BS View',
        )

    def test_endpoint_returns_real_data(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/balance-sheet/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = {r['code']: r['amount'] for r in res.data['aset_lancar']}
        self.assertEqual(Decimal(str(rows['11992'])), Decimal('750000'))

    def test_endpoint_rejected_for_non_manager(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.get('/api/accounting/reports/balance-sheet/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_endpoint_returns_real_xlsx_file(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/balance-sheet/export/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        self.assertIn('attachment; filename="neraca-', res['Content-Disposition'])
        self.assertGreater(len(res.content), 0)

    def test_export_endpoint_rejected_for_non_manager(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.get('/api/accounting/reports/balance-sheet/export/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_changes_in_equity_endpoint_returns_real_data(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/changes-in-equity/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res.data['investasi_kurun_waktu'])), Decimal('750000'))

    def test_cash_flow_endpoint_returns_real_data(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/cash-flow/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res.data['saldo_kas_akhir'])), Decimal('750000'))

    def test_cash_flow_detail_endpoint_returns_paginated_rows(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/reports/cash-flow/penambahan_pengambilan_modal/', {
            'date_from': str(date.today()), 'date_to': str(date.today()), 'page': 1,
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['account_code'], '11992')
