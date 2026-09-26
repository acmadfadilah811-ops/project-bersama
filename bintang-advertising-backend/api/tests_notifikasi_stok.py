"""Notifikasi stok minimum (2026-09-26, UAT INV-06)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import InventoryItem
from .notifikasi_stok_models import NotifikasiStok
from .product_models import Product

URL = '/api/notifikasi-stok/'


class NotifikasiStokTest(APITestCase):
    def _stok(self, produk, qty):
        produk.qty_stok = Decimal(qty)
        produk.save()

    def test_satu_notifikasi_per_penurunan_dan_tutup_sendiri(self):
        p = Product.objects.create(nama='Kertas A3', qty_stok=20, stok_minimum=10, satuan='lembar')
        self.assertFalse(NotifikasiStok.objects.exists())
        self._stok(p, 5)
        self._stok(p, 3)
        n = NotifikasiStok.objects.get()
        self.assertEqual((n.aktif, n.stok, n.minimum), (True, Decimal('3'), Decimal('10')))
        self._stok(p, 15)
        n.refresh_from_db()
        self.assertFalse(n.aktif)
        self._stok(p, 2)
        self.assertEqual(NotifikasiStok.objects.filter(aktif=True).count(), 1)
        self.assertEqual(NotifikasiStok.objects.count(), 2)

    def test_jasa_dan_tanpa_minimum_tidak_diberi_notifikasi(self):
        Product.objects.create(nama='Jasa Edit', qty_stok=0, stok_minimum=5, lacak_inventori=False)
        Product.objects.create(nama='Pigura', qty_stok=0, stok_minimum=0)
        self.assertFalse(NotifikasiStok.objects.exists())

    def test_bahan_baku(self):
        InventoryItem.objects.create(nama='Tinta Cyan', stok=1, min_stok=4, satuan='liter', kategori='Tinta')
        n = NotifikasiStok.objects.get()
        self.assertEqual((n.jenis, n.nama), ('bahan', 'Tinta Cyan'))

    def test_api_peran_dan_tandai_dibaca(self):
        User = get_user_model()
        Product.objects.create(nama='Kertas A3', qty_stok=1, stok_minimum=10, satuan='lembar')
        admin = User.objects.create_user(username='admin-stok', password='x', role='admin')
        self.client.force_authenticate(admin)
        res = self.client.get(URL)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['belum_dibaca'], 1)
        self.assertEqual(res.data['hasil'][0]['judul'], 'Stok menipis: Kertas A3')
        self.assertIn('Sisa 1 lembar, di bawah minimum 10 lembar', res.data['hasil'][0]['pesan'])
        self.client.post(f'{URL}baca/', {'semua': True}, format='json')
        self.assertEqual(self.client.get(URL).data['belum_dibaca'], 0)

        kasir = User.objects.create_user(username='kasir-stok', password='x', role='kasir')
        self.client.force_authenticate(kasir)
        self.assertEqual(self.client.get(URL).status_code, 403)
