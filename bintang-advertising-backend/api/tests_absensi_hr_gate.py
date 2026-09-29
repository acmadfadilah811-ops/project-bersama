"""Gerbang absensi HR (2026-09-29): staff wajib absen masuk di HR sebelum
bisa login/memakai Bintang. Panggilan ke HR di-mock (_tanya_hr)."""

from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import CustomUser

TANYA = 'api.services.absensi_hr_gate._tanya_hr'


def jawab(status):
    return {'applicable': True, 'status': status, 'jam_masuk': '08:00:00', 'jam_pulang': '17:00:00'}


@override_settings(ABSENSI_HR_GATE_AKTIF=True, SECURE_SSL_REDIRECT=False)
class GerbangAbsensiHRTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.staff = CustomUser.objects.create_user(
            username='staff.absen', password='Rahasia123!', role='staff', hr_employee_id=501,
        )
        self.owner = CustomUser.objects.create_user(username='owner.absen', password='Rahasia123!', role='owner')

    def _login(self, username):
        return self.client.post('/api/auth/login/', {'username': username, 'password': 'Rahasia123!'}, secure=True)

    def test_login_ditolak_kalau_belum_absen(self):
        with mock.patch(TANYA, return_value=jawab('belum')):
            res = self._login('staff.absen')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['code'], 'belum_absen_hr')
        self.assertIn('belum absen masuk', res.data['detail'])

    def test_login_ditolak_kalau_sudah_pulang(self):
        with mock.patch(TANYA, return_value=jawab('pulang')):
            res = self._login('staff.absen')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['status_absen'], 'pulang')

    def test_login_boleh_kalau_sudah_masuk(self):
        with mock.patch(TANYA, return_value=jawab('masuk')):
            res = self._login('staff.absen')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)

    def test_owner_bebas_tanpa_tanya_hr(self):
        with mock.patch(TANYA) as tanya:
            res = self._login('owner.absen')
        self.assertEqual(res.status_code, 200)
        tanya.assert_not_called()

    def test_token_lama_ditolak_setelah_absen_pulang(self):
        self.client.force_authenticate(user=None)
        with mock.patch(TANYA, return_value=jawab('masuk')):
            akses = self._login('staff.absen').data['access']
        cache.clear()
        with mock.patch(TANYA, return_value=jawab('pulang')):
            res = self.client.get('/api/users/me/', HTTP_AUTHORIZATION=f'Bearer {akses}', secure=True)
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['code'], 'belum_absen_hr')

    def test_logout_tetap_bisa_walau_terkunci(self):
        with mock.patch(TANYA, return_value=jawab('masuk')):
            data = self._login('staff.absen').data
        cache.clear()
        with mock.patch(TANYA, return_value=jawab('pulang')):
            res = self.client.post(
                '/api/auth/logout/', {'refresh': data['refresh']},
                HTTP_AUTHORIZATION=f"Bearer {data['access']}", secure=True,
            )
        self.assertNotEqual(res.status_code, 403)

    def test_hr_tidak_bisa_dihubungi_fail_open(self):
        with mock.patch(TANYA, return_value=None):
            res = self._login('staff.absen')
        self.assertEqual(res.status_code, 200)

    def test_akun_belum_terhubung_hr_ditolak(self):
        CustomUser.objects.create_user(username='kasir.lepas', password='Rahasia123!', role='kasir')
        with mock.patch(TANYA) as tanya:
            res = self._login('kasir.lepas')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['status_absen'], 'tidak_terhubung')
        tanya.assert_not_called()

    def test_dibuka_manajer_boleh_walau_belum_absen(self):
        Absensi.objects.create(staff=self.staff, tanggal=timezone.localdate(), workspace_unlocked=True)
        with mock.patch(TANYA, return_value=jawab('belum')):
            res = self._login('staff.absen')
        self.assertEqual(res.status_code, 200)

    def test_status_masuk_dicache_status_terkunci_tidak(self):
        with mock.patch(TANYA, return_value=jawab('belum')) as tanya:
            self._login('staff.absen')
            self._login('staff.absen')
        self.assertEqual(tanya.call_count, 2)


class GerbangMatiTest(APITestCase):
    """Saklar mati (default, dan selalu mati saat tes lain) -> perilaku lama."""

    def test_login_tanpa_tanya_hr(self):
        CustomUser.objects.create_user(username='staff.lama', password='Rahasia123!', role='staff')
        with mock.patch(TANYA) as tanya:
            res = self.client.post(
                '/api/auth/login/', {'username': 'staff.lama', 'password': 'Rahasia123!'}, secure=True,
            )
        self.assertEqual(res.status_code, 200)
        tanya.assert_not_called()
