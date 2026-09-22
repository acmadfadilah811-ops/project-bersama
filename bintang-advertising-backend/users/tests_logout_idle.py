"""AKS-06: sesi berakhir otomatis setelah tidak aktif -- bagian server. Logout
mencabut refresh token (blacklist) + SessionToken, jadi token lama tidak bisa
dipakai lagi setelah logout (baik manual maupun dipicu idle-logout di frontend).
Deteksi tidak-aktif 30 menit sendiri murni logic frontend (utils/idleTimeout.js);
di sini hanya memastikan bagian server yang dipanggilnya benar-benar mencabut sesi."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

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


class SessionRevokeBenarBenarMencabutTests(APITestCase):
    """Owner mencabut sesi orang lain harus benar-benar menghentikan sesi itu --
    sebelumnya SessionRevokeView cuma menandai baris DB, refresh token JWT-nya
    tetap sah dipakai selamanya."""

    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner_cabut', password='OwnerSandi2026x', role='owner')
        self.staff = get_user_model().objects.create_user(username='staff_cabut', password='StaffSandi2026x', role='staff')

    def login_staff(self):
        r = self.client.post('/api/auth/login/', {'username': 'staff_cabut', 'password': 'StaffSandi2026x'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()['access'], r.json()['refresh']

    def test_cabut_sesi_memblokir_refresh_token_terkait(self):
        access, refresh = self.login_staff()
        session_id = SessionToken.objects.get(user=self.staff, is_active=True).id

        self.client.force_authenticate(self.owner)
        r = self.client.delete(f'/api/security/sessions/{session_id}/')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn('berhenti dalam maks', r.json()['detail'])

        # Refresh token milik staff sekarang harus ditolak -- inilah "cabut sesi"
        # yang sesungguhnya, bukan cuma baris DB yang berubah.
        self.client.force_authenticate(None)
        r2 = self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(r2.status_code, 401)

    def test_cabut_sesi_lama_tanpa_refresh_jti_tetap_jalan_dgn_catatan(self):
        self.login_staff()
        session = SessionToken.objects.get(user=self.staff, is_active=True)
        session.refresh_jti = ''   # simulasikan baris lama (sebelum kolom ini ada)
        session.save(update_fields=['refresh_jti'])

        self.client.force_authenticate(self.owner)
        r = self.client.delete(f'/api/security/sessions/{session.id}/')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn('sebelum fitur cabut-instan', r.json()['detail'])
        session.refresh_from_db()
        self.assertFalse(session.is_active)

    def test_admin_tidak_boleh_cabut_sesi(self):
        # IsStrictOwnerOrManager: hanya owner/manager, admin sengaja dikecualikan.
        admin = get_user_model().objects.create_user(username='admin_cabut', password='AdminSandi2026x', role='admin')
        self.login_staff()
        session_id = SessionToken.objects.get(user=self.staff, is_active=True).id
        self.client.force_authenticate(admin)
        r = self.client.delete(f'/api/security/sessions/{session_id}/')
        self.assertEqual(r.status_code, 403)


class SatuAkunSatuSesiTests(APITestCase):
    """UAT poin 29: satu akun tidak bisa dipakai login di banyak perangkat
    sekaligus -- login baru harus otomatis mencabut & memblokir semua sesi
    lama milik akun yang sama (bukan cuma menambah SessionToken baru)."""

    def setUp(self):
        from django.core.cache import cache
        # LoginRateThrottle (10/menit, per-IP) dibagi oleh SEMUA test class di
        # file ini -- class ini login berkali-kali per test, jadi bersihkan
        # cache di awal & akhir supaya tidak menghabiskan jatah class lain
        # yang jalan setelahnya dalam satu test run.
        cache.clear()
        self.addCleanup(cache.clear)
        # email diisi -- dipakai test verifikasi-IP-baru di bawah (jalur itu
        # cuma aktif kalau user.email terisi, lihat CustomLoginView).
        self.user = get_user_model().objects.create_user(
            username='dua_device_uji', password='SandiLama2026x', role='staff',
            email='dua_device@test.local')

    def login(self, **extra):
        r = self.client.post('/api/auth/login/', {'username': 'dua_device_uji', 'password': 'SandiLama2026x'}, format='json', **extra)
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()['access'], r.json()['refresh']

    def test_login_kedua_mencabut_sesi_pertama(self):
        access1, refresh1 = self.login()
        session1_id = SessionToken.objects.get(user=self.user, is_active=True).id

        access2, refresh2 = self.login()

        # Sesi pertama harus sudah tidak aktif...
        session1 = SessionToken.objects.get(id=session1_id)
        self.assertFalse(session1.is_active)
        # ...dan refresh token-nya benar-benar diblokir, bukan cuma baris DB.
        r = self.client.post('/api/auth/refresh/', {'refresh': refresh1}, format='json')
        self.assertEqual(r.status_code, 401)

        # Sesi kedua (device baru) tetap sah.
        r2 = self.client.post('/api/auth/refresh/', {'refresh': refresh2}, format='json')
        self.assertEqual(r2.status_code, 200, r2.content)

    def test_hanya_satu_sesi_aktif_setelah_beberapa_kali_login(self):
        self.login()
        self.login()
        self.login()
        self.assertEqual(SessionToken.objects.filter(user=self.user, is_active=True).count(), 1)

    def test_login_baru_tidak_mencabut_sesi_user_lain(self):
        other = get_user_model().objects.create_user(username='user_lain_uji', password='SandiLama2026x', role='staff')
        r = self.client.post('/api/auth/login/', {'username': 'user_lain_uji', 'password': 'SandiLama2026x'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        other_session_id = SessionToken.objects.get(user=other, is_active=True).id

        self.login()

        self.assertTrue(SessionToken.objects.get(id=other_session_id).is_active)

    def test_login_via_verifikasi_ip_baru_juga_mencabut_sesi_lama(self):
        import os
        from unittest import mock
        from django.core.cache import cache

        access1, refresh1 = self.login(REMOTE_ADDR='10.2.2.1')
        session1_id = SessionToken.objects.get(user=self.user, is_active=True).id

        with mock.patch.dict(os.environ, {'SECURITY_BYPASS_IP_VERIFICATION': 'False'}):
            r = self.client.post('/api/auth/login/', {'username': 'dua_device_uji', 'password': 'SandiLama2026x'}, format='json',
                                  REMOTE_ADDR='10.2.2.2')
            self.assertEqual(r.json().get('detail'), 'VERIFICATION_REQUIRED', r.content)
            temp_token = r.json()['temp_token']
            otp = cache.get(f'login_otp_{temp_token}')['otp']
            r2 = self.client.post('/api/auth/verify-login/', {'temp_token': temp_token, 'otp': otp}, format='json')
        self.assertEqual(r2.status_code, 200, r2.content)

        self.assertFalse(SessionToken.objects.get(id=session1_id).is_active)
        r3 = self.client.post('/api/auth/refresh/', {'refresh': refresh1}, format='json')
        self.assertEqual(r3.status_code, 401)
