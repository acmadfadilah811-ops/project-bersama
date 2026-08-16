"""Kontrak endpoint untuk laporan penjualan tambahan yang memakai data nyata."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.finance_models import CashTransaction, CashTransactionType
from api.models import Order, OrderActivityLog, OrderItem, PengembalianOrder
from api.pos_models import POSSale, POSSaleItem
from api.customer_models import Customer
from api.product_models import Collection, Product


User = get_user_model()


class SalesReportExtensionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sales_report_owner', password='secret', role='owner')
        self.collection = Collection.objects.create(nama='Koleksi Laporan')
        self.product = Product.objects.create(
            nama='Produk Laporan', harga_beli=Decimal('5000'), koleksi=self.collection,
        )
        self.customer = Customer.objects.create(
            nama='Member Deposit', kode_pelanggan='CUST-001', email='deposit@example.test', deposit=Decimal('25000'),
        )
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
        self.confirmed_return = PengembalianOrder.objects.create(
            order=self.order, status='Dikonfirmasi', nominal_refund=5000, dibuat_oleh=self.user,
        )
        expense_type = CashTransactionType.objects.create(nama='Operasional', tipe='pengeluaran')
        CashTransaction.objects.create(
            nomor='KEL-REPORT-001', arah='pengeluaran', jumlah=Decimal('3000'),
            tipe_transaksi=expense_type, staff=self.user, waktu=self.sale.created_at, status='selesai',
        )
        self.client.force_authenticate(self.user)

    def _create_cancelled_sources(self):
        cancelled_order = Order.objects.create(
            nomor_wa='0899999999', nama='Pelanggan Batal', status_global='batal',
            total_harga=15000, dilayani_oleh=self.user,
        )
        OrderItem.objects.create(
            order=cancelled_order, jenis_produk='Produk Batal', product=self.product, qty=1, harga_jual=15000,
        )
        OrderActivityLog.objects.create(
            order=cancelled_order, user=self.user, tindakan='CANCEL', keterangan='Pembatalan diuji',
        )
        paid_void = POSSale.objects.create(
            nomor='POS-VOID-PAID', kasir=self.user, subtotal=12000, total=12000,
            dibayar=12000, status='void', voided_at=timezone.now(), voided_by=self.user,
        )
        unpaid_void = POSSale.objects.create(
            nomor='POS-VOID-UNPAID', kasir=self.user, subtotal=9000, total=9000,
            dibayar=0, status='void', voided_at=timezone.now(), voided_by=self.user,
        )
        for sale in (paid_void, unpaid_void):
            POSSaleItem.objects.create(
                sale=sale, product=self.product, nama_snapshot='Produk Void',
                harga_snapshot=sale.total, qty=1, subtotal=sale.total,
            )
        return cancelled_order, paid_void, unpaid_void

    def test_laporan_penjualan_tambahan_tersedia_dan_berkolom(self):
        report_ids = [
            'loyalti-point', 'pending-pos', 'item-pending-pos', 'berdasarkan-jam',
            'penjualan-tanggal', 'penjualan-pelanggan', 'pengeluaran-tanggal',
            'penjualan-pendapatan-pengeluaran', 'penjualan-kredit',
            'pembatalan-penjualan', 'pos-batal-belum-bayar', 'rincian-pengembalian',
            'pengembalian-tanggal', 'pengembalian-pelanggan', 'item-dibatalkan',
            'item-koleksi', 'pelunasan-non-kredit', 'penjualan-penjual',
            'item-pelanggan', 'sisa-deposit',
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
            'item-penjualan-tanggal', 'item-brand', 'pelunasan-kredit', 'log-item-pos-batal',
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

    def test_laporan_pengembalian_hanya_memakai_retur_dikonfirmasi(self):
        self.order.email_pelanggan = 'laporan@example.test'
        self.order.save(update_fields=['email_pelanggan'])
        PengembalianOrder.objects.create(
            order=self.order, status='Tunda', nominal_refund=7000, dibuat_oleh=self.user,
        )
        PengembalianOrder.objects.create(
            order=self.order, status='Batal', nominal_refund=9000, dibuat_oleh=self.user,
        )

        detail = self.client.get('/api/reports/rincian-pengembalian/').data
        self.assertEqual(len(detail['rows']), 1)
        self.assertEqual(detail['rows'][0]['jumlah'], 5000.0)
        self.assertNotIn('modal_produk', detail['rows'][0])

        by_customer = self.client.get('/api/reports/pengembalian-pelanggan/').data
        self.assertEqual(by_customer['rows'][0]['email'], 'laporan@example.test')
        self.assertEqual(by_customer['rows'][0]['jumlah_pengembalian'], 5000.0)

    def test_laporan_pembatalan_memakai_waktu_pembatalan_dan_mencakup_pos(self):
        cancelled_order, paid_void, unpaid_void = self._create_cancelled_sources()
        query = '?start={0}&end={0}'.format(timezone.localdate().isoformat())

        details = self.client.get('/api/reports/pembatalan-penjualan/' + query).data['rows']
        self.assertEqual({row['no_pesanan'] for row in details}, {cancelled_order.id, paid_void.nomor, unpaid_void.nomor})
        self.assertTrue(all(row['tanggal_pembatalan'] for row in details))
        self.assertTrue(all(row['dibatalkan_oleh'] == self.user.username for row in details))

        overview = self.client.get('/api/reports/pesanan-dibatalkan/' + query).data['rows']
        self.assertEqual({row['sumber'] for row in overview}, {'Order', 'POS'})

        cancelled_items = self.client.get('/api/reports/item-dibatalkan/' + query).data['rows']
        self.assertEqual({row['sumber'] for row in cancelled_items}, {'Order', 'POS'})

        unpaid_rows = self.client.get('/api/reports/pos-batal-belum-bayar/' + query).data['rows']
        self.assertEqual([row['no_pesanan'] for row in unpaid_rows], [unpaid_void.nomor])

        pos_log = self.client.get('/api/reports/log-item-pos-batal/' + query).data['rows']
        self.assertEqual({row['no_pesanan'] for row in pos_log}, {paid_void.nomor, unpaid_void.nomor})

    def test_laporan_penjualan_baru_memakai_sumber_transaksi_asli(self):
        non_credit_order = Order.objects.create(
            nomor_wa='0888888888', nama='Pelanggan Tunai', status_global='selesai',
            total_harga=8000, dp_dibayar=8000, sisa_tagihan=0,
            metode_pembayaran='tunai', dilayani_oleh=self.user,
        )
        OrderItem.objects.create(
            order=non_credit_order, jenis_produk='Produk Laporan', product=self.product, qty=1, harga_jual=8000,
        )

        by_collection = self.client.get('/api/reports/item-koleksi/').data
        self.assertTrue(any(row['koleksi'] == self.collection.nama for row in by_collection['rows']))

        by_seller = self.client.get('/api/reports/penjualan-penjual/').data
        self.assertEqual(by_seller['rows'][0]['penjual'], self.user.username)

        by_customer = self.client.get('/api/reports/item-pelanggan/').data
        self.assertTrue(any(row['pelanggan'] == non_credit_order.nama for row in by_customer['rows']))

        non_credit = self.client.get('/api/reports/pelunasan-non-kredit/').data
        self.assertTrue(any(row['no_pesanan'] == non_credit_order.id for row in non_credit['rows']))

        deposit = self.client.get('/api/reports/sisa-deposit/?search=CUST-001').data
        self.assertEqual(deposit['rows'], [{
            'id_pelanggan': 'CUST-001', 'pelanggan': 'Member Deposit',
            'email': 'deposit@example.test', 'sisa_deposit': 25000.0,
        }])

    def test_diskon_kredit_dihitung_dari_subtotal_bukan_dari_total_setelah_diskon(self):
        """order.total_harga SUDAH bersih setelah diskon — 'diskon' di laporan
        Rincian Penjualan Kredit harus dihitung dari selisih subtotal item vs
        total_harga, bukan persen dikali total yang sudah terdiskon (itu
        meremehkan nominal diskon asli)."""
        order = Order.objects.create(
            nomor_wa='0877777777', nama='Pelanggan Kredit Diskon', status_global='selesai',
            total_harga=90000, diskon_persen=10, sisa_tagihan=90000,
            metode_pembayaran='kredit', dilayani_oleh=self.user,
        )
        OrderItem.objects.create(order=order, jenis_produk='Produk Kredit', product=self.product, qty=1, harga_jual=100000)

        row = next(r for r in self.client.get('/api/reports/penjualan-kredit/').data['rows'] if r['no_pesanan'] == order.id)
        self.assertEqual(row['diskon'], 10000.0)
        self.assertEqual(row['total_penjualan'], 90000.0)

    def test_penjualan_berdasarkan_tanggal_mencakup_order_belum_selesai(self):
        """_orders() harus konsisten dengan _orders_in_range() di
        report_views.py (laporan 'Rincian Penjualan' utama): SEMUA status
        kecuali batal, bukan cuma 'selesai' — supaya total di laporan turunan
        (Penjualan berdasarkan Tanggal/Penjual/dst) sinkron dengan laporan utama
        untuk periode yang sama."""
        before = self.client.get('/api/reports/penjualan-tanggal/').data
        total_sebelum = sum(row['jumlah'] for row in before['rows'])

        order_proses = Order.objects.create(
            nomor_wa='0866666666', nama='Pelanggan Masih Proses', status_global='proses',
            total_harga=45000, dilayani_oleh=self.user,
        )
        OrderItem.objects.create(order=order_proses, jenis_produk='Produk Proses', product=self.product, qty=1, harga_jual=45000)

        after = self.client.get('/api/reports/penjualan-tanggal/').data
        total_sesudah = sum(row['jumlah'] for row in after['rows'])
        self.assertAlmostEqual(total_sesudah - total_sebelum, 45000.0)
