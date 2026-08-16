"""Potong stok bahan baku (Bill of Materials) otomatis lewat kasir (POS).

Sebelum ini, pemotongan BoM otomatis HANYA jalan utk alur Order/cetak
(deduct_job_materials_if_needed di views/jobs.py) — transaksi kasir langsung
dilewati sama sekali; kalau produk yang dijual di kasir punya resep BoM,
bahan bakunya tidak ikut terpotong (instruksi user 2026-08-15).
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api.models import BillOfMaterials, BoMItem, InventoryItem, RestockHistory
from api.pos_models import POSSale
from api.product_models import Product, ProductVariant

User = get_user_model()


def _buat_inventory_item(nama='Tinta Banner', stok=100.0, cost=5000.0):
    return InventoryItem.objects.create(
        nama=nama, stok=stok, satuan='ml', kategori='Bahan Baku', cost_per_unit=cost,
    )


class PosBomDeductionTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_bom', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)

        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test POS BoM', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='HPP Test POS BoM', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='51000', defaults={'name': 'HPP Test', 'account_type': 'expense', 'classification': expense})

        self.bahan = _buat_inventory_item(stok=100.0)
        self.product = Product.objects.create(
            nama='Banner Flexi 280gr', harga_beli=10000, harga_jual_toko=25000,
            qty_stok=50, lacak_inventori=True,
        )
        self.bom = BillOfMaterials.objects.create(product=self.product, nama='BoM Banner Flexi')
        BoMItem.objects.create(bom=self.bom, inventory_item=self.bahan, qty_required_per_unit=2.0)

    def _jual(self, qty):
        return self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': qty, 'harga': 25000}],
            'status': 'paid', 'dibayar': 25000 * qty, 'metode_bayar': 'tunai',
        }, format='json')

    def test_jual_produk_ber_bom_lewat_kasir_ikut_potong_bahan_baku(self):
        response = self._jual(3)
        self.assertEqual(response.status_code, 201, response.content)

        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0 - (2.0 * 3))

        sale = POSSale.objects.get(pk=response.data['id'])
        self.assertTrue(RestockHistory.objects.filter(
            item=self.bahan, keterangan__icontains=f'POS {sale.nomor}',
        ).exists())

    def test_produk_tanpa_bom_tidak_menyentuh_bahan_baku(self):
        produk_polos = Product.objects.create(
            nama='Stiker Custom', harga_beli=5000, harga_jual_toko=10000,
            qty_stok=20, lacak_inventori=True,
        )
        response = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': produk_polos.id, 'qty': 2, 'harga': 10000}],
            'status': 'paid', 'dibayar': 20000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0)

    def test_stok_bahan_tidak_cukup_ditolak(self):
        BoMItem.objects.filter(bom=self.bom).update(qty_required_per_unit=60.0)
        response = self._jual(2)
        self.assertEqual(response.status_code, 400, response.content)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0)

    def test_bom_varian_dipakai_saat_produk_terjual_bervarian(self):
        produk_varian = Product.objects.create(
            nama='Kaos Combed', harga_beli=30000, harga_jual_toko=90000,
            has_variant=True, lacak_inventori=True,
        )
        varian = ProductVariant.objects.create(
            product=produk_varian, nama_varian='M', qty_stok=10, harga_jual_toko=90000,
        )
        bom_varian = BillOfMaterials.objects.create(product=produk_varian, variant=varian, nama='BoM Kaos M')
        bahan_kain = _buat_inventory_item(nama='Kain Combed 30S', stok=50.0)
        BoMItem.objects.create(bom=bom_varian, inventory_item=bahan_kain, qty_required_per_unit=1.0)

        response = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': produk_varian.id, 'variant_id': varian.id, 'qty': 2, 'harga': 90000}],
            'status': 'paid', 'dibayar': 180000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)

        bahan_kain.refresh_from_db()
        self.assertEqual(bahan_kain.stok, 50.0 - 2.0)
        # BoM produk utama (tanpa varian) TIDAK ikut kepakai
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0)
