"""Menu "Reorder" di Riwayat Kasir -- human error eksekusi staff (bukan
salah sistem/pelanggan), 2026-09-24. Reorder dibuat lewat checkout-pos
NORMAL (reuse penuh: SPK, potong stok, jurnal) dengan param tambahan
reorder_dari, supaya tidak ada jalur pembuatan order paralel yang bisa
menyimpang dari alur yang sudah teruji."""
import uuid

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Divisi, Order, TahapProses

User = get_user_model()


class ReorderHumanErrorTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_reorder', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir_reorder', password='x', role='kasir')
        self.divisi = Divisi.objects.create(nama='Produksi Reorder')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)

        self.order_asal = Order.objects.create(
            id='ORD-REORDER-ASAL', nama='Pelanggan Asal', nomor_wa='081200000001',
            status_global='selesai', total_harga=100000,
        )
        self.client.force_authenticate(self.kasir)

    def _checkout(self, **overrides):
        payload = {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Asal',
            'nomor_wa': '081200000001',
            'items': [{'qty': 1, 'harga_satuan': 50000, 'nama': 'Banner Reorder'}],
            'jumlah_bayar': 50000,
            'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.kasir.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
            'reorder_dari': self.order_asal.id,
            'catatan': 'Reorder: salah potong ukuran saat cetak, staff eksekusi keliru.',
        }
        payload.update(overrides)
        return self.client.post('/api/orders/checkout-pos/', payload, format='json')

    def test_reorder_berhasil_dan_tertaut_ke_order_asal(self):
        res = self._checkout()
        self.assertEqual(res.status_code, 201, res.content)
        order_baru = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order_baru.reorder_dari_id, self.order_asal.id)
        self.assertIn('salah potong ukuran', order_baru.catatan_pelanggan)

    def test_reorder_wajib_ada_catatan(self):
        res = self._checkout(catatan='')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('Catatan alasan reorder wajib diisi', res.json()['error'])

    def test_reorder_dari_order_belum_selesai_ditolak(self):
        order_proses = Order.objects.create(
            id='ORD-REORDER-PROSES', nama='Pelanggan Proses', nomor_wa='081200000002',
            status_global='proses',
        )
        res = self._checkout(reorder_dari=order_proses.id)
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('sudah selesai', res.json()['error'])

    def test_reorder_dari_order_tidak_ada_ditolak(self):
        res = self._checkout(reorder_dari='ORD-TIDAK-ADA')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('tidak ditemukan', res.json()['error'])

    def test_order_biasa_tanpa_reorder_dari_tetap_normal(self):
        res = self._checkout(reorder_dari='', catatan='')
        self.assertEqual(res.status_code, 201, res.content)
        order_baru = Order.objects.get(pk=res.json()['id'])
        self.assertIsNone(order_baru.reorder_dari_id)
