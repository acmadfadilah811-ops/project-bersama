"""Karyawan dihapus di HR -> akun Bintang dihapus bersih atau, bila punya riwayat,
dinonaktifkan dan data pribadinya dikosongkan (2026-09-30)."""
import os
from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from users.models import SessionToken

from .models import CustomUser, Order

URL = '/api/bridge/hr-employee-hapus/'


class HRHapusAkunTests(APITestCase):
    def setUp(self):
        cache.clear()
        env = mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)

    def hapus(self, hr_id, key='kunci-uji'):
        return self.client.post(URL, {'hr_employee_id': hr_id}, format='json', HTTP_X_API_KEY=key, HTTP_X_FORWARDED_PROTO='https')

    def akun(self, hr_id, username, **extra):
        return CustomUser.objects.create_user(
            username=username, password='rahasia123', role=extra.pop('role', 'staff'),
            hr_employee_id=hr_id, email=f'{username}@uji.test', no_hp='0812', **extra,
        )

    def test_api_key_salah_ditolak(self):
        self.akun(701, 'bersih.satu')
        self.assertEqual(self.hapus(701, key='salah').status_code, 401)
        self.assertTrue(CustomUser.objects.filter(hr_employee_id=701).exists())

    def test_tanpa_hr_employee_id_ditolak(self):
        res = self.client.post(URL, {}, format='json', HTTP_X_API_KEY='kunci-uji', HTTP_X_FORWARDED_PROTO='https')
        self.assertEqual(res.status_code, 400)

    def test_akun_tak_dikenal_dilewati(self):
        self.assertTrue(self.hapus(99999).data.get('skipped'))

    def test_akun_tanpa_jejak_dihapus_bersih(self):
        self.akun(702, 'bersih.dua')
        res = self.hapus(702)
        self.assertEqual(res.data['mode'], 'hapus', res.data)
        self.assertFalse(CustomUser.objects.filter(hr_employee_id=702).exists())

    def test_akun_dengan_riwayat_nota_dinonaktifkan_bukan_dihapus(self):
        user = self.akun(703, 'punya.nota')
        Order.objects.create(id='ORD-HAPUS-1', nomor_wa='08199990000', nama='Pelanggan', dilayani_oleh=user)
        res = self.hapus(703)
        self.assertEqual(res.data['mode'], 'nonaktif', res.data)
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        self.assertEqual((user.email, user.no_hp), ('', None))
        self.assertEqual(user.username, 'punya.nota')  # username tetap untuk audit
        self.assertEqual(Order.objects.get(id='ORD-HAPUS-1').dilayani_oleh_id, user.id)  # riwayat utuh

    def test_atasan_dari_orang_lain_tidak_dihapus_keras(self):
        spv = self.akun(704, 'spv.punya.bawahan', role='spv')
        self.akun(705, 'bawahan.uji', atasan=spv)
        self.assertEqual(self.hapus(704).data['mode'], 'nonaktif')
        self.assertEqual(CustomUser.objects.get(hr_employee_id=705).atasan_id, spv.id)

    def test_owner_tidak_pernah_dihapus_keras(self):
        self.akun(706, 'owner.uji', role='owner')
        self.assertEqual(self.hapus(706).data['mode'], 'nonaktif')
        self.assertTrue(CustomUser.objects.filter(hr_employee_id=706).exists())

    def test_sesi_login_dicabut(self):
        user = self.akun(707, 'sesi.aktif')
        Order.objects.create(id='ORD-HAPUS-2', nomor_wa='08199990001', nama='P', dilayani_oleh=user)
        sesi = SessionToken.objects.create(
            user=user, token_jti='jti-uji-707', is_active=True,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        self.hapus(707)
        sesi.refresh_from_db()
        self.assertFalse(sesi.is_active)

    def test_akun_dengan_sesi_saja_masih_dihapus_bersih(self):
        user = self.akun(708, 'hanya.sesi')
        SessionToken.objects.create(user=user, token_jti='jti-uji-708', is_active=True, expires_at=timezone.now() + timedelta(hours=1))
        self.assertEqual(self.hapus(708).data['mode'], 'hapus')
        self.assertFalse(CustomUser.objects.filter(hr_employee_id=708).exists())

    def test_dipanggil_dua_kali_aman(self):
        user = self.akun(709, 'dua.kali')
        Order.objects.create(id='ORD-HAPUS-3', nomor_wa='08199990002', nama='P', dilayani_oleh=user)
        self.hapus(709)
        self.assertEqual(self.hapus(709).data['mode'], 'nonaktif')
