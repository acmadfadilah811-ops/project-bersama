"""Tugas Admin Finance (2026-09-24): rekap penjualan hari sebelumnya, laporan
penjualan, ringkasan shift, produk & inventori, pelanggan & supplier.

Admin/SPV Finance boleh BACA data POS & shift dan mengekspor data penjualan/
stok/pelanggan; semua aksi tulis POS tetap milik owner/manager/admin/kasir."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

User = get_user_model()

EKSPOR_KEUANGAN = [
    '/api/export/orders/', '/api/export/inventory/', '/api/export/stock-movement/',
    '/api/export/products/', '/api/export/customers/', '/api/export/customer-notes/',
    '/api/export/sales-items-by-brand/', '/api/export/sales-details/',
]
EKSPOR_MANAJERIAL = [
    '/api/export/contacts/', '/api/export/jobs/', '/api/export/absensi/', '/api/export/staff-performance/',
]


class AdminFinanceTugasTests(APITestCase):
    def setUp(self):
        self.admin_finance = User.objects.create_user(username='af_tugas', password='x', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='sf_tugas', password='x', role='spv_finance')
        self.kasir = User.objects.create_user(username='kasir_tugas', password='x', role='kasir')
        self.staff = User.objects.create_user(username='staff_tugas', password='x', role='staff')
        self.kemarin = str(timezone.localdate() - timedelta(days=1))

    def _get(self, user, url):
        self.client.force_authenticate(user)
        return self.client.get(url)

    def test_finance_boleh_baca_rekap_harian_riwayat_pos_dan_daftar_shift(self):
        for user in (self.admin_finance, self.spv_finance):
            for url in (
                f'/api/pos/sales/rekap-harian/?tanggal={self.kemarin}',
                '/api/pos/sales/',
                '/api/saldo-kas-harian/',
                '/api/ringkasan-shift/',
            ):
                res = self._get(user, url)
                self.assertEqual(res.status_code, 200, f'{user.role} {url} -> {res.status_code}')

    def test_finance_tidak_boleh_menulis_pos_atau_shift(self):
        self.client.force_authenticate(self.admin_finance)
        self.assertEqual(self.client.post('/api/pos/sales/', {'items': []}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/api/pos/sales/verify-passkey/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/api/saldo-kas-harian/', {'kas_awal': 1000}, format='json').status_code, 403)

    def test_finance_boleh_ekspor_data_keuangan_tapi_bukan_data_sdm(self):
        for user in (self.admin_finance, self.spv_finance):
            for url in EKSPOR_KEUANGAN:
                self.assertNotEqual(self._get(user, url).status_code, 403, f'{user.role} {url}')
            for url in EKSPOR_MANAJERIAL:
                self.assertEqual(self._get(user, url).status_code, 403, f'{user.role} {url}')

    def test_kasir_dan_staff_tetap_tidak_boleh_ekspor(self):
        for user in (self.kasir, self.staff):
            for url in EKSPOR_KEUANGAN + EKSPOR_MANAJERIAL:
                self.assertEqual(self._get(user, url).status_code, 403, f'{user.role} {url}')

    def test_staff_tetap_tidak_boleh_baca_pos_dan_shift(self):
        for url in ('/api/pos/sales/', '/api/saldo-kas-harian/'):
            self.assertEqual(self._get(self.staff, url).status_code, 403, url)

    def test_finance_boleh_baca_area_produk_inventori_pelanggan_supplier_pembelian_laporan(self):
        for url in (
            '/api/products/', '/api/inventory/', '/api/product-stock-movements/', '/api/stock-in-documents/',
            '/api/stock-opname-documents/', '/api/customers/', '/api/suppliers/', '/api/purchases/',
            '/api/reports/penjualan-paket/',
        ):
            res = self._get(self.admin_finance, url)
            self.assertEqual(res.status_code, 200, f'{url} -> {res.status_code}')
