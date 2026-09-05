"""Regresi: OrderItemViewSet (create/update/destroy) tidak menjaga status
Order sama sekali — item pada pesanan yang sudah 'selesai' (lunas & ditutup)
atau 'batal' bisa diubah/dihapus/ditambah lewat API langsung. OrderItem.save()
menghitung ulang Order.total_harga/sisa_tagihan TANPA mengecek status apa pun,
jadi pesanan yang sudah lunas (sisa_tagihan=0) bisa mendadak "berutang" lagi
hanya dengan mengubah harga satu item — dibuktikan lewat test yang sengaja
gagal dulu sebelum diperbaiki.

Ditemukan & diperbaiki 2026-09-05, audit modul Transaksi & Pembayaran,
ditemukan saat verifikasi ulang atas pertanyaan user "apakah bagian
Penjualan sudah aman?".
"""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.models import Order, OrderItem

User = get_user_model()


class OrderItemLockedAfterCloseTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_item_lock', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)

    def _order_selesai_lunas(self, order_id='ORD-ITEM-LOCK-1'):
        order = Order.objects.create(
            id=order_id, nomor_wa='08123456789', nama='Pelanggan Item Lock',
            status_global='selesai', dp_dibayar=100000,
        )
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=100000)
        order.refresh_from_db()
        self.assertEqual(order.sisa_tagihan, 0)
        return order, item

    def test_update_item_pada_pesanan_selesai_ditolak(self):
        order, item = self._order_selesai_lunas()

        res = self.client.patch(f'/api/order-items/{item.id}/', {'harga_jual': 999999}, format='json')
        self.assertEqual(res.status_code, 400, res.content)

        order.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(order.total_harga, 100000)
        self.assertEqual(order.sisa_tagihan, 0)
        self.assertEqual(item.harga_jual, 100000)

    def test_delete_item_pada_pesanan_selesai_ditolak(self):
        order, item = self._order_selesai_lunas('ORD-ITEM-LOCK-2')

        res = self.client.delete(f'/api/order-items/{item.id}/')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertTrue(OrderItem.objects.filter(pk=item.id).exists())

    def test_tambah_item_pada_pesanan_selesai_ditolak(self):
        order, _item = self._order_selesai_lunas('ORD-ITEM-LOCK-3')

        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Item Baru', 'qty': 1, 'harga_jual': 50000,
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_update_item_pada_pesanan_batal_ditolak(self):
        order = Order.objects.create(id='ORD-ITEM-LOCK-4', nomor_wa='08123456789',
                                      nama='Pelanggan Item Lock', status_global='batal')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=100000)

        res = self.client.patch(f'/api/order-items/{item.id}/', {'harga_jual': 1}, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_update_item_pada_pesanan_aktif_tetap_boleh(self):
        """Pesanan yang belum selesai/batal (mis. 'review') harus tetap bisa
        diedit itemnya seperti biasa — jangan sampai guard ini kebablasan."""
        order = Order.objects.create(id='ORD-ITEM-LOCK-5', nomor_wa='08123456789',
                                      nama='Pelanggan Item Lock', status_global='review')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=100000)

        res = self.client.patch(f'/api/order-items/{item.id}/', {'harga_jual': 150000}, format='json')
        self.assertEqual(res.status_code, 200, res.content)

        order.refresh_from_db()
        self.assertEqual(order.total_harga, 150000)
