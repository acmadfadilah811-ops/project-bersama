"""Regresi audit 2026-09-08: CustomerGroup.diskon_persen ("Diskon Khusus")
tersimpan & tampil di form Tipe Pelanggan tapi TIDAK PERNAH benar-benar
diterapkan ke transaksi mana pun (nol referensi di promo_engine.py/
pos_services.py/Order). Sekarang otomatis diterapkan di checkout POS
(api/pos_services.py) dan Order (api/models.py Order.save()/OrderItem
save()/delete()) -- mencakup dua tipe: persentase dan nominal (keputusan
user 2026-09-08).

Sekalian ditemukan & diperbaiki 2 bug lama yang jadi kelihatan waktu
menambahkan diskon ini: OrderItem.save() dan OrderItem.delete() punya
implementasi recompute total_harga SENDIRI-SENDIRI yang independen dari
Order.save() -- delete() bahkan LUPA subtract diskon_otomatis & kupon sama
sekali, jadi menghapus 1 item dari order yang sudah punya Diskon Penjualan/
kupon aktif diam-diam MENGHILANGKAN diskon itu dari total."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.customer_models import Customer, CustomerGroup
from api.marketing_models import DiscountCoupon
from api.models import Contact, Order, OrderItem
from api.pos_services import create_sale
from api.product_models import Product, ProductCategory

User = get_user_model()


class CustomerGroupHitungDiskonTests(APITestCase):
    """Unit test murni untuk CustomerGroup.hitung_diskon()."""

    def test_persen(self):
        grp = CustomerGroup(tipe_diskon='persen', diskon_persen=Decimal('10'), is_active=True)
        self.assertEqual(grp.hitung_diskon(100000), 10000)

    def test_nominal(self):
        grp = CustomerGroup(tipe_diskon='nominal', diskon_nominal=15000, is_active=True)
        self.assertEqual(grp.hitung_diskon(100000), 15000)

    def test_nominal_tidak_melebihi_subtotal(self):
        grp = CustomerGroup(tipe_diskon='nominal', diskon_nominal=999999, is_active=True)
        self.assertEqual(grp.hitung_diskon(50000), 50000)

    def test_grup_nonaktif_tidak_diskon(self):
        grp = CustomerGroup(tipe_diskon='persen', diskon_persen=Decimal('10'), is_active=False)
        self.assertEqual(grp.hitung_diskon(100000), 0)

    def test_subtotal_nol_tidak_error(self):
        grp = CustomerGroup(tipe_diskon='persen', diskon_persen=Decimal('10'), is_active=True)
        self.assertEqual(grp.hitung_diskon(0), 0)


class OrderCustomerGroupDiscountTests(APITestCase):
    """Order (jalur "Antrean Online & Offline" / Buat Order staff) -- diskon
    diterapkan otomatis via OrderItem.save()/delete() begitu item
    ditambahkan/dihapus, karena itu jalur nyata perhitungan total_harga
    (bukan Order.save() langsung, lihat komentar di api/models.py)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_cg_order', password='x', role='owner')
        self.grup = CustomerGroup.objects.create(
            nama='Reseller Uji', tipe_diskon='persen', diskon_persen=Decimal('10'), is_active=True,
        )
        self.customer = Customer.objects.create(nama='Toko Reseller Uji', customer_group=self.grup)
        self.contact = Contact.objects.create(nomor_wa='6281200088877', nama='Toko Reseller Uji', customer=self.customer)
        self.kategori = ProductCategory.objects.create(nama='Kategori CG Order', key='test-kat-cg-order')
        self.product = Product.objects.create(nama='Produk CG Order', kategori=self.kategori, sku='TEST-CG-ORDER-1')
        self.order = Order.objects.create(nomor_wa=self.contact.nomor_wa, nama='Toko Reseller Uji', dilayani_oleh=self.owner)

    def test_item_ditambahkan_otomatis_kena_diskon_tipe_pelanggan(self):
        OrderItem.objects.create(order=self.order, jenis_produk='Banner', product=self.product, qty=1, harga_jual=100000)
        self.order.refresh_from_db()
        self.assertEqual(self.order.diskon_tipe_pelanggan, 10000)
        self.assertEqual(self.order.total_harga, 90000)

    def test_pelanggan_tanpa_grup_tidak_kena_diskon(self):
        order_lain = Order.objects.create(nomor_wa='6281299900011', nama='Tanpa Grup', dilayani_oleh=self.owner)
        OrderItem.objects.create(order=order_lain, jenis_produk='Banner', product=self.product, qty=1, harga_jual=100000)
        order_lain.refresh_from_db()
        self.assertEqual(order_lain.diskon_tipe_pelanggan, 0)
        self.assertEqual(order_lain.total_harga, 100000)

    def test_tipe_nominal(self):
        self.grup.tipe_diskon = 'nominal'
        self.grup.diskon_nominal = 25000
        self.grup.save(update_fields=['tipe_diskon', 'diskon_nominal'])

        OrderItem.objects.create(order=self.order, jenis_produk='Banner', product=self.product, qty=1, harga_jual=100000)
        self.order.refresh_from_db()
        self.assertEqual(self.order.diskon_tipe_pelanggan, 25000)
        self.assertEqual(self.order.total_harga, 75000)

    def test_hapus_item_tetap_pertahankan_diskon_otomatis_dan_kupon(self):
        """Regresi bug lama: OrderItem.delete() sebelumnya recompute total
        TANPA subtract diskon_otomatis/kupon sama sekali."""
        item1 = OrderItem.objects.create(order=self.order, jenis_produk='Banner', product=self.product, qty=1, harga_jual=60000)
        OrderItem.objects.create(order=self.order, jenis_produk='Stiker', product=self.product, qty=1, harga_jual=40000)
        self.order.refresh_from_db()
        self.order.diskon_otomatis = 5000
        self.order._current_user = self.owner
        self.order.save()
        self.order.refresh_from_db()
        # subtotal 100000 - diskon_otomatis 5000 - diskon_tipe_pelanggan(10% dari 100000=10000) = 85000
        self.assertEqual(self.order.total_harga, 85000)

        item1.delete()
        self.order.refresh_from_db()
        # subtotal sisa 40000 - diskon_otomatis 5000 - diskon_tipe_pelanggan(10% dari 40000=4000) = 31000
        self.assertEqual(self.order.total_harga, 31000)
        self.assertEqual(self.order.diskon_tipe_pelanggan, 4000)


class PosCustomerGroupDiscountTests(APITestCase):
    """Kasir POS -- diskon otomatis dievaluasi & MENUMPUK dengan diskon lain
    (sama seperti Promosi POS), tidak butuh pilihan kasir apa pun."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_cg_pos', password='x', role='owner')
        self.grup = CustomerGroup.objects.create(
            nama='VIP Uji POS', tipe_diskon='persen', diskon_persen=Decimal('20'), is_active=True,
        )
        self.customer = Customer.objects.create(nama='Pelanggan VIP Uji', customer_group=self.grup)
        self.contact = Contact.objects.create(nomor_wa='6281200077766', nama='Pelanggan VIP Uji', customer=self.customer)
        self.kategori = ProductCategory.objects.create(nama='Kategori CG POS', key='test-kat-cg-pos')
        self.product = Product.objects.create(
            nama='Produk CG POS', kategori=self.kategori, sku='TEST-CG-POS-1',
            harga_beli=Decimal('10000'), harga_jual_toko=Decimal('50000'), qty_stok=Decimal('50'),
        )

    def test_pos_checkout_otomatis_kena_diskon_tipe_pelanggan(self):
        sale = create_sale(user=self.owner, data={
            'items': [{'product_id': self.product.id, 'qty': 1, 'nama': 'Produk CG POS'}],
            'pelanggan': self.contact.nomor_wa,
            'status': 'paid', 'dibayar': 40000, 'metode_bayar': 'CASH',
        })
        self.assertEqual(sale.diskon_tipe_pelanggan, Decimal('10000'))
        self.assertEqual(sale.total, Decimal('40000'))

    def test_pos_tanpa_pelanggan_tidak_kena_diskon(self):
        sale = create_sale(user=self.owner, data={
            'items': [{'product_id': self.product.id, 'qty': 1, 'nama': 'Produk CG POS'}],
            'status': 'paid', 'dibayar': 50000, 'metode_bayar': 'CASH',
        })
        self.assertEqual(sale.diskon_tipe_pelanggan, Decimal('0'))
        self.assertEqual(sale.total, Decimal('50000'))

    def test_pos_diskon_tipe_pelanggan_menumpuk_dengan_kupon(self):
        coupon = DiscountCoupon.objects.create(
            kode='CGPOS10', judul='Kupon Uji CG POS', tanggal_aktif='2026-01-01',
            tanpa_kadaluarsa=True, show_pos=True, tipe_diskon='percent', jumlah_diskon=10,
            all_customers=True, all_products=True, is_active=True,
        )
        sale = create_sale(user=self.owner, data={
            'items': [{'product_id': self.product.id, 'qty': 1, 'nama': 'Produk CG POS'}],
            'pelanggan': self.contact.nomor_wa,
            'metode_diskon': 'kupon', 'kupon_kode': coupon.kode,
            'status': 'paid', 'dibayar': 35000, 'metode_bayar': 'CASH',
        })
        # 50000 - kupon 10% (5000) - tipe pelanggan 20% dari subtotal (10000) = 35000
        self.assertEqual(sale.diskon_kupon, Decimal('5000'))
        self.assertEqual(sale.diskon_tipe_pelanggan, Decimal('10000'))
        self.assertEqual(sale.total, Decimal('35000'))
