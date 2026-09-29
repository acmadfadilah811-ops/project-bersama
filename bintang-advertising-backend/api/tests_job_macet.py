"""Peringatan Pekerjaan Macet (PRD-10 UAT, 2026-09-29).

JobBoard.dibuat_pada + pengaturan job_macet_jam_antrean/job_macet_jam_dikerjakan
-- deteksi macetnya sendiri ada di frontend (getMacetInfo, JobMacetBadge.jsx),
di sini hanya dipastikan sumber datanya benar: kolom waktu terisi otomatis dan
pengaturan ambang bisa dibaca/diubah lewat /api/business-settings/.
"""

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CustomUser, Divisi, JobBoard, Order, OrderItem, SystemConfig, TahapProses


class JobBoardDibuatPadaTest(APITestCase):
    def test_dibuat_pada_terisi_otomatis_saat_job_dibuat(self):
        order = Order.objects.create(id='ORD-MACET-1', nama='Budi', nomor_wa='628111', sumber='manual')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1)
        divisi = Divisi.objects.create(nama='Cetak')
        tahap = TahapProses.objects.create(nama='Cetak', divisi=divisi)

        sebelum = timezone.now()
        job = JobBoard.objects.create(order_item=item, tahap=tahap)
        sesudah = timezone.now()

        self.assertIsNotNone(job.dibuat_pada)
        self.assertGreaterEqual(job.dibuat_pada, sebelum)
        self.assertLessEqual(job.dibuat_pada, sesudah)


class BusinessSettingsJobMacetTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = CustomUser.objects.create_user(username='owner1', password='rahasia123', role='owner')
        cls.staff = CustomUser.objects.create_user(username='staff1', password='rahasia123', role='staff')

    def test_bawaan_24_dan_8_jam_ketika_belum_diatur(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(reverse('business-settings'), secure=True)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['job_macet_jam_antrean'], 24)
        self.assertEqual(res.data['job_macet_jam_dikerjakan'], 8)

    def test_owner_bisa_ubah_ambang_dan_tersimpan(self):
        self.client.force_authenticate(self.owner)
        res = self.client.patch(
            reverse('business-settings'),
            {'job_macet_jam_antrean': 48, 'job_macet_jam_dikerjakan': 4},
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['job_macet_jam_antrean'], 48)
        self.assertEqual(res.data['job_macet_jam_dikerjakan'], 4)

        # Dibaca ulang dari SystemConfig (bukan cuma echo response POST).
        res2 = self.client.get(reverse('business-settings'), secure=True)
        self.assertEqual(res2.data['job_macet_jam_antrean'], 48)
        self.assertEqual(res2.data['job_macet_jam_dikerjakan'], 4)
        self.assertEqual(SystemConfig.objects.get(key='job_macet_jam_antrean').value, '48')

    def test_staff_tidak_boleh_ubah_pengaturan(self):
        self.client.force_authenticate(self.staff)
        res = self.client.patch(reverse('business-settings'), {'job_macet_jam_antrean': 1}, secure=True)
        self.assertEqual(res.status_code, 403)

    def test_nilai_rusak_di_systemconfig_jatuh_ke_bawaan(self):
        SystemConfig.objects.create(key='job_macet_jam_antrean', value='bukan-angka')
        self.client.force_authenticate(self.owner)
        res = self.client.get(reverse('business-settings'), secure=True)
        self.assertEqual(res.data['job_macet_jam_antrean'], 24)
