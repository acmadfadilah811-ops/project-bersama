"""Rentang dashboard yang bisa digeser (Harian/Mingguan/Bulanan/Tahunan) dan grafik
pembanding periode sebelumnya -- dashboard operasional & Ringkasan (2026-11-10)."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api import executive_dashboard as ed
from api.models import Order, OrderItem
from api.pos_models import POSSale

User = get_user_model()
URL = '/api/dashboard/penjualan/'


class RentangMurniTests(APITestCase):
    """Fungsi rentang tanpa database."""

    def test_rentang_tiap_mode(self):
        hari = date(2026, 11, 10)  # Selasa
        self.assertEqual(ed.rentang('harian', 0, hari), (hari, hari))
        self.assertEqual(ed.rentang('harian', -1, hari), (date(2026, 11, 9), date(2026, 11, 9)))
        self.assertEqual(ed.rentang('mingguan', 0, hari), (date(2026, 11, 9), date(2026, 11, 15)))
        self.assertEqual(ed.rentang('bulanan', 0, hari), (date(2026, 11, 1), date(2026, 11, 30)))
        self.assertEqual(ed.rentang('tahunan', -1, hari), (date(2025, 1, 1), date(2025, 12, 31)))

    def test_bulanan_mundur_lewat_tahun(self):
        self.assertEqual(ed.rentang('bulanan', -11, date(2026, 11, 10)), (date(2025, 12, 1), date(2025, 12, 31)))
        self.assertEqual(ed.rentang('bulanan', -1, date(2026, 3, 31)), (date(2026, 2, 1), date(2026, 2, 28)))

    def test_pembanding_dipotong_sepanjang_periode_berjalan(self):
        p = ed.info_periode('bulanan', 0, date(2026, 11, 10))
        self.assertEqual((p['mulai'], p['akhir']), (date(2026, 11, 1), date(2026, 11, 10)))
        self.assertEqual((p['sebelum_mulai'], p['sebelum_akhir']), (date(2026, 10, 1), date(2026, 10, 10)))
        self.assertEqual(p['label'], 'November 2026')

    def test_periode_lalu_tidak_dipotong(self):
        p = ed.info_periode('bulanan', -1, date(2026, 11, 10))
        self.assertEqual((p['mulai'], p['akhir']), (date(2026, 10, 1), date(2026, 10, 31)))
        self.assertEqual((p['sebelum_mulai'], p['sebelum_akhir']), (date(2026, 9, 1), date(2026, 9, 30)))

    def test_geser_masa_depan_dan_sampah_jadi_nol(self):
        self.assertEqual(ed.baca_geser('3'), 0)
        self.assertEqual(ed.baca_geser('abc'), 0)
        self.assertEqual(ed.baca_geser(None), 0)
        self.assertEqual(ed.baca_geser('-2'), -2)


class DashboardPenjualanTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_rentang', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir_rentang', password='x', role='kasir')
        self.now = timezone.localtime(timezone.now())

    def _pos(self, nomor, total, waktu, status='paid'):
        sale = POSSale.objects.create(
            nomor=nomor, kasir=self.owner, status=status, total=total, dibayar=total, metode_bayar='Cash',
        )
        POSSale.objects.filter(pk=sale.pk).update(created_at=waktu)  # created_at auto_now_add
        return sale

    def _order(self, order_id, harga, dp, waktu, status_global='proses'):
        order = Order.objects.create(
            id=order_id, nama='Pelanggan', nomor_wa='08123456789', total_harga=harga,
            dp_dibayar=dp, status_global=status_global, waktu=waktu,
        )
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=harga)
        order.refresh_from_db()
        return order

    def test_kasir_ditolak(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_mode_tidak_dikenal_400(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(URL, {'mode': 'kuartalan'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('tidak dikenal', res.json()['error'])

    def test_total_terbayar_belum_dibayar_hari_ini(self):
        self._pos('POS-R-1', 30000, self.now)
        order = self._order('ORD-R-1', 100000, 40000, self.now)
        self._order('ORD-R-BATAL', 500000, 0, self.now, status_global='batal')
        self._pos('POS-R-HOLD', 77777, self.now, status='hold')

        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'mode': 'harian'}).json()
        total = 30000 + float(order.total_harga)
        self.assertEqual(data['total'], total)
        self.assertEqual(data['belum_dibayar'], float(order.sisa_tagihan))
        self.assertEqual(data['terbayar'], total - float(order.sisa_tagihan))
        self.assertEqual(data['jumlah_order'], 1)
        self.assertEqual(data['jumlah_pos'], 1)
        self.assertEqual(data['rata_rata'], total / 2)
        self.assertFalse(data['periode']['bisa_maju'])

    def test_delta_dibanding_kemarin(self):
        self._pos('POS-R-HARI', 150000, self.now)
        self._pos('POS-R-KEMARIN', 100000, self.now - timedelta(days=1))
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'mode': 'harian'}).json()
        self.assertEqual(data['total'], 150000.0)
        self.assertEqual(data['total_lalu'], 100000.0)
        self.assertEqual(data['delta'], 50.0)

    def test_geser_minus_satu_menampilkan_kemarin(self):
        self._pos('POS-R-KMR', 25000, self.now - timedelta(days=1))
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'mode': 'harian', 'geser': '-1'}).json()
        self.assertEqual(data['total'], 25000.0)
        self.assertTrue(data['periode']['bisa_maju'])

    def test_seri_harian_per_jam_dan_berhenti_di_jam_sekarang(self):
        hari = timezone.localdate()
        tz = timezone.get_current_timezone()
        self._pos('POS-R-JAM', 60000, datetime(hari.year, hari.month, hari.day, 10, 15, tzinfo=tz))
        p = ed.info_periode('harian', 0, hari)
        sekarang = datetime(hari.year, hari.month, hari.day, 14, 0, tzinfo=tz)
        seri = ed.seri_penjualan(p, sekarang)
        self.assertEqual(len(seri['label']), 24)
        self.assertEqual(seri['sekarang'][10], 60000.0)
        self.assertEqual(seri['sekarang'][14], 0.0)
        self.assertIsNone(seri['sekarang'][15])
        self.assertEqual(len(seri['sebelumnya']), 24)
        self.assertNotIn(None, seri['sebelumnya'])

    def test_ringkasan_eksekutif_menerima_mode_harian(self):
        self._pos('POS-R-EKS', 45000, self.now)
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/executive-dashboard/', {'period': 'harian'})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        kpi = {k['key']: k['value'] for k in data['kpi']}
        self.assertEqual(kpi['pendapatan'], 45000.0)
        self.assertEqual(len(data['seri']['label']), 24)
        self.assertEqual(data['periode']['kode'], 'harian')

    def test_ringkasan_eksekutif_kode_lama_tetap_jalan(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/executive-dashboard/', {'period': 'mtd'})
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json()['seri'])

    def test_angka_uang_decimal_tidak_bocor_jadi_string(self):
        self._pos('POS-R-DEC', Decimal('12500.50'), self.now)
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL).json()
        self.assertIsInstance(data['total'], float)
