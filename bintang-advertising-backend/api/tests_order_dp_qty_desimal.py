"""Order DP kasir (POST /orders/checkout-pos/) menerima qty berkoma (2026-10-29).

Sebelumnya OrderItem.qty integer sehingga kasir menolak DP bila qty berkoma. Sekarang decimal(12,4):
produk custom/jasa (tanpa pelacakan stok) 4 angka di belakang koma, produk berstok 2 angka, paket harus bulat.
"""

import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from . import stock_fifo
from .models import Divisi, Order, OrderItem, TahapProses
from .product_models import Product


class OrderDpQtyDesimalTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_dp_koma', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_dp_koma', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Produksi DP Koma')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.custom = Product.objects.create(
            nama='Custom Nominal', harga_beli=0, harga_jual_toko=10000, lacak_inventori=False,
        )
        self.berstok = Product.objects.create(
            nama='Kertas Berstok', harga_beli=1000, harga_jual_toko=20000, qty_stok=10, lacak_inventori=True,
        )
        stock_fifo.create_layer(self.berstok, None, 10, 1000, timezone.localdate())
        self.client.force_authenticate(self.owner)

    def _checkout(self, item, jumlah_bayar=0):
        return self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Koma',
            'nomor_wa': '081234500011',
            'items': [item],
            'jumlah_bayar': jumlah_bayar,
            'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.staff.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')

    def test_dp_produk_custom_qty_koma_empat_angka(self):
        res = self._checkout({'product_id': self.custom.id, 'qty': 2.5, 'harga_satuan': 10000})
        self.assertEqual(res.status_code, 201, res.content)
        item = OrderItem.objects.get(order_id=res.json()['id'])
        self.assertEqual(item.qty, Decimal('2.5000'))
        self.assertEqual(item.harga_jual, 25000)
        self.assertEqual(Order.objects.get(pk=res.json()['id']).total_harga, 25000)

        res = self._checkout({'product_id': self.custom.id, 'qty': '1.2345', 'harga_satuan': 10000})
        self.assertEqual(res.status_code, 201, res.content)
        item = OrderItem.objects.get(order_id=res.json()['id'])
        self.assertEqual(item.qty, Decimal('1.2345'))
        self.assertEqual(item.harga_jual, 12345)

    def test_dp_item_kustom_tanpa_produk_qty_koma(self):
        res = self._checkout({'qty': 0.5, 'harga_satuan': 30000, 'nama': 'Jasa Setengah', 'is_custom_priced': True})
        self.assertEqual(res.status_code, 201, res.content)
        item = OrderItem.objects.get(order_id=res.json()['id'])
        self.assertEqual(item.qty, Decimal('0.5000'))
        self.assertEqual(item.harga_jual, 15000)

    def test_dp_produk_berstok_dibulatkan_dua_angka_dan_stok_terpotong(self):
        res = self._checkout({'product_id': self.berstok.id, 'qty': '1.236', 'harga_satuan': 20000})
        self.assertEqual(res.status_code, 201, res.content)
        item = OrderItem.objects.get(order_id=res.json()['id'])
        self.assertEqual(item.qty, Decimal('1.2400'))
        self.berstok.refresh_from_db()
        self.assertEqual(self.berstok.qty_stok, Decimal('8.76'))

    def test_qty_nol_atau_negatif_atau_terlalu_kecil_ditolak(self):
        sebelum = Order.objects.count()
        for qty in (0, -1, '0.00001'):
            res = self._checkout({'product_id': self.custom.id, 'qty': qty, 'harga_satuan': 10000})
            self.assertEqual(res.status_code, 400, (qty, res.content))
        res = self._checkout({'product_id': self.berstok.id, 'qty': '0.004', 'harga_satuan': 20000})
        self.assertEqual(res.status_code, 400, res.content)
        self.assertEqual(Order.objects.count(), sebelum)

    def test_api_item_pesanan_mengirim_angka_bukan_string(self):
        res = self._checkout({'product_id': self.custom.id, 'qty': 2.5, 'harga_satuan': 10000})
        self.assertEqual(res.status_code, 201, res.content)
        bulat = self._checkout({'product_id': self.custom.id, 'qty': 3, 'harga_satuan': 10000})
        self.assertEqual(bulat.status_code, 201, bulat.content)
        data = self.client.get('/api/order-items/').json()
        baris = data['results'] if isinstance(data, dict) else data
        per_order = {r['order']: r['qty'] for r in baris}
        self.assertEqual(per_order[res.json()['id']], 2.5)
        self.assertEqual(per_order[bulat.json()['id']], 3)
        self.assertIsInstance(per_order[bulat.json()['id']], int)

    def test_model_menolak_qty_nol(self):
        order = Order.objects.get(pk=self._checkout({'product_id': self.custom.id, 'qty': 1, 'harga_satuan': 10000}).json()['id'])
        with self.assertRaises(ValueError):
            OrderItem(order=order, jenis_produk='Nol', qty=Decimal('0'), harga_jual=0).save()
