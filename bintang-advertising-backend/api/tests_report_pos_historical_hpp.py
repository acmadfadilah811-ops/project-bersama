"""Regresi audit Laporan Produk 2026-09-08: `_sale_lines()` di report_views.py
menghitung modal (HPP) baris POS dari `product.harga_beli` SAAT INI, bukan
harga beli historis saat barang itu terjual. Kalau harga beli produk berubah
setelah transaksi, "Laba" transaksi LAMA di laporan (Laba/Rugi, Rincian
Penjualan, Item per Brand, dst.) ikut bergeser retroaktif -- padahal
seharusnya tetap, karena modal riil sudah tercatat di
ProductStockMovement.hpp_total (hasil konsumsi lapisan FIFO saat sale itu
terjadi, api/stock_fifo.py). Fix: baca hpp_total per product+variant dari
movement 'penjualan' milik sale itu, bukan harga_beli produk saat ini."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.product_models import Product, ProductCategory, ProductStockMovement
from api.pos_models import POSSale, POSSaleItem

User = get_user_model()


class PosHistoricalHppInReportsTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_hpp_report', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        kategori = ProductCategory.objects.create(nama='Kategori HPP Report Test', key='test-kat-hpp-report')
        # Harga beli SEKARANG jauh lebih tinggi dari harga beli SAAT transaksi
        # terjadi -- ini yang membedakan bug (pakai field ini) vs fix (pakai
        # hpp_total historis).
        self.product = Product.objects.create(
            nama='Produk HPP Report Test', kategori=kategori, sku='TEST-HPPREPORT-1',
            qty_stok=Decimal('100'), lacak_inventori=True, harga_beli=Decimal('50000'),
        )
        self.sale = POSSale.objects.create(
            nomor='POS-HPPREPORT-1', kasir=self.owner, subtotal=Decimal('100000'),
            total=Decimal('100000'), status='paid',
        )
        self.item = POSSaleItem.objects.create(
            sale=self.sale, product=self.product, nama_snapshot='Produk HPP Report Test',
            harga_snapshot=Decimal('100000'), qty=Decimal('1'), subtotal=Decimal('100000'),
        )

    def test_laba_rugi_pakai_hpp_historis_bukan_harga_beli_sekarang(self):
        # Modal RIIL saat sale ini terjadi (harga beli lama, jauh lebih murah).
        ProductStockMovement.objects.create(
            product=self.product, tipe='penjualan', qty=Decimal('1'),
            hpp_total=Decimal('10000'), stok_awal=100, stok_akhir=99,
            tanggal=date(2026, 8, 1), pos_sale=self.sale,
        )

        resp = self.client.get('/api/reports/laba-rugi/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        hpp_row = next(r for r in resp.data['rows'] if r['keterangan'] == 'Harga Pokok Penjualan (HPP)')
        # Bug lama akan menghasilkan 50000 (harga_beli produk saat ini * qty).
        self.assertEqual(hpp_row['jumlah'], 10000.0)

    def test_tanpa_movement_fallback_ke_harga_beli_sekarang(self):
        """Transaksi lama sebelum FIFO aktif (tidak ada movement sama
        sekali) -- fallback ke harga_beli saat ini, lebih baik dari HPP Rp0."""
        resp = self.client.get('/api/reports/laba-rugi/')
        hpp_row = next(r for r in resp.data['rows'] if r['keterangan'] == 'Harga Pokok Penjualan (HPP)')
        self.assertEqual(hpp_row['jumlah'], 50000.0)
