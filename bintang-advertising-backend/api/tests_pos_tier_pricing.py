"""Tier harga per Tipe Pelanggan (Product.tiers[].tipe_pelanggan) benar-benar
dipakai saat checkout POS, bukan cuma metadata tersimpan.

Bug ditemukan 2026-08-13: tab "Tambah Tingkatan Harga" di detail produk sudah
punya field Tipe Pelanggan, tapi kalkulator harga (`_harga_tier` di
services/product_pricing.py) hanya mencocokkan qty — tipe pelanggan tidak
pernah dibaca. Diperbaiki: tier dengan `tipe_pelanggan` diisi didahulukan
dari tier umum kalau pelanggan (Contact.customer.customer_group) cocok;
`pos_services.create_sale` sekarang meresolusi tipe pelanggan SEBELUM loop
harga item (sebelumnya diresolusi setelah loop, jadi tidak sempat dipakai)."""
from rest_framework.test import APITestCase

from api.customer_models import Customer, CustomerGroup
from api.models import Contact, CustomUser
from api.pos_models import POSSaleItem
from api.product_models import Product


class PosTierPricingCustomerGroupTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_tier_pricing', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)

        self.product = Product.objects.create(
            nama='Stiker Chromo', price_type='tier', qty_stok=100, lacak_inventori=False,
            tiers=[
                {'min_qty': 1, 'price': 10000},
                {'min_qty': 1, 'price': 8000, 'tipe_pelanggan': 'Reseller'},
            ],
        )

        self.grup_reseller = CustomerGroup.objects.create(nama='Reseller')
        self.member_reseller = Customer.objects.create(nama='Toko Kulakan', customer_group=self.grup_reseller)
        self.kontak_reseller = Contact.objects.create(
            nomor_wa='628111111111', nama='Toko Kulakan', customer=self.member_reseller,
        )
        self.kontak_umum = Contact.objects.create(nomor_wa='628222222222', nama='Pelanggan Biasa')

    def test_checkout_tanpa_pelanggan_pakai_harga_umum(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1}],
            'status': 'paid', 'dibayar': 10000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.harga_snapshot, 10000)

    def test_checkout_pelanggan_tanpa_tipe_pakai_harga_umum(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1}],
            'pelanggan': self.kontak_umum.nomor_wa,
            'status': 'paid', 'dibayar': 10000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.harga_snapshot, 10000)

    def test_checkout_pelanggan_reseller_pakai_harga_khusus(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1}],
            'pelanggan': self.kontak_reseller.nomor_wa,
            'status': 'paid', 'dibayar': 8000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.harga_snapshot, 8000)

    def test_preview_hitung_harga_endpoint_ikut_pelanggan_id(self):
        res = self.client.get(
            f'/api/products/{self.product.id}/hitung-harga/',
            {'qty': 1, 'pelanggan_id': self.kontak_reseller.nomor_wa},
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['harga_satuan'], 8000.0)

    def test_preview_hitung_harga_endpoint_tanpa_pelanggan_id_harga_umum(self):
        res = self.client.get(f'/api/products/{self.product.id}/hitung-harga/', {'qty': 1})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['harga_satuan'], 10000.0)


class PosTierPricingGuestTests(APITestCase):
    """"Guest" adalah kategori Tipe Pelanggan ASLI (CustomerGroup, di-seed
    migration 0117) yang bisa dikelola di menu Pelanggan & Supplier > Tipe
    Pelanggan seperti Reseller/VIP — BUKAN default otomatis untuk transaksi
    tanpa pelanggan. Koreksi 2026-08-13: implementasi awal sempat membuat
    "Guest" jadi default diam-diam (customer_group_nama='Guest' saat tidak
    ada pelanggan/tipe tertaut), user minta itu dibatalkan supaya konsisten
    dengan cara kerja Tipe Pelanggan lain — harus ditautkan eksplisit ke
    Customer dulu baru tier-nya berlaku."""

    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_tier_guest', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Stiker Chromo', price_type='tier', qty_stok=100, lacak_inventori=False,
            tiers=[
                {'min_qty': 1, 'price': 10000},
                {'min_qty': 1, 'price': 12000, 'tipe_pelanggan': 'Guest'},
            ],
        )

    def test_migration_0117_membuat_customer_group_guest(self):
        self.assertTrue(CustomerGroup.objects.filter(nama='Guest', is_active=True).exists())

    def test_checkout_tanpa_pelanggan_tidak_otomatis_pakai_tier_guest(self):
        # Tanpa pelanggan sama sekali harus tetap jatuh ke tier Umum — Guest
        # bukan default otomatis.
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1}],
            'status': 'paid', 'dibayar': 10000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.harga_snapshot, 10000)

    def test_checkout_pelanggan_tanpa_customer_group_tidak_otomatis_pakai_tier_guest(self):
        # Pelanggan tertaut tapi belum dikategorikan (customer_group kosong)
        # juga tetap tier Umum, bukan otomatis Guest.
        kontak = Contact.objects.create(nomor_wa='628333333333', nama='Tanpa Member')
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1}],
            'pelanggan': kontak.nomor_wa,
            'status': 'paid', 'dibayar': 10000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.harga_snapshot, 10000)

    def test_checkout_pelanggan_ditautkan_eksplisit_ke_guest_pakai_tier_guest(self):
        grup_guest = CustomerGroup.objects.get(nama='Guest')
        member = Customer.objects.create(nama='Pelanggan Guest', customer_group=grup_guest)
        kontak = Contact.objects.create(nomor_wa='628444555666', nama='Pelanggan Guest', customer=member)
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.product.id, 'qty': 1}],
            'pelanggan': kontak.nomor_wa,
            'status': 'paid', 'dibayar': 12000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.harga_snapshot, 12000)

    def test_preview_tanpa_pelanggan_id_tidak_otomatis_pakai_tier_guest(self):
        res = self.client.get(f'/api/products/{self.product.id}/hitung-harga/', {'qty': 1})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['harga_satuan'], 10000.0)
