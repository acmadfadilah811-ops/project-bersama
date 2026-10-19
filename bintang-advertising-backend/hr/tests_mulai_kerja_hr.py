"""Mulai Kerja di ERP butuh absen masuk di HR; SPV/Kordiv tidak dikunci batas waktu (2026-10-18)."""
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from api.models import CustomUser
from hr.models import Absensi, DailyAttendanceSession


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


class ManagerAbsenTests(APITestCase):
    """Manager wajib Mulai Kerja; hanya owner & admin yang tidak absen (2026-10-19)."""

    def setUp(self):
        self.manager = CustomUser.objects.create_user(
            username='mgr.abs', password='x', role='manager', email='m@x.id', hr_employee_id=201,
            first_name='Nasul', last_name='Fikar')
        self.owner = CustomUser.objects.create_user(username='own.abs', password='x', role='owner', email='o@x.id')
        self.admin = CustomUser.objects.create_user(username='adm.abs', password='x', role='admin', email='a@x.id')
        self.spv = CustomUser.objects.create_user(username='spv.abs', password='x', role='spv', email='p@x.id')
        DailyAttendanceSession.objects.update_or_create(
            tanggal=timezone.localdate(),
            defaults={'waktu_mulai': timezone.now() - timedelta(hours=5),
                      'batas_maksimal': timezone.now() - timedelta(hours=4), 'is_active': True},
        )

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'belum'})
    def test_manager_butuh_absen_hr(self, _):
        api = APIClient()
        api.force_authenticate(self.manager)
        self.assertEqual(api.post('/api/hr/absensi/clock-in/', {}, format='json', secure=True).status_code, 403)

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'masuk'})
    def test_manager_lewat_batas_tetap_boleh(self, _):
        api = APIClient()
        api.force_authenticate(self.manager)
        res = api.post('/api/hr/absensi/clock-in/', {}, format='json', secure=True)
        self.assertEqual(res.status_code, 201, res.content)

    def test_daftar_absensi_tanpa_owner_admin_dengan_nama_asli(self):
        kemarin = timezone.localdate() - timedelta(days=1)
        api = APIClient()
        api.force_authenticate(self.admin)  # admin boleh melihat semua
        res = api.get('/api/hr/absensi/', {'tanggal': kemarin.isoformat()}, secure=True)
        self.assertEqual(res.status_code, 200, res.content)
        nama = {r['staff_nama'] for r in res.json()}
        self.assertEqual(nama, {'Nasul Fikar', 'spv.abs'})  # manager (nama asli) & spv; owner/admin tidak ada


class ValidasiOtomatisTests(APITestCase):
    def setUp(self):
        self.staff = CustomUser.objects.create_user(
            username='stf.val', password='x', role='staff', email='sv@x.id', hr_employee_id=111)
        self.kordiv = CustomUser.objects.create_user(
            username='kdv.val', password='x', role='kordiv', email='kv@x.id', hr_employee_id=102)
        DailyAttendanceSession.objects.update_or_create(
            tanggal=timezone.localdate(),
            defaults={'waktu_mulai': timezone.now() - timedelta(hours=5),
                      'batas_maksimal': timezone.now() - timedelta(hours=4), 'is_active': True},
        )

    def _mulai(self, user):
        api = APIClient()
        api.force_authenticate(user)
        return api.post('/api/hr/absensi/clock-in/', {}, format='json', secure=True)

    @patch('api.services.absensi_hr_gate.validasi_absensi_hr', return_value=True)
    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'masuk'})
    def test_mulai_kerja_memicu_validasi_absensi_hr(self, _status, validasi):
        res = self._mulai(self.kordiv)
        self.assertEqual(res.status_code, 201, res.content)
        validasi.assert_called_once_with(102)

    @patch('api.services.absensi_hr_gate.validasi_absensi_hr', return_value=True)
    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'belum'})
    def test_ditolak_tidak_memicu_validasi(self, _status, validasi):
        self.assertEqual(self._mulai(self.staff).status_code, 403)
        validasi.assert_not_called()


class PermintaanAksesTanpaAbsenHrTests(APITestCase):
    """HP tertinggal: karyawan minta izin Mulai Kerja tanpa absen HR (2026-10-19)."""

    def setUp(self):
        from hr.models import UnlockRequest
        self.UnlockRequest = UnlockRequest
        self.staff = CustomUser.objects.create_user(
            username='stf.akses', password='x', role='staff', email='sa@x.id', hr_employee_id=301)
        self.manager = CustomUser.objects.create_user(
            username='mgr.akses', password='x', role='manager', email='ma@x.id', hr_employee_id=302)
        self.owner = CustomUser.objects.create_user(username='own.akses', password='x', role='owner', email='oa@x.id')
        self.sesi, _ = DailyAttendanceSession.objects.update_or_create(
            tanggal=timezone.localdate(),
            defaults={'waktu_mulai': timezone.now() - timedelta(hours=1),
                      'batas_maksimal': timezone.now() + timedelta(hours=1), 'is_active': True},
        )

    def _api(self, user):
        api = APIClient()
        api.force_authenticate(user)
        return api

    def _minta(self, user=None, alasan='HP tertinggal di rumah'):
        return self._api(user or self.staff).post(
            '/api/hr/unlock-request/', {'alasan': alasan, 'jenis': 'tanpa_absen_hr'}, format='json', secure=True)

    def _mulai(self, user=None):
        return self._api(user or self.staff).post('/api/hr/absensi/clock-in/', {}, format='json', secure=True)

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'belum'})
    def test_alur_minta_setujui_lalu_mulai_kerja(self, _):
        self.assertEqual(self._mulai().status_code, 403)
        self.assertEqual(self._minta().status_code, 201)
        # belum disetujui: tetap ditolak
        self.assertEqual(self._mulai().status_code, 403)
        req = self.UnlockRequest.objects.get(staff=self.staff, jenis='tanpa_absen_hr')
        res = self._api(self.manager).post(f'/api/hr/unlock-requests/{req.id}/approve/', secure=True)
        self.assertEqual(res.status_code, 200, res.content)
        with patch('api.services.absensi_hr_gate.validasi_absensi_hr') as validasi:
            res = self._mulai()
            self.assertEqual(res.status_code, 201, res.content)
            validasi.assert_not_called()
        absensi = Absensi.objects.get(staff=self.staff, tanggal=timezone.localdate())
        self.assertIn('tanpa absen HR', absensi.catatan)
        self.assertIn('HP tertinggal', absensi.catatan)

    @patch('api.services.absensi_hr_gate._status_hr', return_value={'applicable': True, 'status': 'belum'})
    def test_ditolak_tetap_diblok(self, _):
        self._minta()
        req = self.UnlockRequest.objects.get(staff=self.staff, jenis='tanpa_absen_hr')
        self._api(self.owner).post(f'/api/hr/unlock-requests/{req.id}/reject/', secure=True)
        self.assertEqual(self._mulai().status_code, 403)

    def test_alasan_wajib_dan_tidak_dobel(self):
        self.assertEqual(self._minta(alasan='  ').status_code, 400)
        self.assertEqual(self._minta().status_code, 201)
        self.assertEqual(self._minta().status_code, 400)

    def test_tidak_boleh_setujui_sendiri(self):
        self._minta(user=self.manager)
        req = self.UnlockRequest.objects.get(staff=self.manager, jenis='tanpa_absen_hr')
        res = self._api(self.manager).post(f'/api/hr/unlock-requests/{req.id}/approve/', secure=True)
        self.assertEqual(res.status_code, 403)
        res = self._api(self.owner).post(f'/api/hr/unlock-requests/{req.id}/approve/', secure=True)
        self.assertEqual(res.status_code, 200)

    def test_approve_tidak_membuat_absensi_atau_membuka_papan(self):
        self._minta()
        req = self.UnlockRequest.objects.get(staff=self.staff, jenis='tanpa_absen_hr')
        self._api(self.manager).post(f'/api/hr/unlock-requests/{req.id}/approve/', secure=True)
        self.assertFalse(Absensi.objects.filter(staff=self.staff, tanggal=timezone.localdate()).exists())

    def test_dashboard_menampilkan_status_permintaan(self):
        self._minta()
        res = self._api(self.staff).get('/api/hr/dashboard/staff/', secure=True)
        self.assertEqual(res.json()['permintaan_akses_hr']['status'], 'pending')
