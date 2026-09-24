"""Stok Bahan Baku (InventoryItem) ikut berubah bila stok Product sumbernya berubah
lewat opname / stok masuk / penjualan langsung; pemakaian resep tidak terhitung
dobel (2026-09-24)."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings
from api.models import BillOfMaterials, BoMItem, Contact, InventoryItem, RestockHistory
from api.product_models import (
    Product, ProductVariant, StockInDocument, StockInDocumentItem, StockLayer,
    StockOpnameDocument, StockOpnameDocumentItem,
)

User = get_user_model()


class BahanBakuSinkronStokProdukTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_sinkron', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='Beban Test', defaults={'account_type': 'expense'})
        liability, _ = AccountClassification.objects.get_or_create(name='Hutang Test', defaults={'account_type': 'liability'})
        for code, nama, tipe, kls in (
            ('11400', 'Persediaan', 'asset', asset), ('81000', 'Penyesuaian', 'expense', expense),
            ('51000', 'HPP', 'expense', expense), ('21000', 'Hutang', 'liability', liability),
        ):
            Account.objects.get_or_create(code=code, defaults={'name': nama, 'account_type': tipe, 'classification': kls})
        advance = Account.objects.create(code='11710', name='Uang Muka', account_type='asset', classification=asset)
        pengaturan, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        pengaturan.purchase_inventory_account = Account.objects.get(code='11400')
        pengaturan.purchase_payable_account = Account.objects.get(code='21000')
        pengaturan.purchase_advance_account = advance
        pengaturan.save(update_fields=['purchase_inventory_account', 'purchase_payable_account', 'purchase_advance_account'])

        self.produk_bahan = Product.objects.create(
            nama='Kertas Sinkron', qty_stok=Decimal('100'), harga_beli=Decimal('1000'),
            lacak_inventori=True, harga_jual_toko=2000,
        )
        StockLayer.objects.create(
            product=self.produk_bahan, variant=None, tanggal_masuk=date(2026, 9, 1),
            qty_masuk=Decimal('100'), sisa_qty=Decimal('100'), harga_beli=Decimal('1000'),
            sumber_tipe='saldo_awal', sumber_nomor='SEED',
        )
        self.bahan = InventoryItem.objects.create(
            nama='Kertas Sinkron', stok=100.0, satuan='pcs', kategori='Bahan Baku',
            product=self.produk_bahan,
        )

    def _opname(self, aktual):
        doc = StockOpnameDocument.objects.create(nomor=f'OP-SINKRON-{aktual}', tanggal=date(2026, 9, 24), dibuat_oleh=self.owner)
        StockOpnameDocumentItem.objects.create(document=doc, product=self.produk_bahan, stok_sistem=Decimal('100'), stok_aktual=Decimal(aktual))
        res = self.client.post(f'/api/stock-opname-documents/{doc.id}/post-document/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)

    def test_opname_mengubah_stok_bahan_tertaut_dan_tercatat_di_riwayat(self):
        self._opname(90)
        self.produk_bahan.refresh_from_db()
        self.bahan.refresh_from_db()
        self.assertEqual(self.produk_bahan.qty_stok, Decimal('90'))
        self.assertEqual(self.bahan.stok, 90.0)
        rh = RestockHistory.objects.filter(item=self.bahan).latest('id')
        self.assertEqual(rh.delta, -10.0)
        self.assertIn('Sinkron stok produk sumber', rh.keterangan)

    def test_opname_surplus_menambah_stok_bahan(self):
        self._opname(120)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 120.0)

    def test_stok_masuk_produk_menambah_stok_bahan(self):
        doc = StockInDocument.objects.create(nomor='IN-SINKRON', tanggal=date(2026, 9, 24), dibuat_oleh=self.owner)
        StockInDocumentItem.objects.create(document=doc, product=self.produk_bahan, qty=Decimal('25'), harga_beli=Decimal('1000'))
        res = self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 125.0)

    def test_restock_langsung_di_menu_bahan_baku_tidak_tertimpa_mutasi_produk(self):
        InventoryItem.objects.filter(pk=self.bahan.pk).update(stok=150.0)  # restock manual +50
        self._opname(90)  # produk: 100 -> 90 (delta -10)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 140.0)  # 150 - 10, bukan ditimpa jadi 90

    def test_pemakaian_resep_tidak_terhitung_dobel(self):
        produk_jadi = Product.objects.create(nama='Banner Jadi', qty_stok=Decimal('50'), harga_beli=Decimal('5000'), harga_jual_toko=25000, lacak_inventori=True)
        bom = BillOfMaterials.objects.create(product=produk_jadi, nama='BoM Banner')
        BoMItem.objects.create(bom=bom, inventory_item=self.bahan, qty_required_per_unit=2.0)
        pelanggan = Contact.objects.create(nomor_wa='081200000123', nama='Pelanggan Sinkron')
        res = self.client.post('/api/pos/sales/', {
            'pelanggan': pelanggan.nomor_wa,
            'items': [{'product_id': produk_jadi.id, 'qty': 3, 'harga': 25000}],
            'status': 'paid', 'dibayar': 75000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

        self.bahan.refresh_from_db()
        self.produk_bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 94.0)                    # 100 - 3 x 2, tepat sekali
        self.assertEqual(self.produk_bahan.qty_stok, Decimal('94'))  # tetap sejajar
        self.assertEqual(RestockHistory.objects.filter(item=self.bahan, keterangan__startswith='Sinkron').count(), 0)

    def test_penjualan_langsung_produk_sumber_mengurangi_stok_bahan(self):
        pelanggan = Contact.objects.create(nomor_wa='081200000124', nama='Pelanggan Sinkron 2')
        res = self.client.post('/api/pos/sales/', {
            'pelanggan': pelanggan.nomor_wa,
            'items': [{'product_id': self.produk_bahan.id, 'qty': 4, 'harga': 2000}],
            'status': 'paid', 'dibayar': 8000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 96.0)

    def test_stok_bahan_tidak_pernah_negatif(self):
        InventoryItem.objects.filter(pk=self.bahan.pk).update(stok=3.0)
        self._opname(90)  # delta -10 > stok bahan 3
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 0.0)

    def test_produk_bervarian_dan_bahan_tanpa_tautan_tidak_tersentuh(self):
        bahan_lepas = InventoryItem.objects.create(nama='Bahan Lepas', stok=50.0, satuan='pcs', kategori='Bahan Baku')
        self._opname(90)
        bahan_lepas.refresh_from_db()
        self.assertEqual(bahan_lepas.stok, 50.0)
