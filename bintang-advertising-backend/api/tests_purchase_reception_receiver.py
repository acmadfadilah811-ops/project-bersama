from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry

from .product_models import Product, Purchase, PurchaseItem, StockInDocument, StockInDocumentItem


class PurchaseReceptionReceiverTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username='owner-purchase', password='secret', role='owner')
        self.receiver = user_model.objects.create_user(
            username='gudang-utama', password='secret', role='staff', first_name='Gudang', last_name='Utama',
        )
        self.product = Product.objects.create(nama='Produk Penerimaan')
        self.client.force_authenticate(self.owner)

    def _purchase(self, nomor):
        purchase = Purchase.objects.create(nomor=nomor, tanggal=date(2026, 7, 29), dibuat_oleh=self.owner)
        PurchaseItem.objects.create(purchase=purchase, product=self.product, qty=Decimal('2'), harga_beli=Decimal('10000'))
        return purchase

    def _configure_purchase_accounts(self, inventory, payable, advance):
        settings, _ = AccountingSettings.objects.get_or_create(
            defaults={'accounting_start_date': date(2026, 7, 1)},
        )
        settings.purchase_inventory_account = inventory
        settings.purchase_payable_account = payable
        settings.purchase_advance_account = advance
        settings.save(update_fields=[
            'purchase_inventory_account', 'purchase_payable_account', 'purchase_advance_account',
        ])

    def test_owner_can_create_purchase_from_add_menu_payload(self):
        response = self.client.post(
            '/api/purchases/',
            {'supplier': 'Supplier Test', 'tanggal': '2026-07-29', 'mata_uang': 'IDR', 'catatan': 'Dibuat dari menu Tambah'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['supplier'], 'Supplier Test')
        self.assertTrue(response.data['nomor'].startswith('PB'))

    def test_selected_receiver_is_saved_without_stock_document(self):
        purchase = self._purchase('PO-RECEIVER-OFF')
        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-07-29', 'no_terima': 'TRM-OFF', 'penerima_id': self.receiver.id, 'lanjut_tambah_stok': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        purchase.refresh_from_db()
        self.assertEqual(purchase.penerima_nama, 'Gudang Utama')
        self.assertEqual(purchase.receive_status, 'diterima')
        self.assertFalse(StockInDocument.objects.filter(purchase=purchase).exists())

    def test_selected_receiver_is_copied_to_stock_in_document(self):
        purchase = self._purchase('PO-RECEIVER-ON')
        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-07-29', 'no_terima': 'TRM-ON', 'penerima_id': self.receiver.id, 'lanjut_tambah_stok': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        purchase.refresh_from_db()
        stock_document = StockInDocument.objects.get(purchase=purchase)
        self.assertEqual(purchase.penerima_nama, 'Gudang Utama')
        self.assertEqual(stock_document.nama_penerima, 'Gudang Utama')

    def test_post_stock_in_uses_standard_inventory_and_payable_coa(self):
        self._seed_coa()
        document = StockInDocument.objects.create(nomor='IN-COA-TEST', tanggal=date(2026, 7, 29), dibuat_oleh=self.owner)
        StockInDocumentItem.objects.create(document=document, product=self.product, qty=Decimal('2'), harga_beli=Decimal('10000'))

        response = self.client.post(f'/api/stock-in-documents/{document.id}/post-document/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.STOCK_IN,
            source_id=document.id,
        ).count(), 1)

    def test_remove_payment_recalculates_purchase_paid_total(self):
        asset, _ = AccountClassification.objects.get_or_create(name='Kas & Bank', defaults={'account_type': 'asset'})
        liability, _ = AccountClassification.objects.get_or_create(name='Hutang Test', defaults={'account_type': 'liability'})
        cash = Account.objects.create(code='11101', name='Kas Test', account_type='asset', classification=asset)
        payable = Account.objects.create(code='21000', name='Hutang Dagang Test', account_type='liability', classification=liability)
        advance = Account.objects.create(code='11710', name='Uang Muka Pembelian', account_type='asset', classification=asset)
        self._configure_purchase_accounts(cash, payable, advance)
        purchase = self._purchase('PO-HAPUS-BAYAR')
        added = self.client.post(
            f'/api/purchases/{purchase.id}/add-payment/',
            {'tanggal': '2026-07-29', 'nominal': '10000', 'payment_account_id': cash.id},
            format='json',
        )

        self.assertEqual(added.status_code, status.HTTP_201_CREATED)
        payment_id = added.data['payments'][0]['id']
        removed = self.client.post(
            f'/api/purchases/{purchase.id}/remove-payment/',
            {'payment_id': payment_id},
            format='json',
        )

        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertEqual(removed.data['total_dibayar'], 0)
        self.assertEqual(removed.data['payment_status'], 'belum')

    def test_toggle_payment_only_updates_administrative_marker(self):
        purchase = self._purchase('PO-PENANDA-BAYAR')

        enabled = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/toggle-payment/', {}, format='json',
        )

        self.assertEqual(enabled.status_code, status.HTTP_200_OK, enabled.data)
        self.assertTrue(enabled.data['payment_marked_paid'])
        purchase.refresh_from_db()
        self.assertTrue(purchase.payment_marked_paid)
        self.assertEqual(purchase.payment_status, 'belum')
        self.assertEqual(purchase.total_dibayar, Decimal('0'))
        self.assertFalse(purchase.payments.exists())
        self.assertFalse(JournalEntry.objects.exists())

        disabled = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/toggle-payment/', {}, format='json',
        )

        self.assertEqual(disabled.status_code, status.HTTP_200_OK, disabled.data)
        purchase.refresh_from_db()
        self.assertFalse(purchase.payment_marked_paid)
        self.assertEqual(purchase.payment_status, 'belum')
        self.assertEqual(purchase.total_dibayar, Decimal('0'))

    def _seed_coa(self):
        asset, _ = AccountClassification.objects.get_or_create(name='Persediaan Test', defaults={'account_type': 'asset'})
        liability, _ = AccountClassification.objects.get_or_create(name='Hutang Test', defaults={'account_type': 'liability'})
        inventory, _ = Account.objects.get_or_create(code='11400', defaults={'name': 'Persediaan Test', 'account_type': 'asset', 'classification': asset})
        payable, _ = Account.objects.get_or_create(code='21000', defaults={'name': 'Hutang Dagang Test', 'account_type': 'liability', 'classification': liability})
        advance, _ = Account.objects.get_or_create(code='11710', defaults={'name': 'Uang Muka Pembelian', 'account_type': 'asset', 'classification': asset})
        self._configure_purchase_accounts(inventory, payable, advance)

    def test_update_status_selesai_posts_stock_and_journal(self):
        """Bug: dropdown status 'Selesai' dulu hanya mengubah field status tanpa
        pernah memposting stok/jurnal. Sekarang harus benar-benar memposting
        StockInDocument draft yang dibuat saat 'Diterima'."""
        self._seed_coa()
        purchase = self._purchase('PO-SELESAI-POST')
        self.client.post(
            f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-07-29', 'no_terima': 'TRM-SELESAI', 'lanjut_tambah_stok': True},
            format='json',
        )
        self.product.refresh_from_db()
        stok_sebelum = self.product.qty_stok

        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Selesai'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'selesai')
        document = StockInDocument.objects.get(purchase=purchase)
        self.assertEqual(document.status, 'selesai')
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, stok_sebelum + Decimal('2'))
        self.assertEqual(JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.STOCK_IN, source_id=document.id,
        ).count(), 1)

    def test_update_status_selesai_is_idempotent(self):
        self._seed_coa()
        purchase = self._purchase('PO-SELESAI-DOBEL')
        self.client.post(
            f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-07-29', 'no_terima': 'TRM-DOBEL', 'lanjut_tambah_stok': True},
            format='json',
        )
        self.client.post(f'/api/purchases/{purchase.id}/workflow/update-status/', {'status_pembelian': 'Selesai'}, format='json')

        second = self.client.post(f'/api/purchases/{purchase.id}/workflow/update-status/', {'status_pembelian': 'Selesai'}, format='json')

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        document = StockInDocument.objects.get(purchase=purchase)
        self.assertEqual(JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.STOCK_IN, source_id=document.id,
        ).count(), 1)

    def test_update_status_selesai_without_stock_document_still_completes(self):
        """Bug: penerimaan dengan 'lanjut tambah stok' dimatikan sengaja tidak
        membuat StockInDocument (lihat siapkan_stok_masuk). Selesai tidak boleh
        menuntut dokumen yang memang tidak pernah dibuat."""
        purchase = self._purchase('PO-SELESAI-TANPA-STOK')
        self.client.post(
            f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-07-29', 'no_terima': 'TRM-NOSTOK', 'lanjut_tambah_stok': False},
            format='json',
        )
        self.assertFalse(StockInDocument.objects.filter(purchase=purchase).exists())

        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Selesai'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'selesai')

    def test_update_status_selesai_without_reception_is_rejected(self):
        purchase = self._purchase('PO-SELESAI-TANPA-TERIMA')
        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Selesai'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'draft')

    def test_update_status_delivery_stages_are_persisted(self):
        purchase = self._purchase('PO-STATUS-KIRIM')

        for selected_status, expected_delivery in [('Terkirim', 'terkirim'), ('Dikirim', 'dikirim')]:
            response = self.client.post(
                f'/api/purchases/{purchase.id}/workflow/update-status/',
                {'status_pembelian': selected_status},
                format='json',
            )

            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            self.assertEqual(response.data['delivery_status'], expected_delivery)
            purchase.refresh_from_db()
            self.assertEqual(purchase.delivery_status, expected_delivery)
            self.assertEqual(purchase.status, 'draft')
            self.assertEqual(purchase.receive_status, 'tunda')

    def test_update_status_batal_blocked_after_diterima(self):
        """Sudah diterima = stok/jurnal sudah berjalan; pembatalan wajib lewat
        retur (M7), bukan langsung lewat dropdown status ini."""
        self._seed_coa()
        purchase = self._purchase('PO-BATAL-DITOLAK')
        self.client.post(
            f'/api/purchases/{purchase.id}/workflow/siapkan-stok-masuk/',
            {'tanggal_diterima': '2026-07-29', 'no_terima': 'TRM-BATAL', 'lanjut_tambah_stok': True},
            format='json',
        )

        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Batal'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        purchase.refresh_from_db()
        self.assertNotEqual(purchase.status, 'batal')

    def test_update_status_batal_allowed_before_reception(self):
        purchase = self._purchase('PO-BATAL-DIIZINKAN')
        response = self.client.post(
            f'/api/purchases/{purchase.id}/workflow/update-status/',
            {'status_pembelian': 'Batal'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'batal')

    def test_owner_can_upload_purchase_attachment_and_detail_returns_it(self):
        purchase = self._purchase('PO-LAMPIRAN')
        response = self.client.post(
            f'/api/purchases/{purchase.id}/upload-attachment/',
            {'file': SimpleUploadedFile('bukti-pembelian.pdf', b'%PDF-1.4 bukti', content_type='application/pdf')},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['nama'].startswith('bukti-pembelian'))
        detail = self.client.get(f'/api/purchases/{purchase.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail.data['attachments']), 1)
        self.assertTrue(detail.data['attachments'][0]['nama'].startswith('bukti-pembelian'))
