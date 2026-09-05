"""Regresi: /api/product-stock-movements/summary/ dipaginasi server sungguhan.

Sebelumnya endpoint ini SELALU menghitung ringkasan pergerakan stok untuk
SEMUA produk sekaligus, lalu frontend (StockMovementPage.jsx) yang memotong
hasilnya jadi halaman-halaman di browser - sama seperti bug lama Halaman
Produk (fetch-all + slice client-side). Diperbaiki lewat audit produksi
2026-09-05: produk dipaginasi & difilter search DULU di server, baru
pergerakan stoknya dihitung untuk produk di halaman itu saja.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from . import stock_fifo
from .product_models import Product, ProductCategory

User = get_user_model()


class StockMovementSummaryPaginationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_movsum_test', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.kategori = ProductCategory.objects.create(nama='Kategori Uji MovSum', key='test-kat-movsum')
        for i in range(3):
            produk = Product.objects.create(
                nama=f'Produk Uji MovSum {i}', kategori=self.kategori,
                sku=f'MOVSUM-{i}', qty_stok=10, lacak_inventori=True, harga_beli=1000,
            )
            stock_fifo.create_layer(produk, None, 10, 1000, date.today())

    def test_tanpa_page_param_tetap_unpaginated_seperti_sebelumnya(self):
        res = self.client.get('/api/product-stock-movements/summary/')
        self.assertEqual(res.status_code, 200, res.content)
        # Bentuk lama: list polos, bukan {count, results}.
        self.assertIsInstance(res.json(), list)
        rows = [r for r in res.json() if r['product'].startswith('Produk Uji MovSum')]
        self.assertEqual(len(rows), 3)

    def test_dengan_page_param_mengembalikan_bentuk_paginated(self):
        res = self.client.get('/api/product-stock-movements/summary/', {'page': 1, 'page_size': 2})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertIn('count', data)
        self.assertIn('results', data)
        self.assertLessEqual(len(data['results']), 2)

    def test_search_memfilter_produk(self):
        res = self.client.get(
            '/api/product-stock-movements/summary/',
            {'page': 1, 'page_size': 10, 'search': 'MovSum 1'},
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data['count'], 1)
        self.assertIn('Produk Uji MovSum 1', data['results'][0]['product'])

    def test_ringkasan_qty_tetap_benar_saat_dipaginasi(self):
        """Membuktikan restrukturisasi (query pergerakan dibatasi ke produk di
        halaman itu) tidak mengubah angka - initial/sisa harus tetap sama
        dengan qty_stok produk (belum ada mutasi di luar saldo awal)."""
        res = self.client.get('/api/product-stock-movements/summary/', {'page': 1, 'page_size': 10})
        self.assertEqual(res.status_code, 200, res.content)
        rows = [r for r in res.json()['results'] if r['product'].startswith('Produk Uji MovSum')]
        self.assertEqual(len(rows), 3)
        for row in rows:
            self.assertEqual(row['sisa'], 10.0)
