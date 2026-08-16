"""Sinkronisasi Qty Stok saat diedit lewat form Produk/Varian.

Bug ditemukan user 2026-08-15: field "Qty Stok" di form edit produk bisa
diubah langsung dan tersimpan begitu saja tanpa jejak apa pun di "Pergerakan
Stok" (ProductStockMovement) maupun sinkronisasi lapisan FIFO — melanggar
M8 (Aturan Engineering): mutasi stok bernilai uang/HPP wajib lewat service
stok resmi, dilarang mutasi langsung di view. Contoh nyata: produk "Banner"
qty_stok sudah berubah di halaman produk, tapi "Pergerakan Stok" masih
menunjukkan angka lama (1000) karena tidak pernah ada movement yang dibuat.

Perbaikan: ProductViewSet/ProductVariantViewSet.perform_update sekarang
memperlakukan perubahan qty_stok sebagai 1 dokumen Stok Opname otomatis
(movement + sinkron lapisan FIFO + jurnal surplus/defisit), persis seperti
opname manual lewat StockOpnameDocumentViewSet.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.product_models import Product, ProductCategory, ProductStockMovement, ProductVariant, StockOpnameDocument

User = get_user_model()


class ProductQtyStokEditSyncTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_qtystok_sync', password='password123', role='owner'
        )
        self.client.force_authenticate(user=self.owner)
        self.kategori = ProductCategory.objects.create(nama='Banner', key='banner')
        self.produk = Product.objects.create(
            nama='Banner Flexi 280gr', kategori=self.kategori, sku='BNR-280',
            qty_stok=1000, lacak_inventori=True, harga_beli=10000,
        )

    def test_ubah_qty_stok_lewat_edit_produk_bikin_movement_opname(self):
        res = self.client.patch(f'/api/products/{self.produk.id}/', {'qty_stok': 940}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, 940)

        movement = ProductStockMovement.objects.filter(product=self.produk).order_by('-created_at').first()
        self.assertIsNotNone(movement, "Edit Qty Stok harus membuat ProductStockMovement (Pergerakan Stok)")
        self.assertEqual(movement.tipe, 'opname')
        self.assertEqual(movement.stok_awal, 1000)
        self.assertEqual(movement.stok_akhir, 940)

        # Dibungkus sbg dokumen Stok Opname otomatis (bukan movement lepas)
        self.assertIsNotNone(movement.stock_opname_document_id)
        doc = StockOpnameDocument.objects.get(pk=movement.stock_opname_document_id)
        self.assertEqual(doc.status, 'selesai')

    def test_edit_produk_tanpa_ubah_qty_stok_tidak_bikin_movement(self):
        res = self.client.patch(f'/api/products/{self.produk.id}/', {'qty_stok': 1000}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(ProductStockMovement.objects.filter(product=self.produk).exists())

    def test_edit_produk_tanpa_kirim_qty_stok_sama_sekali_tidak_bikin_movement(self):
        res = self.client.patch(f'/api/products/{self.produk.id}/', {'nama': 'Banner Flexi 280gr Updated'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, 1000)
        self.assertFalse(ProductStockMovement.objects.filter(product=self.produk).exists())

    def test_ubah_qty_stok_varian_lewat_edit_juga_bikin_movement_opname(self):
        produk_var = Product.objects.create(
            nama='Kaos Combed', kategori=self.kategori, sku='KS-CMB',
            has_variant=True, lacak_inventori=True,
        )
        varian = ProductVariant.objects.create(
            product=produk_var, nama_varian='M', qty_stok=50,
        )
        res = self.client.patch(f'/api/product-variants/{varian.id}/', {'qty_stok': 45}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        varian.refresh_from_db()
        self.assertEqual(varian.qty_stok, 45)

        movement = ProductStockMovement.objects.filter(variant=varian).order_by('-created_at').first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.tipe, 'opname')
        self.assertEqual(movement.stok_awal, 50)
        self.assertEqual(movement.stok_akhir, 45)
