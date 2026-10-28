"""Pengaturan POS > Pembulatan lewat /business-settings/ (2026-10-27)."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


class PembulatanPengaturanTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner_bulat', password='x', role='owner')
        self.client.force_authenticate(self.owner)

    def test_bawaan_mati_lalu_simpan_dan_baca_kembali(self):
        res = self.client.get('/api/business-settings/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual((res.json()['pos_pembulatan_aktif'], res.json()['pos_pembulatan_kelipatan'], res.json()['pos_pembulatan_arah']), (False, 0, 'atas'))
        self.assertEqual(res.json()['pos_pembulatan_arah_diskon'], 'bawah')

        res = self.client.patch('/api/business-settings/', {'pos_pembulatan_aktif': True, 'pos_pembulatan_kelipatan': 1000, 'pos_pembulatan_arah': 'atas'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        res = self.client.get('/api/business-settings/')
        self.assertEqual((res.json()['pos_pembulatan_aktif'], res.json()['pos_pembulatan_kelipatan'], res.json()['pos_pembulatan_arah']), (True, 1000, 'atas'))

        from api import pos_settings
        self.assertEqual((pos_settings.pembulatan_kelipatan(), pos_settings.pembulatan_arah()), (1000, 'atas'))
        self.assertEqual(pos_settings.pembulatan_arah_diskon(), 'bawah')
        self.assertEqual(pos_settings.pembulatan_breakpoint(), 50)
        self.client.patch('/api/business-settings/', {'pos_pembulatan_breakpoint': 60}, format='json')
        self.assertEqual(pos_settings.pembulatan_breakpoint(), 60)

        res = self.client.patch('/api/business-settings/', {'pos_pembulatan_arah_diskon': 'terdekat'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(pos_settings.pembulatan_arah_diskon(), 'terdekat')
        self.client.patch('/api/business-settings/', {'pos_pembulatan_arah_diskon': 'bawah'}, format='json')

        # Saklar Aktif dimatikan: pembagi tersimpan tetapi pembulatan tidak berlaku (seperti Olsera).
        self.client.patch('/api/business-settings/', {'pos_pembulatan_aktif': False}, format='json')
        self.assertEqual(pos_settings.pembulatan_kelipatan(), 0)
        self.assertEqual(self.client.get('/api/business-settings/').json()['pos_pembulatan_kelipatan'], 1000)

    def test_arah_tidak_dikenal_dan_kelipatan_negatif_ditolak(self):
        self.assertEqual(self.client.patch('/api/business-settings/', {'pos_pembulatan_arah': 'acak'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/business-settings/', {'pos_pembulatan_arah_diskon': 'acak'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/business-settings/', {'pos_pembulatan_breakpoint': 100}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/business-settings/', {'pos_pembulatan_kelipatan': -5}, format='json').status_code, 400)
