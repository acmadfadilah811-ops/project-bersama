"""Export Produk (CSV) — market_price & weight_kg untuk produk TANPA varian
sebelumnya hardcode "0" meski Product.harga_pasar/berat sudah terisi (baris
varian sudah benar). Test ini membuktikan produk tanpa varian ikut terisi."""

import csv
import io

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .product_models import Product


class ExportProductsTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_export', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.produk = Product.objects.create(
            nama='Produk Tanpa Varian', harga_beli=10000, harga_jual_toko=50000,
            harga_pasar=60000, berat=2.5,
        )

    def test_market_price_dan_weight_kg_terisi_untuk_produk_tanpa_varian(self):
        res = self.client.get('/api/export/products/')
        self.assertEqual(res.status_code, 200)
        rows = list(csv.reader(io.StringIO(res.content.decode('utf-8-sig'))))
        header, data_rows = rows[0], rows[1:]
        row = next(r for r in data_rows if r[header.index('name')] == 'Produk Tanpa Varian')
        self.assertEqual(row[header.index('market_price')], '60000.00')
        self.assertEqual(row[header.index('weight_kg')], '2.5')
