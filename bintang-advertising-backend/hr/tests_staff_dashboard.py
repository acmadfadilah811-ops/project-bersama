from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Divisi, JobBoard, TahapProses
from api.pos_models import POSSale, POSSaleItem
from api.product_models import Product

from .models import DailyAttendanceSession


class StaffDashboardAttendanceTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.divisi = Divisi.objects.create(nama='Produksi')
        self.staff = User.objects.create_user(
            username='operator', password='x', role='staff', divisi=self.divisi
        )
        self.tahap = TahapProses.objects.create(
            nama='Cetak', divisi=self.divisi, urutan=1
        )
        self.product = Product.objects.create(
            nama='Spanduk', harga_beli=10000, harga_jual_toko=50000
        )
        self.sale = POSSale.objects.create(
            nomor='POS-STAFF-001', total=Decimal('50000'), status='paid'
        )
        self.sale_item = POSSaleItem.objects.create(
            sale=self.sale,
            product=self.product,
            nama_snapshot='Spanduk 2x1',
            harga_snapshot=Decimal('50000'),
            qty=Decimal('1'),
            subtotal=Decimal('50000'),
        )
        self.job = JobBoard.objects.create(
            pos_sale_item=self.sale_item,
            tahap=self.tahap,
            pic_staff=self.staff,
            status_pekerjaan='antrean',
        )
        self.client.force_authenticate(self.staff)

    def test_dashboard_staff_memuat_spk_pos_tanpa_order_item(self):
        response = self.client.get('/api/hr/dashboard/staff/')

        self.assertEqual(response.status_code, 200, response.content)
        job = response.json()['job_aktif'][0]
        self.assertEqual(job['job_id'], self.job.id)
        self.assertEqual(job['produk'], 'Spanduk 2x1')
        self.assertEqual(job['nomor_sumber'], 'POS-STAFF-001')
        self.assertIsNone(job['order_id'])

    def test_clock_in_dan_clock_out_tetap_berhasil_dengan_spk_pos(self):
        now = timezone.now()
        DailyAttendanceSession.objects.create(
            tanggal=timezone.localdate(),
            waktu_mulai=now - timedelta(hours=1),
            batas_maksimal=now + timedelta(hours=1),
            is_active=True,
        )

        clock_in = self.client.post('/api/hr/absensi/clock-in/', {}, format='json')
        self.assertEqual(clock_in.status_code, 201, clock_in.content)

        clock_out = self.client.post('/api/hr/absensi/clock-out/', {}, format='json')
        self.assertEqual(clock_out.status_code, 200, clock_out.content)

    def test_clock_in_satu_staff_tidak_membuka_akses_staff_lain(self):
        User = get_user_model()
        staff_lain = User.objects.create_user(
            username='operator-lain', password='x', role='staff', divisi=self.divisi
        )
        now = timezone.now()
        DailyAttendanceSession.objects.create(
            tanggal=timezone.localdate(),
            waktu_mulai=now - timedelta(hours=1),
            batas_maksimal=now + timedelta(hours=1),
            is_active=True,
        )

        clock_in = self.client.post('/api/hr/absensi/clock-in/', {}, format='json')
        self.assertEqual(clock_in.status_code, 201, clock_in.content)

        self.client.force_authenticate(staff_lain)
        dashboard = self.client.get('/api/hr/dashboard/staff/')
        self.assertEqual(dashboard.status_code, 200, dashboard.content)
        self.assertEqual(dashboard.json()['absensi_hari_ini']['status'], 'belum_absen')

        papan_kerja = self.client.get('/api/jobs/')
        self.assertEqual(papan_kerja.status_code, 403, papan_kerja.content)
