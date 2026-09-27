"""Bahan baku: sumber stok tunggal = produk/varian (2026-09-26, instruksi user).

- Bahan tertaut produk tidak bisa di-restock/diedit langsung -> diarahkan ke
  Pembelian/Stok Masuk, Stok Keluar, Stok Opname. Bahan tanpa tautan tetap bisa.
- Riwayat bahan mencatat siapa & kapan (user_nama_lengkap, waktu).
- Bahan resep bisa dari VARIAN: pemakaian memotong stok varian, mutasi varian
  (mis. stok masuk) dicerminkan ke bahan varian itu, void POS memulihkannya.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api import stock_fifo
from api.models import BillOfMaterials, BoMItem, Contact, InventoryItem, RestockHistory
from api.pos_models import POSSale
from api.product_models import Product, ProductStockMovement, ProductVariant

User = get_user_model()


class BahanBakuSatuSumberTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_bahan', password='x', role='owner',
                                              first_name='Budi', last_name='Gudang')
        self.client.force_authenticate(self.owner)
        aset, _ = AccountClassification.objects.get_or_create(name='Persediaan Uji Bahan', defaults={'account_type': 'asset'})
        beban, _ = AccountClassification.objects.get_or_create(name='HPP Uji Bahan', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan', 'account_type': 'asset', 'classification': aset})
        Account.objects.get_or_create(code='51000', defaults={'name': 'HPP', 'account_type': 'expense', 'classification': beban})
        self.kertas = Product.objects.create(nama='Kertas Foto', qty_stok=0, has_variant=True, satuan='lembar')
        self.v4r = ProductVariant.objects.create(product=self.kertas, nama_varian='4R', qty_stok=Decimal('100'), harga_beli=500)
        self.v10r = ProductVariant.objects.create(product=self.kertas, nama_varian='10R', qty_stok=Decimal('50'), harga_beli=2000)
        stock_fifo.create_layer(self.kertas, self.v4r, 100, 500, timezone.localdate())
        self.cetak = Product.objects.create(nama='Cetak Foto 4R', qty_stok=0, lacak_inventori=False, harga_jual_toko=3000)
        self.bom = BillOfMaterials.objects.create(product=self.cetak, nama='BoM Cetak 4R')

    def _tambah_bahan(self, **data):
        return self.client.post('/api/bom-items/create-from-product/',
                                {'bom': self.bom.id, 'product_id': self.kertas.id, 'qty_required_per_unit': 1, **data},
                                format='json')

    def test_produk_bervarian_wajib_pilih_varian(self):
        res = self._tambah_bahan()
        self.assertEqual(res.status_code, 400)
        self.assertIn('pilih varian', res.data['error'])

    def test_bahan_varian_potong_dan_pulihkan_stok_varian(self):
        self.assertEqual(self._tambah_bahan(variant_id=self.v4r.id).status_code, 201)
        bahan = InventoryItem.objects.get(product=self.kertas, variant=self.v4r)
        self.assertEqual((bahan.nama, bahan.stok), ('Kertas Foto - 4R', 100.0))

        pelanggan = Contact.objects.create(nomor_wa='081200000077', nama='Pelanggan Varian')
        res = self.client.post('/api/pos/sales/', {
            'pelanggan': pelanggan.nomor_wa, 'items': [{'product_id': self.cetak.id, 'qty': 3, 'harga': 3000}],
            'status': 'paid', 'dibayar': 9000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.v4r.refresh_from_db()
        self.v10r.refresh_from_db()
        bahan.refresh_from_db()
        self.assertEqual((self.v4r.qty_stok, self.v10r.qty_stok, bahan.stok), (Decimal('97'), Decimal('50'), 97.0))

        sale = POSSale.objects.get(pk=res.data['id'])
        self.client.post(f'/api/pos/sales/{sale.id}/void/', {'alasan': 'batal', 'bahan_terpakai': False}, format='json')
        self.v4r.refresh_from_db()
        bahan.refresh_from_db()
        self.assertEqual((self.v4r.qty_stok, bahan.stok), (Decimal('100'), 100.0))

    def test_mutasi_varian_dicerminkan_ke_bahan_varian_itu_saja(self):
        self._tambah_bahan(variant_id=self.v4r.id)
        bahan = InventoryItem.objects.get(variant=self.v4r)
        ProductStockMovement.objects.create(product=self.kertas, variant=self.v4r, user=self.owner, tipe='masuk',
                                            qty=20, stok_awal=100, stok_akhir=120, tanggal=timezone.localdate())
        ProductStockMovement.objects.create(product=self.kertas, variant=self.v10r, user=self.owner, tipe='masuk',
                                            qty=5, stok_awal=50, stok_akhir=55, tanggal=timezone.localdate())
        bahan.refresh_from_db()
        self.assertEqual(bahan.stok, 120.0)
        log = RestockHistory.objects.filter(item=bahan).latest('id')
        self.assertEqual(log.user_id, self.owner.id)

    def test_restock_langsung_bahan_tertaut_ditolak_dengan_arahan(self):
        self._tambah_bahan(variant_id=self.v4r.id)
        bahan = InventoryItem.objects.get(variant=self.v4r)
        res = self.client.post(f'/api/inventory/{bahan.id}/restock/', {'delta': 10}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Pembelian', res.data['error'])
        res = self.client.patch(f'/api/inventory/{bahan.id}/', {'stok': 5}, format='json')
        self.assertEqual(res.status_code, 400)
        bahan.refresh_from_db()
        self.assertEqual(bahan.stok, 100.0)

    def test_restock_bahan_tanpa_tautan_tercatat_siapa_dan_kapan(self):
        tinta = InventoryItem.objects.create(nama='Tinta Cyan', stok=1, satuan='liter', kategori='Tinta')
        res = self.client.post(f'/api/inventory/{tinta.id}/restock/', {'delta': 4, 'keterangan': 'beli toko'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        riwayat = self.client.get(f'/api/inventory/{tinta.id}/').data['history']
        self.assertEqual(riwayat[0]['user_nama_lengkap'], 'Budi Gudang')
        self.assertEqual(riwayat[0]['delta'], 4.0)
        self.assertTrue(riwayat[0]['waktu'])
