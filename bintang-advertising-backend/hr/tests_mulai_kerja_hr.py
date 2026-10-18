"""Mulai Kerja di ERP butuh absen masuk di HR; SPV/Kordiv tidak dikunci batas waktu (2026-10-18)."""
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from api.models import CustomUser
from hr.models import DailyAttendanceSession


class MulaiKerjaHrTests(APITestCase):
    def setUp(self):
        self.staff = CustomUser.objects.create_user(
            username='stf.hr', password='x', role='staff', email='s@x.id', hr_employee_id=101)
        self.kordiv = CustomUser.objects.create_user(
            username='kdv.hr', password='x', role='kordiv', email='k@x.id', hr_employee_id=102)
        self.sesi, _ = DailyAttendanceSession.objects.update_or_create(
            tanggal=timezone.localdate(),
            defaults={
                'waktu_mulai': timezone.now() - timedelta(hours=5),
                'batas_maksimal': timezone.now() - timedelta(hours=4),  # sudah lewat
                'is_active': True,
            },
        )

    def _mulai(self, user):
        api = APIClient()
        api.force_authenticate(user)
        return api.post('/api/hr/absensi/clock-in/', {}, format='json', secure=True)

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'belum'})
    def test_belum_absen_hr_ditolak(self, _):
        res = self._mulai(self.staff)
        self.assertEqual(res.status_code, 403)
        self.assertIn('HR', res.json()['detail'])

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'hr_tidak_tersedia': True})
    def test_hr_tidak_tersedia_fail_open_dan_staff_tetap_kena_batas(self, _):
        # HR down -> lolos cek HR, tetapi staff tetap kena batas waktu (terkunci).
        self.assertEqual(self._mulai(self.staff).status_code, 403)

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'masuk'})
    def test_kordiv_lewat_batas_waktu_tetap_boleh_mulai(self, _):
        res = self._mulai(self.kordiv)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()['absensi']['status'], 'terlambat')

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'belum'})
    def test_dashboard_mengirim_status_absen_hr(self, _):
        api = APIClient()
        api.force_authenticate(self.kordiv)
        res = api.get('/api/hr/dashboard/staff/', secure=True)
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['status_absen_hr'], 'belum')
