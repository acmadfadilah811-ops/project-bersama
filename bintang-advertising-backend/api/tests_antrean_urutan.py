"""Urutan Antrean Global (SPK-02 UAT, 2026-09-29): SPV bisa mengurutkan job
unassigned di /api/jobs/?unassigned=1&urutan=... selain bawaan (terbaru dulu).
"""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses


class UrutanAntreanGlobalTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # Urutan diterapkan setelah scoping per-role (lihat get_queryset),
        # jadi jalur admin (lihat semua) cukup untuk menguji logikanya --
        # tanpa perlu menyiapkan hierarki bawahan SPV yang tidak relevan di sini.
        cls.spv = CustomUser.objects.create_user(username='admin1', password='rahasia123', role='admin')
        divisi = Divisi.objects.create(nama='Cetak')
        cls.tahap = TahapProses.objects.create(nama='Cetak', divisi=divisi)

        order = Order.objects.create(id='ORD-URUT-1', nama='Budi', nomor_wa='628111', sumber='manual')

        def buat_job(kode, deadline=None):
            item = OrderItem.objects.create(order=order, jenis_produk=f'Produk {kode}', qty=1)
            return JobBoard.objects.create(order_item=item, tahap=cls.tahap, deadline=deadline)

        # Dibuat berurutan A, B, C -- id A < B < C, dibuat_pada A < B < C.
        cls.job_a = buat_job('A', deadline=timezone.now().date() + timedelta(days=5))
        cls.job_b = buat_job('B', deadline=None)
        cls.job_c = buat_job('C', deadline=timezone.now().date() + timedelta(days=1))

    def _ambil(self, urutan=None):
        params = {'unassigned': 1, 'status_pekerjaan': 'antrean', 'page_size': 50}
        if urutan:
            params['urutan'] = urutan
        res = self.client.get(reverse('job-list'), params, secure=True)
        self.assertEqual(res.status_code, 200)
        data = res.data.get('results', res.data)
        return [row['id'] for row in data]

    def test_bawaan_terbaru_dulu(self):
        self.client.force_authenticate(self.spv)
        urutan = self._ambil()
        self.assertEqual(
            [i for i in urutan if i in (self.job_a.id, self.job_b.id, self.job_c.id)],
            [self.job_c.id, self.job_b.id, self.job_a.id],
        )

    def test_waktu_masuk_tertua_dulu(self):
        self.client.force_authenticate(self.spv)
        urutan = self._ambil('waktu_masuk')
        self.assertEqual(
            [i for i in urutan if i in (self.job_a.id, self.job_b.id, self.job_c.id)],
            [self.job_a.id, self.job_b.id, self.job_c.id],
        )

    def test_deadline_tersegera_dulu_tanpa_deadline_di_akhir(self):
        self.client.force_authenticate(self.spv)
        urutan = self._ambil('deadline')
        self.assertEqual(
            [i for i in urutan if i in (self.job_a.id, self.job_b.id, self.job_c.id)],
            [self.job_c.id, self.job_a.id, self.job_b.id],
        )
