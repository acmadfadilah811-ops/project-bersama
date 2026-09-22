"""AKS-03: akun terkunci sementara setelah beberapa kali gagal login."""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from users.models import SecurityAuditLog


class KunciAkunTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username='kunci_uji', password='SandiBenar2026x', role='staff')

    def login(self, sandi, username='kunci_uji'):
        return self.client.post('/api/auth/login/', {'username': username, 'password': sandi}, format='json')

    def test_tiga_kali_salah_lalu_terkunci_10_menit_walau_sandi_benar(self):
        for i in range(2):
            self.assertEqual(self.login('salah').status_code, 401, i)
        self.assertEqual(self.login('salah').status_code, 429)   # percobaan ke-3 langsung mengunci
        r = self.login('SandiBenar2026x')
        self.assertEqual(r.status_code, 429)
        self.assertGreater(r.json()['retry_after'], 0)
        self.assertLessEqual(r.json()['retry_after'], 600)

    def test_dua_kali_salah_belum_terkunci_dan_sandi_benar_menghapus_hitungan(self):
        for _ in range(2):
            self.login('salah')
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)
        for _ in range(2):
            self.login('salah')
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)

    def test_pesan_gagal_menyebut_sisa_percobaan(self):
        r = self.login('salah')
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()['sisa_percobaan'], 2)

    def test_username_tidak_ada_diperlakukan_sama_anti_enumerasi(self):
        for _ in range(3):
            self.login('x', username='hantu')
        self.assertEqual(self.login('x', username='hantu').status_code, 429)

    def test_kegagalan_dan_penguncian_tercatat_di_audit_log(self):
        for _ in range(3):
            self.login('salah')
        self.login('salah')
        self.assertEqual(SecurityAuditLog.objects.filter(event='LOGIN_FAILED').count(), 3)
        self.assertTrue(SecurityAuditLog.objects.filter(event='LOGIN_FAILED', keterangan__contains='dikunci').exists())

    def test_kunci_berakhir_setelah_masa_habis(self):
        for _ in range(3):
            self.login('salah')
        cache.clear()   # simulasi 10 menit berlalu
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)

    def test_owner_bisa_membuka_kunci_akun_lain(self):
        owner = get_user_model().objects.create_user(username='own_kunci', password='OwnerSandi2026x', role='owner')
        for _ in range(3):
            self.login('salah')
        self.assertEqual(self.login('SandiBenar2026x').status_code, 429)
        self.client.force_authenticate(owner)
        r = self.client.post(f'/api/users/{self.user.id}/buka-kunci/')
        self.assertEqual(r.status_code, 200, r.content)
        self.client.force_authenticate(None)
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)

    def test_staff_tidak_boleh_membuka_kunci(self):
        lain = get_user_model().objects.create_user(username='lain_kunci', password='LainSandi2026x', role='staff')
        self.client.force_authenticate(lain)
        self.assertEqual(self.client.post(f'/api/users/{self.user.id}/buka-kunci/').status_code, 403)


class KunciIpDanOtpTests(APITestCase):
    """IP yang gagal login ke >=3 akun BERBEDA diblokir; OTP membuka kunci akun
    sendiri saja tanpa membuka kunci IP untuk akun lain."""

    def setUp(self):
        cache.clear()
        U = get_user_model()
        self.a = U.objects.create_user(username='ip_a', password='SandiA2026xx', role='staff', email='a@test.local')
        self.b = U.objects.create_user(username='ip_b', password='SandiB2026xx', role='staff', email='b@test.local')
        self.c = U.objects.create_user(username='ip_c', password='SandiC2026xx', role='staff', email='c@test.local')
        self.d = U.objects.create_user(username='ip_d', password='SandiD2026xx', role='staff', email='d@test.local')

    def login(self, username, sandi, ip='9.9.9.9', otp=None):
        data = {'username': username, 'password': sandi}
        if otp:
            data['otp'] = otp
        return self.client.post('/api/auth/login/', data, format='json', REMOTE_ADDR=ip)

    def test_tiga_akun_berbeda_gagal_dari_satu_ip_mengunci_ip_itu(self):
        self.assertEqual(self.login('ip_a', 'salah').status_code, 401)
        self.assertEqual(self.login('ip_b', 'salah').status_code, 401)
        r = self.login('ip_c', 'salah')
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()['cakupan_kunci'], 'ip')

    def test_ip_terkunci_memblokir_akun_keempat_walau_sandi_benar_dan_belum_pernah_gagal(self):
        for u, s in ((self.a, 'salah'), (self.b, 'salah'), (self.c, 'salah')):
            self.login(u.username, s)
        r = self.login('ip_d', 'SandiD2026xx')   # akun d, sandi BENAR, belum pernah gagal
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()['cakupan_kunci'], 'ip')

    def test_ip_berbeda_tidak_ikut_terkunci(self):
        for u in (self.a, self.b, self.c):
            self.login(u.username, 'salah', ip='9.9.9.9')
        r = self.login('ip_d', 'SandiD2026xx', ip='8.8.8.8')
        self.assertEqual(r.status_code, 200)

    def test_otp_unlock_membuka_akun_sendiri_walau_ip_terkunci_tanpa_membuka_utk_akun_lain(self):
        for u in (self.a, self.b, self.c):
            self.login(u.username, 'salah')
        self.client.post('/api/auth/login/unlock-otp/', {'username': 'ip_a'}, format='json')
        otp = self.ambil_otp()
        r = self.login('ip_a', 'SandiA2026xx', otp=otp)
        self.assertEqual(r.status_code, 200, r.content)   # akun a terbuka via OTP
        r2 = self.login('ip_d', 'SandiD2026xx')           # akun lain tetap diblokir kunci IP
        self.assertEqual(r2.status_code, 429)
        self.assertEqual(r2.json()['cakupan_kunci'], 'ip')

    def test_otp_salah_tidak_membuka_kunci(self):
        for u in (self.a, self.b, self.c):
            self.login(u.username, 'salah')
        self.client.post('/api/auth/login/unlock-otp/', {'username': 'ip_a'}, format='json')
        r = self.login('ip_a', 'SandiA2026xx', otp='000000')
        self.assertEqual(r.status_code, 429)

    def test_otp_sekali_pakai(self):
        for u in (self.a, self.b, self.c):
            self.login(u.username, 'salah')
        self.client.post('/api/auth/login/unlock-otp/', {'username': 'ip_a'}, format='json')
        otp = self.ambil_otp()
        self.assertEqual(self.login('ip_a', 'SandiA2026xx', otp=otp).status_code, 200)
        # ip masih terkunci utk akun lain; otp lama dipakai lagi -> tidak lagi valid
        r = self.login('ip_b', 'SandiB2026xx', otp=otp)
        self.assertEqual(r.status_code, 429)

    def test_unlock_otp_request_akun_tidak_ada_tetap_respons_generik(self):
        r = self.client.post('/api/auth/login/unlock-otp/', {'username': 'hantu_tidak_ada'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('Jika akun ada', r.json()['detail'])

    def test_gagal_akun_sama_berkali_tidak_menghitung_sbg_akun_berbeda(self):
        for _ in range(5):
            self.login('ip_a', 'salah')
        # hanya 1 akun berbeda yg dicoba -> kunci IP belum aktif (walau akun 'a' sendiri terkunci)
        r = self.login('ip_b', 'SandiB2026xx')
        self.assertEqual(r.status_code, 200)

    def ambil_otp(self):
        import re
        from django.core import mail
        return re.search(r'KODE: (\d{6})', mail.outbox[-1].body).group(1)
