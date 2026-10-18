"""Kasir unit lain tidak melihat data StarFoto; Ringkasan Shift bisa disaring per unit (2026-10-18)."""
from decimal import Decimal

from rest_framework.test import APIClient

from .models import CustomUser, UnitBisnis
from .pos_models import RingkasanShift
from .tests_starfoto import _Dasar


class KasirUnitSesiFotoTests(_Dasar):
    def setUp(self):
        super().setUp()
        self.adv = UnitBisnis.objects.create(nama='Star Advertising Uji')
        self.kasir_adv = CustomUser.objects.create_user(
            username='kasir.adv', password='x', role='kasir', unit_bisnis=self.adv, email='ka@x.id',
        )
        self.kasir_tanpa_unit = CustomUser.objects.create_user(
            username='kasir.nu', password='x', role='kasir', email='kn@x.id',
        )

    def test_kasir_unit_lain_tidak_melihat_pesanan_foto(self):
        pesanan, _sesi = self._pesanan_siap_konfirmasi()
        self.client.force_authenticate(self.kasir)
        ada = self.client.get('/api/starfoto/pesanan/', secure=True).json()
        self.assertTrue(any(p['id'] == pesanan.id for p in ada))
        for lain in (self.kasir_adv, self.kasir_tanpa_unit):
            self.client.force_authenticate(lain)
            res = self.client.get('/api/starfoto/pesanan/', secure=True)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json(), [])
            self.assertEqual(self.client.get('/api/starfoto/approval-tertunda/', secure=True).json(), [])
            self.assertEqual(self.client.get('/api/starfoto/jadwal/', secure=True).json(), [])

    def test_ringkasan_shift_filter_unit(self):
        RingkasanShift.objects.create(kasir=self.kasir, expected=Decimal('1'), aktual=Decimal('1'), selisih=0)
        RingkasanShift.objects.create(kasir=self.kasir_adv, expected=Decimal('2'), aktual=Decimal('2'), selisih=0)
        api = APIClient()
        api.force_authenticate(self.owner if hasattr(self, 'owner') else CustomUser.objects.create_user(
            username='own.ks', password='x', role='owner', email='ow@x.id'))
        semua = api.get('/api/ringkasan-shift/', secure=True).json()
        semua = semua['results'] if isinstance(semua, dict) else semua
        self.assertEqual(len(semua), 2)
        hanya = api.get('/api/ringkasan-shift/', {'unit_bisnis': self.adv.id}, secure=True).json()
        hanya = hanya['results'] if isinstance(hanya, dict) else hanya
        self.assertEqual([r['kasir_nama'] for r in hanya], ['kasir.adv'])
        self.assertEqual(hanya[0]['unit_bisnis_nama'], 'Star Advertising Uji')
