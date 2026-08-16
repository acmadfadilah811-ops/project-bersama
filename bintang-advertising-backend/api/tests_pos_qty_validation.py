"""Regresi: POS tidak boleh pernah menyimpan baris penjualan dengan qty <= 0
(mencemari pencatatan inventori, akuntansi, dan pergerakan stok)."""
from rest_framework.test import APITestCase

from api.models import CustomUser
from api.pos_models import POSSaleItem
from api.product_models import Product, ProductPackage, ProductPackageItem


class PosQtyValidationTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_qty', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Banner Flexi', harga_beli=10000, harga_jual_toko=25000,
            qty_stok=50, lacak_inventori=True,
        )
        self.package = ProductPackage.objects.create(
            nama='Paket Promosi', harga_jual_offline=60000, publikasi=True, tampil_pos=True,
        )
        ProductPackageItem.objects.create(paket=self.package, product=self.product, qty=1)

    def test_pos_menolak_qty_nol_untuk_produk(self):
        response = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 0, 'harga': 25000}],
            'status': 'paid', 'dibayar': 0, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(POSSaleItem.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 50)

    def test_pos_menolak_qty_negatif_untuk_produk(self):
        response = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': -1, 'harga': 25000}],
            'status': 'paid', 'dibayar': 0, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(POSSaleItem.objects.count(), 0)

    def test_pos_menolak_qty_nol_untuk_item_kustom(self):
        response = self.client.post('/api/pos/sales/', {
            'items': [{'nama': 'Item Kustom', 'qty': 0, 'harga': 10000}],
            'status': 'paid', 'dibayar': 0, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(POSSaleItem.objects.count(), 0)

    def test_pos_menolak_qty_nol_untuk_paket(self):
        response = self.client.post('/api/pos/sales/', {
            'items': [{'package_id': self.package.id, 'qty': 0}],
            'status': 'paid', 'dibayar': 0, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(POSSaleItem.objects.count(), 0)
