"""Pembelian yang berisi produk jasa (2026-09-26, UAT Finance/Inventory).

Jasa (lacak_inventori=False) tidak diblokir di Pembelian: item jasa tidak
menambah stok/lapisan, biayanya didebit ke HPP, Persediaan hanya menerima
barang. Stok Masuk manual, Stok Keluar, dan Opname menolak produk jasa dengan
keterangan, karena jasa tidak punya stok.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry

from .product_models import (
    Product, Purchase, PurchaseItem, StockInDocument, StockLayer, StockOpnameDocument, StockOutDocument,
)


class PembelianJasaTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner-jasa', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.kertas = Product.objects.create(nama='Kertas A3', lacak_inventori=True, qty_stok=0)
        self.jasa = Product.objects.create(nama='Jasa Cetak Vendor', lacak_inventori=False, qty_stok=0)

        aset, _ = AccountClassification.objects.get_or_create(name='Aset Uji', defaults={'account_type': 'asset'})
        kewajiban, _ = AccountClassification.objects.get_or_create(name='Hutang Uji', defaults={'account_type': 'liability'})
        beban, _ = AccountClassification.objects.get_or_create(name='HPP Uji', defaults={'account_type': 'expense'})
        payable = Account.objects.create(code='21000', name='Hutang Dagang', account_type='liability', classification=kewajiban)
        advance = Account.objects.create(code='11710', name='Uang Muka Pembelian', account_type='asset', classification=aset)
        inventory = Account.objects.create(code='11400', name='Persediaan', account_type='asset', classification=aset)
        Account.objects.create(code='11750', name='PPN Masukan', account_type='asset', classification=aset)
        self.hpp = Account.objects.create(code='51000', name='Harga pokok penjualan', account_type='expense', classification=beban)
        self.settings, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        self.settings.purchase_inventory_account = inventory
        self.settings.purchase_payable_account = payable
        self.settings.purchase_advance_account = advance
        self.settings.pos_cogs_expense_account = self.hpp
        self.settings.save()

    def _pembelian(self, nomor, *items, pajak=None):
        p = Purchase.objects.create(nomor=nomor, tanggal=date(2026, 9, 26), dibuat_oleh=self.owner)
        for produk, qty, harga in items:
            PurchaseItem.objects.create(purchase=p, product=produk, qty=Decimal(qty), harga_beli=Decimal(harga))
        if pajak:
            res = self.client.patch(f'/api/purchases/{p.id}/', {'pajak_tipe': 'persen', 'pajak_nilai': pajak}, format='json')
            self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        return p

    def _terima_dan_posting(self, purchase):
        res = self.client.post(f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
                               {'tanggal_diterima': '2026-09-26', 'lanjut_tambah_stok': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        doc = StockInDocument.objects.get(purchase=purchase)
        return doc, self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')

    def _baris(self, doc):
        jurnal = JournalEntry.objects.get(source_type='stock_in', source_id=doc.id)
        self.assertEqual(sum(l.debit for l in jurnal.lines.all()), sum(l.kredit for l in jurnal.lines.all()))
        return {(l.account.code, l.debit, l.kredit) for l in jurnal.lines.all()}

    def test_campuran_barang_dan_jasa_dengan_ppn(self):
        p = self._pembelian('PB-J1', (self.kertas, '100', '1000'), (self.jasa, '1', '50000'), pajak='11')
        detail = self.client.get(f'/api/purchases/{p.id}/').data
        self.assertEqual({i['product_nama']: i['is_jasa'] for i in detail['items']},
                         {'Kertas A3': False, 'Jasa Cetak Vendor': True})

        doc, res = self._terima_dan_posting(p)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.kertas.refresh_from_db()
        self.jasa.refresh_from_db()
        self.assertEqual((self.kertas.qty_stok, self.jasa.qty_stok), (Decimal('100'), Decimal('0')))
        self.assertFalse(StockLayer.objects.filter(product=self.jasa).exists())
        self.assertEqual(self._baris(doc), {
            ('11400', Decimal('100000'), Decimal('0')),
            ('51000', Decimal('50000'), Decimal('0')),
            ('11750', Decimal('16500'), Decimal('0')),
            ('21000', Decimal('0'), Decimal('166500')),
        })

    def test_pembelian_hanya_jasa(self):
        doc, res = self._terima_dan_posting(self._pembelian('PB-J2', (self.jasa, '2', '75000')))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.assertEqual(self._baris(doc), {('51000', Decimal('150000'), Decimal('0')),
                                            ('21000', Decimal('0'), Decimal('150000'))})
        self.assertFalse(doc.movements.exists())

    def test_akun_hpp_belum_diatur_ditolak_dengan_pesan(self):
        self.settings.pos_cogs_expense_account = None
        self.settings.save()
        _doc, res = self._terima_dan_posting(self._pembelian('PB-J3', (self.jasa, '1', '50000')))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('akun HPP', str(res.content.decode()))
        self.assertFalse(JournalEntry.objects.exists())

    def test_stok_masuk_keluar_opname_menolak_jasa(self):
        masuk = StockInDocument.objects.create(nomor='IN-J', tanggal=date(2026, 9, 26), dibuat_oleh=self.owner)
        keluar = StockOutDocument.objects.create(nomor='OUT-J', tanggal=date(2026, 9, 26), dibuat_oleh=self.owner)
        opname = StockOpnameDocument.objects.create(nomor='OP-J', tanggal=date(2026, 9, 26), dibuat_oleh=self.owner)
        for url, data in (
            (f'/api/stock-in-documents/{masuk.id}/add-item/', {'product': self.jasa.id, 'qty': 5, 'harga_beli': 1000}),
            (f'/api/stock-out-documents/{keluar.id}/add-item/', {'product': self.jasa.id, 'qty': 1}),
            (f'/api/stock-opname-documents/{opname.id}/add-item/', {'product': self.jasa.id, 'stok_aktual': 3}),
        ):
            with self.subTest(url=url):
                res = self.client.post(url, data, format='json')
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.content)
                self.assertIn('produk jasa', res.data['error'])
        ok = self.client.post(f'/api/stock-in-documents/{masuk.id}/add-item/',
                              {'product': self.kertas.id, 'qty': 5, 'harga_beli': 1000}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.content)
