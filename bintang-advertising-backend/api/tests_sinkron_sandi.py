"""Ganti sandi ERP <-> HR <-> CRM (2026-09-30)."""
import os
from unittest import mock

from django.core.cache import cache
from django.test import TransactionTestCase  # noqa: F401
from rest_framework.test import APITestCase

from .models import CustomUser
from .services import sinkron_sandi as svc

URL = '/api/bridge/hr-employee-sandi/'


class KirimKeHrTests(APITestCase):
    def setUp(self):
        env = mock.patch.dict(os.environ, {'INSIGHTS_BRIDGE_API_KEY': 'kunci-insights', 'HR_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)
        self.user = CustomUser.objects.create_user(username='u.sandi', password='lama12345', role='staff', hr_employee_id=950)

    def _ganti(self, sandi='Baru12345678'):
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                self.user.set_password(sandi)
                self.user.save()
        return post

    def test_ganti_sandi_mengirim_hash_ke_hr(self):
        post = self._ganti()
        post.assert_called_once()
        payload = post.call_args.kwargs['json']
        self.assertEqual(payload['hr_employee_id'], 950)
        self.assertEqual(payload['sumber'], 'bintang')
        self.assertTrue(payload['password_hash'].startswith('pbkdf2_'))
        self.assertNotIn('Baru12345678', str(payload))  # sandi asli tidak pernah dikirim
        self.assertEqual(post.call_args.kwargs['headers']['X-Api-Key'], 'kunci-insights')

    def test_simpan_tanpa_ganti_sandi_tidak_mengirim(self):
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                self.user.first_name = 'Baru'
                self.user.save()
        post.assert_not_called()

    def test_update_last_login_tidak_memicu(self):
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                self.user.save(update_fields=['last_login'])
        post.assert_not_called()

    def test_akun_tanpa_hr_tidak_mengirim(self):
        lokal = CustomUser.objects.create_user(username='lokal.saja', password='lama12345', role='owner')
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                lokal.set_password('Baru12345678')
                lokal.save()
        post.assert_not_called()

    def test_hr_gagal_tidak_menggagalkan_ganti_sandi(self):
        with mock.patch.object(svc.requests, 'post', side_effect=Exception('putus')):
            with self.captureOnCommitCallbacks(execute=True):
                self.user.set_password('Baru12345678')
                self.user.save()
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Baru12345678'))

    def test_sandi_tak_bisa_dipakai_tidak_dikirim(self):
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                self.user.set_unusable_password()
                self.user.save()
        post.assert_not_called()


class TerimaDariHrTests(APITestCase):
    def setUp(self):
        cache.clear()
        env = mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': 'kunci-uji', 'INSIGHTS_BRIDGE_API_KEY': 'kunci-insights'})
        env.start()
        self.addCleanup(env.stop)
        self.user = CustomUser.objects.create_user(username='terima.sandi', password='lama12345', role='staff', hr_employee_id=951)
        from django.contrib.auth.hashers import make_password
        self.hash_baru = make_password('DariHr12345')

    def kirim(self, payload, key='kunci-uji'):
        return self.client.post(URL, payload, format='json', HTTP_X_API_KEY=key, HTTP_X_FORWARDED_PROTO='https')

    def test_hash_diterapkan_dan_sandi_baru_berlaku(self):
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                res = self.kirim({'hr_employee_id': 951, 'password_hash': self.hash_baru})
        self.assertEqual(res.status_code, 200, res.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('DariHr12345'))
        self.assertFalse(self.user.check_password('lama12345'))
        post.assert_not_called()  # tidak dikirim balik ke HR (tanpa putaran)

    def test_api_key_salah_ditolak(self):
        self.assertEqual(self.kirim({'hr_employee_id': 951, 'password_hash': self.hash_baru}, key='x').status_code, 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('lama12345'))

    def test_hash_tidak_valid_ditolak(self):
        for h in ('bukan-hash', '', '!tak-bisa-dipakai', 'plain12345678'):
            self.assertEqual(self.kirim({'hr_employee_id': 951, 'password_hash': h}).status_code, 400, h)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('lama12345'))

    def test_profil_sales_tanpa_sandi_dilewati(self):
        sales = CustomUser.objects.create(username='sales.tanpa.login', role='sales', hr_employee_id=952)
        sales.set_unusable_password()
        sales.save()
        res = self.kirim({'hr_employee_id': 952, 'password_hash': self.hash_baru})
        self.assertTrue(res.data.get('skipped'))
        sales.refresh_from_db()
        self.assertFalse(sales.has_usable_password())

    def test_akun_tak_dikenal_dilewati(self):
        self.assertTrue(self.kirim({'hr_employee_id': 99999, 'password_hash': self.hash_baru}).data.get('skipped'))
