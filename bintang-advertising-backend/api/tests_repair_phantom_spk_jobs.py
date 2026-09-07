"""Test management command repair_phantom_spk_jobs -- perbaikan satu kali
untuk order yang tersangkut karena job hantu (lihat api/spk.py dan
api/management/commands/repair_phantom_spk_jobs.py untuk konteks lengkap).
"""
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from api.models import Divisi, JobBoard, Order, OrderItem, TahapProses

User = get_user_model()


class RepairPhantomSpkJobsTest(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='staff_repair', password='pw12345', role='staff')
        self.divisi_editor = Divisi.objects.create(nama='Editor')
        self.tahap_edit = TahapProses.objects.create(nama='Edit', divisi=self.divisi_editor, urutan=1)
        self.divisi_operator = Divisi.objects.create(nama='Operator')
        self.tahap_cetak = TahapProses.objects.create(nama='Cetak', divisi=self.divisi_operator, urutan=2)

    def _order_tersangkut(self, suffix):
        order = Order.objects.create(nomor_wa=f'62812000000{suffix}', nama=f'Uji {suffix}', status_global='desain')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')
        JobBoard.objects.create(order_item=item, tahap=self.tahap_edit, status_pekerjaan='antrean')
        JobBoard.objects.create(
            order_item=item, tahap=self.tahap_cetak, status_pekerjaan='selesai',
            pic_staff=self.staff,
        )
        return order

    def test_membereskan_order_tersangkut(self):
        order = self._order_tersangkut('1')

        out = StringIO()
        call_command('repair_phantom_spk_jobs', stdout=out)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'ready')
        hantu = JobBoard.objects.get(order_item__order=order, tahap=self.tahap_edit)
        self.assertEqual(hantu.status_pekerjaan, 'batal')
        self.assertTrue(order.activity_logs.filter(tindakan='READY_ORDER').exists())

    def test_dry_run_tidak_menyimpan_perubahan(self):
        order = self._order_tersangkut('2')

        out = StringIO()
        call_command('repair_phantom_spk_jobs', '--dry-run', stdout=out)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'desain')
        hantu = JobBoard.objects.get(order_item__order=order, tahap=self.tahap_edit)
        self.assertEqual(hantu.status_pekerjaan, 'antrean')

    def test_order_dengan_job_aktif_asli_tidak_disentuh(self):
        order = Order.objects.create(nomor_wa='6281200000039', nama='Masih Proses', status_global='proses')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')
        JobBoard.objects.create(order_item=item, tahap=self.tahap_edit, status_pekerjaan='antrean')
        JobBoard.objects.create(order_item=item, tahap=self.tahap_cetak, status_pekerjaan='dikerjakan', pic_staff=self.staff)

        call_command('repair_phantom_spk_jobs', stdout=StringIO())

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'proses')

    def test_tahap_lanjutan_belum_dikerjakan_tidak_disentuh(self):
        """Kebalikan dari kasus hantu: tahap DEFAULT (Edit, urutan terkecil)
        sudah genuinely dikerjakan & selesai oleh staf, tahap LANJUTAN
        (Cetak) masih 'antrean' murni belum diklaim siapa pun -- ini
        pekerjaan sungguhan yang belum tuntas, BUKAN job hantu. Order tidak
        boleh dipaksa 'ready' (bug ditemukan saat verifikasi ulang
        2026-09-07: heuristik lama salah menandai kasus persis ini)."""
        order = Order.objects.create(nomor_wa='6281200000005', nama='Masih Cetak', status_global='review')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner')
        JobBoard.objects.create(
            order_item=item, tahap=self.tahap_edit, status_pekerjaan='selesai', pic_staff=self.staff,
        )
        JobBoard.objects.create(order_item=item, tahap=self.tahap_cetak, status_pekerjaan='antrean')

        call_command('repair_phantom_spk_jobs', stdout=StringIO())

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'review')
        cetak = JobBoard.objects.get(order_item__order=order, tahap=self.tahap_cetak)
        self.assertEqual(cetak.status_pekerjaan, 'antrean')

    def test_filter_order_id_membatasi_cakupan(self):
        target = self._order_tersangkut('3')
        lain = self._order_tersangkut('4')

        call_command('repair_phantom_spk_jobs', f'--order={target.id}', stdout=StringIO())

        target.refresh_from_db()
        lain.refresh_from_db()
        self.assertEqual(target.status_global, 'ready')
        self.assertEqual(lain.status_global, 'desain')
