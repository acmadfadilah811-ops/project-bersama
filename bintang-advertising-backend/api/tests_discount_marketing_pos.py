"""Regresi diskon Marketing pada kasir lunas/DP serta Ringkasan Diskon."""

import uuid

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.marketing_models import CouponUsage, DiscountCoupon
from api.models import Divisi, Order, OrderItem, TahapProses
from api.pos_models import POSSale
from api.pos_serializers import POSSaleSerializer
from api.product_models import Product
from api.report_views import rpt_ringkasan_diskon
from api.services.order_invoice_whatsapp import hitung_ringkasan_invoice_dp
from api.services.pos_receipt_whatsapp import hitung_total_diskon_resi, susun_resi


class DiscountMarketingPosTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username='owner_diskon_marketing', password='secret', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.divisi = Divisi.objects.create(nama='Produksi Diskon')
        self.tahap = TahapProses.objects.create(nama='Cetak Diskon', divisi=self.divisi, urutan=1)
        self.product = Product.objects.create(
            nama='Banner Diskon', harga_beli=10000, harga_jual_toko=50000, qty_stok=10,
        )
        self.coupon = DiscountCoupon.objects.create(
            kode='DP10', judul='Promo DP Sepuluh Persen', tanggal_aktif=timezone.localdate(),
            tanpa_kadaluarsa=True, show_pos=True, tipe_diskon='percent', jumlah_diskon=10,
            all_customers=True, all_products=True, is_active=True,
        )

    def _payload(self, **overrides):
        payload = {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan DP Kupon',
            'nomor_wa': '081234567890',
            'dilayani_oleh_id': self.owner.id,
            'metode_pembayaran': 'tunai',
            'jumlah_bayar': 10000,
            'jatuh_tempo': str(timezone.localdate()),
            'items': [{
                'product_id': self.product.id, 'qty': 1, 'harga_satuan': 50000,
                'nama': 'Banner Diskon', 'is_custom_priced': False,
            }],
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }
        payload.update(overrides)
        return payload

    def test_dp_coupon_divalidasi_server_dan_masuk_ringkasan_diskon(self):
        response = self.client.post('/api/orders/checkout-pos/', self._payload(
            metode_diskon='kupon', kupon_kode=self.coupon.kode,
        ), format='json')

        self.assertEqual(response.status_code, 201, response.content)
        order = Order.objects.get(pk=response.data['id'])
        self.assertEqual(order.kupon, self.coupon)
        self.assertEqual(order.total_harga, 45000)
        self.assertEqual(order.sisa_tagihan, 35000)
        self.assertEqual(response.data['diskon_total'], 5000)
        self.assertEqual(hitung_ringkasan_invoice_dp(order)['diskon_total'], 5000)
        self.assertTrue(CouponUsage.objects.filter(order=order, kupon=self.coupon, nilai_diskon=5000).exists())

        report = rpt_ringkasan_diskon({'start': None, 'end': None})
        row = next(row for row in report['rows'] if row['kode_diskon'] == self.coupon.kode)
        self.assertEqual(row['sumber'], 'Order')
        self.assertEqual(row['jumlah_diskon'], 5000)
        self.assertEqual(row['qty_pesanan'], 1)

    def test_diskon_manual_dp_ditolak(self):
        response = self.client.post('/api/orders/checkout-pos/', self._payload(diskon_persen=10), format='json')

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Diskon manual', response.data['error'])

    def test_diskon_manual_pos_lunas_ditolak(self):
        response = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.product.id, 'qty': 1, 'harga': 50000,
                'nama': 'Banner Diskon',
            }],
            'status': 'paid',
            'dibayar': 50000,
            'metode_bayar': 'CASH',
            'diskon_persen': 10,
        }, format='json')

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Diskon manual', response.data['error'])

    def test_ringkasan_diskon_memuat_diskon_penjualan_otomatis(self):
        POSSale.objects.create(
            nomor='POS-DISKON-OTOMATIS', status='paid', diskon_penjualan=2500,
        )
        order = Order.objects.create(
            nama='Order Diskon Otomatis', nomor_wa='081234567891', sumber='pos',
            metode_diskon='otomatis', diskon_otomatis=0,
        )
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=10000)
        order.diskon_otomatis = 1000
        order.save()

        report = rpt_ringkasan_diskon({'start': None, 'end': None})
        pos_row = next(row for row in report['rows'] if row['kode_diskon'] == 'AUTO--')
        order_row = next(row for row in report['rows'] if row['kode_diskon'] == 'AUTO-ORDER')
        self.assertEqual(pos_row['jumlah_diskon'], 2500)
        self.assertEqual(order_row['jumlah_diskon'], 1000)

    def test_resi_pos_memakai_total_diskon_kupon_dan_otomatis(self):
        sale = POSSale.objects.create(
            nomor='POS-RESI-DISKON', status='paid', subtotal=50000,
            diskon_kupon=5000, diskon_penjualan=2500, total=42500,
            metode_bayar='CASH', dibayar=50000, kembalian=7500,
        )

        self.assertEqual(hitung_total_diskon_resi(sale), 7500)
        self.assertEqual(POSSaleSerializer(sale).data['diskon_total'], 7500)
        self.assertIn('Diskon: Rp 7,500', susun_resi(sale))
