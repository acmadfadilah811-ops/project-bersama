"""Daftar pesanan (/api/orders/) tidak boleh menambah query per pesanan (N+1).
Monitor Pesanan memuat daftar ini berkala; sebelumnya ~14 query per pesanan."""
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from .models import CustomUser, Divisi, JobBoard, Order, OrderItem, PengembalianOrder, TahapProses


class DaftarPesananQueryTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username='own_query', password='x12345678', role='owner', email='own_query@uji.test')
        self.divisi = Divisi.objects.create(nama='Cetak Uji Query')
        self.tahap = TahapProses.objects.create(nama='Cetak Q', divisi=self.divisi)
        self.client.force_authenticate(self.owner)
        self.nomor = 0

    def _buat_pesanan(self, jumlah):
        for _ in range(jumlah):
            self.nomor += 1
            order = Order.objects.create(id=f'ORD-Q-{self.nomor}', nama=f'P{self.nomor}', nomor_wa=f'62899{self.nomor:05d}', sumber='manual')
            for k in range(2):
                item = OrderItem.objects.create(order=order, jenis_produk=f'Banner {k}', qty=1)
                JobBoard.objects.create(order_item=item, tahap=self.tahap)
            PengembalianOrder.objects.create(order=order, status='Batal', catatan='x')

    def _hitung_query(self):
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get('/api/orders/?page=1&page_size=100')
        self.assertEqual(res.status_code, 200)
        return len(ctx), res.json()

    def test_jumlah_query_tidak_naik_per_pesanan(self):
        self._buat_pesanan(2)
        sedikit, _ = self._hitung_query()
        self._buat_pesanan(10)
        banyak, data = self._hitung_query()
        self.assertEqual(data['count'], 12)
        # 10 pesanan tambahan (20 item, 20 job) boleh menambah paling banyak beberapa query tetap.
        self.assertLessEqual(banyak - sedikit, 3, f'N+1: {sedikit} -> {banyak} query')

    def test_data_item_tetap_lengkap(self):
        self._buat_pesanan(1)
        _, data = self._hitung_query()
        item = data['results'][0]['items'][0]
        self.assertIn('insentif', item)
        self.assertIn('biaya_desain', item)
        self.assertEqual(len(item['jobs']), 1)
        self.assertIsNone(data['results'][0]['pengembalian_aktif'])  # retur berstatus Batal tidak dihitung
