"""KPI karyawan (2026-11-02): metrik ERP untuk capaian otomatis HR + KPI Saya di dashboard."""
from datetime import date, timedelta
from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses
from .pos_models import POSSale
from .services.metrik_kpi import hitung_metrik

KUNCI = 'rahasia-hr-bridge-uji'


@override_settings(SECURE_SSL_REDIRECT=False)
class MetrikKpiTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.divisi = Divisi.objects.create(nama='Divisi KPI')
        self.tahap = TahapProses.objects.create(divisi=self.divisi, nama='Cetak KPI', urutan=1)
        self.staff = CustomUser.objects.create_user(
            username='staff.kpi', password='x', role='staff', hr_employee_id=701, email='staff.kpi@uji.local',
        )
        self.kasir = CustomUser.objects.create_user(
            username='kasir.kpi', password='x', role='kasir', hr_employee_id=702, email='kasir.kpi@uji.local',
        )
        self.order = Order.objects.create(id='ORD-KPI-1', nomor_wa='0811', nama='Pelanggan', dilayani_oleh=self.kasir, total_harga=250000, status_global='proses')
        item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1, harga_jual=250000)
        self.item = item
        self.hari_ini = timezone.localdate()

    def _job(self, status, insentif=0, hari=0):
        job = JobBoard.objects.create(order_item=self.item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan=status)
        JobBoard.objects.filter(pk=job.pk).update(
            insentif=insentif, waktu_selesai=timezone.now() - timedelta(days=hari),
        )
        return job

    def test_spk_dan_insentif_hanya_yang_selesai_di_periode(self):
        self._job('selesai', 15000)
        self._job('selesai', 5000)
        self._job('gagal', 9999)
        self._job('selesai', 7000, hari=60)  # di luar periode
        m = hitung_metrik(self.staff, self.hari_ini - timedelta(days=7), self.hari_ini)
        self.assertEqual((m['spk_selesai'], m['spk_gagal'], m['insentif']), (2, 1, 20000))

    def test_omzet_kasir_penjualan_lunas_plus_pesanan_aktif(self):
        POSSale.objects.create(nomor='POS-KPI-1', kasir=self.kasir, total=100000, status='paid')
        POSSale.objects.create(nomor='POS-KPI-2', kasir=self.kasir, total=50000, status='void')
        POSSale.objects.create(nomor='POS-KPI-3', kasir=self.staff, dilayani_oleh=self.kasir, total=30000, status='paid')
        Order.objects.create(id='ORD-KPI-2', nomor_wa='0812', nama='B', dilayani_oleh=self.kasir, total_harga=999999, status_global='batal')
        m = hitung_metrik(self.kasir, self.hari_ini, self.hari_ini)
        # 100.000 + 30.000 (dilayani kasir) + pesanan proses 250.000
        self.assertEqual(m['omzet_kasir'], 380000)

    def _bridge(self, **params):
        return self.client.get('/api/bridge/metrik-kpi/', params, HTTP_X_API_KEY=KUNCI, secure=True)

    @mock.patch.dict('os.environ', {'HR_BRIDGE_API_KEY': KUNCI})
    def test_bridge_butuh_kunci_dan_parameter_valid(self):
        self.assertEqual(self.client.get('/api/bridge/metrik-kpi/', secure=True).status_code, 401)
        awal, akhir = self.hari_ini.isoformat(), self.hari_ini.isoformat()
        self.assertEqual(self._bridge(hr_employee_id=701, dari='bukan-tanggal', sampai=akhir).status_code, 400)
        self.assertEqual(self._bridge(hr_employee_id='x', dari=awal, sampai=akhir).status_code, 400)
        self._job('selesai', 4000)
        res = self._bridge(hr_employee_id=701, dari=awal, sampai=akhir)
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual((res.data['terhubung'], res.data['spk_selesai'], res.data['insentif']), (True, 1, 4000))

    @mock.patch.dict('os.environ', {'HR_BRIDGE_API_KEY': KUNCI})
    def test_karyawan_hr_tanpa_akun_erp_bukan_galat(self):
        hari = self.hari_ini.isoformat()
        res = self._bridge(hr_employee_id=99999, dari=hari, sampai=hari)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['terhubung'])

    @mock.patch.dict('os.environ', {'INSIGHTS_BRIDGE_API_KEY': 'k'})
    def test_kpi_saya_meneruskan_hasil_hr_dan_cache(self):
        self.client.force_authenticate(self.staff)
        jawaban = mock.Mock()
        jawaban.json.return_value = {'objektif': [{'judul': 'Target November', 'progres': 40, 'key_results': []}]}
        with mock.patch('api.views.kpi.requests.get', return_value=jawaban) as get:
            res = self.client.get('/api/kpi-saya/', secure=True)
            self.assertEqual(res.status_code, 200, res.content)
            self.assertEqual(res.data['objektif'][0]['judul'], 'Target November')
            self.assertEqual(get.call_args.kwargs['params'], {'hr_employee_id': 701})
            self.client.get('/api/kpi-saya/', secure=True)
            self.assertEqual(get.call_count, 1)  # kedua dari cache
            self.client.get('/api/kpi-saya/?segar=1', secure=True)
            self.assertEqual(get.call_count, 2)  # paksa segar

    def test_kpi_saya_tanpa_tautan_hr(self):
        lepas = CustomUser.objects.create_user(username='tanpa.hr', password='x', role='staff', email='tanpa.hr@uji.local')
        self.client.force_authenticate(lepas)
        res = self.client.get('/api/kpi-saya/', secure=True)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['terhubung'])

    def test_kpi_saya_butuh_login(self):
        self.assertIn(self.client.get('/api/kpi-saya/', secure=True).status_code, (401, 403))


@override_settings(SECURE_SSL_REDIRECT=False)
class MetrikKpiTambahanTest(APITestCase):
    """Metrik tambahan untuk KPI Karyawan HR (2026-11-14)."""

    def setUp(self):
        from .models import UnitBisnis

        self.unit = UnitBisnis.objects.create(nama='Digital Printing KPI')
        self.divisi = Divisi.objects.create(nama='Divisi KPI 2')
        self.tahap = TahapProses.objects.create(divisi=self.divisi, nama='Cetak KPI 2', urutan=1)
        self.staff = CustomUser.objects.create_user(username='op.kpi', password='x', role='staff', unit_bisnis=self.unit)
        self.kasir = CustomUser.objects.create_user(username='ksr.kpi', password='x', role='kasir', unit_bisnis=self.unit)
        self.order = Order.objects.create(
            id='ORD-KPI-T1', nomor_wa='0813', nama='C', dilayani_oleh=self.kasir, total_harga=400000,
            status_global='proses', unit_bisnis=self.unit,
        )
        self.item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=2, harga_jual=400000, panjang=2, lebar=1.5)
        OrderItem.objects.filter(pk=self.item.pk).update(luas=3.0)
        self.hari_ini = timezone.localdate()

    def test_order_produksi_kesalahan_dan_omzet(self):
        POSSale.objects.create(nomor='POS-KPI-T1', kasir=self.kasir, total=100000, status='paid', unit_bisnis=self.unit)
        job = JobBoard.objects.create(order_item=self.item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan='selesai')
        JobBoard.objects.filter(pk=job.pk).update(waktu_selesai=timezone.now())
        gagal = JobBoard.objects.create(order_item=self.item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan='gagal')
        JobBoard.objects.filter(pk=gagal.pk).update(waktu_selesai=timezone.now())

        kasir = hitung_metrik(self.kasir, self.hari_ini, self.hari_ini)
        self.assertEqual(kasir['jumlah_order'], 2)  # 1 nota kasir + 1 pesanan
        self.assertEqual(kasir['omzet_divisi'], 500000)
        self.assertEqual(kasir['omzet_perusahaan'], 500000)
        self.assertIsNone(kasir['kepuasan'])

        op = hitung_metrik(self.staff, self.hari_ini, self.hari_ini)
        self.assertEqual(op['produksi_m2'], 6.0)  # luas 3 m2 x qty 2
        self.assertEqual(op['produksi_qty'], 2.0)
        self.assertEqual(op['kesalahan'], 1)
        self.assertIsNone(op['akurasi_opname'])

    def test_kepuasan_dari_survei_transaksi_yang_dilayani(self):
        from .survei_models import SurveiKepuasan

        SurveiKepuasan.objects.create(order=self.order, rata_rata=4.5)
        sale = POSSale.objects.create(nomor='POS-KPI-T2', kasir=self.kasir, total=10000, status='paid')
        SurveiKepuasan.objects.create(pos_sale=sale, rata_rata=3.5)
        self.assertEqual(hitung_metrik(self.kasir, self.hari_ini, self.hari_ini)['kepuasan'], 4.0)
