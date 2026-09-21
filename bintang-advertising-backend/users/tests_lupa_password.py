"""Lupa password: OTP + reset_token, jeda kirim ulang 15 menit, kriteria sandi baru."""
import re
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from users.views import RESET_RESEND_COOLDOWN


class LupaPasswordTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username='operatora3', password='LamaSandi1', role='staff', email='op@contoh.test')

    def minta(self, username='operatora3'):
        return self.client.post('/api/auth/forgot-password/request/', {'username': username}, format='json')

    def ambil_otp(self):
        return re.search(r'(\d{6})', mail.outbox[-1].body).group(1)

    def verifikasi(self, token, otp, sandi, username='operatora3'):
        return self.client.post('/api/auth/forgot-password/verify/', {
            'username': username, 'otp': otp, 'new_password': sandi, 'reset_token': token,
        }, format='json')

    def test_alur_normal_reset_berhasil_dan_bisa_login(self):
        r = self.minta()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['resend_after'], RESET_RESEND_COOLDOWN)
        r2 = self.verifikasi(r.json()['reset_token'], self.ambil_otp(), 'SandiBaru2026x')
        self.assertEqual(r2.status_code, 200, r2.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('SandiBaru2026x'))

    def test_kirim_ulang_sebelum_15_menit_ditolak_429_dengan_sisa_waktu(self):
        self.minta()
        r = self.minta()
        self.assertEqual(r.status_code, 429)
        self.assertGreater(r.json()['retry_after'], 0)
        self.assertLessEqual(r.json()['retry_after'], RESET_RESEND_COOLDOWN)
        self.assertEqual(len(mail.outbox), 1)   # tidak ada email kedua

    def test_kirim_ulang_setelah_15_menit_diizinkan_dan_otp_lama_mati(self):
        r1 = self.minta()
        otp_lama = self.ambil_otp()
        cache.delete('pw_reset_cd:operatora3')   # simulasi jeda 15 menit habis
        r2 = self.minta()
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertNotEqual(r1.json()['reset_token'], r2.json()['reset_token'])

    def test_jeda_berlaku_sama_untuk_username_tidak_ada_anti_enumerasi(self):
        self.minta('hantu')
        r = self.minta('hantu')
        self.assertEqual(r.status_code, 429)

    def test_sandi_lemah_ditolak_tanpa_menghanguskan_otp(self):
        r = self.minta()
        token, otp = r.json()['reset_token'], self.ambil_otp()
        for lemah in ('abcdefgh', '12345678', 'Ab1', 'operatora3'):
            x = self.verifikasi(token, otp, lemah)
            self.assertEqual(x.status_code, 400, lemah)
        # OTP masih berlaku: sandi yang benar diterima
        ok = self.verifikasi(token, otp, 'SandiBaru2026x')
        self.assertEqual(ok.status_code, 200, ok.content)

    def test_sandi_tanpa_huruf_atau_tanpa_angka_pesannya_jelas(self):
        r = self.minta()
        token, otp = r.json()['reset_token'], self.ambil_otp()
        self.assertIn('angka', self.verifikasi(token, otp, 'HurufSajaYa').json()['detail'])
        self.assertIn('huruf', self.verifikasi(token, otp, '98765432101').json()['detail'])

    def test_otp_salah_ditolak(self):
        r = self.minta()
        x = self.verifikasi(r.json()['reset_token'], '000000', 'SandiBaru2026x')
        self.assertEqual(x.status_code, 400)

    def test_tanpa_reset_token_ditolak_seperti_bug_lama(self):
        self.minta()
        x = self.client.post('/api/auth/forgot-password/verify/', {
            'username': 'operatora3', 'otp': self.ambil_otp(), 'new_password': 'SandiBaru2026x',
        }, format='json')
        self.assertEqual(x.status_code, 400)

    def test_setelah_reset_berhasil_jeda_dibuka_lagi(self):
        r = self.minta()
        self.verifikasi(r.json()['reset_token'], self.ambil_otp(), 'SandiBaru2026x')
        self.assertEqual(self.minta().status_code, 200)


class AturanSandiGantiDanResetTests(APITestCase):
    """Ganti Password (mandiri) & Reset Password (owner/manager) memakai aturan yang sama."""

    def setUp(self):
        U = get_user_model()
        self.owner = U.objects.create_user(username='own_pw', password='OwnerLama1x', role='owner')
        self.manager = U.objects.create_user(username='mgr_pw', password='ManagerLama1x', role='manager')
        self.staff = U.objects.create_user(username='stf_pw', password='StaffLama1x', role='staff')

    def ganti(self, baru, lama='StaffLama1x'):
        self.client.force_authenticate(self.staff)
        return self.client.post('/api/auth/change-password/', {'old_password': lama, 'new_password': baru}, format='json')

    def reset(self, pengubah, target, baru):
        self.client.force_authenticate(pengubah)
        return self.client.post(f'/api/users/{target.id}/reset-password/', {'new_password': baru}, format='json')

    def test_ganti_password_menolak_tanpa_huruf_atau_angka(self):
        self.assertEqual(self.ganti('12345678901').status_code, 400)
        self.assertIn('huruf', self.ganti('12345678901').json()['detail'])
        self.assertIn('angka', self.ganti('HurufSajaYa').json()['detail'])
        self.assertEqual(self.ganti('SandiBaru2026x').status_code, 200)

    def test_reset_password_owner_menolak_sandi_lemah_dan_menerima_yang_benar(self):
        r = self.reset(self.owner, self.staff, 'HurufSajaYa')
        self.assertEqual(r.status_code, 400)
        self.assertIn('angka', r.json()['error'])
        self.assertEqual(self.reset(self.owner, self.staff, 'SandiBaru2026x').status_code, 200)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password('SandiBaru2026x'))

    def test_reset_password_tetap_menolak_sandi_mirip_username(self):
        self.assertEqual(self.reset(self.manager, self.staff, 'stf_pw12345').status_code, 400)
