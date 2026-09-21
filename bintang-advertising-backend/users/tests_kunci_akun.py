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

    def test_lima_kali_salah_lalu_terkunci_walau_sandi_benar(self):
        for i in range(4):
            self.assertEqual(self.login('salah').status_code, 401, i)
        self.assertEqual(self.login('salah').status_code, 429)   # percobaan ke-5 langsung mengunci
        r = self.login('SandiBenar2026x')
        self.assertEqual(r.status_code, 429)
        self.assertGreater(r.json()['retry_after'], 0)
        self.assertLessEqual(r.json()['retry_after'], 900)

    def test_empat_kali_salah_belum_terkunci_dan_sandi_benar_menghapus_hitungan(self):
        for _ in range(4):
            self.login('salah')
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)
        for _ in range(4):
            self.login('salah')
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)

    def test_pesan_gagal_menyebut_sisa_percobaan(self):
        r = self.login('salah')
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()['sisa_percobaan'], 4)

    def test_username_tidak_ada_diperlakukan_sama_anti_enumerasi(self):
        for _ in range(5):
            self.login('x', username='hantu')
        self.assertEqual(self.login('x', username='hantu').status_code, 429)

    def test_kegagalan_dan_penguncian_tercatat_di_audit_log(self):
        for _ in range(5):
            self.login('salah')
        self.login('salah')
        self.assertEqual(SecurityAuditLog.objects.filter(event='LOGIN_FAILED').count(), 5)
        self.assertTrue(SecurityAuditLog.objects.filter(event='LOGIN_FAILED', keterangan__contains='dikunci').exists())

    def test_kunci_berakhir_setelah_masa_habis(self):
        for _ in range(5):
            self.login('salah')
        cache.clear()   # simulasi 15 menit berlalu
        self.assertEqual(self.login('SandiBenar2026x').status_code, 200)

    def test_owner_bisa_membuka_kunci_akun_lain(self):
        owner = get_user_model().objects.create_user(username='own_kunci', password='OwnerSandi2026x', role='owner')
        for _ in range(5):
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
