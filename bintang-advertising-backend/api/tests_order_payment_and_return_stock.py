from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Order, OrderItem, PengembalianOrder, OrderPayment, SaldoKasHarian
from api.product_models import Product, ProductStockMovement
from api.services.shift_summary import calculate_shift_cash_summary


User = get_user_model()


class OrderPaymentAndReturnStockTests(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(
            username='kasir_payment_stock', password='secret', role='kasir',
        )
        self.client.force_authenticate(self.kasir)
        self.order = Order.objects.create(
            id='ORD-PAYMENT-STOCK-1', nomor_wa='08123456789', nama='Pelanggan',
            status_global='selesai', total_harga=100000, dp_dibayar=25000,
            sisa_tagihan=75000, metode_pembayaran='tunai',
        )

    def test_cash_order_payment_is_counted_in_active_shift(self):
        shift = SaldoKasHarian.objects.create(
            kasir=self.kasir, shift='Pagi', kas_awal=Decimal('10000'),
        )
        OrderPayment.objects.create(
            order=self.order, shift=shift, jumlah=25000,
            metode_pembayaran='Tunai', is_dp=True, dibuat_oleh=self.kasir,
        )

        summary = calculate_shift_cash_summary(shift)
        self.assertEqual(summary['penjualan_tunai'], Decimal('25000'))
        self.assertEqual(summary['expected'], Decimal('35000'))

    def test_confirmed_return_restores_stock_once_and_unconfirm_reverses_it(self):
        product = Product.objects.create(
            nama='Produk Retur', sku='SKU-RETUR-ORDER-1', qty_stok=Decimal('5'),
            lacak_inventori=True,
        )
        OrderItem.objects.create(
            order=self.order, product=product, jenis_produk=product.nama,
            qty=2, harga_jual=50000,
        )
        retur = PengembalianOrder.objects.create(
            order=self.order, status='Tunda', nominal_refund=100000,
            dibuat_oleh=self.kasir,
        )

        confirmed = self.client.patch(
            f'/api/pengembalian/{retur.id}/', {'status': 'Dikonfirmasi'}, format='json',
        )
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)
        product.refresh_from_db()
        retur.refresh_from_db()
        self.assertEqual(product.qty_stok, Decimal('7'))
        self.assertIsNotNone(retur.stok_dikembalikan_pada)
        self.assertEqual(
            ProductStockMovement.objects.filter(product=product, tipe='pengembalian').count(), 1,
        )

        unconfirmed = self.client.patch(
            f'/api/pengembalian/{retur.id}/', {'status': 'Tunda'}, format='json',
        )
        self.assertEqual(unconfirmed.status_code, status.HTTP_200_OK, unconfirmed.data)
        product.refresh_from_db()
        retur.refresh_from_db()
        self.assertEqual(product.qty_stok, Decimal('5'))
        self.assertIsNone(retur.stok_dikembalikan_pada)
        self.assertEqual(
            ProductStockMovement.objects.filter(product=product, tipe='penjualan').count(), 1,
        )
