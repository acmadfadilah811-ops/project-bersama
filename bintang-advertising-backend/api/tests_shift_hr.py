"""Shift di ERP hanya-lihat, bersumber dari HR (2026-10-19)."""
from unittest.mock import patch

from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from api.models import CustomUser, ShiftTiming

CONTOH = [{'id': 1, 'judul': 'Pagi', 'jam_mulai': '08:30:00', 'jam_berakhir': '17:30:00', 'hari': []}]


class ShiftHrTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = CustomUser.objects.create_user(username='own.sh', password='x', role='owner', email='o@x.id')
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    @patch('api.services.hr_shift.ambil_shift_hr', return_value=CONTOH)
    def test_daftar_dari_hr(self, _):
        data = self.api.get('/api/shift-timing/', secure=True).json()
        self.assertEqual([(s['judul'], s['sumber']) for s in data], [('Pagi', 'hr')])

    @patch('api.services.hr_shift.ambil_shift_hr', return_value=None)
    def test_cadangan_lokal_bila_hr_tidak_terjangkau(self, _):
        ShiftTiming.objects.create(judul='Lama', jam_mulai='08:00', jam_berakhir='16:00')
        data = self.api.get('/api/shift-timing/', secure=True).json()
        self.assertEqual([(s['judul'], s['sumber']) for s in data], [('Lama', 'lokal')])

    @patch('api.services.hr_shift.ambil_shift_hr', return_value=CONTOH)
    def test_tidak_bisa_diubah_dari_erp(self, _):
        payload = {'judul': 'X', 'jam_mulai': '08:00', 'jam_berakhir': '16:00'}
        self.assertEqual(self.api.post('/api/shift-timing/', payload, format='json', secure=True).status_code, 405)
        s = ShiftTiming.objects.create(judul='Lama', jam_mulai='08:00', jam_berakhir='16:00')
        self.assertEqual(self.api.put(f'/api/shift-timing/{s.id}/', payload, format='json', secure=True).status_code, 405)
        self.assertEqual(self.api.delete(f'/api/shift-timing/{s.id}/', secure=True).status_code, 405)
