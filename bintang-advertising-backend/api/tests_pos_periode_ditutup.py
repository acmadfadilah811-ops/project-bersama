"""Kasir yang bertransaksi saat periode akuntansi sudah ditutup (2026-09-29):
sebelumnya 500 polos; sekarang 400 dengan kalimat yang bisa dimengerti kasir,
tanpa istilah/kode akuntansi."""

from unittest import mock

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.test import APITestCase

from .models import CustomUser

PESAN_TEKNIS = "Periode Sep 2026 (Ditutup) sudah ditutup (Tutup Buku), tidak bisa posting."


class PosPeriodeDitutupTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = CustomUser.objects.create_user(username='owner.ptp', password='rahasia123', role='owner')

    def test_transaksi_pos_ditolak_dengan_pesan_jelas(self):
        self.client.force_authenticate(self.owner)
        with mock.patch('api.pos_views.create_sale', side_effect=DjangoValidationError(PESAN_TEKNIS)):
            res = self.client.post('/api/pos/sales/', {'items': [], 'status': 'paid'}, format='json', secure=True)
        self.assertEqual(res.status_code, 400)
        self.assertIn('periode pembukuan', res.data['error'])
        self.assertIn('Hubungi Owner atau Finance', res.data['error'])
        self.assertNotIn('Tutup Buku', res.data['error'])
        self.assertNotIn('posting', res.data['error'])

    def test_validasi_lain_tetap_menampilkan_pesan_aslinya(self):
        self.client.force_authenticate(self.owner)
        with mock.patch('api.pos_views.create_sale', side_effect=DjangoValidationError('Stok tidak cukup.')):
            res = self.client.post('/api/pos/sales/', {'items': [], 'status': 'paid'}, format='json', secure=True)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['error'], 'Stok tidak cukup.')
