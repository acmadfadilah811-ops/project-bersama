"""Retur pembelian ber-diskon & PPN: PPN Masukan dibalik proporsional, hutang
berkurang sebesar nilai barang + PPN, total retur konsisten dengan jurnal, dan
retur tukar barang netral (2026-09-24)."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry

from .product_models import Product, Purchase, PurchaseItem, StockInDocument


class ReturPembelianPpnTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner-retur-ppn', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(nama='Kertas Retur PPN', lacak_inventori=True, qty_stok=0)

        asset, _ = AccountClassification.objects.get_or_create(name='Kas & Bank', defaults={'account_type': 'asset'})
        liability, _ = AccountClassification.objects.get_or_create(name='Hutang Test', defaults={'account_type': 'liability'})
        self.cash = Account.objects.create(code='11101', name='Kas Test', account_type='asset', classification=asset)
        payable = Account.objects.create(code='21000', name='Hutang Dagang Test', account_type='liability', classification=liability)
        advance = Account.objects.create(code='11710', name='Uang Muka Pembelian', account_type='asset', classification=asset)
        inventory = Account.objects.create(code='11400', name='Persediaan Test', account_type='asset', classification=asset)
        Account.objects.create(code='11750', name='PPN Masukan', account_type='asset', classification=asset)
        settings, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        settings.purchase_inventory_account = inventory
        settings.purchase_payable_account = payable
        settings.purchase_advance_account = advance
        settings.save(update_fields=['purchase_inventory_account', 'purchase_payable_account', 'purchase_advance_account'])

        # 100 x 1.000 = 100.000; diskon 10% -> 90.000; PPN 11% -> 9.900; total 99.900
        self.purchase = Purchase.objects.create(
            nomor='PB-RETUR-PPN', tanggal=date(2026, 9, 24), dibuat_oleh=self.owner,
            diskon_tipe='persen', diskon_nilai=Decimal('10'), pajak_tipe='persen', pajak_nilai=Decimal('11'),
        )
        PurchaseItem.objects.create(purchase=self.purchase, product=self.product, qty=Decimal('100'), harga_beli=Decimal('1000'))
        self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-09-24', 'lanjut_tambah_stok': True}, format='json',
        )
        doc = StockInDocument.objects.get(purchase=self.purchase)
        self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')
        self.client.post(f'/api/purchases/{self.purchase.id}/add-payment/', {
            'tanggal': '2026-09-24', 'nominal': '99900', 'payment_account_id': self.cash.id,
        }, format='json')

    def _retur(self, qty, exchange=False):
        create = self.client.post(f'/api/purchases/{self.purchase.id}/create-retur/', {}, format='json')
        self.assertEqual(create.status_code, status.HTTP_201_CREATED, create.content)
        retur_id = create.data['id']
        item = self.client.post(
            f'/api/purchases/{retur_id}/add-item/',
            {'product': self.product.id, 'qty': qty, 'harga_beli': 1000}, format='json',
        )
        self.assertEqual(item.status_code, status.HTTP_201_CREATED, item.content)
        post = self.client.post(f'/api/purchases/{retur_id}/post-retur/', {'exchange_new': exchange}, format='json')
        self.assertEqual(post.status_code, status.HTTP_200_OK, post.content)
        return retur_id, post.data

    def _baris_out(self, retur_id):
        retur = Purchase.objects.get(pk=retur_id)
        from .product_models import StockOutDocument
        doc = StockOutDocument.objects.get(purchase=retur)
        jurnal = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_OUT, source_id=doc.id)
        return {(l.account.code, l.debit, l.kredit) for l in jurnal.lines.all()}

    def test_retur_penuh_membalik_seluruh_ppn_masukan(self):
        retur_id, data = self._retur(100)
        self.assertEqual(self._baris_out(retur_id), {
            ('21000', Decimal('99900'), Decimal('0')),  # hutang: barang netto + PPN
            ('11400', Decimal('0'), Decimal('90000')),  # persediaan biaya bersih FIFO
            ('11750', Decimal('0'), Decimal('9900')),   # PPN Masukan dibalik
        })
        self.assertEqual(Decimal(str(data['total'])), Decimal('99900'))
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 0)

    def test_dua_retur_parsial_total_ppn_yang_dibalik_tepat_sama_dengan_ppn_asal(self):
        r1, d1 = self._retur(30)
        self.assertEqual(self._baris_out(r1), {
            ('21000', Decimal('29970'), Decimal('0')),
            ('11400', Decimal('0'), Decimal('27000')),
            ('11750', Decimal('0'), Decimal('2970')),
        })
        self.assertEqual(Decimal(str(d1['total'])), Decimal('29970'))

        r2, _ = self._retur(70)
        self.assertEqual(self._baris_out(r2), {
            ('21000', Decimal('69930'), Decimal('0')),
            ('11400', Decimal('0'), Decimal('63000')),
            ('11750', Decimal('0'), Decimal('6930')),
        })

    def test_retur_tukar_barang_tidak_membalik_ppn_dan_persediaan_netral(self):
        retur_id, data = self._retur(30, exchange=True)
        baris = self._baris_out(retur_id)
        self.assertNotIn('11750', {b[0] for b in baris})
        self.assertEqual(baris, {
            ('21000', Decimal('27000'), Decimal('0')),
            ('11400', Decimal('0'), Decimal('27000')),
        })
        # Barang pengganti masuk dengan biaya bersih yang sama: tidak ada baris PPN sama sekali.
        semua_ppn = JournalEntry.objects.filter(lines__account__code='11750').exclude(
            source_type=JournalEntry.SourceType.STOCK_IN, source_id=StockInDocument.objects.get(purchase=self.purchase).id,
        )
        self.assertFalse(semua_ppn.exists())
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 100)
        self.assertEqual(Decimal(str(data['total'])), Decimal('30000'))
