"""BillOfMaterials (BoM) — tautan ke Product asli (product_models), bukan
cuma dicocokkan lewat nama string ke ProductPrice legacy.

Bug ditemukan 2026-08-12: UI "Tambah Bahan" di detail produk (Inventory)
menyimpan lewat endpoint yang diam-diam membuat/mencocokkan baris
`ProductPrice` terpisah berdasar NAMA teks, sama sekali tidak terhubung ke
`Product` (product_models) yang sedang dilihat user — sehingga bahan yang
ditambahkan tidak pernah ikut potong stok otomatis untuk produk POS.
Migration 0114 menambahkan FK `product`/`variant` (Product/ProductVariant
asli) di BillOfMaterials, field lama di-rename jadi `product_price`
(dipertahankan untuk alur Order/JobBoard lama yang cocok dari teks bebas).
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api.models import (
    BillOfMaterials, BoMItem, Divisi, InventoryItem, JobBoard, Order, OrderItem,
    ProductPrice, RestockHistory, TahapProses,
)
from api.product_models import Product, ProductVariant
from api.views.jobs import deduct_job_materials_if_needed

User = get_user_model()


def _buat_inventory_item(nama='Kertas A4', stok=100.0, cost=1000.0):
    return InventoryItem.objects.create(
        nama=nama, stok=stok, satuan='lembar', kategori='Bahan Baku',
        cost_per_unit=cost,
    )


class BomProductLinkApiTest(APITestCase):
    """Endpoint /bom/ dan /bom-items/ — jalur BARU (product_id/variant_id)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_bom', password='pass12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.product = Product.objects.create(nama='Banner Flexi', price_type='flat', harga_jual_toko=50000)
        self.variant = ProductVariant.objects.create(product=self.product, nama_varian='280gr')
        self.bahan = _buat_inventory_item()

    def test_get_or_create_membuat_bom_terhubung_ke_product_asli(self):
        res = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        bom = BillOfMaterials.objects.get(pk=res.data['id'])
        self.assertEqual(bom.product_id, self.product.id)
        self.assertIsNone(bom.variant_id)
        self.assertIsNone(bom.product_price_id)

    def test_get_or_create_idempotent_per_product_dan_variant(self):
        res1 = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id, 'variant_id': self.variant.id,
        }, format='json')
        res2 = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id, 'variant_id': self.variant.id,
        }, format='json')
        self.assertEqual(res1.data['id'], res2.data['id'])
        self.assertEqual(BillOfMaterials.objects.filter(product=self.product, variant=self.variant).count(), 1)

    def test_bom_utama_dan_bom_varian_beda_baris(self):
        res_utama = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id,
        }, format='json')
        res_varian = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id, 'variant_id': self.variant.id,
        }, format='json')
        self.assertNotEqual(res_utama.data['id'], res_varian.data['id'])

    def test_produk_tidak_ada_dibalas_404_bukan_crash(self):
        res = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': 999999,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_tambah_dan_lihat_bahan_via_product_id(self):
        bom_res = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id,
        }, format='json')
        item_res = self.client.post('/api/bom-items/', {
            'bom': bom_res.data['id'],
            'inventory_item': self.bahan.id,
            'qty_required_per_unit': 2.5,
        }, format='json')
        self.assertEqual(item_res.status_code, status.HTTP_201_CREATED)

        list_res = self.client.get(f'/api/bom/?product_id={self.product.id}')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data['results'] if isinstance(list_res.data, dict) else list_res.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['product_nama'], 'Banner Flexi')
        self.assertEqual(len(results[0]['items']), 1)
        self.assertEqual(results[0]['items'][0]['inventory_item_nama'], self.bahan.nama)

    def test_bom_produk_lain_tidak_ikut_tercampur(self):
        produk_lain = Product.objects.create(nama='Stiker Chromo', price_type='flat', harga_jual_toko=2000)
        self.client.post('/api/bom/get-or-create-for-product/', {'product_id': self.product.id}, format='json')
        self.client.post('/api/bom/get-or-create-for-product/', {'product_id': produk_lain.id}, format='json')

        res = self.client.get(f'/api/bom/?product_id={self.product.id}')
        results = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['product_nama'], 'Banner Flexi')


class BomItemCreateFromProductTest(APITestCase):
    """POST /bom-items/create-from-product/ — pilih bahan baku dari katalog
    Produk (bukan InventoryItem, yang nyaris tidak pernah diisi lewat menu
    "Bahan Baku"). Bug ditemukan 2026-08-13: kotak pencarian "Produk Bahan
    Baku" di UI query ke /inventory/ yang kosong, padahal bahan baku nyata
    (mis. kertas Ivory) tersimpan sebagai Product biasa di katalog."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_bom_prod', password='pass12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.product = Product.objects.create(nama='Kartu Nama IV260-1MK', price_type='flat', harga_jual_toko=50000)
        self.bahan_product = Product.objects.create(
            nama='IVORY 260GR', price_type='flat', harga_jual_toko=0, satuan='pcs',
        )
        bom_res = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_id': self.product.id,
        }, format='json')
        self.bom_id = bom_res.data['id']

    def test_pilih_bahan_dari_produk_membuat_inventoryitem_tersinkron(self):
        res = self.client.post('/api/bom-items/create-from-product/', {
            'bom': self.bom_id,
            'product_id': self.bahan_product.id,
            'qty_required_per_unit': 4,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        inv_item = InventoryItem.objects.get(product=self.bahan_product)
        self.assertEqual(inv_item.nama, 'IVORY 260GR')
        bom_item = BoMItem.objects.get(bom_id=self.bom_id, inventory_item=inv_item)
        self.assertEqual(bom_item.qty_required_per_unit, 4)

        list_res = self.client.get(f'/api/bom/?product_id={self.product.id}')
        results = list_res.data['results'] if isinstance(list_res.data, dict) else list_res.data
        self.assertEqual(results[0]['items'][0]['inventory_item_nama'], 'IVORY 260GR')

    def test_pilih_produk_yang_sama_dua_kali_tidak_membuat_inventoryitem_dobel(self):
        self.client.post('/api/bom-items/create-from-product/', {
            'bom': self.bom_id, 'product_id': self.bahan_product.id, 'qty_required_per_unit': 4,
        }, format='json')
        res2 = self.client.post('/api/bom-items/create-from-product/', {
            'bom': self.bom_id, 'product_id': self.bahan_product.id, 'qty_required_per_unit': 6,
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(InventoryItem.objects.filter(product=self.bahan_product).count(), 1)
        self.assertEqual(BoMItem.objects.filter(bom_id=self.bom_id).count(), 1)
        bom_item = BoMItem.objects.get(bom_id=self.bom_id, inventory_item__product=self.bahan_product)
        self.assertEqual(bom_item.qty_required_per_unit, 6)

    def test_produk_bahan_tidak_ada_dibalas_404(self):
        res = self.client.post('/api/bom-items/create-from-product/', {
            'bom': self.bom_id, 'product_id': 999999, 'qty_required_per_unit': 4,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_qty_nol_ditolak(self):
        res = self.client.post('/api/bom-items/create-from-product/', {
            'bom': self.bom_id, 'product_id': self.bahan_product.id, 'qty_required_per_unit': 0,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class BomLegacyProductPriceTest(APITestCase):
    """Jalur LAMA (product_name/material -> ProductPrice) harus tetap jalan
    tanpa crash untuk caller yang belum kirim product_id (mis. import CSV)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_bom_legacy', password='pass12345', role='owner')
        self.client.force_authenticate(user=self.owner)

    def test_get_or_create_legacy_masih_jalan(self):
        res = self.client.post('/api/bom/get-or-create-for-product/', {
            'product_name': 'Banner Custom Lama',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        bom = BillOfMaterials.objects.get(pk=res.data['id'])
        self.assertIsNone(bom.product_id)
        self.assertIsNotNone(bom.product_price_id)
        self.assertEqual(bom.product_price.nama_produk, 'Banner Custom Lama')


class DeductJobMaterialsBomLinkTest(APITestCase):
    """deduct_job_materials_if_needed() — utamakan tautan Product/Variant
    asli di OrderItem, fallback ke ProductPrice legacy kalau tidak ada."""

    def setUp(self):
        self.staff = User.objects.create_user(username='staff_deduct', password='pass12345', role='staff')
        divisi = Divisi.objects.create(nama='Desain Deduct')
        self.tahap = TahapProses.objects.create(nama='Desain Deduct', divisi=divisi, urutan=1)
        self.bahan = _buat_inventory_item(stok=100.0)
        self.order = Order.objects.create(nama='Pelanggan Deduct', nomor_wa='081200000000', sumber='pos')

        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test BoM', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='HPP Test BoM', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='51000', defaults={'name': 'HPP Test', 'account_type': 'expense', 'classification': expense})

    def _buat_job(self, order_item):
        return JobBoard.objects.create(order_item=order_item, tahap=self.tahap, status_pekerjaan='antrean')

    def test_pakai_bom_dari_product_asli_saat_order_item_punya_fk_produk(self):
        product = Product.objects.create(nama='Banner Flexi', price_type='flat', harga_jual_toko=50000)
        bom = BillOfMaterials.objects.create(product=product, nama='BoM Banner Flexi')
        BoMItem.objects.create(bom=bom, inventory_item=self.bahan, qty_required_per_unit=3.0)

        order_item = OrderItem.objects.create(
            order=self.order, jenis_produk='Nama Bebas Berbeda', product=product, qty=2,
        )
        job = self._buat_job(order_item)

        deduct_job_materials_if_needed(job, self.staff)

        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0 - (3.0 * 2))
        self.assertTrue(RestockHistory.objects.filter(
            item=self.bahan, keterangan__icontains=f'Job #{job.id}',
        ).exists())

    def test_fallback_ke_product_price_legacy_saat_order_item_tanpa_fk_produk(self):
        product_price = ProductPrice.objects.create(kategori='Umum', nama_produk='Banner Lama', harga=0)
        bom = BillOfMaterials.objects.create(product_price=product_price, nama='BoM Legacy')
        BoMItem.objects.create(bom=bom, inventory_item=self.bahan, qty_required_per_unit=1.5)

        order_item = OrderItem.objects.create(
            order=self.order, jenis_produk='Banner Lama', qty=4,
        )
        job = self._buat_job(order_item)

        deduct_job_materials_if_needed(job, self.staff)

        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0 - (1.5 * 4))

    def test_tidak_ada_bom_sama_sekali_tidak_error(self):
        order_item = OrderItem.objects.create(order=self.order, jenis_produk='Produk Tanpa Resep', qty=1)
        job = self._buat_job(order_item)
        deduct_job_materials_if_needed(job, self.staff)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0)
