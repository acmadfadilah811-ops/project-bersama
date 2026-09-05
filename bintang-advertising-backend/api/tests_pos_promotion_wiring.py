"""Regresi: Promosi (POS) (BX/DQ/DA/FI) harus benar-benar diterapkan saat
checkout kasir. Sebelum perbaikan ini, `promo_engine.evaluate_promotions()`
tidak pernah dipanggil dari `pos_services.create_sale` sama sekali — promosi
tersimpan & tampak aktif di menu Marketing tapi tidak pernah berdampak ke
transaksi kasir manapun (bug ditemukan & diperbaiki 2026-09-05, audit modul
Marketing)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.marketing_models import DiscountCoupon, POSPromotion
from api.pos_models import POSSale
from api.pos_services import create_sale, void_sale
from api.product_models import Product


class PosPromotionWiringTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='kasir_promo_wiring', password='secret', role='kasir',
        )
        self.produk_a = Product.objects.create(
            nama='Produk A Promo', harga_beli=10000, harga_jual_toko=50000,
            qty_stok=100, lacak_inventori=True,
        )
        self.produk_gratis = Product.objects.create(
            nama='Produk Gratis Promo', harga_beli=5000, harga_jual_toko=20000,
            qty_stok=10, lacak_inventori=True,
        )

    def _sale_paid(self, items, **extra):
        return create_sale(user=self.user, data={
            'items': items, 'status': 'paid', 'dibayar': 10_000_000,
            'metode_bayar': 'CASH', **extra,
        })

    def test_promo_da_memotong_total_saat_transaksi_memenuhi_ambang(self):
        POSPromotion.objects.create(
            judul='Diskon Belanja 100rb', tipe_promosi='DA',
            min_total_transaksi=Decimal('100000'), tipe_diskon='nominal', jumlah_diskon=Decimal('10000'),
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        sale = self._sale_paid([
            {'product_id': self.produk_a.id, 'qty': 3},
        ])
        self.assertEqual(sale.subtotal, Decimal('150000.00'))
        self.assertEqual(sale.diskon_promo, Decimal('10000.00'))
        self.assertEqual(sale.total, Decimal('140000.00'))

    def test_promo_tidak_menyala_di_bawah_ambang(self):
        POSPromotion.objects.create(
            judul='Diskon Belanja 100rb', tipe_promosi='DA',
            min_total_transaksi=Decimal('100000'), tipe_diskon='nominal', jumlah_diskon=Decimal('10000'),
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        sale = self._sale_paid([{'product_id': self.produk_a.id, 'qty': 1}])
        self.assertEqual(sale.diskon_promo, Decimal('0'))
        self.assertEqual(sale.total, Decimal('50000.00'))

    def test_promo_menumpuk_dengan_kupon(self):
        """Promosi (POS) adalah mekanisme terpisah dari Kupon/Diskon Penjualan —
        keduanya boleh berlaku bersamaan (desain Olsera)."""
        coupon = DiscountCoupon.objects.create(
            kode='STACK10', judul='Stack Test', tanggal_aktif=timezone.localdate(),
            tanpa_kadaluarsa=True, show_pos=True, tipe_diskon='nominal', jumlah_diskon=Decimal('5000'),
            all_customers=True, all_products=True, is_active=True,
        )
        POSPromotion.objects.create(
            judul='Diskon Belanja 100rb', tipe_promosi='DA',
            min_total_transaksi=Decimal('100000'), tipe_diskon='nominal', jumlah_diskon=Decimal('10000'),
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        sale = self._sale_paid(
            [{'product_id': self.produk_a.id, 'qty': 3}],
            metode_diskon='kupon', kupon_kode=coupon.kode,
        )
        self.assertEqual(sale.diskon_kupon, Decimal('5000.00'))
        self.assertEqual(sale.diskon_promo, Decimal('10000.00'))
        self.assertEqual(sale.total, Decimal('135000.00'))

    def test_promo_bx_membuat_item_gratis_dan_potong_stok(self):
        promo = POSPromotion.objects.create(
            judul='Beli A Gratis B', tipe_promosi='BX', combine_qty=False, combine_qty_value=1,
            produk_qty=[{'product_id': self.produk_a.id, 'qty': 1}],
            berlaku_membeli='semua', qty_gratis=1,
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        promo.produk_gratis.add(self.produk_gratis)

        stok_awal_gratis = self.produk_gratis.qty_stok
        sale = self._sale_paid([{'product_id': self.produk_a.id, 'qty': 1}])

        gratis_item = sale.items.get(is_gratis=True)
        self.assertEqual(gratis_item.product_id, self.produk_gratis.id)
        self.assertEqual(gratis_item.qty, Decimal('1.00'))
        self.assertEqual(gratis_item.harga_snapshot, Decimal('0.00'))
        self.assertEqual(gratis_item.subtotal, Decimal('0.00'))
        self.assertEqual(gratis_item.promo_id, promo.id)
        # Item gratis tidak menambah subtotal/nilai yang dibayar pelanggan.
        self.assertEqual(sale.subtotal, Decimal('50000.00'))

        self.produk_gratis.refresh_from_db()
        self.assertEqual(self.produk_gratis.qty_stok, stok_awal_gratis - 1)

    def test_promo_bx_produk_gratis_bervarian_dilewati_pemotongan_stok(self):
        """Batasan diketahui: produk_gratis cuma ManyToMany ke Product (bukan
        varian tertentu) — untuk produk dgn varian, stok TIDAK dipotong
        otomatis (tidak ada info varian mana yang digratiskan)."""
        self.produk_gratis.has_variant = True
        self.produk_gratis.save(update_fields=['has_variant'])
        promo = POSPromotion.objects.create(
            judul='Beli A Gratis B Varian', tipe_promosi='FI', qty_gratis=1,
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        promo.produk_gratis.add(self.produk_gratis)
        stok_awal = self.produk_gratis.qty_stok

        sale = self._sale_paid([{'product_id': self.produk_a.id, 'qty': 1}])

        gratis_item = sale.items.get(is_gratis=True)
        self.assertEqual(gratis_item.product_id, self.produk_gratis.id)
        self.produk_gratis.refresh_from_db()
        self.assertEqual(self.produk_gratis.qty_stok, stok_awal)

    def test_void_sale_mengembalikan_stok_item_gratis(self):
        promo = POSPromotion.objects.create(
            judul='Beli A Gratis B', tipe_promosi='FI', qty_gratis=2,
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        promo.produk_gratis.add(self.produk_gratis)
        stok_awal = self.produk_gratis.qty_stok

        sale = self._sale_paid([{'product_id': self.produk_a.id, 'qty': 1}])
        self.produk_gratis.refresh_from_db()
        self.assertEqual(self.produk_gratis.qty_stok, stok_awal - 2)

        void_sale(sale_id=sale.id, user=self.user)
        self.produk_gratis.refresh_from_db()
        self.assertEqual(self.produk_gratis.qty_stok, stok_awal)

    def test_preview_endpoint_pos_promotion(self):
        POSPromotion.objects.create(
            judul='Diskon Belanja 100rb', tipe_promosi='DA',
            min_total_transaksi=Decimal('100000'), tipe_diskon='nominal', jumlah_diskon=Decimal('10000'),
            tanggal_aktif=timezone.localdate(), tanpa_kadaluarsa=True, is_active=True,
        )
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/pos-promotions/preview/', {
            'subtotal': '150000',
            'items': [{'product_id': self.produk_a.id, 'qty': 3, 'harga': 50000}],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['diskon'], '10000.00')
