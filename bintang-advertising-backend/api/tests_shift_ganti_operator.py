"""Kasir di advertising ini bergantian pakai satu mesin kasir fisik — tidak
boleh dua akun kasir sama-sama punya shift terbuka di waktu yang sama.
Lihat SaldoKasHarianViewSet.create() (api/views/pos.py)."""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class SatuShiftAktifTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_ganti_op', password='secret', role='owner')
        self.kasir1 = User.objects.create_user(username='kasir_ganti_op_1', password='secret', role='kasir')
        self.kasir2 = User.objects.create_user(username='kasir_ganti_op_2', password='secret', role='kasir')

    def _buka_shift(self, user, kas_awal=10000):
        self.client.force_authenticate(user)
        return self.client.post('/api/saldo-kas-harian/', {'shift': 'Shift Test', 'kas_awal': kas_awal}, format='json')

    def test_kasir_kedua_tidak_bisa_buka_shift_selagi_kasir_pertama_aktif(self):
        res1 = self._buka_shift(self.kasir1)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        res2 = self._buka_shift(self.kasir2)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(self.kasir1.username, str(res2.data))

    def test_owner_pun_tidak_bisa_buka_shift_baru_selagi_kasir_aktif(self):
        self._buka_shift(self.kasir1)

        res = self._buka_shift(self.owner)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_kasir_kedua_bisa_buka_shift_setelah_kasir_pertama_tutup(self):
        res1 = self._buka_shift(self.kasir1)
        shift_id = res1.data['id']
        self.client.post(f'/api/saldo-kas-harian/{shift_id}/close/', {'kas_akhir': 10000}, format='json')

        res2 = self._buka_shift(self.kasir2)
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

    def test_kasir_tidak_bisa_buka_shift_kedua_untuk_dirinya_sendiri(self):
        self._buka_shift(self.kasir1)

        res = self._buka_shift(self.kasir1)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
