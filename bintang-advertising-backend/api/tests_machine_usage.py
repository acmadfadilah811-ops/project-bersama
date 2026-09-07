"""Test API Penggunaan Mesin (Mesin, PenggunaanMesin, MaintenanceMesin) --
lihat api/machine_models.py dan api/views/machine.py untuk konteks lengkap
fitur ini (disetujui user 2026-09-07)."""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Mesin, PenggunaanMesin, MaintenanceMesin

User = get_user_model()


class MesinViewSetTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_mesin', password='pw12345', role='owner')
        self.staff = User.objects.create_user(username='staff_mesin', password='pw12345', role='staff')
        self.mesin = Mesin.objects.create(nama='DocuColor 1', tipe='docucolor', ambang_servis_klik=50000)

    def test_staff_bisa_baca_daftar_mesin(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/mesin/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_dilarang_membuat_mesin(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/mesin/', {'nama': 'Banner 1', 'tipe': 'cetak_banner'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_membuat_mesin(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/mesin/', {'nama': 'Printer 1', 'tipe': 'printer'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Mesin.objects.count(), 2)

    def test_total_klik_dan_perlu_servis(self):
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=100, lembar_mono=200)
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=49800, lembar_mono=0)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/mesin/{self.mesin.id}/')
        self.assertEqual(res.data['total_klik'], 50100)
        self.assertTrue(res.data['perlu_servis'])

    def test_klik_sejak_servis_terakhir_reset_setelah_maintenance(self):
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=60000, lembar_mono=0)
        MaintenanceMesin.objects.create(mesin=self.mesin, jenis='Servis Rutin', counter_saat_servis=60000)
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=1000, lembar_mono=0)

        self.mesin.refresh_from_db()
        self.assertEqual(self.mesin.total_klik, 61000)
        self.assertEqual(self.mesin.klik_sejak_servis_terakhir, 1000)
        self.assertFalse(self.mesin.perlu_servis)


class PenggunaanMesinViewSetTest(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='staff_log', password='pw12345', role='staff')
        self.staff2 = User.objects.create_user(username='staff_log2', password='pw12345', role='staff')
        self.owner = User.objects.create_user(username='owner_log', password='pw12345', role='owner')
        self.mesin = Mesin.objects.create(nama='DocuColor 2', tipe='docucolor')

    def test_staff_bisa_mencatat_penggunaan(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/penggunaan-mesin/', {
            'mesin': self.mesin.id, 'lembar_color': 10, 'lembar_mono': 5,
            'kondisi_hasil': 'ok', 'catatan_konfirmasi': 'Sesuai pesanan',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        entri = PenggunaanMesin.objects.get(id=res.data['id'])
        self.assertEqual(entri.operator, self.staff)

    def test_staff_boleh_edit_entri_sendiri(self):
        self.client.force_authenticate(user=self.staff)
        create_res = self.client.post('/api/penggunaan-mesin/', {
            'mesin': self.mesin.id, 'lembar_color': 10, 'lembar_mono': 5,
        })
        entri_id = create_res.data['id']

        res = self.client.patch(f'/api/penggunaan-mesin/{entri_id}/', {'lembar_color': 12})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_dilarang_edit_entri_staff_lain(self):
        entri = PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff2, lembar_color=10)

        self.client.force_authenticate(user=self.staff)
        res = self.client.patch(f'/api/penggunaan-mesin/{entri.id}/', {'lembar_color': 99})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_boleh_edit_entri_siapa_pun(self):
        entri = PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=10)

        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(f'/api/penggunaan-mesin/{entri.id}/', {'lembar_color': 20})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_filter_by_mesin(self):
        mesin_lain = Mesin.objects.create(nama='Printer 3', tipe='printer')
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=1)
        PenggunaanMesin.objects.create(mesin=mesin_lain, operator=self.staff, lembar_color=2)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/penggunaan-mesin/?mesin={self.mesin.id}')
        self.assertEqual(res.data['count'] if isinstance(res.data, dict) and 'count' in res.data else len(res.data), 1)


class MaintenanceMesinViewSetTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_maint', password='pw12345', role='owner')
        self.staff = User.objects.create_user(username='staff_maint', password='pw12345', role='staff')
        self.mesin = Mesin.objects.create(nama='Banner 2', tipe='cetak_banner')

    def test_staff_bisa_baca_riwayat_maintenance(self):
        MaintenanceMesin.objects.create(mesin=self.mesin, jenis='Ganti Pisau Potong')

        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/maintenance-mesin/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_dilarang_mencatat_maintenance(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/maintenance-mesin/', {'mesin': self.mesin.id, 'jenis': 'Servis Rutin'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_mencatat_maintenance(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/maintenance-mesin/', {'mesin': self.mesin.id, 'jenis': 'Servis Rutin'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MaintenanceMesin.objects.get(id=res.data['id']).dicatat_oleh, self.owner)
