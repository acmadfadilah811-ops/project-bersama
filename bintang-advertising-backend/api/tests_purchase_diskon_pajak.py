"""Diskon & PPN dokumen Pembelian: disimpan di server, ikut total/pembayaran,
dan dijurnal (Persediaan netto, PPN Masukan, Hutang = total) -- 2026-09-24.
Ongkir sengaja belum didukung."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry

from .product_models import Product, Purchase, PurchaseItem, StockInDocument


class PembelianDiskonPajakTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner-pb-dp', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(nama='Kertas Diskon', lacak_inventori=True, qty_stok=0)

        asset, _ = AccountClassification.objects.get_or_create(name='Kas & Bank', defaults={'account_type': 'asset'})
        liability, _ = AccountClassification.objects.get_or_create(name='Hutang Test', defaults={'account_type': 'liability'})
        self.cash = Account.objects.create(code='11101', name='Kas Test', account_type='asset', classification=asset)
        payable = Account.objects.create(code='21000', name='Hutang Dagang Test', account_type='liability', classification=liability)
        advance = Account.objects.create(code='11710', name='Uang Muka Pembelian', account_type='asset', classification=asset)
        inventory = Account.objects.create(code='11400', name='Persediaan Test', account_type='asset', classification=asset)
        self.ppn = Account.objects.create(code='11750', name='PPN Masukan', account_type='asset', classification=asset)
        settings, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        settings.purchase_inventory_account = inventory
        settings.purchase_payable_account = payable
        settings.purchase_advance_account = advance
        settings.save(update_fields=['purchase_inventory_account', 'purchase_payable_account', 'purchase_advance_account'])

        self.purchase = Purchase.objects.create(nomor='PB-DP-1', tanggal=date(2026, 9, 24), dibuat_oleh=self.owner)
        # subtotal 100 x 1000 = 100.000
        PurchaseItem.objects.create(purchase=self.purchase, product=self.product, qty=Decimal('100'), harga_beli=Decimal('1000'))

    def _patch(self, **data):
        return self.client.patch(f'/api/purchases/{self.purchase.id}/', data, format='json')

    def _terima_dan_posting(self):
        res = self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-09-24', 'lanjut_tambah_stok': True}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        doc = StockInDocument.objects.get(purchase=self.purchase)
        post = self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')
        self.assertEqual(post.status_code, status.HTTP_200_OK, post.content)
        return doc

    def test_total_menghitung_diskon_persen_lalu_ppn_dari_dasar_setelah_diskon(self):
        res = self._patch(diskon_tipe='persen', diskon_nilai='10', pajak_tipe='persen', pajak_nilai='11')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        # 100.000 - 10% = 90.000; PPN 11% x 90.000 = 9.900; total 99.900
        self.assertEqual(Decimal(str(res.data['diskon_amount'])), Decimal('10000'))
        self.assertEqual(Decimal(str(res.data['pajak_amount'])), Decimal('9900'))
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('99900'))

    def test_diskon_nominal_dibatasi_maksimal_subtotal(self):
        res = self._patch(diskon_tipe='nominal', diskon_nilai='999999')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.assertEqual(Decimal(str(res.data['diskon_amount'])), Decimal('100000'))
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('0'))

    def test_nilai_tidak_valid_ditolak(self):
        self.assertEqual(self._patch(diskon_tipe='persen', diskon_nilai='101').status_code, 400)
        self.assertEqual(self._patch(pajak_tipe='nominal', pajak_nilai='-5').status_code, 400)

    def test_pembayaran_mengikuti_total_baru_dan_lunas_di_total_akhir(self):
        self._patch(diskon_tipe='persen', diskon_nilai='10', pajak_tipe='persen', pajak_nilai='11')  # total 99.900
        bayar = self.client.post(f'/api/purchases/{self.purchase.id}/add-payment/', {
            'tanggal': '2026-09-24', 'nominal': '99900', 'payment_account_id': self.cash.id,
        }, format='json')
        self.assertEqual(bayar.status_code, status.HTTP_201_CREATED, bayar.content)
        self.assertEqual(bayar.data['payment_status'], 'lunas')

    def test_ubah_potongan_ditolak_bila_total_baru_lebih_kecil_dari_yang_dibayar(self):
        self.client.post(f'/api/purchases/{self.purchase.id}/add-payment/', {
            'tanggal': '2026-09-24', 'nominal': '90000', 'payment_account_id': self.cash.id,
        }, format='json')
        res = self._patch(diskon_tipe='persen', diskon_nilai='50')  # total baru 50.000 < 90.000
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ubah_potongan_ditolak_setelah_barang_diterima(self):
        self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-09-24', 'lanjut_tambah_stok': True}, format='json',
        )
        res = self._patch(diskon_tipe='persen', diskon_nilai='5')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_jurnal_stok_masuk_persediaan_netto_ppn_masukan_dan_hutang_sama_dengan_total(self):
        self._patch(diskon_tipe='persen', diskon_nilai='10', pajak_tipe='persen', pajak_nilai='11')
        doc = self._terima_dan_posting()

        jurnal = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_IN, source_id=doc.id)
        baris = {(l.account.code, l.debit, l.kredit) for l in jurnal.lines.all()}
        self.assertEqual(baris, {
            ('11400', Decimal('90000'), Decimal('0')),   # Persediaan netto
            ('11750', Decimal('9900'), Decimal('0')),    # PPN Masukan
            ('21000', Decimal('0'), Decimal('99900')),   # Hutang = total
        })
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 100)
        self.assertEqual(self.product.harga_beli, Decimal('900.00'))  # biaya bersih per unit

    def test_tanpa_diskon_dan_ppn_jurnal_tetap_seperti_sebelumnya(self):
        doc = self._terima_dan_posting()
        jurnal = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_IN, source_id=doc.id)
        baris = {(l.account.code, l.debit, l.kredit) for l in jurnal.lines.all()}
        self.assertEqual(baris, {
            ('11400', Decimal('100000'), Decimal('0')),
            ('21000', Decimal('0'), Decimal('100000')),
        })

    def test_pembulatan_biaya_per_unit_diserap_ke_persediaan_supaya_hutang_pas(self):
        # 7 unit x 1.000 = 7.000, diskon nominal 2.333 -> netto 4.667 (biaya/unit
        # 666,71 dibulatkan 2 desimal -> total unit 4.666,97; selisih diserap).
        PurchaseItem.objects.all().delete()
        PurchaseItem.objects.create(purchase=self.purchase, product=self.product, qty=Decimal('7'), harga_beli=Decimal('1000'))
        self._patch(diskon_tipe='nominal', diskon_nilai='2333', pajak_tipe='persen', pajak_nilai='11')
        # netto 4.667; PPN 11% = 513 (513,37); total 5.180
        doc = self._terima_dan_posting()
        jurnal = JournalEntry.objects.get(source_type=JournalEntry.SourceType.STOCK_IN, source_id=doc.id)
        hutang = sum(l.kredit for l in jurnal.lines.filter(account__code='21000'))
        self.purchase.refresh_from_db()
        self.assertEqual(hutang, Decimal('5180'))
        self.assertEqual(hutang, self.purchase.total)
        self.assertEqual(sum(l.debit for l in jurnal.lines.all()), sum(l.kredit for l in jurnal.lines.all()))
