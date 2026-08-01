"""Ringkasan Shift (V2) harus menampung data dari SEMUA akun kasir untuk
Owner/Manager (bukan cuma kasir yang sedang login), dan filter
tanggal_mulai/tanggal_akhir harus benar-benar menyaring di server — bukan
elemen tanggal yang cuma tampil tapi tidak difungsikan (lihat perbaikan
PosShiftSummary.jsx)."""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from api.finance_models import CashTransaction, CashTransactionType
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
