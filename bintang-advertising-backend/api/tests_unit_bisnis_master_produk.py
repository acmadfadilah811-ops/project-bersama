"""Master produk per unit bisnis (2026-10-11): kasir hanya melihat master
unitnya + yang berlaku umum; owner melihat semua dan bisa memilih unit."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import UnitBisnis
from .product_models import Addon, Brand, Collection, ProductCategory, ProductPackage, Specification


def _baris(res):
    data = res.json()
    return data['results'] if isinstance(data, dict) else data


class MasterProdukUnitBisnisTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.foto, _ = UnitBisnis.objects.get_or_create(nama='StarFoto')
        self.adv, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising')
        self.owner = User.objects.create_user(username='owner.ub', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir.ub', password='x', role='kasir', unit_bisnis=self.foto)

    def test_kasir_hanya_melihat_unitnya_dan_umum(self):
        daftar = {
            '/api/addons/': lambda u, n: Addon.objects.create(nama=n, harga=Decimal('1000'), unit_bisnis=u),
            '/api/product-categories/': lambda u, n: ProductCategory.objects.create(nama=n, unit_bisnis=u),
            '/api/brands/': lambda u, n: Brand.objects.create(nama=n, unit_bisnis=u),
            '/api/collections/': lambda u, n: Collection.objects.create(nama=n, unit_bisnis=u),
            '/api/product-packages/': lambda u, n: ProductPackage.objects.create(nama=n, unit_bisnis=u),
            '/api/specifications/': lambda u, n: Specification.objects.create(nama=n, unit_bisnis=u),
        }
        for url, buat in daftar.items():
            buat(self.foto, 'Foto')
            buat(self.adv, 'Adv')
            buat(None, 'Umum')
            self.client.force_authenticate(self.kasir)
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, (url, res.content))
            self.assertEqual(sorted(r['nama'] for r in _baris(res)), ['Foto', 'Umum'], url)
            self.client.force_authenticate(self.owner)
            self.assertEqual(len(_baris(self.client.get(url))), 3, url)

    def test_owner_memilih_unit_bisnis_addon(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post('/api/addons/', {'nama': 'Tambah Orang', 'harga': 10000, 'unit_bisnis': self.foto.id}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()['unit_bisnis_nama'], 'StarFoto')
