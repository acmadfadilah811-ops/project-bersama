"""Test: SPK ke tahap berbeda membatalkan job "hantu" yang belum tersentuh.

OrderItemSerializer.create()/update() otomatis membuat 1 JobBoard di tahap
pertama global (by urutan) begitu item dibuat -- sebelum kasir sempat
memilih tahap SPK sungguhan (mis. "Langsung Cetak / Produksi" yang skip
tahap Desain/Edit). Kalau tahap SPK yang diterbitkan beda dari tahap job
default itu, spk.terbitkan() (dipakai bersama /orders/{id}/assign/ dan
POS) sebelumnya membuat job BARU tanpa pernah membereskan job lama --
job lama itu permanen mengganjal `active_jobs_exist` di api/views/jobs.py,
order tak pernah pindah ke "Siap Diambil" walau produksi sungguhan sudah
tuntas. Bug ditemukan user 2026-09-07 (ORD-20260907-59F1, ORD-20260905-C652).
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Divisi, JobBoard, Order, OrderItem, TahapProses
from hr.models import Absensi

User = get_user_model()


class SpkPhantomJobTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_spkphantom', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)

        self.divisi_editor = Divisi.objects.create(nama='Editor')
        self.tahap_edit = TahapProses.objects.create(nama='Edit', divisi=self.divisi_editor, urutan=1)
        self.divisi_operator = Divisi.objects.create(nama='Operator')
        self.tahap_cetak = TahapProses.objects.create(nama='Cetak', divisi=self.divisi_operator, urutan=2)
        self.staff = User.objects.create_user(
            username='staff_spkphantom', password='pw12345', role='staff', divisi=self.divisi_operator,
        )
        # Clock-in hari ini supaya lolos IsClockedIn di /jobs/{id}/complete/
        Absensi.objects.create(
            staff=self.staff, tanggal=timezone.localdate(),
            jam_masuk=timezone.now(), status='hadir',
        )

    def _assign(self, order, tahap):
        return self.client.post(
            f'/api/orders/{order.id}/assign/',
            {'tahap_id': tahap.id, 'staff_id': self.staff.id, 'deadline': '2026-12-31'},
            format='json',
        )

    def test_spk_ke_tahap_lain_membatalkan_job_hantu_belum_tersentuh(self):
        order = Order.objects.create(nomor_wa='6281200000001', nama='Pelanggan Uji 1')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')
        hantu = JobBoard.objects.create(order_item=item, tahap=self.tahap_edit, status_pekerjaan='antrean')

        res = self._assign(order, self.tahap_cetak)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)

        hantu.refresh_from_db()
        self.assertEqual(hantu.status_pekerjaan, 'batal')

        job_cetak = JobBoard.objects.get(order_item=item, tahap=self.tahap_cetak)
        self.assertEqual(job_cetak.status_pekerjaan, 'antrean')

    def test_job_yang_sudah_dimulai_tidak_ikut_dibatalkan(self):
        """Job di tahap lain yang SUDAH diklaim/dimulai bukan hantu -- pekerjaan
        sungguhan yang sedang berjalan, jangan pernah dibatalkan otomatis."""
        order = Order.objects.create(nomor_wa='6281200000002', nama='Pelanggan Uji 2')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')
        job_berjalan = JobBoard.objects.create(
            order_item=item, tahap=self.tahap_edit, status_pekerjaan='dikerjakan',
            pic_staff=self.staff, waktu_mulai=timezone.now(),
        )

        self._assign(order, self.tahap_cetak)

        job_berjalan.refresh_from_db()
        self.assertEqual(job_berjalan.status_pekerjaan, 'dikerjakan')

    def test_order_jadi_ready_setelah_job_asli_selesai_meski_ada_job_hantu(self):
        order = Order.objects.create(nomor_wa='6281200000003', nama='Pelanggan Uji 3', status_global='review')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')
        JobBoard.objects.create(order_item=item, tahap=self.tahap_edit, status_pekerjaan='antrean')

        self._assign(order, self.tahap_cetak)

        job_cetak = JobBoard.objects.get(order_item=item, tahap=self.tahap_cetak)
        job_cetak.pic_staff = self.staff
        job_cetak.status_pekerjaan = 'dikerjakan'
        job_cetak.save()

        self.client.force_authenticate(user=self.staff)
        res = self.client.post(f'/api/jobs/{job_cetak.id}/complete/')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'ready')

    def test_terbit_ulang_tahap_sama_tidak_membatalkan_diri_sendiri(self):
        order = Order.objects.create(nomor_wa='6281200000004', nama='Pelanggan Uji 4')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')

        self._assign(order, self.tahap_cetak)
        res = self._assign(order, self.tahap_cetak)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)

        job = JobBoard.objects.get(order_item=item, tahap=self.tahap_cetak)
        self.assertEqual(job.status_pekerjaan, 'antrean')
        self.assertEqual(JobBoard.objects.filter(order_item=item).count(), 1)
