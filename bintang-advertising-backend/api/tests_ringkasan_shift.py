"""Ringkasan Shift (V2) harus menampung data dari SEMUA akun kasir untuk
Owner/Manager (bukan cuma kasir yang sedang login), dan filter
tanggal_mulai/tanggal_akhir harus benar-benar menyaring di server — bukan
elemen tanggal yang cuma tampil tapi tidak difungsikan (lihat perbaikan
PosShiftSummary.jsx)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from api.finance_models import CashTransaction, CashTransactionType
from api.models import Order, OrderPayment
from api.pos_models import POSSale

User = get_user_model()


class RingkasanShiftMultiKasirTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_ringkasan', password='secret', role='owner')
        self.kasir1 = User.objects.create_user(username='kasir_ringkasan_1', password='secret', role='kasir')
        self.kasir2 = User.objects.create_user(username='kasir_ringkasan_2', password='secret', role='kasir')

    def _buka_dan_tutup_shift(self, user, kas_awal=10000, kas_akhir=10000):
        self.client.force_authenticate(user)
        res = self.client.post('/api/saldo-kas-harian/', {'shift': 'Shift Test', 'kas_awal': kas_awal}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        shift_id = res.data['id']
        res = self.client.post(f'/api/saldo-kas-harian/{shift_id}/close/', {'kas_akhir': kas_akhir}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    @staticmethod
    def _rows(response):
        return response.data.get('results', response.data) if isinstance(response.data, dict) else response.data

    def test_owner_sees_ringkasan_from_every_kasir_account(self):
        self._buka_dan_tutup_shift(self.kasir1)
        self._buka_dan_tutup_shift(self.kasir2)

        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/ringkasan-shift/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        kasir_names = {row['kasir_nama'] for row in self._rows(response)}
        self.assertIn(self.kasir1.username, kasir_names)
        self.assertIn(self.kasir2.username, kasir_names)

    def test_kasir_only_sees_own_ringkasan(self):
        self._buka_dan_tutup_shift(self.kasir1)
        self._buka_dan_tutup_shift(self.kasir2)

        self.client.force_authenticate(self.kasir1)
        response = self.client.get('/api/ringkasan-shift/')
        kasir_names = {row['kasir_nama'] for row in self._rows(response)}
        self.assertEqual(kasir_names, {self.kasir1.username})

    def test_tanggal_filter_benar_benar_menyaring(self):
        data = self._buka_dan_tutup_shift(self.kasir1)
        tanggal = data['ringkasan']['tanggal']

        self.client.force_authenticate(self.owner)
        response = self.client.get(
            '/api/ringkasan-shift/',
            {'tanggal_mulai': '2020-01-01', 'tanggal_akhir': '2020-01-02'},
        )
        self.assertEqual(len(self._rows(response)), 0)

        response = self.client.get(
            '/api/ringkasan-shift/',
            {'tanggal_mulai': tanggal, 'tanggal_akhir': tanggal},
        )
        self.assertEqual(len(self._rows(response)), 1)

    def test_rincian_kas_disimpan_dan_ditampilkan_dari_snapshot_shift(self):
        self.client.force_authenticate(self.kasir1)
        opened = self.client.post(
            '/api/saldo-kas-harian/', {'shift': 'Shift Test', 'kas_awal': 10000}, format='json',
        )
        self.assertEqual(opened.status_code, status.HTTP_201_CREATED, opened.data)
        shift_id = opened.data['id']

        POSSale.objects.create(
            nomor='POS-RINGKASAN-CASH', kasir=self.kasir1, shift_id=shift_id,
            total=25000, dibayar=25000, metode_bayar='Cash', status='paid',
        )
        tipe = CashTransactionType.objects.create(nama='Tips', tipe='pendapatan')
        CashTransaction.objects.create(
            nomor='KAS-RINGKASAN-1', arah='pendapatan', jumlah=5000,
            tipe_transaksi=tipe, shift_id=shift_id, waktu=opened.data['waktu_buka'],
        )

        closed = self.client.post(
            f'/api/saldo-kas-harian/{shift_id}/close/', {'kas_akhir': 40000}, format='json',
        )
        self.assertEqual(closed.status_code, status.HTTP_201_CREATED, closed.data)
        self.assertEqual(str(closed.data['ringkasan']['kas_awal']), '10000.00')
        self.assertEqual(str(closed.data['ringkasan']['penjualan_tunai']), '25000.00')
        self.assertEqual(str(closed.data['ringkasan']['kas_masuk']), '5000.00')
        self.assertTrue(closed.data['ringkasan']['rincian_tersedia'])

        self.client.force_authenticate(self.owner)
        listed = self.client.get('/api/ringkasan-shift/')
        row = self._rows(listed)[0]
        self.assertEqual(str(row['expected']), '40000.00')
        self.assertEqual(str(row['kas_keluar']), '0.00')

    def test_keterangan_tutup_shift_tersimpan_dan_tampil_di_ringkasan(self):
        # Bug ditemukan 2026-08-13: field `catatan` sudah diterima server
        # saat close() dan disimpan ke SaldoKasHarian, tapi tidak pernah ikut
        # disalin ke snapshot RingkasanShift (V2) — jadi laporan V2 tidak
        # pernah menampilkan keterangan kasir sama sekali.
        self.client.force_authenticate(self.kasir1)
        opened = self.client.post(
            '/api/saldo-kas-harian/', {'shift': 'Shift Keterangan', 'kas_awal': 10000}, format='json',
        )
        self.assertEqual(opened.status_code, status.HTTP_201_CREATED, opened.data)
        shift_id = opened.data['id']

        closed = self.client.post(
            f'/api/saldo-kas-harian/{shift_id}/close/',
            {'kas_akhir': 10000, 'catatan': 'Selisih Rp0, kas sudah dihitung ulang 2x.'},
            format='json',
        )
        self.assertEqual(closed.status_code, status.HTTP_201_CREATED, closed.data)
        self.assertEqual(closed.data['ringkasan']['keterangan'], 'Selisih Rp0, kas sudah dihitung ulang 2x.')

        self.client.force_authenticate(self.owner)
        listed = self.client.get('/api/ringkasan-shift/')
        row = self._rows(listed)[0]
        self.assertEqual(row['keterangan'], 'Selisih Rp0, kas sudah dihitung ulang 2x.')

    def test_keterangan_kosong_default_string_kosong(self):
        data = self._buka_dan_tutup_shift(self.kasir1)
        self.assertEqual(data['ringkasan']['keterangan'], '')

    def test_rekap_metode_mencakup_pos_dan_cicilan_order(self):
        self.client.force_authenticate(self.kasir1)
        opened = self.client.post(
            '/api/saldo-kas-harian/', {'shift': 'Shift Metode', 'kas_awal': 0}, format='json',
        )
        self.assertEqual(opened.status_code, status.HTTP_201_CREATED, opened.data)
        shift_id = opened.data['id']
        POSSale.objects.create(
            nomor='POS-RINGKASAN-QRIS', kasir=self.kasir1, shift_id=shift_id,
            total=30000, dibayar=30000, metode_bayar='QRIS', status='paid',
        )
        order = Order.objects.create(
            id='ORD-RINGKASAN-METODE', nama='Pelanggan', nomor_wa='08123456789',
            total_harga=50000, dp_dibayar=20000, sisa_tagihan=30000,
        )
        OrderPayment.objects.create(
            order=order, shift_id=shift_id, jumlah=20000,
            metode_pembayaran='Tunai', is_dp=True, dibuat_oleh=self.kasir1,
        )
        closed = self.client.post(
            f'/api/saldo-kas-harian/{shift_id}/close/', {'kas_akhir': 20000}, format='json',
        )
        self.assertEqual(closed.status_code, status.HTTP_201_CREATED, closed.data)
        rows = {row['metode']: row for row in closed.data['ringkasan']['rincian_metode']}
        self.assertEqual(rows['QRIS']['total'], '30000.00')
        self.assertEqual(rows['QRIS']['pos'], '30000.00')
        self.assertEqual(rows['Tunai']['total'], '20000.00')
        self.assertEqual(rows['Tunai']['order'], '20000.00')

    def test_rekap_shift_baru_tidak_mencampur_transaksi_shift_sebelumnya(self):
        self.client.force_authenticate(self.kasir1)
        shift_lama = self.client.post(
            '/api/saldo-kas-harian/', {'shift': 'Shift Pagi', 'kas_awal': 10000}, format='json',
        )
        self.assertEqual(shift_lama.status_code, status.HTTP_201_CREATED, shift_lama.data)
        POSSale.objects.create(
            nomor='POS-SHIFT-LAMA', kasir=self.kasir1, shift_id=shift_lama.data['id'],
            total=25000, dibayar=25000, metode_bayar='Cash', status='paid',
        )
        closed = self.client.post(
            f"/api/saldo-kas-harian/{shift_lama.data['id']}/close/", {'kas_akhir': 35000}, format='json',
        )
        self.assertEqual(closed.status_code, status.HTTP_201_CREATED, closed.data)

        shift_baru = self.client.post(
            '/api/saldo-kas-harian/', {'shift': 'Shift Siang', 'kas_awal': 5000}, format='json',
        )
        self.assertEqual(shift_baru.status_code, status.HTTP_201_CREATED, shift_baru.data)

        rekap = self.client.get('/api/pos/sales/rekap-harian/', {'shift': shift_baru.data['id']})
        self.assertEqual(rekap.status_code, status.HTTP_200_OK, rekap.data)
        self.assertEqual(str(rekap.data['ringkasan']['total_penjualan']), '0')
        self.assertEqual(rekap.data['penjualan_per_metode'], [])

    def test_rekap_harian_ikut_menghitung_pelunasan_order(self):
        """rekap-harian dipakai layar Shift utk 'Total Diharapkan' live dan
        Ringkasan Shift v2 — HARUS sinkron dengan angka yg dipakai server saat
        shift ditutup (calculate_shift_cash_summary), yang sudah menghitung
        OrderPayment. Sebelum perbaikan ini, OrderPayment tidak pernah ikut
        terhitung di sini sehingga kasir melihat angka live yang lebih kecil
        dari yang sebenarnya terekonsiliasi saat tutup shift."""
        self.client.force_authenticate(self.kasir1)
        opened = self.client.post(
            '/api/saldo-kas-harian/', {'shift': 'Shift Pelunasan', 'kas_awal': 0}, format='json',
        )
        self.assertEqual(opened.status_code, status.HTTP_201_CREATED, opened.data)
        shift_id = opened.data['id']
        POSSale.objects.create(
            nomor='POS-RINGKASAN-PELUNASAN', kasir=self.kasir1, shift_id=shift_id,
            total=10000, dibayar=10000, metode_bayar='Cash', status='paid',
        )
        order = Order.objects.create(
            id='ORD-RINGKASAN-PELUNASAN', nama='Pelanggan', nomor_wa='08123456789',
            total_harga=50000, dp_dibayar=20000, sisa_tagihan=30000,
        )
        OrderPayment.objects.create(
            order=order, shift_id=shift_id, jumlah=20000,
            metode_pembayaran='Tunai', is_dp=True, dibuat_oleh=self.kasir1,
        )

        rekap = self.client.get('/api/pos/sales/rekap-harian/', {'shift': shift_id})
        self.assertEqual(rekap.status_code, status.HTTP_200_OK, rekap.data)
        self.assertEqual(str(rekap.data['ringkasan']['total_penjualan']), '30000.00')
        self.assertEqual(rekap.data['ringkasan']['jumlah_transaksi'], 2)
        metode = {m['metode']: m['jumlah'] for m in rekap.data['penjualan_per_metode']}
        self.assertEqual(Decimal(str(metode['Tunai'])), Decimal('20000'))
        self.assertEqual(Decimal(str(metode['Cash'])), Decimal('10000'))
