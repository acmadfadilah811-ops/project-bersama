"""Penerimaan barang parsial Pembelian (2026-09-26, UAT INV-05).

Skenario: 100 kertas @1.000 + 10 tinta @5.000 = 150.000, PPN 11% = 16.500,
total 166.500, DP 50.000. Kedatangan 1: 40 kertas + 10 tinta. DP kedua 60.000.
Kedatangan 2: 60 kertas (melengkapi). Total hutang semua kedatangan = total.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry, JournalEntryLine

from .product_models import Product, Purchase, PurchaseItem, StockInDocument


class PenerimaanParsialTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner-parsial', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.kertas = Product.objects.create(nama='Kertas A3', qty_stok=0)
        self.tinta = Product.objects.create(nama='Tinta Cyan', qty_stok=0)
        aset, _ = AccountClassification.objects.get_or_create(name='Kas & Bank', defaults={'account_type': 'asset'})
        kew, _ = AccountClassification.objects.get_or_create(name='Hutang Uji', defaults={'account_type': 'liability'})
        self.kas = Account.objects.create(code='11101', name='Kas', account_type='asset', classification=aset)
        self.hutang = Account.objects.create(code='21000', name='Hutang Dagang', account_type='liability', classification=kew)
        self.uang_muka = Account.objects.create(code='11710', name='Uang Muka Pembelian', account_type='asset', classification=aset)
        self.persediaan = Account.objects.create(code='11400', name='Persediaan', account_type='asset', classification=aset)
        Account.objects.create(code='11750', name='PPN Masukan', account_type='asset', classification=aset)
        s, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        s.purchase_inventory_account, s.purchase_payable_account, s.purchase_advance_account = self.persediaan, self.hutang, self.uang_muka
        s.save()
        self.po = Purchase.objects.create(nomor='PB-P1', tanggal=date(2026, 9, 26), dibuat_oleh=self.owner)
        self.i_kertas = PurchaseItem.objects.create(purchase=self.po, product=self.kertas, qty=Decimal('100'), harga_beli=Decimal('1000'))
        self.i_tinta = PurchaseItem.objects.create(purchase=self.po, product=self.tinta, qty=Decimal('10'), harga_beli=Decimal('5000'))
        res = self.client.patch(f'/api/purchases/{self.po.id}/', {'pajak_tipe': 'persen', 'pajak_nilai': '11'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)

    def _bayar(self, nominal):
        res = self.client.post(f'/api/purchases/{self.po.id}/add-payment/', {
            'tanggal': '2026-09-26', 'nominal': str(nominal), 'payment_account_id': self.kas.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

    def _terima(self):
        res = self.client.post(f'/api/purchases/{self.po.id}/workflow/siapkan-stok-masuk/',
                               {'tanggal_diterima': '2026-09-26', 'lanjut_tambah_stok': True}, format='json')
        self.assertIn(res.status_code, (200, 201), res.content)
        return StockInDocument.objects.get(pk=res.data['stock_document']['id'])

    def _post(self, doc):
        return self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')

    def _saldo(self, akun):
        baris = JournalEntryLine.objects.filter(account=akun, journal_entry__status='posted')
        return sum((l.debit - l.kredit for l in baris), Decimal('0'))

    def test_dua_kedatangan_hutang_ppn_dan_dp_tepat(self):
        self._bayar(50000)
        doc1 = self._terima()
        self.assertEqual(sorted((i.product.nama, i.qty) for i in doc1.items.all()),
                         [('Kertas A3', Decimal('100')), ('Tinta Cyan', Decimal('10'))])
        baris_kertas = doc1.items.get(product=self.kertas)
        res = self.client.post(f'/api/stock-in-documents/{doc1.id}/update-item/',
                               {'item_id': baris_kertas.id, 'qty': 40}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self._post(doc1).status_code, 200)

        self.po.refresh_from_db()
        self.kertas.refresh_from_db()
        self.assertEqual((self.po.receive_status, self.kertas.qty_stok), ('sebagian', Decimal('40')))
        detail = self.client.get(f'/api/purchases/{self.po.id}/').data
        self.assertEqual({i['product_nama']: Decimal(str(i['qty_diterima'])) for i in detail['items']},
                         {'Kertas A3': Decimal('40'), 'Tinta Cyan': Decimal('10')})
        # Kedatangan 1: 40.000 + 50.000 = 90.000, PPN 9.900, hutang 99.900, DP 50.000 dipakai.
        self.assertEqual(self._saldo(self.persediaan), Decimal('90000'))
        self.assertEqual(self._saldo(self.hutang), Decimal('-99900') + Decimal('50000'))

        self._bayar(60000)  # masih 'sebagian' -> tetap DP
        doc2 = self._terima()
        self.assertEqual([(i.product.nama, i.qty) for i in doc2.items.all()], [('Kertas A3', Decimal('60'))])
        self.assertEqual(self._post(doc2).status_code, 200)

        self.po.refresh_from_db()
        self.kertas.refresh_from_db()
        self.assertEqual((self.po.receive_status, self.kertas.qty_stok), ('diterima', Decimal('100')))
        self.assertEqual(self._saldo(self.persediaan), Decimal('150000'))
        # Total hutang dikredit 166.500, DP 110.000 dipakai -> sisa hutang 56.500; uang muka habis.
        self.assertEqual(self._saldo(self.hutang), Decimal('-56500'))
        self.assertEqual(self._saldo(self.uang_muka), Decimal('0'))
        for j in JournalEntry.objects.filter(source_type='stock_in'):
            self.assertEqual(sum(l.debit for l in j.lines.all()), sum(l.kredit for l in j.lines.all()))

        tolak = self.client.post(f'/api/purchases/{self.po.id}/workflow/siapkan-stok-masuk/',
                                 {'lanjut_tambah_stok': True}, format='json')
        self.assertEqual(tolak.status_code, 400)

    def test_qty_melebihi_sisa_ditolak(self):
        doc1 = self._terima()
        baris = doc1.items.get(product=self.kertas)
        self.client.post(f'/api/stock-in-documents/{doc1.id}/update-item/', {'item_id': baris.id, 'qty': 30}, format='json')
        self._post(doc1)
        doc2 = self._terima()
        baris2 = doc2.items.get(product=self.kertas)
        res = self.client.post(f'/api/stock-in-documents/{doc2.id}/update-item/', {'item_id': baris2.id, 'qty': 71}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('sisa', res.data['error'])

    def test_penerimaan_sekaligus_tetap_seperti_sebelumnya(self):
        doc = self._terima()
        self.assertEqual(self._post(doc).status_code, 200)
        self.po.refresh_from_db()
        self.assertEqual(self.po.receive_status, 'diterima')
        self.assertEqual(self._saldo(self.hutang), Decimal('-166500'))
