"""Stok produk untuk Order DP dari kasir (POST /orders/checkout-pos/).

Sebelumnya checkout-pos sama sekali tidak menyentuh qty_stok/ProductStockMovement
meski item order me-refer ke Product asli — beda dengan /pos/sales/ (lunas) yang
sudah benar. Test ini membuktikan: (a) checkout-pos mengurangi stok lewat FIFO
resmi, (b) stok tidak cukup ditolak & tidak ada apa pun tersimpan, (c) batalkan()
memulihkan stok penuh lewat lapisan FIFO yang sama.
"""

import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from . import stock_fifo
from .models import Divisi, Order, TahapProses
from .product_models import Product, ProductStockMovement


class CheckoutPosStockTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_stock', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_stock', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Produksi Stok')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(
            nama='Banner Stok', harga_beli=10000, harga_jual_toko=50000,
            qty_stok=10, lacak_inventori=True,
        )
        stock_fifo.create_layer(self.produk, None, 10, 10000, timezone.localdate())
        self.client.force_authenticate(self.owner)

    def _checkout(self, qty=1, jumlah_bayar=50000):
        return self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Stok',
            'nomor_wa': '081234567890',
            'items': [{'product_id': self.produk.id, 'qty': qty, 'harga_satuan': 50000}],
            'jumlah_bayar': jumlah_bayar,
            'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.staff.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')

    def test_checkout_pos_mengurangi_stok_dan_mencatat_movement(self):
        res = self._checkout(qty=3)
        self.assertEqual(res.status_code, 201, res.content)
        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, Decimal('7'))

        order = Order.objects.get(pk=res.json()['id'])
        movement = ProductStockMovement.objects.get(order=order, tipe='penjualan')
        self.assertEqual(movement.product_id, self.produk.id)
        self.assertEqual(movement.qty, Decimal('3'))
        self.assertEqual(movement.stok_awal, Decimal('10'))
        self.assertEqual(movement.stok_akhir, Decimal('7'))

    def test_stok_tidak_cukup_ditolak_dan_tidak_menyimpan_apa_pun(self):
        order_count_before = Order.objects.count()
        res = self._checkout(qty=999)
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('tidak mencukupi', res.json()['error'])
        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, Decimal('10'))
        self.assertEqual(Order.objects.count(), order_count_before)

    def test_batalkan_order_memulihkan_stok_penuh(self):
        res = self._checkout(qty=4)
        self.assertEqual(res.status_code, 201, res.content)
        order_id = res.json()['id']
        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, Decimal('6'))

        res2 = self.client.post(f'/api/orders/{order_id}/batalkan/', {'alasan': 'test batal'}, format='json')
        self.assertEqual(res2.status_code, 200, res2.content)
        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, Decimal('10'))

        pengembalian = ProductStockMovement.objects.get(order_id=order_id, tipe='pengembalian')
        self.assertEqual(pengembalian.qty, Decimal('4'))
