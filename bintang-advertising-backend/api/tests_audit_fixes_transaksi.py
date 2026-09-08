"""Regresi audit menu Transaksi & Pembayaran 2026-09-08 (Penjualan +
Pendapatan/Pengeluaran). Lihat api/tests_purchase_retur_journal.py untuk
regresi sisi Pembelian."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.finance_models import CashTransaction, CashTransactionType
from api.models import Contact, Order, OrderItem, PengembalianOrder

User = get_user_model()


class OrderTanpaItemFakePhoneTests(APITestCase):
    """Bug: form 'Tambah' order (CreateOrderForm.jsx) sebelumnya diam-diam
    memakai nomor palsu '081234567890' kalau pelanggan tidak punya no. HP di
    data master, tanpa peringatan. Fix ada di frontend (butuh no. HP asli
    sebelum submit); di backend, pastikan validasi format nomor tetap
    menolak input kosong/tidak valid (garis pertahanan kedua)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_order_nowa', password='x', role='owner')
        self.client.force_authenticate(self.owner)

    def test_backend_menolak_nomor_wa_kosong(self):
        resp = self.client.post('/api/orders/', {
            'nomor_wa': '', 'nama': 'Pelanggan Tanpa HP', 'dilayani_oleh': self.owner.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class OrderContactTotalSpentTests(APITestCase):
    """Bug: contact.total_spent (dihitung ulang tiap ada pembayaran order)
    menjumlah SEMUA order pelanggan tanpa kecuali status -- termasuk draft
    (belum jadi pesanan riil) dan batal (dibatalkan). Fix: exclude keduanya."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_total_spent', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_total_spent', password='x', role='staff')
        self.client.force_authenticate(self.owner)
        self.contact = Contact.objects.create(nomor_wa='6281200011122', nama='Pelanggan Uji Spent')

    def _order(self, suffix, status_global, harga_jual):
        order = Order.objects.create(
            id=f'ORD-TEST-SPENT-{suffix}', nomor_wa=self.contact.nomor_wa, nama='Pelanggan Uji Spent',
            status_global=status_global, dilayani_oleh=self.staff, dp_dibayar=0,
        )
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=harga_jual)
        return order

    def test_total_spent_kecualikan_draft_dan_batal(self):
        selesai = self._order('1', 'selesai', 100000)
        self._order('2', 'draft', 500000)
        self._order('3', 'batal', 900000)

        # Trigger recompute lewat endpoint bayar() pada order 'selesai' yang
        # masih ada sisa tagihan (recompute hanya jalan di jalur ini).
        selesai.total_harga = 100000
        selesai.save(update_fields=['total_harga'])
        resp = self.client.post(f'/api/orders/{selesai.id}/bayar/', {
            'jumlah_bayar': 100000, 'metode_pembayaran': 'tunai',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.contact.refresh_from_db()
        self.assertEqual(self.contact.total_spent, 100000, 'Draft & batal tidak boleh ikut terhitung.')


class OrderReturNominalRefundTests(APITestCase):
    """Bug: nominal_refund SELALU total_harga penuh order, tidak peduli
    barang apa yang benar-benar diretur -- frontend tidak pernah mengirim
    nominal_refund, dan items_json/tambahan_json yang dikirim ReturnOrderDetail
    silently didrop DRF karena tidak dideklarasikan di serializer (juga ada
    DUA class PengembalianOrderSerializer, yang kedua menang & tidak punya
    field2 itu sama sekali). Fix: field ditambahkan + nominal_refund dihitung
    ulang proporsional dari items_json+tambahan_json."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_retur_nominal', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_retur_nominal', password='x', role='staff')
        self.client.force_authenticate(self.owner)
        self.order = Order.objects.create(
            id='ORD-TEST-RETUR-1', nomor_wa='6281200099988', nama='Pelanggan Retur Uji',
            status_global='selesai', dilayani_oleh=self.staff, total_harga=200000, dp_dibayar=200000,
        )
        self.item1 = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=2, harga_jual=150000)
        self.item2 = OrderItem.objects.create(order=self.order, jenis_produk='Stiker', qty=1, harga_jual=50000)

    def test_retur_tanpa_items_json_tetap_fallback_total_penuh(self):
        """Alur simple 'Tambah' (ReturnOrderForm.jsx) tidak kirim items_json
        -- tetap fallback ke total_harga penuh, backward compatible."""
        resp = self.client.post(f'/api/orders/{self.order.id}/retur/', {
            'catatan': 'Retur simple', 'tanggal_pengembalian': '2026-09-08',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        retur = PengembalianOrder.objects.get(order_id=self.order.id)
        self.assertEqual(retur.nominal_refund, 200000)

    def test_retur_dengan_items_json_dihitung_proporsional(self):
        """Retur cuma 1 dari 2 unit item1 (harga_jual Rp150.000 utk qty 2) ->
        refund = 150000 * (1/2) = 75000, item2 tidak diretur sama sekali."""
        import json
        items_json = json.dumps([
            {'order_item_id': self.item1.id, 'qty': 1, 'max_qty': 2, 'harga': 150000},
        ])
        resp = self.client.post(f'/api/orders/{self.order.id}/retur/', {
            'catatan': 'Retur sebagian', 'tanggal_pengembalian': '2026-09-08',
            'items_json': items_json,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        retur = PengembalianOrder.objects.get(order_id=self.order.id)
        self.assertEqual(retur.nominal_refund, 75000)

    def test_update_items_json_lewat_pengembalian_endpoint_recompute_refund(self):
        """Alur nyata ReturnOrderDetail.jsx: create dulu (tanpa item), lalu
        PATCH items_json belakangan -- nominal_refund harus ikut ter-update,
        bukan tetap nyangkut di nilai lama."""
        import json
        create_resp = self.client.post(f'/api/orders/{self.order.id}/retur/', {
            'tanggal_pengembalian': '2026-09-08',
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        retur_id = PengembalianOrder.objects.get(order_id=self.order.id).id
        self.assertEqual(PengembalianOrder.objects.get(id=retur_id).nominal_refund, 200000)

        items_json = json.dumps([
            {'order_item_id': self.item2.id, 'qty': 1, 'max_qty': 1, 'harga': 50000},
        ])
        patch_resp = self.client.patch(f'/api/pengembalian/{retur_id}/', {
            'items_json': items_json, 'tambahan_json': json.dumps({'deskripsi': '', 'jumlah': 0}),
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['nominal_refund'], 50000)
        self.assertEqual(patch_resp.data['items_json'], items_json)


class CashTransactionDestroyGuardTests(APITestCase):
    """Bug: transaksi Kas yang sudah 'Terposting' (status='selesai', ada
    jurnal akuntansi terkait) bisa dihapus langsung tanpa guard apa pun --
    jurnalnya nyangkut/orphan tanpa sumber datanya lagi. Fix: destroy()
    ditolak untuk status selain 'draft'."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_kas_destroy', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.tipe = CashTransactionType.objects.create(nama='Listrik Toko', tipe='pengeluaran')

    def _transaksi(self, tx_status):
        return CashTransaction.objects.create(
            nomor=f'KAS-TEST-{tx_status}', arah='pengeluaran', jumlah=Decimal('50000'),
            tipe_transaksi=self.tipe, status=tx_status, waktu='2026-09-08T10:00:00+07:00',
            dibuat_oleh=self.owner,
        )

    def test_hapus_draft_tetap_boleh(self):
        tx = self._transaksi('draft')
        resp = self.client.delete(f'/api/cash-transactions/{tx.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_hapus_selesai_ditolak(self):
        tx = self._transaksi('selesai')
        resp = self.client.delete(f'/api/cash-transactions/{tx.id}/')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(CashTransaction.objects.filter(id=tx.id).exists())

    def test_hapus_batal_ditolak(self):
        tx = self._transaksi('batal')
        resp = self.client.delete(f'/api/cash-transactions/{tx.id}/')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(CashTransaction.objects.filter(id=tx.id).exists())
