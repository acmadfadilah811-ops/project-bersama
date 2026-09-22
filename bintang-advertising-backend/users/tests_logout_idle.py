"""AKS-06: sesi berakhir otomatis setelah tidak aktif -- bagian server. Logout
mencabut refresh token (blacklist) + SessionToken, jadi token lama tidak bisa
dipakai lagi setelah logout (baik manual maupun dipicu idle-logout di frontend).
Deteksi tidak-aktif 30 menit sendiri murni logic frontend (utils/idleTimeout.js);
di sini hanya memastikan bagian server yang dipanggilnya benar-benar mencabut sesi."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import SessionToken


class LogoutMencabutSesiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='logout_uji', password='SandiLama2026x', role='staff')

    def login(self):
        r = self.client.post('/api/auth/login/', {'username': 'logout_uji', 'password': 'SandiLama2026x'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()['access'], r.json()['refresh']

    def test_refresh_token_tidak_bisa_dipakai_lagi_setelah_logout(self):
        access, refresh = self.login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r = self.client.post('/api/auth/logout/', {'refresh': refresh}, format='json')
        self.assertEqual(r.status_code, 200, r.content)

        # Token lama dipakai lagi (mis. disalin sebelum idle-logout) -> harus ditolak
        r2 = self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(r2.status_code, 401)

    def test_session_token_dicabut_setelah_logout(self):
        access, refresh = self.login()
        from rest_framework_simplejwt.tokens import AccessToken
        jti = AccessToken(access).get('jti')
        self.assertTrue(SessionToken.objects.filter(token_jti=jti, is_active=True).exists())

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.client.post('/api/auth/logout/', {'refresh': refresh}, format='json')

        self.assertFalse(SessionToken.objects.filter(token_jti=jti, is_active=True).exists())

    def test_logout_tanpa_login_ditolak(self):
        r = self.client.post('/api/auth/logout/', {'refresh': 'apa-saja'}, format='json')
        self.assertEqual(r.status_code, 401)


class VerifyLoginSessionTokenTests(APITestCase):
    """Jalur login-dari-IP-baru (VerifyLoginView) membuat SessionToken sendiri --
    bug timezone.utc yang sama ada di sini juga, path terpisah dari CustomLoginView."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='verify_uji', password='SandiLama2026x', role='staff', email='verify@test.local')

    def test_session_token_dari_verifikasi_ip_baru_pakai_jti_yang_benar(self):
        import os
        from unittest import mock
        from django.core.cache import cache
        # .env lokal set SECURITY_BYPASS_IP_VERIFICATION=True (kemudahan dev) --
        # matikan sementara supaya alur verifikasi IP baru benar-benar teruji.
        with mock.patch.dict(os.environ, {'SECURITY_BYPASS_IP_VERIFICATION': 'False'}):
            # Login sukses pertama dari IP A supaya ada riwayat LOGIN_SUCCESS.
            self.client.post('/api/auth/login/', {'username': 'verify_uji', 'password': 'SandiLama2026x'}, format='json',
                              REMOTE_ADDR='10.1.1.1')
            # Login kedua dari IP B -> requires_verification -> OTP dikirim, bukan token langsung.
            r = self.client.post('/api/auth/login/', {'username': 'verify_uji', 'password': 'SandiLama2026x'}, format='json',
                                  REMOTE_ADDR='10.1.1.2')
            self.assertEqual(r.json().get('detail'), 'VERIFICATION_REQUIRED', r.content)
            temp_token = r.json()['temp_token']
            otp = cache.get(f'login_otp_{temp_token}')['otp']

            r2 = self.client.post('/api/auth/verify-login/', {'temp_token': temp_token, 'otp': otp}, format='json')
        self.assertEqual(r2.status_code, 200, r2.content)
        access = r2.json()['access']

        from rest_framework_simplejwt.tokens import AccessToken
        jti = AccessToken(access).get('jti')
        self.assertTrue(SessionToken.objects.filter(token_jti=jti, is_active=True).exists())
