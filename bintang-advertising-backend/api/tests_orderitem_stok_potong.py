"""Regresi: OrderItem yang tertaut ke Product langsung (bukan lewat POS/
checkout_pos) harus tetap memotong stok — sebelumnya order dari form WA
(_simpan_order_dari_form) dan endpoint /order-items/ generik TIDAK PERNAH
memotong stok sama sekali, hanya checkout_pos() (alur DP kasir) yang
melakukannya. Lihat _potong_stok_order_item di api/serializers.py."""
from rest_framework.test import APITestCase

from api.models import CustomUser, Order, OrderItem
from api.product_models import Product, ProductStockMovement


class OrderItemStokPotongTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_stok', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Banner Flexi', harga_beli=10000, harga_jual_toko=25000,
            qty_stok=50, lacak_inventori=True,
        )
        self.order = Order.objects.create(nomor_wa='081234567890', nama='Budi')

    def test_buat_order_item_dengan_produk_memotong_stok(self):
        response = self.client.post('/api/order-items/', {
            'order': self.order.id, 'product': self.product.id, 'qty': 5,
            'jenis_produk': self.product.nama, 'harga_jual': 125000,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 45)

        item = OrderItem.objects.get(pk=response.data['id'])
        self.assertTrue(item.stok_dikurangi)
        mv = ProductStockMovement.objects.get(order=self.order, product=self.product)
        self.assertEqual(mv.qty, 5)
        self.assertEqual(mv.stok_awal, 50)
        self.assertEqual(mv.stok_akhir, 45)

    def test_order_item_tanpa_produk_tidak_memotong_stok_dan_tidak_error(self):
        # Persis pola order dari form WA: jenis_produk teks bebas, product None.
        response = self.client.post('/api/order-items/', {
            'order': self.order.id, 'jenis_produk': 'Banner (dari WA, teks bebas)',
            'qty': 3, 'harga_jual': 0,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 50)  # tidak berubah
        item = OrderItem.objects.get(pk=response.data['id'])
        self.assertFalse(item.stok_dikurangi)

    def test_menautkan_produk_belakangan_ke_item_wa_memotong_stok_sekali(self):
        # Simulasi: order WA sudah masuk tanpa produk, lalu staff menautkan
        # produk asli lewat edit item (kondisi produksi yang ditemukan: order
        # ORD-20260810-D1AA punya product_id tertaut tapi stok tidak berkurang).
        item = OrderItem.objects.create(
            order=self.order, jenis_produk='X banner', qty=3, harga_jual=0,
        )
        response = self.client.patch(f'/api/order-items/{item.id}/', {
            'product': self.product.id, 'jenis_produk': self.product.nama,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 47)  # 50 - 3
        item.refresh_from_db()
        self.assertTrue(item.stok_dikurangi)

        # Edit lagi (mis. ganti qty) TIDAK memotong ulang — batasan yang
        # didokumentasikan, bukan bug: mencegah dobel potong.
        response2 = self.client.patch(f'/api/order-items/{item.id}/', {'qty': 10}, format='json')
        self.assertEqual(response2.status_code, 200, response2.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 47)  # tidak berubah lagi

    def test_stok_tidak_cukup_ditolak_dan_tidak_mengubah_stok(self):
        response = self.client.post('/api/order-items/', {
            'order': self.order.id, 'product': self.product.id, 'qty': 999,
            'jenis_produk': self.product.nama, 'harga_jual': 1,
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 50)

    def test_produk_tidak_lacak_inventori_tidak_memotong_stok(self):
        jasa = Product.objects.create(
            nama='Jasa Desain', harga_jual_toko=50000, qty_stok=0, lacak_inventori=False,
        )
        response = self.client.post('/api/order-items/', {
            'order': self.order.id, 'product': jasa.id, 'qty': 1,
            'jenis_produk': jasa.nama, 'harga_jual': 50000,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        item = OrderItem.objects.get(pk=response.data['id'])
        self.assertFalse(item.stok_dikurangi)
        self.assertFalse(ProductStockMovement.objects.filter(order=self.order).exists())
