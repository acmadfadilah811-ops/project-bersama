"""Promosi POS per unit bisnis + kupon di Order lewat server (2026-09-27)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.marketing_models import CouponUsage, DiscountCoupon, POSPromotion
from api.models import Contact, Order, OrderItem, UnitBisnis
from api.product_models import Product
from api.promo_engine import BarisKeranjang, KonteksPromo, evaluate_promotions

User = get_user_model()


class PromosiUnitBisnisTest(APITestCase):
    def setUp(self):
        self.foto, _ = UnitBisnis.objects.get_or_create(nama='Star Foto Uji')
        self.adv, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising Uji')
        hari = timezone.localdate()
        self.khusus_foto = POSPromotion.objects.create(
            judul='Diskon Foto', tipe_promosi='DA', min_total_transaksi=0, tipe_diskon='nominal',
            jumlah_diskon=Decimal('5000'), tanggal_aktif=hari, unit_bisnis=self.foto)
        self.semua = POSPromotion.objects.create(
            judul='Diskon Semua', tipe_promosi='DA', min_total_transaksi=0, tipe_diskon='nominal',
            jumlah_diskon=Decimal('1000'), tanggal_aktif=hari)

    def _nilai(self, unit_id):
        konteks = KonteksPromo(baris=[BarisKeranjang(qty=Decimal('1'), harga=Decimal('100000'), subtotal=Decimal('100000'))],
                               subtotal=Decimal('100000'), unit_bisnis_id=unit_id)
        return sorted(d['judul'] for d in evaluate_promotions(konteks).diterapkan)

    def test_promosi_hanya_berlaku_di_unitnya(self):
        self.assertEqual(self._nilai(self.foto.id), ['Diskon Foto', 'Diskon Semua'])
        self.assertEqual(self._nilai(self.adv.id), ['Diskon Semua'])
        self.assertEqual(self._nilai(None), ['Diskon Semua'])

    def test_api_menyimpan_dan_menampilkan_unit(self):
        owner = User.objects.create_user(username='owner-promo', password='x', role='owner')
        self.client.force_authenticate(owner)
        res = self.client.get(f'/api/pos-promotions/{self.khusus_foto.id}/')
        self.assertEqual((res.data['unit_bisnis'], res.data['unit_bisnis_nama']), (self.foto.id, 'Star Foto Uji'))
        res = self.client.patch(f'/api/pos-promotions/{self.khusus_foto.id}/', {'unit_bisnis': self.adv.id}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.khusus_foto.refresh_from_db()
        self.assertEqual(self.khusus_foto.unit_bisnis_id, self.adv.id)


class KuponOrderTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner-kupon', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        Contact.objects.create(nomor_wa='628111', nama='Budi')
        self.produk = Product.objects.create(nama='Banner', harga_jual_toko=50000)
        self.kupon = DiscountCoupon.objects.create(
            kode='HEMAT10', judul='Hemat 10%', tanggal_aktif=timezone.localdate(), tipe_diskon='percent',
            jumlah_diskon=Decimal('10'), min_total_pesanan=Decimal('50000'), show_pos=True)
        self.order = Order.objects.create(id='ORD-KUPON-1', nomor_wa='628111', nama='Budi', status_global='proses')
        OrderItem.objects.create(order=self.order, product=self.produk, jenis_produk='Banner', qty=2, harga_jual=100000)
        self.order.refresh_from_db()

    def _patch(self, **data):
        return self.client.patch(f'/api/orders/{self.order.id}/', data, format='json')

    def test_kupon_dihitung_server_dan_tidak_dobel(self):
        res = self._patch(kupon_kode='hemat10', metode_diskon='kupon', diskon_kupon=99999)
        self.assertEqual(res.status_code, 200, res.content)
        self.order.refresh_from_db()
        self.assertEqual((self.order.kupon_id, self.order.diskon_kupon, self.order.total_harga), (self.kupon.id, 10000, 90000))
        self._patch(kupon_kode='HEMAT10', metode_diskon='kupon')
        self.assertEqual(CouponUsage.objects.filter(order=self.order).count(), 1)
        self.kupon.refresh_from_db()
        self.assertEqual(self.kupon.penggunaan_count, 1)

    def test_lepas_kupon_mengembalikan_total_dan_kuota(self):
        self._patch(kupon_kode='HEMAT10', metode_diskon='kupon')
        res = self._patch(kupon_kode=None, metode_diskon='tidak_ada', diskon_persen=0)
        self.assertEqual(res.status_code, 200, res.content)
        self.order.refresh_from_db()
        self.assertEqual((self.order.kupon_id, self.order.total_harga), (None, 100000))
        self.assertFalse(CouponUsage.objects.exists())

    def test_syarat_kupon_tidak_terpenuhi_ditolak_tanpa_perubahan(self):
        self.kupon.min_total_pesanan = Decimal('500000')
        self.kupon.save()
        res = self._patch(kupon_kode='HEMAT10', metode_diskon='kupon')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Minimal belanja', str(res.data))
        self.order.refresh_from_db()
        self.assertEqual((self.order.total_harga, self.order.kupon_id), (100000, None))

    def test_buat_order_tidak_mempercayai_nilai_kupon_browser(self):
        from api.models import CustomUser

        pelayan = CustomUser.objects.create_user(username='pelayan', password='x', role='staff')
        res = self.client.post('/api/orders/', {
            'nama': 'Sari', 'nomor_wa': '6282233334444', 'dilayani_oleh': pelayan.id, 'status_global': 'review',
            'metode_diskon': 'kupon', 'kupon_kode': 'HEMAT10', 'diskon_kupon': 99999,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        baru = Order.objects.get(pk=res.data['id'])
        self.assertEqual((baru.metode_diskon, baru.kupon_id), ('tidak_ada', None))
        self.assertFalse(CouponUsage.objects.filter(order=baru).exists())

    def test_batal_order_mengembalikan_kuota_kupon(self):
        from api.services.order_actions import batalkan_order

        self._patch(kupon_kode='HEMAT10', metode_diskon='kupon')
        batalkan_order(Order.objects.get(pk=self.order.id), actor=self.owner, alasan='uji')
        self.assertFalse(CouponUsage.objects.filter(order=self.order).exists())
        self.kupon.refresh_from_db()
        self.assertEqual(self.kupon.penggunaan_count, 0)
