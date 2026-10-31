"""Diskon custom kasir Rp/% (keputusan manager 2026-10-31): lunas (create_sale) dan order DP (checkout-pos).

Pilihan ketiga di samping kupon & Diskon Penjualan otomatis (tidak ditumpuk), tanpa batas maksimal, tidak
melebihi subtotal, dibulatkan ke rupiah utuh."""

import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from api.models import Contact, Divisi, Order, TahapProses
from api.pos_services import create_sale
from api.product_models import Product

User = get_user_model()


class DiskonCustomLunasTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='kasir_diskon_custom', password='x', role='kasir')
        Contact.objects.create(nomor_wa='6281200022200', nama='Pelanggan Diskon')
        self.produk = Product.objects.create(nama='Cetak Uji Diskon', price_type='flat', harga_jual_toko=33333, lacak_inventori=False)

    def _jual(self, **diskon):
        data = {
            'pelanggan': '6281200022200', 'status': 'paid', 'metode_bayar': 'Cash', 'dibayar': 1000000,
            'items': [{'product_id': self.produk.id, 'qty': 3}],
        }
        data.update(diskon)
        return create_sale(user=self.user, data=data)

    def test_diskon_persen(self):
        sale = self._jual(metode_diskon='manual', diskon_manual_tipe='persen', diskon_manual_nilai='12.5')
        # 99.999 x 12,5% = 12.499,875 -> 12.500 (rupiah utuh)
        self.assertEqual(sale.diskon, Decimal('12500'))
        self.assertEqual(sale.subtotal - sale.diskon, Decimal('87499'))

    def test_diskon_rupiah(self):
        sale = self._jual(metode_diskon='manual', diskon_manual_tipe='nominal', diskon_manual_nilai=15000)
        self.assertEqual(sale.diskon, Decimal('15000'))

    def test_diskon_tidak_melebihi_subtotal(self):
        sale = self._jual(metode_diskon='manual', diskon_manual_tipe='nominal', diskon_manual_nilai=500000)
        self.assertEqual(sale.diskon, sale.subtotal)
        self.assertEqual(sale.total, Decimal('0'))

    def test_input_tidak_valid_ditolak(self):
        for salah in (
            {'diskon_manual_tipe': 'persen', 'diskon_manual_nilai': 101},
            {'diskon_manual_tipe': 'persen', 'diskon_manual_nilai': 0},
            {'diskon_manual_tipe': 'bebas', 'diskon_manual_nilai': 10},
            {'diskon_manual_tipe': 'nominal', 'diskon_manual_nilai': 'abc'},
        ):
            with self.assertRaises(ValidationError, msg=salah):
                self._jual(metode_diskon='manual', **salah)

    def test_diskon_persen_lama_tetap_ditolak(self):
        with self.assertRaises(ValidationError):
            self._jual(diskon_persen=10)


class DiskonCustomOrderDpTest(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_dp_diskon', password='x', role='kasir')
        self.staff = User.objects.create_user(username='staff_dp_diskon', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Produksi Diskon')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(nama='Banner Diskon', harga_jual_toko=50000, lacak_inventori=False)
        self.client.force_authenticate(self.kasir)

    def _checkout(self, **diskon):
        data = {
            'idempotency_key': str(uuid.uuid4()), 'nama': 'Pelanggan DP Diskon', 'nomor_wa': '081234500022',
            'items': [{'product_id': self.produk.id, 'qty': 2, 'harga_satuan': 50000}],
            'jumlah_bayar': 0, 'metode_pembayaran': 'tunai', 'dilayani_oleh_id': self.staff.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }
        data.update(diskon)
        return self.client.post('/api/orders/checkout-pos/', data, format='json')

    def test_dp_diskon_persen_jadi_rupiah(self):
        res = self._checkout(metode_diskon='manual', diskon_manual_tipe='persen', diskon_manual_nilai=10)
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order.metode_diskon, 'manual')
        self.assertEqual(order.diskon_manual, 10000)
        self.assertEqual(order.total_harga, 90000)
        self.assertEqual(order.sisa_tagihan, 90000)
        self.assertEqual(res.json()['diskon_manual'], 10000)

    def test_dp_diskon_rupiah(self):
        res = self._checkout(metode_diskon='manual', diskon_manual_tipe='nominal', diskon_manual_nilai=25000)
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order.total_harga, 75000)

    def test_dp_diskon_tidak_melebihi_subtotal(self):
        res = self._checkout(metode_diskon='manual', diskon_manual_tipe='nominal', diskon_manual_nilai=999999)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Order.objects.get(pk=res.json()['id']).total_harga, 0)

    def test_dp_diskon_tidak_valid_ditolak_tanpa_order(self):
        sebelum = Order.objects.count()
        res = self._checkout(metode_diskon='manual', diskon_manual_tipe='persen', diskon_manual_nilai=150)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Order.objects.count(), sebelum)
