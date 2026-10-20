"""Form Buat Pesanan per unit bisnis (2026-10-20): produk unit + umum, unit karyawan di staff-list."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import UnitBisnis
from .product_models import Product


class PesananUnitDaftarHargaTests(APITestCase):
    def setUp(self):
        self.foto, _ = UnitBisnis.objects.get_or_create(nama='StarFoto Uji')
        self.adv, _ = UnitBisnis.objects.get_or_create(nama='Advertising Uji')
        self.owner = get_user_model().objects.create_user(username='own.unit', password='x', role='owner')
        self.kasir = get_user_model().objects.create_user(
            username='ksr.unit', password='x', role='kasir', unit_bisnis=self.foto, first_name='Kasir', last_name='Foto')
        Product.objects.create(nama='Pigura Foto', unit_bisnis=self.foto, harga_jual_toko=1)
        Product.objects.create(nama='Banner Adv', unit_bisnis=self.adv, harga_jual_toko=1)
        Product.objects.create(nama='Laminasi Umum', harga_jual_toko=1)
        self.client.force_authenticate(self.owner)

    def _nama(self, **params):
        res = self.client.get('/api/products/', {'page': 1, 'page_size': 50, **params})
        self.assertEqual(res.status_code, 200, res.content)
        return sorted(p['nama'] for p in res.json()['results'])

    def test_produk_unit_ditambah_umum(self):
        self.assertEqual(self._nama(unit_bisnis=self.foto.id), ['Pigura Foto'])
        self.assertEqual(self._nama(unit_bisnis=self.foto.id, termasuk_umum=1), ['Laminasi Umum', 'Pigura Foto'])

    def test_staff_list_menyertakan_unit(self):
        rows = self.client.get('/api/pos/sales/staff-list/').json()
        kasir = next(r for r in rows if r['id'] == self.kasir.id)
        self.assertEqual(kasir['unit_bisnis'], self.foto.id)
        self.assertEqual(kasir['unit_bisnis_nama'], 'StarFoto Uji')
