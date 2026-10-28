"""Akurasi stok bahan resep (BoM) saat pemakaiannya berkoma -- diagnostik 2026-10-28.

Stok bahan ada di dua tempat: InventoryItem.stok (float, 4 desimal) dan Product.qty_stok sumbernya (menu Stok, 2 desimal).
Kedua angka harus tetap sama walau pemakaian per transaksi berkoma."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api.models import BillOfMaterials, BoMItem, Contact, InventoryItem
from api.product_models import Product

User = get_user_model()


class BahanQtyKomaAkurasiTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_bahan_koma', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)
        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Uji Koma', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='HPP Uji Koma', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Uji', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='51000', defaults={'name': 'HPP Uji', 'account_type': 'expense', 'classification': expense})

        self.sumber = Product.objects.create(nama='Bahan Sumber Uji', harga_beli=1000, harga_jual_toko=0, qty_stok=Decimal('100'), lacak_inventori=True)
        self.bahan = InventoryItem.objects.create(
            nama='Bahan Sumber Uji', stok=100.0, satuan='lbr', kategori='Bahan Baku', cost_per_unit=1000.0, product=self.sumber,
        )
        self.custom = Product.objects.create(nama='CUSTOM UJI KOMA', harga_beli=0, harga_jual_toko=10000, lacak_inventori=False)
        self.bom = BillOfMaterials.objects.create(product=self.custom, nama='BoM Custom Uji')
        BoMItem.objects.create(bom=self.bom, inventory_item=self.bahan, qty_required_per_unit=0.4)
        self.pelanggan = Contact.objects.create(nomor_wa='081200000191', nama='Pelanggan Koma Uji')

    def _jual(self, qty):
        res = self.client.post('/api/pos/sales/', {
            'pelanggan': self.pelanggan.nomor_wa,
            'items': [{'product_id': self.custom.id, 'qty': qty}],
            'status': 'paid', 'dibayar': 1000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)

    def _selisih(self):
        self.bahan.refresh_from_db()
        self.sumber.refresh_from_db()
        return round(Decimal(str(self.bahan.stok)) - self.sumber.qty_stok, 4)

    def test_stok_bahan_dan_stok_produk_sumber_tetap_sama_setelah_pemakaian_berkoma(self):
        for _ in range(10):
            self._jual('1.2345')          # pemakaian 0,4938 per transaksi
        self.assertEqual(self._selisih(), Decimal('0'), (self.bahan.stok, self.sumber.qty_stok))

    def test_pemakaian_sangat_kecil_tetap_mengurangi_stok_produk_sumber(self):
        for _ in range(20):
            self._jual('0.0100')          # pemakaian 0,004 per transaksi
        self.assertEqual(self._selisih(), Decimal('0'), (self.bahan.stok, self.sumber.qty_stok))

    def test_api_menampilkan_stok_tanpa_nol_berlebih(self):
        self.assertEqual(self.client.get(f'/api/products/{self.sumber.id}/').data['qty_stok'], '100.00')
        for _ in range(10):
            self._jual('1.2345')
        self.assertEqual(self.client.get(f'/api/products/{self.sumber.id}/').data['qty_stok'], '95.062')
