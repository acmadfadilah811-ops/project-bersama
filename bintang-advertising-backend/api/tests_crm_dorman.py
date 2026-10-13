"""Jembatan CRM -> Bintang: pelanggan yang lama tidak order (2026-10-13)."""

import os
from datetime import timedelta
from unittest import mock

from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Contact, Order
from .pos_models import POSSale

KUNCI = 'kunci-crm-uji'
H = {'HTTP_X_API_KEY': KUNCI}
URL = '/api/bridge/crm/pelanggan-dorman/'


def _order(id_, nomor, nama, hari_lalu, total, status='selesai'):
    Order.objects.create(id=id_, nomor_wa=nomor, nama=nama, status_global=status, sumber='wa')
    Order.objects.filter(pk=id_).update(waktu=timezone.now() - timedelta(days=hari_lalu), total_harga=total)


@mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': KUNCI})
class PelangganDormanTest(APITestCase):
    def test_hanya_yang_lama_tidak_order_diurut_nilai_belanja(self):
        _order('O-1', '081234567890', 'Budi', 90, 100000)       # dorman
        _order('O-2', '6281234567890', 'Budi', 120, 50000)      # nomor sama format lain -> digabung
        _order('O-3', '085700001111', 'Sari', 100, 400000)      # dorman, belanja lebih besar
        _order('O-4', '085700002222', 'Aktif', 5, 900000)       # baru order -> tidak dorman
        _order('O-5', '085700003333', 'Batal', 200, 700000, status='batal')   # batal tidak dihitung
        _order('O-6', '164566218616947', 'LID', 300, 10000)     # bukan nomor HP -> dilewati
        res = self.client.get(URL, {'hari': 60}, **H)
        self.assertEqual(res.status_code, 200, res.data)
        nomor = [r['nomor'] for r in res.data['hasil']]
        self.assertEqual(nomor, ['6285700001111', '6281234567890'])
        budi = res.data['hasil'][1]
        self.assertEqual((budi['jumlah_transaksi'], budi['total_belanja'], budi['hari_sejak']), (2, 150000, 90))
        self.assertEqual(budi['nama'], 'Budi')
        self.assertEqual(res.data['total'], 2)

    def test_penjualan_pos_ikut_dihitung_dan_pelanggan_aktif_via_pos_tidak_dorman(self):
        Contact.objects.create(nomor_wa='6281111111111', nama='Dina')
        Contact.objects.create(nomor_wa='6282222222222', nama='Eko')
        _order('O-1', '081111111111', 'Dina', 150, 20000)
        _order('O-2', '082222222222', 'Eko', 150, 20000)
        POSSale.objects.create(nomor='POS-D-1', pelanggan_id='6282222222222', total=30000, status='paid')   # Eko belanja hari ini
        POSSale.objects.create(nomor='POS-D-2', pelanggan_id='6281111111111', total=99999, status='void')   # void diabaikan
        res = self.client.get(URL, {'hari': 60}, **H)
        self.assertEqual([r['nomor'] for r in res.data['hasil']], ['6281111111111'])

    def test_min_transaksi(self):
        _order('O-1', '081234567890', 'Budi', 90, 1000)
        _order('O-2', '085700001111', 'Sari', 90, 1000)
        _order('O-3', '085700001111', 'Sari', 95, 1000)
        res = self.client.get(URL, {'hari': 60, 'min_transaksi': 2}, **H)
        self.assertEqual([r['nomor'] for r in res.data['hasil']], ['6285700001111'])

    def test_parameter_salah_dan_kunci(self):
        for q in ({'hari': 'x'}, {'hari': 3}, {'hari': 5000}, {'hari': 60, 'min_transaksi': 0}):
            self.assertEqual(self.client.get(URL, q, **H).status_code, 400, q)
        self.assertEqual(self.client.get(URL, {'hari': 60}).status_code, 401)
        self.assertEqual(self.client.get(URL, {'hari': 60}, HTTP_X_API_KEY='salah').status_code, 401)
        self.assertEqual(self.client.get(URL, **H).status_code, 200)  # hari bawaan 60

    def test_cek_nomor_tertentu_tanpa_ambang(self):
        _order('O-1', '081234567890', 'Budi', 3, 1000)      # baru order, tetap dikembalikan bila diminta
        _order('O-2', '085700001111', 'Sari', 90, 1000)
        res = self.client.get(URL, {'nomor': '081234567890,6285700001111,0899999999'}, **H)
        self.assertEqual(res.status_code, 200, res.data)
        per_nomor = {r['nomor']: r for r in res.data['hasil']}
        self.assertEqual(set(per_nomor), {'6281234567890', '6285700001111'})
        self.assertEqual(per_nomor['6281234567890']['hari_sejak'], 3)
