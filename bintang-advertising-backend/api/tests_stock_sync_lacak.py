"""Sync Stok Produk tidak membuat lapisan untuk produk yang tidak dilacak stoknya.

Temuan UAT Finance 2026-09-26: produk jasa/paket hasil impor ber-stok 1000 ikut
dibuatkan lapisan saldo awal, sehingga nilai Persediaan melonjak ke miliaran dan
Tutup Buku pasti ditolak. Stok produk seperti ini tidak pernah dikonsumsi saat
terjual, jadi lapisannya tidak boleh ada.
"""

from decimal import Decimal

from django.test import TestCase

from . import stock_fifo
from .product_models import Product, ProductVariant, StockLayer


class SyncStokLacakInventoriTest(TestCase):
    def test_hanya_produk_dan_varian_yang_dilacak(self):
        dilacak = Product.objects.create(nama='Kertas A3', harga_beli=500, qty_stok=100)
        jasa = Product.objects.create(nama='Paket Wedding', harga_beli=12000000, qty_stok=1000, lacak_inventori=False)
        induk = Product.objects.create(nama='Banner', harga_beli=10000)
        v_lacak = ProductVariant.objects.create(product=induk, nama_varian='280gr', harga_beli=10000, qty_stok=5)
        v_jasa = ProductVariant.objects.create(product=induk, nama_varian='Jasa pasang', harga_beli=50000,
                                               qty_stok=1000, lacak_inventori=False)

        self.assertEqual(stock_fifo.sync_opening_layers(), 2)

        self.assertTrue(StockLayer.objects.filter(product=dilacak).exists())
        self.assertTrue(StockLayer.objects.filter(variant=v_lacak).exists())
        self.assertFalse(StockLayer.objects.filter(product=jasa).exists())
        self.assertFalse(StockLayer.objects.filter(variant=v_jasa).exists())

        from accounting.services.period import get_computed_persediaan_value

        self.assertEqual(get_computed_persediaan_value(), Decimal('100') * 500 + Decimal('5') * 10000)
        self.assertEqual(stock_fifo.sync_opening_layers(), 0)
