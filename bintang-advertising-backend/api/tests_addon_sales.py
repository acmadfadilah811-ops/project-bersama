"""Addon di kasir — sebelumnya model Addon ada tapi 0% terhubung ke alur
penjualan (tidak pernah muncul di POST /pos/sales/ maupun
/orders/checkout-pos/). Test ini membuktikan: (a) addon menambah harga item
lewat POST /pos/sales/, dihitung ulang di server (bukan dipercaya dari
klien), (b) addon menambah harga di checkout-pos Order, (c) stok bahan
tautan addon (linked_product) berkurang lewat FIFO, (d) addon yang tidak
berlaku untuk produk ditolak, (e) void POS & batalkan Order memulihkan
stok bahan addon."""

import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from . import stock_fifo
from .models import Divisi, Order, OrderItem, TahapProses
from .pos_models import POSSale
from .product_models import Addon, Product, ProductStockMovement, SaleItemAddon


class AddonSalesTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_addon', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_addon', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Produksi Addon')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)

        self.produk = Product.objects.create(
            nama='Banner Addon', harga_beli=10000, harga_jual_toko=50000,
            qty_stok=10, lacak_inventori=True,
        )
        self.produk_lain = Product.objects.create(
            nama='Produk Lain', harga_beli=5000, harga_jual_toko=20000, qty_stok=5,
        )
        self.bahan_mata_ayam = Product.objects.create(
            nama='Mata Ayam (bahan)', harga_beli=500, harga_jual_toko=0,
            qty_stok=100, lacak_inventori=True,
        )
        stock_fifo.create_layer(self.bahan_mata_ayam, None, 100, 500, timezone.localdate())

        self.addon = Addon.objects.create(
            nama='Mata Ayam', harga=Decimal('5000'), is_active=True,
            linked_product=self.bahan_mata_ayam, linked_qty=Decimal('4'),
        )
        self.addon.applies_to.add(self.produk)

        self.client.force_authenticate(self.owner)

    def test_pos_sale_addon_menambah_harga_dan_mengurangi_stok_bahan(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.produk.id, 'qty': 2, 'harga': 999999,  # harga klien harus diabaikan
                'addon_ids': [self.addon.id],
            }],
            'status': 'paid',
            'dibayar': 110000,
            'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # 2 x 50000 (katalog) + 2 x 5000 (addon) = 110000
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('110000'))

        sale = POSSale.objects.get(pk=res.data['id'])
        item = sale.items.first()
        addon_link = SaleItemAddon.objects.get(pos_sale_item=item)
        self.assertEqual(addon_link.nama_snapshot, 'Mata Ayam')
        self.assertEqual(addon_link.subtotal, Decimal('10000'))

        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('92'))  # 100 - (4*2)
        self.assertTrue(
            ProductStockMovement.objects.filter(product=self.bahan_mata_ayam, pos_sale=sale, tipe='penjualan').exists()
        )

        report = self.client.get('/api/reports/addon-item-penjualan/')
        self.assertEqual(report.status_code, 200, report.content)
        addon_rows = [r for r in report.json()['rows'] if r['no_pesanan'] == sale.nomor]
        self.assertEqual(len(addon_rows), 1)
        self.assertEqual(addon_rows[0]['addon'], 'Mata Ayam')
        self.assertEqual(addon_rows[0]['total_penjualan'], 10000.0)

    def test_report_addon_per_item_agregat_lintas_transaksi(self):
        """Laporan Produk > 'Penjualan Add-On Per Item' sebelumnya ditandai
        'unavailable' di frontend dengan alasan yang sudah tidak akurat -
        SaleItemAddon sudah mencatat penjualan add-on sejak apply_addons().
        Test ini membuktikan endpoint agregatnya (beda dari
        addon-item-penjualan yang per-transaksi) menjumlahkan qty & total
        dengan benar lintas 2 transaksi POS terpisah."""
        for _ in range(2):
            res = self.client.post('/api/pos/sales/', {
                'items': [{'product_id': self.produk.id, 'qty': 2, 'harga': 50000, 'addon_ids': [self.addon.id]}],
                'status': 'paid',
                'dibayar': 110000,
                'metode_bayar': 'CASH',
            }, format='json')
            self.assertEqual(res.status_code, 201, res.content)

        report = self.client.get('/api/reports/addon-per-item/')
        self.assertEqual(report.status_code, 200, report.content)
        rows = [r for r in report.json()['rows'] if r['addon'] == 'Mata Ayam']
        self.assertEqual(len(rows), 1)
        # 2 transaksi x (qty 2, subtotal 10000) = qty 4, total 20000.
        self.assertEqual(rows[0]['total_qty'], 4.0)
        self.assertEqual(rows[0]['total_jual'], 20000.0)

    def test_addon_tidak_berlaku_untuk_produk_lain_ditolak(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.produk_lain.id, 'qty': 1, 'harga': 20000, 'addon_ids': [self.addon.id]}],
            'status': 'paid',
            'dibayar': 20000,
            'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('tidak berlaku', res.data['error'])

    def test_void_pos_sale_memulihkan_stok_bahan_addon(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.produk.id, 'qty': 2, 'harga': 50000, 'addon_ids': [self.addon.id]}],
            'status': 'paid',
            'dibayar': 110000,
            'metode_bayar': 'CASH',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('92'))

        res2 = self.client.post(f"/api/pos/sales/{res.data['id']}/void/", {}, format='json')
        self.assertEqual(res2.status_code, 200, res2.content)
        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('100'))

    def test_checkout_pos_order_addon_menambah_harga_dan_stok(self):
        res = self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Addon',
            'nomor_wa': '081234567891',
            'items': [{'product_id': self.produk.id, 'qty': 3, 'harga_satuan': 50000, 'addon_ids': [self.addon.id]}],
            'jumlah_bayar': 165000,
            'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.staff.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # 3 x 50000 + 3 x 5000 = 165000
        self.assertEqual(res.json()['total_harga'], 165000)

        order = Order.objects.get(pk=res.json()['id'])
        self.assertTrue(SaleItemAddon.objects.filter(order_item__order=order).exists())
        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('88'))  # 100 - (4*3)

    def test_batalkan_order_addon_memulihkan_stok_bahan(self):
        res = self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Addon 2',
            'nomor_wa': '081234567892',
            'items': [{'product_id': self.produk.id, 'qty': 1, 'harga_satuan': 50000, 'addon_ids': [self.addon.id]}],
            'jumlah_bayar': 55000,
            'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.staff.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        order_id = res.json()['id']
        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('96'))

        res2 = self.client.post(f'/api/orders/{order_id}/batalkan/', {'alasan': 'test'}, format='json')
        self.assertEqual(res2.status_code, 200, res2.content)
        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('100'))

    def test_order_item_endpoint_addon_menambah_harga_dan_stok(self):
        """Form Antrean WA (CreateOrderModal) membuat order lewat POST /orders/
        + POST /order-items/ per item - jalur BERBEDA dari checkout-pos() yang
        sudah punya addon sejak awal. Sebelumnya /order-items/ tidak punya
        jalur addon sama sekali (user melapor: 'di antrean wa ngga ada pilihan
        untuk menambahkan addon'). Test ini membuktikan OrderItemSerializer
        sekarang menghitung ulang harga addon di server & memotong stok bahan,
        persis seperti checkout-pos."""
        order = Order.objects.create(
            nomor_wa='081234567893', nama='Pelanggan Antrean WA', sumber='wa',
            dilayani_oleh=self.staff,
        )
        res = self.client.post('/api/order-items/', {
            'order': order.pk,
            'jenis_produk': self.produk.nama,
            'product': self.produk.id,
            'panjang': 0, 'lebar': 0,
            'qty': 2,
            'harga_jual': 100000,  # 2 x 50000 katalog, TANPA addon (klien tidak tahu harga addon)
            'addon_ids': [self.addon.id],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # Server menambahkan 2 x 5000 (addon, qty ikut qty item induk) ke harga_jual.
        self.assertEqual(res.data['harga_jual'], 110000)

        item = OrderItem.objects.get(pk=res.data['id'])
        addon_link = SaleItemAddon.objects.get(order_item=item)
        self.assertEqual(addon_link.nama_snapshot, 'Mata Ayam')
        self.assertEqual(addon_link.subtotal, Decimal('10000'))

        self.bahan_mata_ayam.refresh_from_db()
        self.assertEqual(self.bahan_mata_ayam.qty_stok, Decimal('92'))  # 100 - (4*2)
