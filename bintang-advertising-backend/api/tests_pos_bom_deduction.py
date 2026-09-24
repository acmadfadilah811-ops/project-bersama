"""Potong stok bahan baku (Bill of Materials) otomatis lewat kasir (POS).

Sebelum ini, pemotongan BoM otomatis HANYA jalan utk alur Order/cetak
(deduct_job_materials_if_needed di views/jobs.py) — transaksi kasir langsung
dilewati sama sekali; kalau produk yang dijual di kasir punya resep BoM,
bahan bakunya tidak ikut terpotong (instruksi user 2026-08-15).
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api.models import BillOfMaterials, BoMItem, Contact, InventoryItem, RestockHistory
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
        self.pelanggan = Contact.objects.create(nomor_wa='081200000097', nama='Pelanggan BoM Uji')

    def _jual(self, qty):
        return self.client.post('/api/pos/sales/', {
            'pelanggan': self.pelanggan.nomor_wa,
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
            'pelanggan': self.pelanggan.nomor_wa,
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
            'pelanggan': self.pelanggan.nomor_wa,
            'items': [{'product_id': produk_varian.id, 'variant_id': varian.id, 'qty': 2, 'harga': 90000}],
            'status': 'paid', 'dibayar': 180000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)

        bahan_kain.refresh_from_db()
        self.assertEqual(bahan_kain.stok, 50.0 - 2.0)
        # BoM produk utama (tanpa varian) TIDAK ikut kepakai
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0)


class PosBomSinkronProdukSumberTest(APITestCase):
    """Bahan resep yang berasal dari katalog Produk (InventoryItem.product)
    ikut memotong qty_stok Product sumbernya (instruksi user 2026-09-24)."""

    def setUp(self):
        from django.utils import timezone
        from api import stock_fifo

        self.owner = User.objects.create_user(username='owner_bom_sinkron', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)
        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test POS BoM', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='HPP Test POS BoM', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='51000', defaults={'name': 'HPP Test', 'account_type': 'expense', 'classification': expense})

        self.produk_bahan = Product.objects.create(
            nama='Kertas Ivory 230gr', harga_beli=1500, harga_jual_toko=3000,
            qty_stok=100, lacak_inventori=True,
        )
        stock_fifo.create_layer(self.produk_bahan, None, 100, 1500, timezone.localdate())
        self.bahan = _buat_inventory_item(nama='Kertas Ivory 230gr', stok=100.0, cost=1500.0)
        self.bahan.product = self.produk_bahan
        self.bahan.save(update_fields=['product'])

        self.product = Product.objects.create(
            nama='Banner Flexi 280gr', harga_beli=10000, harga_jual_toko=25000,
            qty_stok=50, lacak_inventori=True,
        )
        self.bom = BillOfMaterials.objects.create(product=self.product, nama='BoM Banner Flexi')
        BoMItem.objects.create(bom=self.bom, inventory_item=self.bahan, qty_required_per_unit=2.0)
        self.pelanggan = Contact.objects.create(nomor_wa='081200000098', nama='Pelanggan BoM Sinkron')

    def _jual(self, qty):
        return self.client.post('/api/pos/sales/', {
            'pelanggan': self.pelanggan.nomor_wa,
            'items': [{'product_id': self.product.id, 'qty': qty, 'harga': 25000}],
            'status': 'paid', 'dibayar': 25000 * qty, 'metode_bayar': 'tunai',
        }, format='json')

    def test_pemakaian_resep_ikut_kurangi_stok_produk_sumber(self):
        from api.product_models import ProductStockMovement, StockLayer

        response = self._jual(3)  # 3 x 2.0 per unit = 6 bahan
        self.assertEqual(response.status_code, 201, response.content)

        self.produk_bahan.refresh_from_db()
        self.assertEqual(float(self.produk_bahan.qty_stok), 94.0)

        mv = ProductStockMovement.objects.get(product=self.produk_bahan, tipe='keluar')
        self.assertEqual(float(mv.qty), 6.0)
        self.assertEqual(float(mv.stok_awal), 100.0)
        self.assertEqual(float(mv.stok_akhir), 94.0)
        self.assertIsNone(mv.pos_sale_id)  # tidak masuk agregasi HPP penjualan POS
        self.assertEqual(float(mv.hpp_total), 6.0 * 1500)
        layer = StockLayer.objects.get(product=self.produk_bahan)
        self.assertEqual(float(layer.sisa_qty), 94.0)

    def test_bahan_tanpa_tautan_produk_tidak_menyentuh_produk_lain(self):
        self.bahan.product = None
        self.bahan.save(update_fields=['product'])
        response = self._jual(3)
        self.assertEqual(response.status_code, 201, response.content)
        self.produk_bahan.refresh_from_db()
        self.assertEqual(float(self.produk_bahan.qty_stok), 100.0)

    def test_stok_produk_sumber_tidak_pernah_negatif(self):
        # Stok InventoryItem (100) > stok Product sumber (4): selisih dua
        # stok terpisah tidak boleh membuat qty_stok Product jadi negatif.
        self.produk_bahan.qty_stok = 4
        self.produk_bahan.save(update_fields=['qty_stok'])
        response = self._jual(3)  # butuh 6 bahan
        self.assertEqual(response.status_code, 201, response.content)
        self.produk_bahan.refresh_from_db()
        self.assertEqual(float(self.produk_bahan.qty_stok), 0.0)

    def test_hpp_penjualan_pos_tidak_terhitung_dobel(self):
        from accounting.services.pos_posting import _sale_hpp_total

        response = self._jual(3)
        self.assertEqual(response.status_code, 201, response.content)
        sale = POSSale.objects.get(pk=response.data['id'])
        # Hanya HPP produk jual (Banner: 3 x 10000 dari FIFO fallback), BUKAN
        # ditambah mutasi 'keluar' bahan resep.
        self.assertEqual(_sale_hpp_total(sale), 3 * 10000)
