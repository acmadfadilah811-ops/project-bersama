"""Regresi: search server sungguhan di Stok Produksi & Stok Opname.

Sebelumnya /stock-production-documents/ dan /stock-opname-documents/ selalu
mengembalikan SEMUA dokumen (fetch-all) dan frontend yang memfilter+
memaginasi sendiri di browser. Diperbaiki lewat audit produksi 2026-09-05,
sama pola perbaikan Halaman Produk - search sekarang jadi query param server.
"""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .product_models import StockOpnameDocument, StockProductionDocument

User = get_user_model()


class StockProductionSearchTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_prod_search', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        StockProductionDocument.objects.create(nomor='PR-CARIINI-001', tanggal=date.today(), catatan='catatan biasa')
        StockProductionDocument.objects.create(nomor='PR-LAIN-002', tanggal=date.today(), catatan='catatan lain')

    def test_search_nomor_memfilter_hasil(self):
        res = self.client.get('/api/stock-production-documents/', {'search': 'CARIINI', 'page': 1, 'page_size': 10})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['nomor'], 'PR-CARIINI-001')

    def test_search_catatan_memfilter_hasil(self):
        res = self.client.get('/api/stock-production-documents/', {'search': 'catatan lain', 'page': 1, 'page_size': 10})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['count'], 1)

    def test_tanpa_search_mengembalikan_semua(self):
        res = self.client.get('/api/stock-production-documents/', {'page': 1, 'page_size': 10})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['count'], 2)


class StockOpnameSearchTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_opname_search', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        StockOpnameDocument.objects.create(nomor='OP-CARIINI-001', tanggal=date.today(), catatan='catatan biasa')
        StockOpnameDocument.objects.create(nomor='OP-LAIN-002', tanggal=date.today(), catatan='catatan lain')

    def test_search_nomor_memfilter_hasil(self):
        res = self.client.get('/api/stock-opname-documents/', {'search': 'CARIINI', 'page': 1, 'page_size': 10})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['nomor'], 'OP-CARIINI-001')

    def test_tanpa_search_mengembalikan_semua(self):
        res = self.client.get('/api/stock-opname-documents/', {'page': 1, 'page_size': 10})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['count'], 2)
