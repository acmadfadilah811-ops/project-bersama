"""Akses Admin Finance & SPV Finance ke fitur akuntansi yang sudah ada
(Pengadaan, Pendapatan/Pengeluaran, Laporan Keuangan, Riwayat Payroll).
Instruksi user 2026-09-24 -- backend-nya SUDAH lengkap sebelumnya, cuma
permission_classes yang membatasi ke owner/manager/admin saja. Keputusan
user: Admin Finance boleh buat & setujui pengadaan penuh; Tutup Buku
TETAP eksklusif Owner/Manager (tidak disentuh di sini)."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.product_models import Purchase

User = get_user_model()


class PurchaseAksesFinanceTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pf', password='secret', role='owner')
        self.admin_finance = User.objects.create_user(username='adminfin_pf', password='secret', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='spvfin_pf', password='secret', role='spv_finance')
        self.staff = User.objects.create_user(username='staff_pf', password='secret', role='staff')
        self.purchase = Purchase.objects.create(nomor='PO-PF-0001', tanggal=date(2026, 9, 24), dibuat_oleh=self.owner)

    def test_admin_finance_bisa_lihat_daftar_pembelian(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/purchases/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_admin_finance_bisa_buat_pembelian(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post('/api/purchases/', {
            'tanggal': '2026-09-24', 'supplier': 'Supplier PF Test',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

    def test_admin_finance_bisa_ubah_pembelian(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.patch(f'/api/purchases/{self.purchase.id}/', {'catatan': 'diubah admin finance'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)

    def test_spv_finance_hanya_baca_tidak_bisa_buat_pembelian(self):
        self.client.force_authenticate(self.spv_finance)
        res_get = self.client.get('/api/purchases/')
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        res_post = self.client.post('/api/purchases/', {
            'tanggal': '2026-09-24', 'supplier': 'Supplier PF Test 2',
        }, format='json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_tetap_tidak_bisa_buat_pembelian(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post('/api/purchases/', {
            'tanggal': '2026-09-24', 'supplier': 'Supplier PF Test 3',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_finance_bisa_akses_purchase_workflow_logs(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get(f'/api/purchases/{self.purchase.id}/workflow/logs/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class CashTransactionTypeAksesFinanceTests(APITestCase):
    def setUp(self):
        self.admin_finance = User.objects.create_user(username='adminfin_ctt', password='secret', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='spvfin_ctt', password='secret', role='spv_finance')
        self.staff = User.objects.create_user(username='staff_ctt', password='secret', role='staff')

    def test_admin_finance_bisa_lihat_dan_buat_tipe_transaksi(self):
        self.client.force_authenticate(self.admin_finance)
        res_get = self.client.get('/api/cash-transaction-types/')
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        res_post = self.client.post('/api/cash-transaction-types/', {'nama': 'Listrik PF', 'tipe': 'pengeluaran'})
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED, res_post.content)

    def test_spv_finance_bisa_lihat_tipe_transaksi(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/cash-transaction-types/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_tetap_tidak_bisa(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get('/api/cash-transaction-types/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class ExportCashTransactionsAksesFinanceTests(APITestCase):
    def setUp(self):
        self.admin_finance = User.objects.create_user(username='adminfin_exp', password='secret', role='admin_finance')
        self.staff = User.objects.create_user(username='staff_exp', password='secret', role='staff')

    def test_admin_finance_bisa_ekspor(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/export/cash-transactions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_tidak_bisa_ekspor(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get('/api/export/cash-transactions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class LaporanAkuntansiAksesFinanceTests(APITestCase):
    """Laba Rugi/Neraca/Arus Kas/Buku Besar -- read-only, tidak butuh data
    jurnal nyata untuk membuktikan permission-nya, cukup pastikan bukan 403."""

    def setUp(self):
        self.admin_finance = User.objects.create_user(username='adminfin_lap', password='secret', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='spvfin_lap', password='secret', role='spv_finance')
        self.staff = User.objects.create_user(username='staff_lap', password='secret', role='staff')

    def test_admin_finance_bisa_akses_laba_rugi(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/accounting/reports/income-statement/', {
            'start_date': '2026-09-01', 'end_date': '2026-09-24',
        })
        self.assertNotEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_spv_finance_bisa_akses_neraca(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/accounting/reports/balance-sheet/', {'as_of_date': '2026-09-24'})
        self.assertNotEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_tetap_ditolak_laba_rugi(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get('/api/accounting/reports/income-statement/', {
            'start_date': '2026-09-01', 'end_date': '2026-09-24',
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_finance_bisa_akses_ringkasan_buku_besar(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/accounting/ledger/', {
            'start_date': '2026-09-01', 'end_date': '2026-09-24',
        })
        self.assertNotEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_finance_bisa_baca_daftar_akun_tapi_tidak_bisa_tambah(self):
        self.client.force_authenticate(self.admin_finance)
        res_get = self.client.get('/api/accounting/accounts/')
        self.assertNotEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)
        res_post = self.client.post('/api/accounting/accounts/', {
            'code': '99999', 'name': 'Akun Percobaan PF', 'account_type': 'expense',
        }, format='json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)


class PayrollRiwayatAksesFinanceTests(APITestCase):
    def setUp(self):
        self.admin_finance = User.objects.create_user(username='adminfin_pr', password='secret', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='spvfin_pr', password='secret', role='spv_finance')
        self.staff = User.objects.create_user(username='staff_pr', password='secret', role='staff')

    def test_admin_finance_bisa_lihat_riwayat_payroll(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/accounting/payroll/riwayat/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_spv_finance_bisa_lihat_riwayat_payroll(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/accounting/payroll/riwayat/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_admin_finance_tidak_bisa_posting_payroll(self):
        """Kritis: Admin Finance boleh LIHAT riwayat, tapi TIDAK boleh
        memicu posting -- itu murni Owner/Manager (Aturan M2)."""
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post('/api/accounting/payroll/posting/', {'tahun': 2026, 'bulan': 9}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_tidak_bisa_lihat_riwayat_payroll(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get('/api/accounting/payroll/riwayat/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
