"""Arsip akun nonaktif & AI Business Analyst tanpa manager (2026-10-14)."""
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import CustomUser


class ArsipAkunTests(TestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username='own', password='x', role='owner', email='own@x.id')
        self.staff = CustomUser.objects.create_user(username='stf', password='x', role='staff', email='stf@x.id')
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def test_akun_aktif_tidak_bisa_diarsipkan(self):
        res = self.api.post(f'/api/users/{self.staff.id}/arsip/', {'arsip': True}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_akun_nonaktif_diarsipkan_dan_aktif_lagi_keluar_arsip(self):
        self.staff.is_active = False
        self.staff.status_karyawan = 'nonaktif'
        self.staff.save()
        res = self.api.post(f'/api/users/{self.staff.id}/arsip/', {'arsip': True}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['diarsipkan'])
        res = self.api.patch(f'/api/users/{self.staff.id}/', {'status_karyawan': 'aktif'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.is_active)
        self.assertFalse(self.staff.diarsipkan)

    def test_staff_tidak_boleh_mengarsipkan(self):
        lain = CustomUser.objects.create_user(username='lain', password='x', role='staff', email='l@x.id', is_active=False)
        self.api.force_authenticate(self.staff)
        res = self.api.post(f'/api/users/{lain.id}/arsip/', {'arsip': True}, format='json')
        self.assertEqual(res.status_code, 403)


class AiAnalystTanpaManagerTests(TestCase):
    def test_manager_ditolak_admin_boleh(self):
        manager = CustomUser.objects.create_user(username='mgr', password='x', role='manager', email='m@x.id')
        api = APIClient()
        api.force_authenticate(manager)
        self.assertEqual(api.get('/api/ai-business-analyst/').status_code, 403)
        res = api.post('/api/ai-business-analyst/chat/', {'messages': [{'role': 'user', 'content': 'hai'}]}, format='json')
        self.assertEqual(res.status_code, 403)


class KontrakHanyaDariHrTests(TestCase):
    """Data kontrak tidak bisa diubah lewat ERP; hanya dari HR (2026-10-17)."""

    def test_patch_kontrak_diabaikan(self):
        owner = CustomUser.objects.create_user(username='own2', password='x', role='owner', email='o2@x.id')
        staff = CustomUser.objects.create_user(username='stf2', password='x', role='staff', email='s2@x.id')
        api = APIClient()
        api.force_authenticate(owner)
        res = api.patch(f'/api/users/{staff.id}/', {
            'jenis_kontrak': 'freelance', 'kontrak_mulai': '2026-01-01', 'status_karyawan': 'cuti',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        staff.refresh_from_db()
        self.assertEqual(staff.jenis_kontrak, 'tetap')
        self.assertIsNone(staff.kontrak_mulai)
        self.assertEqual(staff.status_karyawan, 'cuti')
