"""Rekap harian kasir (Ringkasan Shift v2) dipisah per unit bisnis (2026-10-14)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import UnitBisnis
from .pos_models import POSSale

URL = '/api/pos/sales/rekap-harian/'


class RekapHarianUnitTests(APITestCase):
    def setUp(self):
        U = get_user_model()
        self.foto = UnitBisnis.objects.get_or_create(nama='StarFoto')[0]
        self.adv = UnitBisnis.objects.get_or_create(nama='Star Advertising')[0]
        self.k_foto = U.objects.create_user(username='kf_rekap', password='x12345678', role='kasir', email='kf@uji.test', unit_bisnis=self.foto)
        self.k_adv = U.objects.create_user(username='ka_rekap', password='x12345678', role='kasir', email='ka@uji.test', unit_bisnis=self.adv)
        self.owner = U.objects.create_user(username='own_rekap', password='x12345678', role='owner', email='own_rekap@uji.test')
        POSSale.objects.create(nomor='R-F1', total=Decimal('10000'), status='paid', kasir=self.k_foto, unit_bisnis=self.foto, metode_bayar='Cash')
        POSSale.objects.create(nomor='R-A1', total=Decimal('25000'), status='paid', kasir=self.k_adv, unit_bisnis=self.adv, metode_bayar='Cash')
        POSSale.objects.create(nomor='R-A2', total=Decimal('5000'), status='paid', kasir=self.k_adv, unit_bisnis=self.adv, metode_bayar='QRIS')

    def _get(self, user, param=''):
        self.client.force_authenticate(user)
        res = self.client.get(URL + param)
        self.assertEqual(res.status_code, 200)
        return res.json()

    def test_kasir_hanya_melihat_unitnya(self):
        data = self._get(self.k_foto)
        self.assertEqual(Decimal(str(data['ringkasan']['total_penjualan'])), Decimal('10000'))
        self.assertEqual(data['unit_bisnis_kasir'], 'StarFoto')
        data = self._get(self.k_adv)
        self.assertEqual(Decimal(str(data['ringkasan']['total_penjualan'])), Decimal('30000'))
        self.assertEqual(data['ringkasan']['jumlah_transaksi'], 2)

    def test_owner_melihat_semua_dengan_rincian_per_unit(self):
        data = self._get(self.owner)
        self.assertEqual(Decimal(str(data['ringkasan']['total_penjualan'])), Decimal('40000'))
        per_unit = {u['nama']: u for u in data['per_unit']}
        self.assertEqual(Decimal(str(per_unit['StarFoto']['total_penjualan'])), Decimal('10000'))
        self.assertEqual(per_unit['Star Advertising']['jumlah_transaksi'], 2)

    def test_owner_bisa_memilih_satu_unit(self):
        data = self._get(self.owner, f'?unit_bisnis={self.adv.id}')
        self.assertEqual(Decimal(str(data['ringkasan']['total_penjualan'])), Decimal('30000'))


class PosSaleFilterUnitTests(RekapHarianUnitTests):
    """?unit_bisnis= pada /pos/sales/ membuang transaksi yang belum bertanda unit (Pesanan & Pelunasan kasir StarFoto)."""

    def test_kasir_starfoto_strict_tanpa_transaksi_tak_bertanda(self):
        POSSale.objects.create(nomor='R-NULL', total=Decimal('1000'), status='paid', metode_bayar='Cash')
        self.client.force_authenticate(self.k_foto)
        semua = {s['nomor'] for s in self.client.get('/api/pos/sales/?page=1&page_size=100').json()['results']}
        self.assertEqual(semua, {'R-F1', 'R-NULL'})
        strict = {s['nomor'] for s in self.client.get(f'/api/pos/sales/?page=1&page_size=100&unit_bisnis={self.foto.id}').json()['results']}
        self.assertEqual(strict, {'R-F1'})
