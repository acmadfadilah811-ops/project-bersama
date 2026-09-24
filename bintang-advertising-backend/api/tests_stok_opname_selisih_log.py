"""Stok Opname: nilai selisih memakai harga beli (snapshot saat posting), ringkasan
per produk yang benar untuk beberapa baris rak, jejak siapa menginput/memposting,
riwayat aktivitas, dan jurnal (2026-09-24)."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, JournalEntry

from .product_models import (
    Product, ProductVariant, StockLayer, StockOpnameActivityLog, StockOpnameDocument, StockOpnameDocumentItem,
)

User = get_user_model()


class StokOpnameSelisihLogTests(APITestCase):
    def setUp(self):
        self.penginput = User.objects.create_user(username='gudang_a', password='x', role='admin', first_name='Gudang', last_name='A')
        self.owner = User.objects.create_user(username='owner_op', password='x', role='owner')
        self.client.force_authenticate(self.penginput)
        self.product = Product.objects.create(nama='Kertas Opname', qty_stok=Decimal('100'), harga_beli=Decimal('1000'), lacak_inventori=True)
        StockLayer.objects.create(
            product=self.product, variant=None, tanggal_masuk=date(2026, 9, 1),
            qty_masuk=Decimal('100'), sisa_qty=Decimal('100'), harga_beli=Decimal('1000'),
            sumber_tipe='saldo_awal', sumber_nomor='SEED',
        )
        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test', defaults={'account_type': 'asset'})
        expense, _ = AccountClassification.objects.get_or_create(name='Penyesuaian Test', defaults={'account_type': 'expense'})
        Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        Account.objects.get_or_create(code='81000', defaults={'name': 'Penyesuaian Barang Test', 'account_type': 'expense', 'classification': expense})

    def _buat_dokumen(self):
        res = self.client.post('/api/stock-opname-documents/', {'tanggal': '2026-09-24', 'catatan': 'Opname bulanan'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        return res.data['id']

    def _tambah(self, doc_id, product, aktual, **extra):
        res = self.client.post(f'/api/stock-opname-documents/{doc_id}/add-item/', {'product': product.id, 'stok_aktual': aktual, **extra}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        return res.data

    def _post(self, doc_id):
        res = self.client.post(f'/api/stock-opname-documents/{doc_id}/post-document/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        return res.data

    def test_selisih_harga_tampil_di_draft_memakai_harga_beli(self):
        doc_id = self._buat_dokumen()
        item = self._tambah(doc_id, self.product, 90)  # kurang 10 x 1.000
        self.assertEqual(Decimal(str(item['selisih'])), Decimal('-10'))
        self.assertEqual(Decimal(str(item['selisih_harga'])), Decimal('-10000'))

        detail = self.client.get(f'/api/stock-opname-documents/{doc_id}/').data
        ring = detail['ringkasan_selisih']
        self.assertEqual(Decimal(str(ring['total_defisit'])), Decimal('10000'))
        self.assertEqual(Decimal(str(ring['total_surplus'])), Decimal('0'))
        self.assertEqual(ring['jumlah_produk_selisih'], 1)

    def test_produk_di_dua_rak_dijumlah_sebelum_dibandingkan_dengan_stok_sistem(self):
        doc_id = self._buat_dokumen()
        self._tambah(doc_id, self.product, 60, rak='A')
        self._tambah(doc_id, self.product, 40, rak='B')  # total 100 = stok sistem -> tidak ada selisih
        ring = self.client.get(f'/api/stock-opname-documents/{doc_id}/').data['ringkasan_selisih']
        self.assertEqual(len(ring['baris']), 1)
        self.assertEqual(Decimal(str(ring['baris'][0]['selisih'])), Decimal('0'))
        self.assertEqual(ring['jumlah_produk_selisih'], 0)

    def test_selisih_varian_memakai_harga_beli_varian(self):
        produk = Product.objects.create(nama='Kaos Opname', has_variant=True, harga_beli=Decimal('1'), lacak_inventori=True)
        varian = ProductVariant.objects.create(product=produk, nama_varian='XL', qty_stok=Decimal('10'), harga_beli=Decimal('30000'))
        doc_id = self._buat_dokumen()
        res = self.client.post(f'/api/stock-opname-documents/{doc_id}/add-item/', {
            'product': produk.id, 'variant': varian.id, 'stok_aktual': 8,
        }, format='json')
        self.assertEqual(Decimal(str(res.data['selisih_harga'])), Decimal('-60000'))  # -2 x 30.000

    def test_posting_menyimpan_snapshot_penginput_pemosting_dan_nilai(self):
        doc_id = self._buat_dokumen()
        self._tambah(doc_id, self.product, 90)
        self.client.force_authenticate(self.owner)
        data = self._post(doc_id)

        self.assertEqual(data['dibuat_oleh_nama'], 'gudang_a')
        self.assertEqual(data['diposting_oleh_nama'], 'owner_op')
        self.assertIsNotNone(data['waktu_diposting'])
        self.assertEqual(Decimal(str(data['nilai_defisit'])), Decimal('10000'))
        self.assertEqual(Decimal(str(data['nilai_jurnal_defisit'])), Decimal('10000'))

        # Harga beli berubah SESUDAH posting: nilai selisih historis tetap.
        Product.objects.filter(pk=self.product.pk).update(harga_beli=Decimal('9999'))
        ring = self.client.get(f'/api/stock-opname-documents/{doc_id}/').data['ringkasan_selisih']
        self.assertEqual(Decimal(str(ring['total_defisit'])), Decimal('10000'))

    def test_posting_dijurnal_dan_deskripsi_memuat_penginput_dan_pemosting(self):
        doc_id = self._buat_dokumen()
        self._tambah(doc_id, self.product, 90)
        self.client.force_authenticate(self.owner)
        self._post(doc_id)

        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_OPNAME, source_id=doc_id)
        self.assertEqual(sum(l.debit for l in entry.lines.all()), Decimal('10000'))
        self.assertIn('Gudang A', entry.description)
        self.assertIn('owner_op', entry.description)
        self.assertEqual(entry.created_by_id, self.owner.id)

    def test_riwayat_mencatat_siapa_membuat_menambah_mengubah_dan_memposting(self):
        doc_id = self._buat_dokumen()
        item = self._tambah(doc_id, self.product, 90)
        self.client.post(f'/api/stock-opname-documents/{doc_id}/update-item/', {'item_id': item['id'], 'stok_aktual': 95}, format='json')
        self._post(doc_id)

        logs = self.client.get(f'/api/stock-opname-documents/{doc_id}/logs/').data
        tindakan = [l['tindakan'] for l in reversed(logs)]
        self.assertEqual(tindakan, ['CREATED', 'ITEM_ADDED', 'ITEM_UPDATED', 'POSTED'])
        self.assertTrue(all(l['user_nama'] == 'Gudang A' for l in logs))
        self.assertIn('90', logs[1]['keterangan'])
        self.assertIn('95', logs[1]['keterangan'])

    def test_hapus_item_dan_batal_tercatat(self):
        doc_id = self._buat_dokumen()
        item = self._tambah(doc_id, self.product, 90)
        self.client.post(f'/api/stock-opname-documents/{doc_id}/remove-item/', {'item_id': item['id']}, format='json')
        self.client.post(f'/api/stock-opname-documents/{doc_id}/cancel/', {}, format='json')
        tindakan = set(StockOpnameActivityLog.objects.filter(document_id=doc_id).values_list('tindakan', flat=True))
        self.assertTrue({'ITEM_REMOVED', 'CANCELED'} <= tindakan)

    def test_stok_sistem_dicatat_ulang_saat_posting_bila_stok_bergerak(self):
        doc_id = self._buat_dokumen()
        self._tambah(doc_id, self.product, 90)
        Product.objects.filter(pk=self.product.pk).update(qty_stok=Decimal('95'))  # ada penjualan sebelum posting
        StockLayer.objects.filter(product=self.product).update(sisa_qty=Decimal('95'))
        data = self._post(doc_id)
        item = StockOpnameDocumentItem.objects.get(document_id=doc_id)
        self.assertEqual(item.stok_sistem, Decimal('95'))
        self.assertEqual(Decimal(str(data['nilai_defisit'])), Decimal('5000'))
