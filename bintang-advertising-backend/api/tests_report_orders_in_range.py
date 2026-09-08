"""Regresi audit Laporan 2026-09-08: _orders_in_range() (dipakai 23 laporan
termasuk Laba/Rugi) sebelumnya cuma mengecualikan status_global='batal' --
order 'draft'/'quotation'/'review' (belum dikonfirmasi manager) tetap
terhitung sebagai pendapatan penjualan. Dibuktikan lewat perbandingan
langsung ke production: Laporan > Laba/Rugi menunjukkan Rp658.000
pendapatan untuk periode yang di Akuntansi Internal (jurnal terposting
sungguhan) cuma Rp50.000 -- selisih 13x.

Keputusan user 2026-09-08: order dihitung HANYA kalau sudah ada pembayaran
(dp_dibayar > 0) ATAU SPK sudah diterbitkan (bukan sekadar status_global)."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Order, OrderActivityLog, OrderItem

User = get_user_model()


class OrdersInRangeAccrualGateTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_report_gate', password='x', role='owner')
        self.client.force_authenticate(self.owner)

    def _order(self, suffix, status_global, dp_dibayar=0):
        order = Order.objects.create(
            id=f'ORD-TEST-GATE-{suffix}', nomor_wa='6281200077766', nama='Pelanggan Gate Uji',
            status_global=status_global, dilayani_oleh=self.owner, dp_dibayar=dp_dibayar,
        )
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=100000)
        return order

    def _laba_rugi_pendapatan(self):
        resp = self.client.get('/api/reports/laba-rugi/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        row = next(r for r in resp.data['rows'] if r['keterangan'] == 'Pendapatan Penjualan')
        return row['jumlah']

    def test_review_tanpa_bayar_tanpa_spk_dikecualikan(self):
        """Persis kasus yang ditemukan di production: order 'review' tanpa
        pembayaran dan tanpa SPK tidak boleh dihitung sebagai pendapatan."""
        self._order('1', 'review', dp_dibayar=0)
        self.assertEqual(self._laba_rugi_pendapatan(), 0)

    def test_review_sudah_bayar_tetap_dihitung(self):
        """Order masih 'review' (belum di-ACC manager) tapi SUDAH ada DP --
        harus tetap terhitung, walau status belum berubah."""
        self._order('2', 'review', dp_dibayar=100000)
        self.assertEqual(self._laba_rugi_pendapatan(), 100000)

    def test_desain_dengan_spk_terbit_tanpa_bayar_tetap_dihitung(self):
        """SPK sudah diterbitkan (produksi jalan) walau belum ada pembayaran
        sama sekali -- harus tetap terhitung sebagai komitmen penjualan."""
        order = self._order('3', 'desain', dp_dibayar=0)
        OrderActivityLog.objects.create(
            order=order, user=self.owner, tindakan='TERBITKAN_SPK',
            keterangan='Menerbitkan SPK item ke divisi Desain', waktu=timezone.now(),
        )
        self.assertEqual(self._laba_rugi_pendapatan(), 100000)

    def test_draft_dikecualikan(self):
        self._order('4', 'draft', dp_dibayar=0)
        self.assertEqual(self._laba_rugi_pendapatan(), 0)

    def test_batal_tetap_dikecualikan_walau_ada_dp(self):
        """Order batal tidak boleh dihitung apa pun kondisinya (existing
        behavior, dipertahankan) -- DP yang sudah masuk direfund lewat jalur
        lain, bukan diakui sebagai pendapatan."""
        self._order('5', 'batal', dp_dibayar=100000)
        self.assertEqual(self._laba_rugi_pendapatan(), 0)

    def test_selesai_dengan_pembayaran_tetap_dihitung(self):
        self._order('6', 'selesai', dp_dibayar=100000)
        self.assertEqual(self._laba_rugi_pendapatan(), 100000)


class DuplicateOrdersHelperConsistencyTests(APITestCase):
    """Bug lanjutan ditemukan audit 2026-09-08: `_orders()` di
    sales_report_extensions.py dan `_outstanding_orders()` di
    payment_report_extensions.py ternyata punya query DUPLIKAT sendiri yang
    tidak ikut kena fix order_confirmed_q() -- keduanya sekarang delegasi ke
    fungsi/Q object yang sama. Order 'review' tanpa DP/SPK harus konsisten
    TIDAK MUNCUL di laporan mana pun yang menghitung "penjualan"/"piutang"."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_dup_gate', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.order = Order.objects.create(
            id='ORD-TEST-DUPGATE-1', nomor_wa='6281200055544', nama='Pelanggan Belum Konfirmasi',
            status_global='review', dilayani_oleh=self.owner, dp_dibayar=0,
            total_harga=200000, sisa_tagihan=200000,
        )
        OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1, harga_jual=200000)

    def test_penjualan_berdasarkan_tanggal_kecualikan_order_belum_konfirmasi(self):
        resp = self.client.get('/api/reports/penjualan-tanggal/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sum(r['jumlah'] for r in resp.data['rows']), 0)

    def test_piutang_tipe_pelanggan_kecualikan_order_belum_konfirmasi(self):
        resp = self.client.get('/api/reports/piutang-tipe-pelanggan/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sum(r['total_piutang'] for r in resp.data['rows']), 0)

    def test_penjualan_hutang_jatuh_tempo_kecualikan_order_belum_konfirmasi(self):
        self.order.jatuh_tempo = timezone.localdate()
        self.order.save(update_fields=['jatuh_tempo'])
        resp = self.client.get('/api/reports/penjualan-hutang-jatuh-tempo/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(any(r['no_pesanan'] == self.order.id for r in resp.data['rows']))

    def test_order_yang_sama_muncul_setelah_dp_masuk(self):
        """Begitu order dapat DP, harus konsisten muncul di KETIGA laporan."""
        self.order.dp_dibayar = 50000
        self.order.sisa_tagihan = 150000
        self.order.save(update_fields=['dp_dibayar', 'sisa_tagihan'])

        penjualan = self.client.get('/api/reports/penjualan-tanggal/').data
        self.assertEqual(sum(r['jumlah'] for r in penjualan['rows']), 200000)

        piutang = self.client.get('/api/reports/piutang-tipe-pelanggan/').data
        self.assertEqual(sum(r['total_piutang'] for r in piutang['rows']), 150000)
