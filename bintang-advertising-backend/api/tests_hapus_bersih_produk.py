"""Hapus bersih produk hasil impor (2026-10-20): saldo awal dibalik, produk dihapus."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.test import APITestCase

from accounting.models import JournalEntryLine
from .models import Order, OrderItem
from .product_models import Product, ProductStockMovement, StockLayer
from .tests_product_opening_stock_journal import _setup_accounts

User = get_user_model()


class HapusBersihProdukTests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='mgr.hapus', password='x', role='manager')
        self.staff = User.objects.create_user(username='stf.hapus', password='x', role='staff')
        self.inventory, self.saldo_awal = _setup_accounts()
        self.client.force_authenticate(self.manager)
        res = self.client.post('/api/products/', {
            'nama': 'Produk Impor', 'harga_beli': '1000', 'harga_jual_toko': '2000',
            'qty_stok': '10', 'lacak_inventori': True,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.produk = Product.objects.get(nama='Produk Impor')

    def _saldo(self, akun):
        agg = JournalEntryLine.objects.filter(account=akun, journal_entry__status='posted').aggregate(d=Sum('debit'), k=Sum('kredit'))
        return (agg['d'] or 0) - (agg['k'] or 0)

    def test_hapus_biasa_ditolak_karena_stok(self):
        self.assertEqual(self.client.delete(f'/api/products/{self.produk.id}/').status_code, 400)

    def test_hapus_bersih_membalik_saldo_awal_dan_menghapus(self):
        self.assertEqual(self._saldo(self.inventory), Decimal('10000'))
        res = self.client.post(f'/api/products/{self.produk.id}/hapus-bersih/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['jurnal_dibalik'], 1)
        self.assertFalse(Product.objects.filter(pk=self.produk.id).exists())
        self.assertFalse(StockLayer.objects.filter(product_id=self.produk.id).exists())
        self.assertEqual(self._saldo(self.inventory), 0)
        self.assertEqual(self._saldo(self.saldo_awal), 0)

    def test_produk_yang_sudah_dipesan_ditolak(self):
        order = Order.objects.create(nomor_wa='6281111', nama='Uji')
        OrderItem.objects.create(order=order, product=self.produk, jenis_produk='Produk Impor', qty=1)
        res = self.client.post(f'/api/products/{self.produk.id}/hapus-bersih/')
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Product.objects.filter(pk=self.produk.id).exists())

    def test_riwayat_selain_saldo_awal_ditolak(self):
        ProductStockMovement.objects.create(product=self.produk, tipe='masuk', qty=1, stok_awal=10, stok_akhir=11)
        self.assertEqual(self.client.post(f'/api/products/{self.produk.id}/hapus-bersih/').status_code, 400)

    def test_staff_tidak_boleh(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post(f'/api/products/{self.produk.id}/hapus-bersih/').status_code, 403)
