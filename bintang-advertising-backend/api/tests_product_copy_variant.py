"""Regresi: menyalin (Salin/Copy) produk berlacak varian crash 500.

Bug ditemukan lewat audit VPS produksi 2026-09-05: PurchaseViewSet.copy_product()
membuat ProductVariant baru dengan kwarg `stok_minimum=` dan `is_active=` -
dua field yang TIDAK PERNAH ada di model ProductVariant (beda dari Product).
Dampak nyata: tombol "Salin" di menu aksi baris produk selalu Server Error
500 untuk SETIAP produk yang has_variant=True dan copy_variant dicentang -
100% reproducible, bukan edge case.

Bug kedua di baris yang sama: qty_stok varian baru terbalik - sebelumnya
variant yang MELACAK inventori (lacak_inventori=True) selalu dapat 0.00,
sedangkan yang TIDAK melacak malah dapat qty_stok dari form salin.

Bug ketiga (diperbaiki sesudahnya, sama-sama dari audit 2026-09-05): semua
varian baru disamakan ke satu nilai `lacak_inventori` form-level, bukan
mempertahankan nilai asli tiap varian - produk dengan varian campuran
(sebagian melacak stok, sebagian tidak) kehilangan perbedaan itu saat disalin.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .product_models import Product, ProductVariant

User = get_user_model()


class CopyProductWithVariantTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_copy_variant_test', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Produk Uji Salin Varian', harga_beli=10000, harga_jual_toko=20000,
            has_variant=True, lacak_inventori=True, qty_stok=5,
        )
        self.variant_lacak = ProductVariant.objects.create(
            product=self.product, nama_varian='Merah', sku='UJI-SALIN-RED',
            harga_beli=10000, harga_jual_toko=20000, lacak_inventori=True, qty_stok=7,
        )
        self.variant_tanpa_lacak = ProductVariant.objects.create(
            product=self.product, nama_varian='Biru', sku='UJI-SALIN-BLUE',
            harga_beli=10000, harga_jual_toko=20000, lacak_inventori=False, qty_stok=0,
        )

    def test_copy_dengan_varian_tidak_crash_dan_qty_stok_benar(self):
        res = self.client.post(
            f'/api/products/{self.product.id}/copy/',
            # lacak_inventori=False di form sengaja beda dari nilai asli
            # kedua varian, untuk membuktikan tiap varian mempertahankan
            # nilainya sendiri-sendiri, bukan ikut nilai form ini.
            {'nama': 'Produk Uji Salin Varian (Copy)', 'copy_variant': True, 'qty_stok': 99, 'lacak_inventori': False},
            format='json',
        )
        self.assertIn(res.status_code, (200, 201), res.content)

        salinan = Product.objects.get(nama='Produk Uji Salin Varian (Copy)')
        varian_baru = {v.nama_varian: v for v in salinan.variants.all()}
        self.assertEqual(set(varian_baru.keys()), {'Merah', 'Biru'})

        # Varian yang melacak inventori dapat qty_stok dari form salin (99),
        # bukan 0.00 seperti sebelum fix - dan tetap melacak inventori
        # walau form-level lacak_inventori di atas diisi False.
        self.assertTrue(varian_baru['Merah'].lacak_inventori)
        self.assertEqual(varian_baru['Merah'].qty_stok, 99)
        # Varian yang TIDAK melacak inventori tetap 0.00 dan tetap
        # lacak_inventori=False, sesuai aslinya.
        self.assertFalse(varian_baru['Biru'].lacak_inventori)
        self.assertEqual(varian_baru['Biru'].qty_stok, 0)
