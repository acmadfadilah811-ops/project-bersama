"""Total Omset di Dashboard Owner harus menghitung SEMUA kanal penjualan
(Order/pesanan WA-DP maupun POSSale/kasir langsung), dan tidak boleh
memasukkan order yang sudah dibatalkan sebagai omset."""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Order, OrderItem
from api.pos_models import POSSale

User = get_user_model()


class DashboardOmsetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(username='owner_dash', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.now = timezone.localtime(timezone.now())

    def _buat_order(self, order_id, harga_jual, status_global='proses'):
        order = Order.objects.create(
            id=order_id, nama='Pelanggan', nomor_wa='08123456789',
            total_harga=harga_jual, status_global=status_global, waktu=self.now,
        )
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=harga_jual)
        return order

    def test_omset_mencakup_possale_bukan_cuma_order(self):
        self._buat_order('ORD-DASH-1', 50000)
        POSSale.objects.create(
            nomor='POS-DASH-1', kasir=self.owner, status='paid',
            total=30000, dibayar=30000, metode_bayar='Cash', created_at=self.now,
        )

        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(int(response.data['omset_bulan_ini']), 80000)

    def test_omset_tidak_menghitung_order_batal(self):
        self._buat_order('ORD-DASH-2', 100000, status_global='batal')
        self._buat_order('ORD-DASH-3', 40000, status_global='proses')

        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(int(response.data['omset_bulan_ini']), 40000)

    def test_possale_yang_belum_paid_tidak_ikut_dihitung(self):
        POSSale.objects.create(
            nomor='POS-DASH-HOLD', kasir=self.owner, status='hold',
            total=99999, dibayar=0, metode_bayar='Cash', created_at=self.now,
        )
        POSSale.objects.create(
            nomor='POS-DASH-VOID', kasir=self.owner, status='void',
            total=88888, dibayar=88888, metode_bayar='Cash', created_at=self.now,
        )

        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(int(response.data['omset_bulan_ini']), 0)
