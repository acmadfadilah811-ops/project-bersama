"""Kontrak endpoint untuk laporan penjualan tambahan yang memakai data nyata."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.finance_models import CashTransaction, CashTransactionType
from api.models import Order, OrderItem, PengembalianOrder
from api.pos_models import POSSale, POSSaleItem
from api.product_models import Product


User = get_user_model()


class SalesReportExtensionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sales_report_owner', password='secret', role='owner')
        self.product = Product.objects.create(nama='Produk Laporan', harga_beli=Decimal('5000'))
        self.sale = POSSale.objects.create(
            nomor='POS-REPORT-001', kasir=self.user, subtotal=Decimal('12000'),
            total=Decimal('11000'), diskon=Decimal('1000'), poin_ditebus=10,
            diskon_loyalti=Decimal('1000'), status='paid',
        )
        POSSaleItem.objects.create(
            sale=self.sale, product=self.product, nama_snapshot='Produk Laporan',
            harga_snapshot=Decimal('12000'), qty=Decimal('1'), subtotal=Decimal('12000'),
        )
        self.order = Order.objects.create(
            nomor_wa='08123456789', nama='Pelanggan Laporan', status_global='selesai',
            total_harga=20000, sisa_tagihan=10000, metode_pembayaran='kredit',
            jatuh_tempo=date(2026, 8, 15), dilayani_oleh=self.user,
        )
        OrderItem.objects.create(order=self.order, jenis_produk='Produk Laporan', product=self.product, qty=1, harga_jual=20000)
        PengembalianOrder.objects.create(order=self.order, nominal_refund=5000, dibuat_oleh=self.user)
        expense_type = CashTransactionType.objects.create(nama='Operasional', tipe='pengeluaran')
        CashTransaction.objects.create(
            nomor='KEL-REPORT-001', arah='pengeluaran', jumlah=Decimal('3000'),
            tipe_transaksi=expense_type, staff=self.user, waktu=self.sale.created_at, status='selesai',
        )
        self.client.force_authenticate(self.user)

    def test_laporan_penjualan_tambahan_tersedia_dan_berkolom(self):
        report_ids = [
            'loyalti-point', 'pending-pos', 'item-pending-pos', 'berdasarkan-jam',
            'penjualan-tanggal', 'penjualan-pelanggan', 'pengeluaran-tanggal',
            'penjualan-pendapatan-pengeluaran', 'penjualan-kredit',
            'pembatalan-penjualan', 'pos-batal-belum-bayar', 'rincian-pengembalian',
            'pengembalian-tanggal', 'pengembalian-pelanggan', 'item-dibatalkan',
        ]
        for report_id in report_ids:
            with self.subTest(report_id=report_id):
                response = self.client.get(f'/api/reports/{report_id}/')
                self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                self.assertTrue(response.data['columns'])

        response = self.client.get('/api/reports/loyalti-point/')
        self.assertEqual(response.data['rows'][0]['no_pesanan'], 'POS-REPORT-001')
        self.assertEqual(response.data['rows'][0]['tebus_point'], 10)
        credit = self.client.get('/api/reports/penjualan-kredit/')
        self.assertEqual(credit.data['rows'][0]['no_pesanan'], self.order.id)

    def test_semua_sumber_laporan_produk_dan_penjualan_terdaftar(self):
        report_ids = [
            # Produk: seluruh laporan yang tidak ditandai unavailable di frontend.
            'sku', 'kategori', 'brand', 'koleksi', 'material', 'qty-terjual',
            'qty-stok-tanggal', 'qty-stok-syncron', 'tidak-laku', 'sisa-uom',
            'sisa-grup', 'produk-status', 'sisa-produk', 'stok-masuk', 'stok-keluar',
            'qty-keluar', 'usia-stok', 'peringatan-stok', 'tingkatan-harga',
            'pergerakan-stok', 'value-pergerakan', 'stok-kedaluwarsa', 'stok-fifo',
            'pergerakan-fifo', 'banding-fifo',
            # Penjualan: seluruh dataSource pada konfigurasi frontend.
            'ringkasan-diskon', 'ringkasan-loyalti', 'pesanan-dibatalkan', 'top-produk',
            'laba-rugi', 'ringkasan-metode', 'transaksi-tunai', 'rincian-penjualan',
            'item-penjualan-tanggal', 'item-brand', 'pelunasan-kredit',
            # Pembayaran: seluruh laporan yang aktif pada konfigurasi frontend.
            'pembayaran-sudah-lunas', 'pembayaran-belum-lunas',
            'penjualan-pembayaran-pelanggan', 'piutang-tipe-pelanggan',
            'penjualan-hutang-jatuh-tempo',
        ]
        for report_id in report_ids:
            with self.subTest(report_id=report_id):
                response = self.client.get(f'/api/reports/{report_id}/')
                self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                self.assertTrue(response.data['columns'])

        export = self.client.get('/api/reports/loyalti-point/export/?format=xlsx')
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertIn('spreadsheetml', export['Content-Type'])

        due_sales = self.client.get('/api/reports/penjualan-hutang-jatuh-tempo/').data
        self.assertEqual(due_sales['rows'][0]['no_pesanan'], self.order.id)
