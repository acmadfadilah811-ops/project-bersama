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

    def test_per_m2_luas_tidak_dibulatkan_dan_pembulatan_rupiah_half_up(self):
        # Transaksi Faisal RSPC 2026-10-26: 0,6 x 0,42 = 0,252 m2 x 75.000 = 18.900 (kalkulator
        # kasir dulu membulatkan luas ke 0,25 -> 18.750, tidak sama dengan yang ditagih server).
        p = Product.objects.create(nama='Cetak Albatros', price_type='per_m2', harga_jual_toko=75000)
        hasil = hitung_harga(p, qty=2, panjang='0.6', lebar='0.42')
        self.assertEqual(hasil['harga_satuan'], 18900.0)
        self.assertEqual(hasil['total'], 37800.0)
        # Tepat .5 rupiah dibulatkan ke atas (sama dengan Math.round di kasir), bukan ke genap.
        p2 = Product.objects.create(nama='Stiker Mini', price_type='per_m2', harga_jual_toko=25)
        self.assertEqual(hitung_harga(p2, panjang='0.5', lebar='0.2')['harga_satuan'], 3.0)  # 0,1 m2 x 25 = 2,5 -> 3

    def test_flat_memakai_tingkatan_harga_per_tipe_pelanggan_rp_dan_persen(self):
        """Kasir memakai Tingkatan Harga (2026-10-27): tier bisa Rp tetap atau potongan % dari harga normal."""
        p = Product.objects.create(nama='Kartu Nama', price_type='flat', harga_jual_toko=60000, tiers=[
            {'price': 50000, 'min_qty': 1, 'tipe_pelanggan': 'Agen'},                       # Rp tetap
            {'tipe_nilai': 'persen', 'persen': 10, 'price': 0, 'min_qty': 1, 'tipe_pelanggan': 'MOU'},  # -10%
            {'price': 58000, 'min_qty': 5, 'tipe_pelanggan': 'Guest'},                      # qty break Guest
            {'price': 59000, 'min_qty': 10, 'tipe_pelanggan': ''},                          # tier umum
        ])
        self.assertEqual(hitung_harga(p, qty=1, customer_group_nama='agen')['harga_satuan'], 50000.0)  # tak peka huruf besar
        self.assertEqual(hitung_harga(p, qty=2, customer_group_nama='MOU')['harga_satuan'], 54000.0)
        self.assertEqual(hitung_harga(p, qty=1)['harga_satuan'], 60000.0)                    # Guest, qty belum cukup -> dasar
        self.assertEqual(hitung_harga(p, qty=5)['harga_satuan'], 58000.0)                    # Guest, qty break
        self.assertEqual(hitung_harga(p, qty=12, customer_group_nama='Member')['harga_satuan'], 59000.0)  # tipe lain -> tier umum
        self.assertEqual(hitung_harga(p, qty=3, customer_group_nama='Member')['harga_satuan'], 60000.0)   # tak ada yang cocok

    def test_per_m2_tarif_ikut_tingkatan_harga_tipe_pelanggan(self):
        p = Product.objects.create(nama='Banner', price_type='flat', harga_jual_toko=25000, tiers=[
            {'tipe_nilai': 'persen', 'persen': 32, 'price': 0, 'min_qty': 1, 'tipe_pelanggan': 'Agen'},
        ])
        hasil = hitung_harga(p, qty=1, panjang='1.6', lebar='0.6', paksa_per_m2=True, customer_group_nama='Agen')
        self.assertEqual(hasil['harga_per_m2'], 17000.0)      # 25.000 - 32%
        self.assertEqual(hasil['harga_satuan'], 16320.0)      # 0,96 m2 x 17.000

    def test_price_type_tier_mendukung_persen(self):
        p = Product.objects.create(nama='Stiker', price_type='tier', harga_jual_toko=10000, tiers=[
            {'tipe_nilai': 'persen', 'persen': 20, 'price': 0, 'min_qty': 1, 'tipe_pelanggan': 'Agen'},
            {'price': 9000, 'min_qty': 1, 'tipe_pelanggan': ''},
        ])
        self.assertEqual(hitung_harga(p, qty=1, customer_group_nama='Agen')['harga_satuan'], 8000.0)
        self.assertEqual(hitung_harga(p, qty=1, customer_group_nama='Corporate')['harga_satuan'], 9000.0)

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

    def test_nomor_wa_pelanggan_menentukan_harga_tipe_pelanggan(self):
        """Form Buat Order staff/manager hanya tahu nomor WA: harga ikut Tipe Pelanggan seperti kasir."""
        from .customer_models import Customer, CustomerGroup
        from .models import Contact
        grup = CustomerGroup.objects.create(nama='Agen Uji WA')
        cust = Customer.objects.create(nama='Toko Agen', customer_group=grup)
        Contact.objects.create(nomor_wa='6281200033322', nama='Toko Agen', customer=cust)
        p = Product.objects.create(nama='Kartu Nama Tier', price_type='flat', harga_jual_toko=60000, tiers=[
            {'price': 50000, 'min_qty': 1, 'tipe_pelanggan': 'Agen Uji WA'},
        ])
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 1, 'nomor_wa': '6281200033322'})
        self.assertEqual(res.data['harga_satuan'], 50000.0)
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 1, 'nomor_wa': '6289999999999'})
        self.assertEqual(res.data['harga_satuan'], 60000.0)   # bukan pelanggan terdaftar = Guest -> harga dasar
        res = self.client.get(f'/api/products/{p.id}/hitung-harga/', {'qty': 1})
        self.assertEqual(res.data['harga_satuan'], 60000.0)

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


class PosTierTipePelangganTest(APITestCase):
    """Kasir (POS lunas) memakai Tingkatan Harga sesuai Tipe Pelanggan pembeli (2026-10-27)."""

    def setUp(self):
        from .customer_models import Customer, CustomerGroup
        from .models import Contact

        self.owner = User.objects.create_user(username='owner_tier_pos', password='rahasia123', role='owner')
        self.client.force_authenticate(self.owner)
        agen = CustomerGroup.objects.create(nama='Agen')
        self.produk = Product.objects.create(
            nama='Kartu Nama Tier', price_type='flat', harga_jual_toko=60000, harga_beli=30000, qty_stok=50, lacak_inventori=True,
            tiers=[{'tipe_nilai': 'persen', 'persen': 10, 'price': 0, 'min_qty': 1, 'tipe_pelanggan': 'Agen'}],
        )
        cust = Customer.objects.create(nama='Toko Agen', customer_group=agen)
        self.agen = Contact.objects.create(nomor_wa='081200000111', nama='Toko Agen', customer=cust)
        self.guest = Contact.objects.create(nomor_wa='081200000112', nama='Pembeli Biasa')

    def _jual(self, kontak, harga_klien):
        return self.client.post('/api/pos/sales/', {
            'pelanggan': kontak.nomor_wa,
            'items': [{'product_id': self.produk.id, 'qty': 2, 'harga': harga_klien}],
            'status': 'paid', 'dibayar': 500000, 'metode_bayar': 'tunai',
        }, format='json')

    def test_pelanggan_agen_dapat_harga_tier_persen_dan_guest_harga_dasar(self):
        res = self._jual(self.agen, 60000)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('108000'))   # 2 x (60.000 - 10%)
        res = self._jual(self.guest, 54000)  # harga kiriman klien tidak dipercaya (M6)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(str(res.data['total'])), Decimal('120000'))   # 2 x 60.000
