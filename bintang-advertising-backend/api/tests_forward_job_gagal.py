"""ForwardJobView aksi='gagal' -- job ditandai GAGAL (bukan 'selesai') saat
staff mencatat kondisi_hasil='kendala' di Penggunaan Mesin/hasil cetak
bermasalah (instruksi user 2026-09-09). Lihat api/views/orders.py::ForwardJobView."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import Divisi, JobBoard, Order, OrderItem, TahapProses

User = get_user_model()


class ForwardJobGagalTest(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Gagal Test')
        self.tahap = TahapProses.objects.create(nama='Tahap Gagal Test', divisi=self.divisi, urutan=1)
        self.staff = User.objects.create_user(
            username='staff_gagal_test', password='pw12345', role='staff', divisi=self.divisi,
        )
        Absensi.objects.create(staff=self.staff, tanggal=timezone.localdate(), jam_masuk=timezone.now())
        self.order = Order.objects.create(id='ORD-GAGAL-1', nomor_wa='08133333333', nama='Pelanggan Gagal Test')
        self.item = OrderItem.objects.create(order=self.order, jenis_produk='Item Gagal Test', qty=1, harga_jual=10000)
        self.job = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan='dikerjakan',
        )
        self.client.force_authenticate(self.staff)

    def _forward(self, **payload):
        return self.client.post(f'/api/jobs/{self.job.id}/forward/', payload, format='json')

    def test_aksi_gagal_menandai_job_gagal_bukan_selesai(self):
        res = self._forward(aksi='gagal', alasan_gagal='Mesin DocuColor macet, hasil cetak reject.')
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'gagal')
        self.assertEqual(self.job.alasan_gagal, 'Mesin DocuColor macet, hasil cetak reject.')

    def test_aksi_gagal_wajib_isi_alasan(self):
        res = self._forward(aksi='gagal')
        self.assertEqual(res.status_code, 400)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'dikerjakan')  # tidak berubah

    def test_aksi_gagal_tidak_mengubah_order_jadi_ready(self):
        """Beda dari 'selesai' -- job gagal TIDAK boleh memicu
        order.status_global='ready' (item ini belum benar-benar tuntas)."""
        self.order.status_global = 'proses'
        self.order.save()
        self._forward(aksi='gagal', alasan_gagal='Bahan sobek saat dicetak.')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status_global, 'proses')

    def test_job_sudah_gagal_tidak_bisa_diforward_ulang(self):
        self.job.status_pekerjaan = 'gagal'
        self.job.save()
        res = self._forward(aksi='gagal', alasan_gagal='Coba lagi')
        self.assertEqual(res.status_code, 400)

    def test_aksi_selesai_tetap_jalan_normal(self):
        """Regresi: aksi='gagal' baru tidak boleh mengganggu aksi 'selesai' yang sudah ada."""
        res = self._forward(aksi='selesai')
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'selesai')
