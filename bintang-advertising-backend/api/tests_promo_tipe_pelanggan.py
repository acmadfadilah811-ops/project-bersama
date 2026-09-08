"""Regresi audit Marketing > Voucher & Diskon 2026-09-08: field `tipe_pelanggan`
di DiscountCoupon, POSPromotion, dan SalesDiscount tersimpan & tampil di form
tapi TIDAK PERNAH benar-benar dibaca oleh mesin evaluasi -- kupon/diskon/
promosi yang "khusus tipe pelanggan X" tetap berlaku untuk SEMUA pelanggan.
Pola identik dengan bug CustomerGroup.diskon_persen yang lebih dulu
ditemukan & diperbaiki.

Juga: Promosi POS (DQ/DA) sebelumnya cuma dievaluasi di checkout Kasir POS
Terminal (`pos_services.create_sale`), sama sekali tidak nyala untuk order
yang diproses lewat Antrean Online & Offline -- sekarang otomatis diterapkan
di Order juga (keputusan user 2026-09-08). Item gratis (BX/FI) SENGAJA tidak
diotomasi di Order (lihat Order._hitung_diskon_promo_pos docstring)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api import promo_engine
from api.customer_models import Customer, CustomerGroup
from api.marketing_models import DiscountCoupon, POSPromotion, SalesDiscount
from api.models import Contact, Order, OrderItem
from api.product_models import Product, ProductCategory

User = get_user_model()


def konteks(baris, pelanggan=None, kanal=promo_engine.KANAL_POS):
    subtotal = sum((b.subtotal for b in baris), Decimal('0'))
    return promo_engine.KonteksPromo(baris=baris, subtotal=promo_engine.money(subtotal), pelanggan=pelanggan, kanal=kanal)


def baris(product, qty, harga):
    qty = Decimal(str(qty))
    harga = Decimal(str(harga))
    return promo_engine.BarisKeranjang(product=product, variant=None, qty=qty, harga=harga, subtotal=promo_engine.money(harga * qty))


class TipePelangganPromoTests(APITestCase):
    def setUp(self):
        self.hari_ini = timezone.localdate()
        self.kategori = ProductCategory.objects.create(nama='Kategori Tipe Pelanggan Test', key='test-kat-tp')
        self.produk = Product.objects.create(
            nama='Produk Tipe Pelanggan Test', kategori=self.kategori, sku='TEST-TP-1',
            harga_beli=10000, harga_jual_toko=50000, qty_stok=100,
        )
        self.grup_reseller = CustomerGroup.objects.create(nama='Reseller TP Test', is_active=True)
        self.grup_vip = CustomerGroup.objects.create(nama='VIP TP Test', is_active=True)
        self.customer_reseller = Customer.objects.create(nama='Toko Reseller', customer_group=self.grup_reseller)
        self.pelanggan_reseller = Contact.objects.create(nomor_wa='6281200001111', nama='Toko Reseller', customer=self.customer_reseller)
        self.customer_vip = Customer.objects.create(nama='Pelanggan VIP', customer_group=self.grup_vip)
        self.pelanggan_vip = Contact.objects.create(nomor_wa='6281200002222', nama='Pelanggan VIP', customer=self.customer_vip)
        self.pelanggan_umum = Contact.objects.create(nomor_wa='6281200003333', nama='Pelanggan Umum')

    # ---- Kupon ----
    def test_kupon_tipe_pelanggan_menolak_grup_lain(self):
        kupon = DiscountCoupon.objects.create(
            kode='RESELLER10', judul='Reseller 10%', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            tipe_diskon='percent', jumlah_diskon=Decimal('10'), show_pos=True, is_active=True,
            all_customers=False, tipe_pelanggan='Reseller TP Test',
        )
        hasil = promo_engine.evaluate_coupon_code('RESELLER10', konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_vip))
        self.assertFalse(hasil.ok)

    def test_kupon_tipe_pelanggan_menerima_grup_cocok(self):
        kupon = DiscountCoupon.objects.create(
            kode='RESELLER10B', judul='Reseller 10%', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            tipe_diskon='percent', jumlah_diskon=Decimal('10'), show_pos=True, is_active=True,
            all_customers=False, tipe_pelanggan='Reseller TP Test',
        )
        hasil = promo_engine.evaluate_coupon_code('RESELLER10B', konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_reseller))
        self.assertTrue(hasil.ok)
        self.assertEqual(hasil.diskon, Decimal('5000.00'))

    def test_kupon_tipe_pelanggan_multi_grup_dipisah_koma(self):
        DiscountCoupon.objects.create(
            kode='MULTI10', judul='Multi Grup', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            tipe_diskon='percent', jumlah_diskon=Decimal('10'), show_pos=True, is_active=True,
            all_customers=False, tipe_pelanggan='Reseller TP Test, VIP TP Test',
        )
        for pelanggan in (self.pelanggan_reseller, self.pelanggan_vip):
            hasil = promo_engine.evaluate_coupon_code('MULTI10', konteks([baris(self.produk, 1, 50000)], pelanggan=pelanggan))
            self.assertTrue(hasil.ok, f'{pelanggan.nama} seharusnya lolos')
        hasil_umum = promo_engine.evaluate_coupon_code('MULTI10', konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_umum))
        self.assertFalse(hasil_umum.ok)

    # ---- Promosi POS ----
    def test_promosi_pos_tipe_pelanggan_ditegakkan(self):
        promo = POSPromotion.objects.create(
            judul='Promo Reseller', tipe_promosi='DA', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            jam_24=True, is_active=True, hari='min,sen,sel,rab,kam,jum,sab',
            min_total_transaksi=Decimal('1'), tipe_diskon='percent', jumlah_diskon=Decimal('15'),
            all_customers=False, tipe_pelanggan='Reseller TP Test',
        )
        hasil_cocok = promo_engine.evaluate_promotions(konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_reseller), [promo])
        self.assertEqual(hasil_cocok.diskon, Decimal('7500.00'))

        hasil_tolak = promo_engine.evaluate_promotions(konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_vip), [promo])
        self.assertEqual(hasil_tolak.diskon, Decimal('0'))

    # ---- Diskon Penjualan (sebelumnya TIDAK ADA pengecekan pelanggan sama sekali) ----
    def test_diskon_penjualan_tipe_pelanggan_ditegakkan(self):
        SalesDiscount.objects.create(
            tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True, minimal_total_pesanan=Decimal('1'),
            tipe_diskon='percent', jumlah_diskon=Decimal('20'), is_active=True,
            tipe_pelanggan='VIP TP Test',
        )
        nilai_vip, _ = promo_engine.evaluate_sales_discount(konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_vip))
        self.assertEqual(nilai_vip, Decimal('10000.00'))

        nilai_umum, _ = promo_engine.evaluate_sales_discount(konteks([baris(self.produk, 1, 50000)], pelanggan=self.pelanggan_umum))
        self.assertEqual(nilai_umum, Decimal('0'))

        nilai_tanpa_pelanggan, _ = promo_engine.evaluate_sales_discount(konteks([baris(self.produk, 1, 50000)], pelanggan=None))
        self.assertEqual(nilai_tanpa_pelanggan, Decimal('0'))

    def test_diskon_penjualan_kosong_tetap_berlaku_semua(self):
        """Backward compatible: tipe_pelanggan='' (default lama) tetap
        berlaku untuk semua pelanggan, termasuk tanpa pelanggan sama sekali."""
        SalesDiscount.objects.create(
            tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True, minimal_total_pesanan=Decimal('1'),
            tipe_diskon='percent', jumlah_diskon=Decimal('10'), is_active=True,
        )
        nilai, _ = promo_engine.evaluate_sales_discount(konteks([baris(self.produk, 1, 50000)], pelanggan=None))
        self.assertEqual(nilai, Decimal('5000.00'))


class PromosiPosDiOrderTests(APITestCase):
    """Promosi POS (DQ/DA) sekarang otomatis diterapkan ke Order juga
    (Antrean Online & Offline / Buat Order staff), bukan cuma POS Terminal."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_promo_order', password='x', role='owner')
        self.hari_ini = timezone.localdate()
        self.kategori = ProductCategory.objects.create(nama='Kategori Promo Order Test', key='test-kat-promo-order')
        self.product = Product.objects.create(
            nama='Produk Promo Order Test', kategori=self.kategori, sku='TEST-PROMO-ORDER-1',
        )
        self.contact = Contact.objects.create(nomor_wa='6281200004444', nama='Pelanggan Promo Order')

    def test_promosi_da_otomatis_terapkan_ke_order(self):
        POSPromotion.objects.create(
            judul='Promo DA Order', tipe_promosi='DA', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            jam_24=True, is_active=True, hari='min,sen,sel,rab,kam,jum,sab',
            min_total_transaksi=Decimal('50000'), tipe_diskon='percent', jumlah_diskon=Decimal('10'),
        )
        order = Order.objects.create(nomor_wa=self.contact.nomor_wa, nama='Pelanggan Promo Order', dilayani_oleh=self.owner)
        OrderItem.objects.create(order=order, jenis_produk='Banner', product=self.product, qty=1, harga_jual=100000)
        order.refresh_from_db()
        self.assertEqual(order.diskon_promo, 10000)
        self.assertEqual(order.total_harga, 90000)

    def test_promosi_da_di_bawah_ambang_tidak_terapkan(self):
        POSPromotion.objects.create(
            judul='Promo DA Order Ambang', tipe_promosi='DA', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            jam_24=True, is_active=True, hari='min,sen,sel,rab,kam,jum,sab',
            min_total_transaksi=Decimal('500000'), tipe_diskon='percent', jumlah_diskon=Decimal('10'),
        )
        order = Order.objects.create(nomor_wa=self.contact.nomor_wa, nama='Pelanggan Promo Order', dilayani_oleh=self.owner)
        OrderItem.objects.create(order=order, jenis_produk='Banner', product=self.product, qty=1, harga_jual=100000)
        order.refresh_from_db()
        self.assertEqual(order.diskon_promo, 0)
        self.assertEqual(order.total_harga, 100000)

    def test_promosi_bx_tidak_membuat_item_gratis_otomatis_di_order(self):
        """BX/FI sengaja tidak diotomasi di Order (butuh staf pilih produk
        gratis & validasi stok manual) -- diskon_promo tetap 0, tidak error."""
        produk_gratis = Product.objects.create(nama='Produk Gratis Promo Order', kategori=self.kategori, sku='TEST-PROMO-ORDER-GRATIS')
        promo = POSPromotion.objects.create(
            judul='Promo BX Order', tipe_promosi='BX', tanggal_aktif=self.hari_ini, tanpa_kadaluarsa=True,
            jam_24=True, is_active=True, hari='min,sen,sel,rab,kam,jum,sab',
            combine_qty=True, combine_qty_value=1, qty_gratis=1, berlaku_kelipatan=False,
        )
        promo.produk_qty = [{'nama': self.product.nama, 'qty': 1, 'product_id': self.product.pk}]
        promo.save()
        promo.produk_gratis.set([produk_gratis])

        order = Order.objects.create(nomor_wa=self.contact.nomor_wa, nama='Pelanggan Promo Order', dilayani_oleh=self.owner)
        OrderItem.objects.create(order=order, jenis_produk='Banner', product=self.product, qty=1, harga_jual=100000)
        order.refresh_from_db()
        self.assertEqual(order.diskon_promo, 0)
        self.assertEqual(order.items.count(), 1, 'Tidak boleh ada baris item gratis otomatis ditambahkan.')
