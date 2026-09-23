"""Regresi: kunci "satu shift aktif" di SaldoKasHarianViewSet.create()
sebelumnya berlaku ke SELURUH SISTEM (query tidak difilter sama sekali) --
begitu SATU kasir di unit bisnis mana pun membuka shift, kasir di unit
bisnis LAIN (mesin kasir fisik berbeda) ikut terkunci total dan tidak bisa
transaksi sama sekali. Dilaporkan user 2026-09-23: kasir StarFoto dan kasir
Star Advertising harus bisa buka shift & transaksi bersamaan.

Diperbaiki: lock dibatasi ke `kasir__unit_bisnis_id` yang sama dengan kasir
yang sedang buka shift. Perilaku lama (satu kasir aktif per waktu) TETAP
berlaku untuk kasir dalam unit bisnis yang sama -- lihat
tests_shift_ganti_operator.py, tidak diubah/dilemahkan.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import UnitBisnis

User = get_user_model()


class ShiftParalelAntarUnitBisnisTests(APITestCase):
    def setUp(self):
        # get_or_create: migration api.0134_seed_unit_bisnis sudah menaburkan
        # baris "StarFoto"/"Star Advertising" di DB (nama unique) -- create()
        # polos tabrakan dengan seed itu.
        self.starfoto, _ = UnitBisnis.objects.get_or_create(nama='StarFoto')
        self.staradv, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising')
        self.kasir_starfoto = User.objects.create_user(
            username='kasir_starfoto_paralel', password='secret', role='kasir', unit_bisnis=self.starfoto,
        )
        self.kasir_staradv = User.objects.create_user(
            username='kasir_staradv_paralel', password='secret', role='kasir', unit_bisnis=self.staradv,
        )
        self.kasir_starfoto_2 = User.objects.create_user(
            username='kasir_starfoto_2_paralel', password='secret', role='kasir', unit_bisnis=self.starfoto,
        )

    def _buka_shift(self, user, kas_awal=10000):
        self.client.force_authenticate(user)
        return self.client.post('/api/saldo-kas-harian/', {'shift': 'Shift Test', 'kas_awal': kas_awal}, format='json')

    def test_kasir_unit_bisnis_berbeda_bisa_buka_shift_bersamaan(self):
        res1 = self._buka_shift(self.kasir_starfoto)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.content)

        res2 = self._buka_shift(self.kasir_staradv)
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED, res2.content)

    def test_kasir_unit_bisnis_sama_tetap_saling_mengunci(self):
        res1 = self._buka_shift(self.kasir_starfoto)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.content)

        res2 = self._buka_shift(self.kasir_starfoto_2)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(self.kasir_starfoto.username, str(res2.data))
