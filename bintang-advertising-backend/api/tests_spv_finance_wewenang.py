"""Wewenang SPV Finance (keputusan user 2026-09-24): seluruh akuntansi (termasuk
Tutup Buku) + fitur owner -- produk/inventori, marketing, pelanggan/supplier,
transaksi, laporan, pengaturan POS -- dan Permintaan Bahan. Admin Finance tetap
dibatasi; role lain tidak ikut terbuka."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.services import material_requisition as mr

User = get_user_model()


class SpvFinanceWewenangTests(APITestCase):
    def setUp(self):
        self.spv_fin = User.objects.create_user(username='spvfin_w', password='x', role='spv_finance')
        self.admin_fin = User.objects.create_user(username='adminfin_w', password='x', role='admin_finance')
        self.staff = User.objects.create_user(username='staff_w', password='x', role='staff')

    def _post(self, user, url, data=None):
        self.client.force_authenticate(user)
        return self.client.post(url, data or {}, format='json')

    def test_spv_finance_boleh_menulis_produk_marketing_inventori(self):
        for url in ('/api/products/', '/api/product-categories/', '/api/inventory/'):
            res = self._post(self.spv_fin, url)
            self.assertNotEqual(res.status_code, 403, f'{url} -> {res.status_code}')

    def test_spv_finance_boleh_akses_akuntansi_termasuk_periode(self):
        self.client.force_authenticate(self.spv_fin)
        for url in ('/api/accounting/accounts/', '/api/accounting/periods/', '/api/accounting/settings/'):
            res = self.client.get(url)
            self.assertNotIn(res.status_code, (401, 403), f'{url} -> {res.status_code}')

    def test_spv_finance_boleh_ubah_pengaturan_pos(self):
        self.client.force_authenticate(self.spv_fin)
        res = self.client.post('/api/pos-payment-methods/', {}, format='json')
        self.assertNotEqual(res.status_code, 403)

    def test_role_lain_tetap_tertutup(self):
        for user in (self.admin_fin, self.staff):
            self.assertEqual(self._post(user, '/api/products/').status_code, 403, user.role)
            self.assertEqual(self._post(user, '/api/pos-payment-methods/').status_code, 403, user.role)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get('/api/accounting/accounts/').status_code, 403)

    def test_spv_finance_bisa_menyetujui_permintaan_bahan(self):
        class Req:
            pemohon_id = self.staff.id
            status = 'diajukan'
        self.assertTrue(mr.boleh_menyetujui(self.spv_fin, Req()))
        self.assertIn('spv_finance', mr.ROLE_GUDANG)
