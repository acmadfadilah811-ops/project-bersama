"""Kontrak API untuk seluruh Laporan Pembelian."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.customer_models import Supplier
from api.product_models import Product, Purchase, PurchaseItem, PurchasePayment


User = get_user_model()


class PurchaseReportTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_purchase_report', password='secret', role='owner')
        self.supplier = Supplier.objects.create(nama='PT Kertas', email='supplier@test.local')
        self.product = Product.objects.create(
            nama='Kertas Art Carton', sku='KAC-01', harga_beli=Decimal('10000'),
            qty_stok=Decimal('2'), stok_minimum=Decimal('5'),
        )
        self.purchase = Purchase.objects.create(
            nomor='PB-REPORT-001', tanggal=date(2026, 8, 1), supplier='PT Kertas',
            supplier_ref=self.supplier, status='selesai', receive_status='diterima',
            tanggal_diterima=date(2026, 8, 1), no_terima='TRM-001', dibuat_oleh=self.owner,
        )
        PurchaseItem.objects.create(
            purchase=self.purchase, product=self.product, qty=Decimal('3'), harga_beli=Decimal('10000'),
        )
        PurchasePayment.objects.create(
            purchase=self.purchase, tanggal=date(2026, 8, 1), nominal=Decimal('30000'), metode='Transfer',
        )
        self.purchase.recompute_payment_status()

        self.unpaid = Purchase.objects.create(
            nomor='PB-REPORT-002', tanggal=date(2026, 8, 1), supplier='PT Kertas',
            supplier_ref=self.supplier, status='draft', receive_status='tunda', dibuat_oleh=self.owner,
        )
        PurchaseItem.objects.create(
            purchase=self.unpaid, product=self.product, qty=Decimal('1'), harga_beli=Decimal('10000'),
        )
        self.return_purchase = Purchase.objects.create(
            nomor='RT-REPORT-001', tanggal=date(2026, 8, 1), supplier='PT Kertas',
            supplier_ref=self.supplier, is_retur=True, retur_ref=self.purchase, status='selesai', dibuat_oleh=self.owner,
        )
        PurchaseItem.objects.create(
            purchase=self.return_purchase, product=self.product, qty=Decimal('1'), harga_beli=Decimal('10000'),
        )
        self.client.force_authenticate(self.owner)

    def test_semua_laporan_pembelian_mengembalikan_data_nyata(self):
        report_ids = [
            'rincian-pembelian', 'pembelian-tanggal', 'item-pembelian-tanggal',
            'pembelian-supplier', 'pembelian-pembeli', 'retur-pembelian-tanggal',
            'retur-pembelian-supplier', 'pembayaran-belum-lunas',
            'pembayaran-pembelian', 'rekomendasi-pembelian',
        ]
        for report_id in report_ids:
            with self.subTest(report_id=report_id):
                response = self.client.get(f'/api/reports/purchases/{report_id}/')
                self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                self.assertTrue(response.data['columns'])
                self.assertTrue(response.data['rows'])

        detail = self.client.get('/api/reports/purchases/rincian-pembelian/').data
        paid_row = next(row for row in detail['rows'] if row['no_pembelian'] == 'PB-REPORT-001')
        self.assertEqual(Decimal(paid_row['subtotal']), Decimal('30000'))

        outstanding = self.client.get('/api/reports/purchases/pembayaran-belum-lunas/').data
        self.assertEqual(outstanding['rows'][0]['no_pembelian'], 'PB-REPORT-002')
        self.assertEqual(Decimal(outstanding['rows'][0]['sisa']), Decimal('10000'))

    def test_laporan_memerlukan_login(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/reports/purchases/rincian-pembelian/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_id_laporan_tidak_dikenal_ditolak(self):
        response = self.client.get('/api/reports/purchases/tidak-ada/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
