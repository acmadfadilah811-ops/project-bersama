"""Regresi: PATCH/PUT umum ke /api/orders/{id}/ TIDAK menjaga `status_global`
sama sekali — siapa pun yang boleh mengedit Order bisa langsung menulis
status_global='batal'/'selesai' lewat endpoint generik ini, melewati
batalkan_order()/selesaikan_order() (pemulihan stok FIFO, jurnal pembalik/
HPP, validasi transisi). Ini kelas bug yang sama dengan import-status-csv
(lihat tests_order_import_status_bypass.py), tapi lewat pintu masuk yang
berbeda dan LEBIH mudah dipicu — ditemukan aktif dipakai lewat 3 tombol/
dropdown nyata di menu Pesanan (Orders.jsx) dan panel Produksi
(GlobalListPanel.jsx), bukan cuma risiko API teoretis.

Ditemukan & diperbaiki 2026-09-05, audit modul Transaksi & Pembayaran,
dipicu oleh pertanyaan user soal pembatalan pesanan yang belum selesai.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Order
from api.product_models import Product, ProductStockMovement

User = get_user_model()


class OrderPatchStatusGuardTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_patch_guard', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.product = Product.objects.create(
            nama='Banner Patch Guard', harga_beli=10000, harga_jual_toko=50000,
            qty_stok=Decimal('5'), lacak_inventori=True,
        )

    def _order_dengan_stok_terpotong(self, order_id, status_global):
        order = Order.objects.create(
            id=order_id, nomor_wa='08123456789', nama='Pelanggan Patch Guard',
            status_global=status_global,
        )
        ProductStockMovement.objects.create(
            product=self.product, order=order, tipe='penjualan', qty=Decimal('2'),
            stok_awal=Decimal('5'), stok_akhir=Decimal('3'), tanggal=timezone.localdate(),
        )
        self.product.qty_stok = Decimal('3')
        self.product.save(update_fields=['qty_stok'])
        return order

    def test_patch_status_global_batal_ditolak(self):
        order = self._order_dengan_stok_terpotong('ORD-PATCH-BATAL', 'proses')

        response = self.client.patch(f'/api/orders/{order.id}/', {'status_global': 'batal'}, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Batalkan', str(response.data['status_global']))

        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status_global, 'proses')
        self.assertEqual(self.product.qty_stok, Decimal('3'))

    def test_patch_status_global_selesai_ditolak(self):
        order = Order.objects.create(id='ORD-PATCH-SELESAI', nomor_wa='08123456789',
                                      nama='Pelanggan Patch Guard', status_global='ready')

        response = self.client.patch(f'/api/orders/{order.id}/', {'status_global': 'selesai'}, format='json')
        self.assertEqual(response.status_code, 400, response.content)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'ready')

    def test_patch_status_global_lainnya_tetap_boleh(self):
        """Transisi P/A/S/T (review/desain/proses/ready) TIDAK melibatkan
        stok/jurnal — PATCH langsung tetap harus jalan seperti biasa."""
        order = Order.objects.create(id='ORD-PATCH-PROSES', nomor_wa='08123456789',
                                      nama='Pelanggan Patch Guard', status_global='review')

        response = self.client.patch(f'/api/orders/{order.id}/', {'status_global': 'desain'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'desain')

    def test_patch_field_lain_tanpa_status_global_tetap_boleh(self):
        order = Order.objects.create(id='ORD-PATCH-CATATAN', nomor_wa='08123456789',
                                      nama='Pelanggan Patch Guard', status_global='review')

        response = self.client.patch(f'/api/orders/{order.id}/', {'catatan_pelanggan': 'Tolong dibungkus rapi'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)

        order.refresh_from_db()
        self.assertEqual(order.catatan_pelanggan, 'Tolong dibungkus rapi')
