"""Penyatuan kredensial akun lama Bintang dengan HR (2026-09-30)."""
import os
from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import CustomUser

URL = '/api/bridge/hr-employee-kredensial/'


class HRKredensialTests(APITestCase):
    def setUp(self):
        cache.clear()
        env = mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)
        self.user = CustomUser.objects.create_user(username='ceo.starfoto', password='lama12345', role='manager', hr_employee_id=901)

    def kirim(self, payload, key='kunci-uji'):
        return self.client.post(URL, payload, format='json', HTTP_X_API_KEY=key, HTTP_X_FORWARDED_PROTO='https')

    def test_api_key_salah_ditolak(self):
        self.assertEqual(self.kirim({'hr_employee_id': 901, 'username': 'ceo', 'password': 'BaruAwal123'}, key='x').status_code, 401)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ceo.starfoto')

    def test_hanya_lihat_tidak_mengubah(self):
        res = self.kirim({'hr_employee_id': 901, 'hanya_lihat': True})
        self.assertEqual(res.data['username'], 'ceo.starfoto')
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('lama12345'))

    def test_username_dan_sandi_disamakan(self):
        res = self.kirim({'hr_employee_id': 901, 'username': 'CEO', 'password': 'BaruAwal123'})
        self.assertEqual(res.status_code, 200, res.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ceo')
        self.assertTrue(self.user.check_password('BaruAwal123'))

    def test_username_dipakai_akun_lain_dijawab_409_dan_tidak_berubah(self):
        CustomUser.objects.create_user(username='ceo', password='x12345678', role='staff')
        res = self.kirim({'hr_employee_id': 901, 'username': 'ceo', 'password': 'BaruAwal123'})
        self.assertEqual(res.status_code, 409)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ceo.starfoto')
        self.assertTrue(self.user.check_password('lama12345'))

    def test_profil_sales_tanpa_sandi_hanya_username(self):
        sales = CustomUser.objects.create(username='marketing.advertising', role='sales', hr_employee_id=902)
        sales.set_unusable_password()
        sales.save()
        res = self.kirim({'hr_employee_id': 902, 'username': 'haythix', 'password': 'BaruAwal123'})
        self.assertFalse(res.data['sandi_diubah'])
        sales.refresh_from_db()
        self.assertEqual(sales.username, 'haythix')
        self.assertFalse(sales.has_usable_password())

    def test_akun_nonaktif_dilewati(self):
        CustomUser.objects.filter(pk=self.user.pk).update(is_active=False)
        res = self.kirim({'hr_employee_id': 901, 'username': 'ceo', 'password': 'BaruAwal123'})
        self.assertTrue(res.data.get('skipped'))
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ceo.starfoto')

    def test_format_dan_sandi_pendek_ditolak(self):
        self.assertEqual(self.kirim({'hr_employee_id': 901, 'username': 'Ceo Baru!', 'password': 'BaruAwal123'}).status_code, 400)
        self.assertEqual(self.kirim({'hr_employee_id': 901, 'username': 'ceo', 'password': '123'}).status_code, 400)

    def test_akun_tak_dikenal_dilewati(self):
        self.assertTrue(self.kirim({'hr_employee_id': 99999, 'username': 'x.y', 'password': 'BaruAwal123'}).data.get('skipped'))
