"""PRD-05 UAT (2026-09-29): pengembalian pekerjaan ke tahap sebelumnya wajib
alasan dan baru berlaku setelah diterima staff tujuan (bukan Kordiv/SPV)."""

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import CustomUser, Divisi, JobBoard, Order, OrderActivityLog, OrderItem, TahapProses
from .pengembalian_job_models import PengembalianJob


class PengembalianJobTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        div_editor = Divisi.objects.create(nama='Editor PRD05')
        div_operator = Divisi.objects.create(nama='Operator PRD05')
        cls.tahap_editor = TahapProses.objects.create(nama='Desain PRD05', divisi=div_editor, urutan=1)
        cls.tahap_operator = TahapProses.objects.create(nama='Cetak PRD05', divisi=div_operator, urutan=2)

        cls.kordiv_editor = CustomUser.objects.create_user(
            username='kordiv.ed05', password='rahasia123', role='kordiv', divisi=div_editor,
        )
        cls.staff_editor = CustomUser.objects.create_user(
            username='staff.ed05', password='rahasia123', role='staff', divisi=div_editor, atasan=cls.kordiv_editor,
        )
        cls.kordiv_operator = CustomUser.objects.create_user(
            username='kordiv.op05', password='rahasia123', role='kordiv', divisi=div_operator,
        )
        cls.operator = CustomUser.objects.create_user(
            username='op.op05', password='rahasia123', role='staff', divisi=div_operator, atasan=cls.kordiv_operator,
        )
        cls.staff_lain_op = CustomUser.objects.create_user(
            username='staff2.op05', password='rahasia123', role='staff', divisi=div_operator, atasan=cls.kordiv_operator,
        )
        cls.staff_editor_lain = CustomUser.objects.create_user(
            username='staff2.ed05', password='rahasia123', role='staff', divisi=div_editor, atasan=cls.kordiv_editor,
        )
        cls.manager = CustomUser.objects.create_user(username='mgr.prd05', password='rahasia123', role='manager')
        for u in (cls.kordiv_editor, cls.kordiv_operator, cls.operator, cls.staff_editor,
                  cls.staff_lain_op, cls.staff_editor_lain):
            Absensi.objects.create(staff=u, tanggal=timezone.localdate(), jam_masuk=timezone.now())

        cls.order = Order.objects.create(id='ORD-PRD05', nama='Budi', nomor_wa='628111', sumber='manual')

    def setUp(self):
        item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1)
        self.job_editor = JobBoard.objects.create(
            order_item=item, tahap=self.tahap_editor, status_pekerjaan='selesai', pic_staff=self.staff_editor,
            waktu_mulai=timezone.now(), waktu_selesai=timezone.now(),
        )
        self.job_op = JobBoard.objects.create(
            order_item=item, tahap=self.tahap_operator, status_pekerjaan='dikerjakan',
            pic_staff=self.operator, waktu_mulai=timezone.now(),
        )

    def _ajukan(self, alasan='Warna luntur, desain perlu diperbaiki', user=None):
        self.client.force_authenticate(user or self.operator)
        return self.client.post(
            reverse('kembalikan_job', args=[self.job_op.id]), {'alasan': alasan}, secure=True,
        )

    def _putuskan(self, aksi, pk, user, catatan=''):
        self.client.force_authenticate(user)
        return self.client.post(
            reverse(f'pengembalian_job_{aksi}', args=[pk]), {'catatan': catatan}, secure=True,
        )

    def test_alasan_wajib(self):
        res = self._ajukan(alasan='   ')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(PengembalianJob.objects.exists())

    def test_ajukan_mengunci_job_pengaju(self):
        res = self._ajukan()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['tahap_tujuan'], 'Desain PRD05')
        self.job_op.refresh_from_db()
        self.assertEqual(self.job_op.status_pekerjaan, 'kendala')
        self.client.force_authenticate(self.operator)
        mulai = self.client.post(reverse('job-start', args=[self.job_op.id]), secure=True)
        self.assertEqual(mulai.status_code, 400)
        self.assertIn('menunggu keputusan', mulai.data['error'])

    def test_tidak_bisa_ajukan_dua_kali(self):
        self._ajukan()
        self.assertEqual(self._ajukan().status_code, 400)

    def test_job_tahap_pertama_tidak_bisa_dikembalikan(self):
        self.client.force_authenticate(self.staff_editor)
        res = self.client.post(
            reverse('kembalikan_job', args=[self.job_editor.id]), {'alasan': 'x'}, secure=True,
        )
        self.assertEqual(res.status_code, 400)

    def test_staff_lain_tidak_bisa_mengajukan(self):
        self.assertEqual(self._ajukan(user=self.staff_editor).status_code, 403)

    def test_staff_tujuan_menerima_tahap_sebelumnya_dibuka_lagi(self):
        pid = self._ajukan().data['id']
        res = self._putuskan('terima', pid, self.staff_editor, 'Siap diperbaiki')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'diterima')
        self.assertEqual(res.data['penerima'], 'staff.ed05')
        self.job_editor.refresh_from_db()
        self.job_op.refresh_from_db()
        self.assertEqual(self.job_editor.status_pekerjaan, 'antrean')
        self.assertIsNone(self.job_editor.waktu_selesai)
        self.assertIn('Warna luntur', self.job_editor.catatan_staff[-1]['catatan'])
        self.assertEqual(self.job_op.status_pekerjaan, 'antrean')
        self.assertTrue(OrderActivityLog.objects.filter(tindakan='RETURN_ACCEPT').exists())

    def test_operator_tetap_tertahan_sampai_editor_selesai_lagi(self):
        pid = self._ajukan().data['id']
        self._putuskan('terima', pid, self.staff_editor)
        self.client.force_authenticate(self.operator)
        mulai = self.client.post(reverse('job-start', args=[self.job_op.id]), secure=True)
        self.assertEqual(mulai.status_code, 400)
        self.assertIn('Desain PRD05', mulai.data['error'])

    def test_tolak_wajib_catatan_dan_job_kembali_ke_antrean(self):
        pid = self._ajukan().data['id']
        self.assertEqual(self._putuskan('tolak', pid, self.staff_editor, '').status_code, 400)
        res = self._putuskan('tolak', pid, self.staff_editor, 'Desain sudah sesuai brief')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'ditolak')
        self.job_op.refresh_from_db()
        self.job_editor.refresh_from_db()
        self.assertEqual(self.job_op.status_pekerjaan, 'antrean')
        self.assertEqual(self.job_editor.status_pekerjaan, 'selesai')

    def test_hanya_penerima_yang_berwenang_memutuskan(self):
        pid = self._ajukan().data['id']
        # Pengaju sendiri, Kordiv pengaju, dan staff divisi lain tidak boleh.
        self.assertEqual(self._putuskan('terima', pid, self.operator).status_code, 403)
        self.assertEqual(self._putuskan('terima', pid, self.kordiv_operator).status_code, 403)
        self.assertEqual(self._putuskan('terima', pid, self.staff_lain_op).status_code, 403)
        # Staff tujuan (PIC) boleh tanpa Kordiv/SPV.
        self.assertEqual(self._putuskan('terima', pid, self.staff_editor).status_code, 200)

    def test_kordiv_tujuan_dan_manajemen_hanya_cadangan(self):
        pid1 = self._ajukan().data['id']
        self.assertEqual(self._putuskan('terima', pid1, self.kordiv_editor).status_code, 200)
        # Ajukan lagi -> manager juga bisa jadi cadangan.
        self.job_op.refresh_from_db()
        self.job_op.status_pekerjaan = 'dikerjakan'
        self.job_op.save()
        self.job_editor.status_pekerjaan = 'selesai'
        self.job_editor.save()
        pid2 = self._ajukan().data['id']
        self.assertEqual(self._putuskan('terima', pid2, self.manager).status_code, 200)

    def test_job_tujuan_tanpa_pic_bisa_diputuskan_staff_divisi_tujuan(self):
        self.job_editor.pic_staff = None
        self.job_editor.save()
        pid = self._ajukan().data['id']
        self.assertEqual(self._putuskan('terima', pid, self.staff_lain_op).status_code, 403)
        self.assertEqual(self._putuskan('tolak', pid, self.staff_editor_lain, 'Sudah sesuai').status_code, 200)

    def test_tidak_bisa_diputuskan_dua_kali(self):
        pid = self._ajukan().data['id']
        self._putuskan('terima', pid, self.staff_editor)
        self.assertEqual(self._putuskan('tolak', pid, self.staff_editor, 'x').status_code, 400)

    def test_kanban_masuk_untuk_staff_tujuan_saja(self):
        self._ajukan()
        self.client.force_authenticate(self.staff_editor)
        masuk = self.client.get(reverse('pengembalian_job_list'), {'arah': 'masuk'}, secure=True)
        self.assertEqual(len(masuk.data), 1)
        self.assertEqual(masuk.data[0]['penerima'], 'staff.ed05')
        for lain in (self.kordiv_operator, self.staff_lain_op):
            self.client.force_authenticate(lain)
            kosong = self.client.get(reverse('pengembalian_job_list'), {'arah': 'masuk'}, secure=True)
            self.assertEqual(len(kosong.data), 0)
        self.client.force_authenticate(self.operator)
        keluar = self.client.get(reverse('pengembalian_job_list'), {'arah': 'keluar'}, secure=True)
        self.assertEqual(len(keluar.data), 1)
