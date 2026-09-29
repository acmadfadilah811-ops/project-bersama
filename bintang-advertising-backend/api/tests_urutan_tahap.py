"""PRD-04 UAT (2026-09-29): job tahap berikutnya (Operator) hanya bisa dimulai
setelah tahap sebelumnya (Editor) pada item yang sama selesai."""

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses


class MulaiSetelahTahapSebelumnyaTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        div_editor = Divisi.objects.create(nama='Editor')
        div_operator = Divisi.objects.create(nama='Operator')
        cls.tahap_editor = TahapProses.objects.create(nama='Desain PRD04', divisi=div_editor, urutan=1)
        cls.tahap_operator = TahapProses.objects.create(nama='Cetak PRD04', divisi=div_operator, urutan=2)

        cls.operator = CustomUser.objects.create_user(
            username='op.prd04', password='rahasia123', role='staff', divisi=div_operator,
        )
        cls.admin = CustomUser.objects.create_user(username='admin.prd04', password='rahasia123', role='admin')
        Absensi.objects.create(staff=cls.operator, tanggal=timezone.localdate(), jam_masuk=timezone.now())

        cls.order = Order.objects.create(id='ORD-PRD04', nama='Budi', nomor_wa='628111', sumber='manual')

    def _item(self, kode):
        return OrderItem.objects.create(order=self.order, jenis_produk=f'Banner {kode}', qty=1)

    def _job_editor(self, item, status='dikerjakan'):
        return JobBoard.objects.create(order_item=item, tahap=self.tahap_editor, status_pekerjaan=status)

    def _job_operator(self, item):
        return JobBoard.objects.create(
            order_item=item, tahap=self.tahap_operator, status_pekerjaan='antrean', pic_staff=self.operator,
        )

    def _start(self, job):
        self.client.force_authenticate(self.operator)
        return self.client.post(reverse('job-start', args=[job.id]), secure=True)

    def test_operator_tidak_bisa_mulai_selama_editor_belum_selesai(self):
        item = self._item('A')
        self._job_editor(item, 'dikerjakan')
        job_op = self._job_operator(item)
        res = self._start(job_op)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Desain PRD04', res.data['error'])
        job_op.refresh_from_db()
        self.assertEqual(job_op.status_pekerjaan, 'antrean')

    def test_operator_bisa_mulai_setelah_editor_selesai(self):
        item = self._item('B')
        self._job_editor(item, 'selesai')
        job_op = self._job_operator(item)
        self.assertEqual(self._start(job_op).status_code, 200)
        job_op.refresh_from_db()
        self.assertEqual(job_op.status_pekerjaan, 'dikerjakan')

    def test_editor_gagal_tetap_memblokir(self):
        item = self._item('C')
        self._job_editor(item, 'gagal')
        job_op = self._job_operator(item)
        self.assertEqual(self._start(job_op).status_code, 400)

    def test_item_tanpa_tahap_editor_tidak_terblokir(self):
        item = self._item('D')
        job_op = self._job_operator(item)
        self.assertEqual(self._start(job_op).status_code, 200)

    def test_editor_pada_item_lain_tidak_memblokir(self):
        self._job_editor(self._item('E1'), 'dikerjakan')
        job_op = self._job_operator(self._item('E2'))
        self.assertEqual(self._start(job_op).status_code, 200)

    def test_patch_status_dikerjakan_juga_diblokir(self):
        item = self._item('F')
        self._job_editor(item, 'dikerjakan')
        job_op = self._job_operator(item)
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            reverse('job-detail', args=[job_op.id]), {'status_pekerjaan': 'dikerjakan'}, secure=True,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('status_pekerjaan', res.data)
        job_op.refresh_from_db()
        self.assertEqual(job_op.status_pekerjaan, 'antrean')

    def test_patch_dikerjakan_diizinkan_kalau_editor_selesai(self):
        item = self._item('G')
        self._job_editor(item, 'selesai')
        job_op = self._job_operator(item)
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            reverse('job-detail', args=[job_op.id]), {'status_pekerjaan': 'dikerjakan'}, secure=True,
        )
        self.assertEqual(res.status_code, 200)
