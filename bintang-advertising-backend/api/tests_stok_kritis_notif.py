"""Notifikasi stok menipis setelah transaksi (2026-09-24, instruksi user:
kasir tidak dapat peringatan apa pun saat stok tembus ambang minimum).
Dicek lewat field `stok_kritis` di response POST /pos/sales/ dan
/orders/checkout-pos/."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Contact, Divisi, TahapProses
from .product_models import Product

User = get_user_model()


class StokKritisPosSaleTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_kritis_pos', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.pelanggan = Contact.objects.create(nomor_wa='081200000080', nama='Pelanggan Kritis Uji')
        self.produk = Product.objects.create(
            nama='Mendoan', harga_beli=1000, harga_jual_toko=5000,
            qty_stok=100, stok_minimum=96, lacak_inventori=True,
        )

    def _jual(self, qty):
        return self.client.post('/api/pos/sales/', {
            'pelanggan': self.pelanggan.nomor_wa,
            'items': [{'product_id': self.produk.id, 'qty': qty, 'harga': 5000}],
            'status': 'paid', 'dibayar': 5000 * qty, 'metode_bayar': 'tunai',
        }, format='json')

    def test_stok_setelah_transaksi_di_bawah_minimum_muncul_di_response(self):
        res = self._jual(5)  # 100 - 5 = 95, di bawah minimum 96
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(res.data['stok_kritis']), 1)
        self.assertEqual(res.data['stok_kritis'][0]['nama'], 'Mendoan')
        self.assertEqual(res.data['stok_kritis'][0]['sisa'], 95.0)
        self.assertEqual(res.data['stok_kritis'][0]['minimum'], 96.0)

    def test_stok_masih_di_atas_minimum_tidak_muncul(self):
        self.produk.qty_stok = 200
        self.produk.save(update_fields=['qty_stok'])
        res = self._jual(1)  # 200 - 1 = 199, jauh di atas minimum 96
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['stok_kritis'], [])

    def test_stok_minimum_nol_tidak_pernah_memicu_notifikasi(self):
        self.produk.stok_minimum = 0
        self.produk.save(update_fields=['stok_minimum'])
        res = self._jual(99)  # sisa 1, tapi minimum 0 = fitur nonaktif utk produk ini
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['stok_kritis'], [])


class StokKritisCheckoutPosTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_kritis_order', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir_kritis_order', password='x', role='kasir')
        self.client.force_authenticate(self.kasir)
        self.divisi = Divisi.objects.create(nama='Produksi Kritis')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(
            nama='Banner Kritis', harga_beli=1000, harga_jual_toko=50000,
            qty_stok=10, stok_minimum=8, lacak_inventori=True,
        )

    def test_checkout_pos_dp_stok_kritis_muncul_di_response(self):
        import uuid
        res = self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Pelanggan Order Kritis', 'nomor_wa': '081200000081',
            'items': [{'product_id': self.produk.id, 'qty': 3, 'harga_satuan': 50000}],
            'jumlah_bayar': 150000, 'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.kasir.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(res.data['stok_kritis']), 1)
        self.assertEqual(res.data['stok_kritis'][0]['sisa'], 7.0)
