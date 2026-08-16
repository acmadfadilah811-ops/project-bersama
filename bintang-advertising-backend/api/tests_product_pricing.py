"""Resolver harga Product.price_type/tiers (api/services/product_pricing.py)
— sumber kebenaran baru untuk kalkulator harga bot WA, menggantikan tabel
ProductPrice legacy. Fokus: flat/tier/per_m2 dan penolakan tegas (bukan
tebakan) saat data yang dibutuhkan tidak ada."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .product_models import Product, ProductVariant
from .services.product_pricing import hitung_harga, HargaProdukError

User = get_user_model()


class HitungHargaProdukTest(TestCase):
    def test_flat(self):
        p = Product.objects.create(nama='Kartu Nama', price_type='flat', harga_jual_toko=35000)
        hasil = hitung_harga(p, qty=3)
        self.assertEqual(hasil['price_type'], 'flat')
        self.assertEqual(hasil['harga_satuan'], 35000.0)
        self.assertEqual(hasil['total'], 105000.0)

    def test_per_m2(self):
        p = Product.objects.create(nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000)
        hasil = hitung_harga(p, qty=2, panjang=2, lebar=3)
        self.assertEqual(hasil['price_type'], 'per_m2')
        self.assertEqual(hasil['luas_m2'], 6.0)
        self.assertEqual(hasil['harga_satuan'], 150000.0)  # 6 m2 x 25000
        self.assertEqual(hasil['total'], 300000.0)  # x qty 2

    def test_per_m2_tanpa_panjang_lebar_ditolak(self):
        p = Product.objects.create(nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000)
        with self.assertRaises(HargaProdukError):
            hitung_harga(p, qty=1)

    def test_tier(self):
        p = Product.objects.create(
            nama='Stiker Chromo', price_type='tier',
            tiers=[{'min_qty': 1, 'price': 7000}, {'min_qty': 11, 'price': 6000}, {'min_qty': 51, 'price': 5000}],
        )
        murah = hitung_harga(p, qty=5)
        self.assertEqual(murah['harga_satuan'], 7000.0)
        sedang = hitung_harga(p, qty=20)
        self.assertEqual(sedang['harga_satuan'], 6000.0)
        besar = hitung_harga(p, qty=100)
        self.assertEqual(besar['harga_satuan'], 5000.0)
        self.assertEqual(besar['total'], 500000.0)

    def test_tier_khusus_tipe_pelanggan_didahulukan(self):
        p = Product.objects.create(
            nama='Stiker Chromo', price_type='tier',
            tiers=[
                {'min_qty': 1, 'price': 10000},
                {'min_qty': 1, 'price': 8000, 'tipe_pelanggan': 'Reseller'},
            ],
        )
        umum = hitung_harga(p, qty=1)
        self.assertEqual(umum['harga_satuan'], 10000.0)
        reseller = hitung_harga(p, qty=1, customer_group_nama='Reseller')
        self.assertEqual(reseller['harga_satuan'], 8000.0)

    def test_tier_tipe_pelanggan_tidak_cocok_jatuh_ke_umum(self):
        p = Product.objects.create(
            nama='Stiker Chromo', price_type='tier',
            tiers=[
                {'min_qty': 1, 'price': 10000},
                {'min_qty': 1, 'price': 8000, 'tipe_pelanggan': 'Reseller'},
            ],
        )
        hasil = hitung_harga(p, qty=1, customer_group_nama='VIP')
        self.assertEqual(hasil['harga_satuan'], 10000.0)

    def test_tier_hanya_tipe_khusus_tanpa_tier_umum_ditolak_utk_pelanggan_lain(self):
        p = Product.objects.create(
            nama='Stiker Chromo', price_type='tier',
            tiers=[{'min_qty': 1, 'price': 8000, 'tipe_pelanggan': 'Reseller'}],
        )
        with self.assertRaises(HargaProdukError):
            hitung_harga(p, qty=1)

    def test_tier_tanpa_data_tiers_ditolak(self):
        p = Product.objects.create(nama='Stiker Chromo', price_type='tier', tiers=None)
        with self.assertRaises(HargaProdukError):
            hitung_harga(p, qty=5)

    def test_qty_nol_ditolak(self):
        p = Product.objects.create(nama='Kartu Nama', price_type='flat', harga_jual_toko=35000)
        with self.assertRaises(HargaProdukError):
            hitung_harga(p, qty=0)

    def test_variant_menimpa_harga_produk_induk(self):
        from .product_models import ProductVariant
        p = Product.objects.create(nama='Kaos', price_type='flat', harga_jual_toko=50000, has_variant=True)
        v = ProductVariant.objects.create(product=p, nama_varian='XL', harga_jual_toko=60000)
        hasil = hitung_harga(p, qty=1, variant=v)
        self.assertEqual(hasil['harga_satuan'], 60000.0)

    def test_paksa_per_m2_pada_produk_flat(self):
        # Katalog belum semuanya dikonfigurasi price_type='per_m2' dengan
        # benar — kasir Antrean WA butuh P x L tetap jadi pengali harga
        # walau produknya masih tercatat 'flat' (instruksi user 2026-08-12).
        p = Product.objects.create(nama='Banner Custom', price_type='flat', harga_jual_toko=25000)
        hasil = hitung_harga(p, qty=2, panjang=2, lebar=3, paksa_per_m2=True)
        self.assertEqual(hasil['price_type'], 'per_m2_manual')
        self.assertEqual(hasil['harga_satuan'], 150000.0)
        self.assertEqual(hasil['total'], 300000.0)

    def test_paksa_per_m2_pada_produk_tier_juga_menang(self):
        p = Product.objects.create(
            nama='Stiker Chromo', price_type='tier',
            tiers=[{'min_qty': 1, 'price': 7000}],
        )
        hasil = hitung_harga(p, qty=1, panjang=1, lebar=2, paksa_per_m2=True)
        self.assertEqual(hasil['price_type'], 'per_m2_manual')

    def test_paksa_per_m2_tanpa_ukuran_tetap_ditolak(self):
        p = Product.objects.create(nama='Banner Custom', price_type='flat', harga_jual_toko=25000)
        with self.assertRaises(HargaProdukError):
            hitung_harga(p, qty=1, paksa_per_m2=True)

    def test_tanpa_paksa_per_m2_produk_flat_abaikan_ukuran(self):
        # Default (paksa_per_m2=False) tidak berubah — caller lama (bot WA)
        # tidak boleh ikut terpengaruh.
        p = Product.objects.create(nama='Kartu Nama', price_type='flat', harga_jual_toko=35000)
        hasil = hitung_harga(p, qty=1, panjang=2, lebar=3)
        self.assertEqual(hasil['price_type'], 'flat')
        self.assertEqual(hasil['harga_satuan'], 35000.0)


class HitungHargaEndpointTest(APITestCase):
    """GET /products/{id}/hitung-harga/ — endpoint yang dipakai form Antrean
    WA supaya harga terisi otomatis saat pilih produk (bug 2026-08-12: field
    flat client-side tidak pernah benar utk produk per_m2/tier)."""

    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_hitung_harga', password='pass12345', role='kasir')
        self.client.force_authenticate(user=self.kasir)

    def test_kasir_bisa_hitung_harga_flat(self):
        p = Product.objects.create(nama='Kartu Nama', price_type='flat', harga_jual_toko=35000)
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 3})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['harga_satuan'], 35000.0)
        self.assertEqual(res.data['total'], 105000.0)

    def test_kasir_bisa_hitung_harga_per_m2(self):
        p = Product.objects.create(nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000)
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 2, 'panjang': 2, 'lebar': 3})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['harga_satuan'], 150000.0)
        self.assertEqual(res.data['total'], 300000.0)

    def test_per_m2_tanpa_ukuran_dibalas_400_bukan_crash(self):
        p = Product.objects.create(nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000)
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 1})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res.data)

    def test_paksa_per_m2_endpoint_produk_flat(self):
        # Antrean WA: P x L tetap jadi pengali harga walau produk masih
        # tercatat 'flat' di katalog (instruksi user 2026-08-12).
        p = Product.objects.create(nama='Banner Custom', price_type='flat', harga_jual_toko=25000)
        res = self.client.get(
            f'/api/products/{p.id}/hitung-harga/',
            {'qty': 1, 'panjang': 2, 'lebar': 3, 'paksa_per_m2': 'true'},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['harga_satuan'], 150000.0)

    def test_tanpa_paksa_per_m2_produk_flat_tetap_flat(self):
        p = Product.objects.create(nama='Banner Custom', price_type='flat', harga_jual_toko=25000)
        res = self.client.get(
            f'/api/products/{p.id}/hitung-harga/',
            {'qty': 1, 'panjang': 2, 'lebar': 3},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['harga_satuan'], 25000.0)

    def test_hitung_harga_dengan_variant(self):
        p = Product.objects.create(nama='Kaos', price_type='flat', harga_jual_toko=50000, has_variant=True)
        v = ProductVariant.objects.create(product=p, nama_varian='XL', harga_jual_toko=60000)
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'variant_id': v.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['harga_satuan'], 60000.0)

    def test_tier_pilih_bracket_sesuai_qty(self):
        p = Product.objects.create(
            nama='Stiker Chromo', price_type='tier',
            tiers=[{'min_qty': 1, 'price': 7000}, {'min_qty': 11, 'price': 6000}],
        )
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 20})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['harga_satuan'], 6000.0)
