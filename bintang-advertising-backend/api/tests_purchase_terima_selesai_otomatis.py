"""Alur Pembelian: terima barang saat baru dibayar sebagian, dropdown "Diterima"
tidak lagi memblokir tombol Terima, dan pembelian lunas + diterima otomatis
pindah ke Telah Diproses (2026-09-24, laporan user)."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings

from .product_models import Product, Purchase, PurchaseItem, StockInDocument


class PembelianTerimaSelesaiOtomatisTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='owner-pb-auto', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(nama='Mendoan Beli', lacak_inventori=True, qty_stok=0)

        asset, _ = AccountClassification.objects.get_or_create(name='Kas & Bank', defaults={'account_type': 'asset'})
        liability, _ = AccountClassification.objects.get_or_create(name='Hutang Test', defaults={'account_type': 'liability'})
        self.cash = Account.objects.create(code='11101', name='Kas Test', account_type='asset', classification=asset)
        payable = Account.objects.create(code='21000', name='Hutang Dagang Test', account_type='liability', classification=liability)
        advance = Account.objects.create(code='11710', name='Uang Muka Pembelian', account_type='asset', classification=asset)
        inventory = Account.objects.create(code='11400', name='Persediaan Test', account_type='asset', classification=asset)
        settings, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        settings.purchase_inventory_account = inventory
        settings.purchase_payable_account = payable
        settings.purchase_advance_account = advance
        settings.save(update_fields=['purchase_inventory_account', 'purchase_payable_account', 'purchase_advance_account'])

        self.purchase = Purchase.objects.create(nomor='PB-AUTO-1', tanggal=date(2026, 9, 24), dibuat_oleh=self.owner)
        PurchaseItem.objects.create(purchase=self.purchase, product=self.product, qty=Decimal('4'), harga_beli=Decimal('1000'))

    def _bayar(self, nominal):
        res = self.client.post(f'/api/purchases/{self.purchase.id}/add-payment/', {
            'tanggal': '2026-09-24', 'nominal': str(nominal), 'payment_account_id': self.cash.id,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

    def _terima(self, **extra):
        return self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-09-24', 'lanjut_tambah_stok': True, **extra}, format='json',
        )

    def _posting_stok_masuk(self):
        doc = StockInDocument.objects.get(purchase=self.purchase)
        res = self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        return doc

    def test_baru_bayar_setengah_tetap_bisa_terima_dan_masuk_stok_masuk(self):
        self._bayar(2000)  # total 4000, baru setengah
        res = self._terima()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        self._posting_stok_masuk()

        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 4)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.payment_status, 'sebagian')
        self.assertEqual(self.purchase.status, 'draft')  # belum lunas -> belum Telah Diproses

        self._bayar(2000)  # pelunasan
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.payment_status, 'lunas')
        self.assertEqual(self.purchase.status, 'selesai')

    def test_lunas_dulu_lalu_stok_masuk_diposting_otomatis_selesai(self):
        self._bayar(4000)
        self.assertEqual(self._terima().status_code, status.HTTP_201_CREATED)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, 'draft')  # Stok Masuk masih draft
        self._posting_stok_masuk()
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, 'selesai')

    def test_lunas_dan_diterima_tanpa_stok_masuk_langsung_selesai(self):
        self._bayar(4000)
        res = self._terima(lanjut_tambah_stok=False)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, 'selesai')

    def test_dropdown_diterima_membuat_stok_masuk_dan_terima_tidak_ditolak(self):
        self._bayar(2000)
        res = self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Diterima'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        doc = StockInDocument.objects.get(purchase=self.purchase)
        self.assertEqual(doc.status, 'draft')

        # Klik Terima lagi (kasus laporan user) -> kembali ke Stok Masuk yang sama.
        lagi = self._terima()
        self.assertEqual(lagi.status_code, status.HTTP_200_OK, lagi.content)
        self.assertEqual(lagi.data['stock_document']['id'], doc.id)
        self.assertEqual(StockInDocument.objects.filter(purchase=self.purchase).count(), 1)

    def test_pembelian_sudah_diterima_tanpa_stok_masuk_diperbaiki_lewat_terima(self):
        # Keadaan rusak dari data lama: diterima tapi tidak ada dokumen Stok Masuk.
        Purchase.objects.filter(pk=self.purchase.pk).update(receive_status='diterima')
        res = self._terima()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        self.assertEqual(StockInDocument.objects.filter(purchase=self.purchase).count(), 1)

    def test_terima_setelah_stok_diposting_ditolak_dengan_pesan_jelas(self):
        self._terima()
        self._posting_stok_masuk()
        res = self._terima()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sudah diposting', res.data['error'])

    def test_selesai_tanpa_stok_masuk_ditolak_supaya_stok_tidak_terlewat(self):
        Purchase.objects.filter(pk=self.purchase.pk).update(receive_status='diterima')
        res = self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Selesai'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, 'draft')

    def test_tidak_bisa_mundur_ke_tunda_setelah_ada_stok_masuk(self):
        self._terima()
        res = self.client.post(
            f'/api/purchases/{self.purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Tunda'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.receive_status, 'diterima')

    def test_penanda_lunas_administratif_juga_memicu_selesai_otomatis(self):
        self._terima(lanjut_tambah_stok=False)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.status, 'draft')
        res = self.client.post(f'/api/purchases/{self.purchase.id}/workflow/toggle-payment/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        self.assertEqual(res.data['status'], 'selesai')
