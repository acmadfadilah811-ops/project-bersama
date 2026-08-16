"""Regresi penjualan paket melalui POS dan antrean WA/admin."""
from unittest.mock import patch

from rest_framework.test import APITestCase

from api.models import CustomUser, Order, OrderItem
from api.marketing_models import DiscountCoupon
from api.pos_models import POSSaleItem
from api.product_models import Product, ProductPackage, ProductPackageItem
from api.promo_engine import BarisKeranjang, KonteksPromo, evaluate_coupon_code
from api.report_views import rpt_penjualan_paket, rpt_sisa_paket


class PackageSalesTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_paket', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.product = Product.objects.create(
            nama='Komponen Paket', harga_beli=10000, harga_jual_toko=40000,
            qty_stok=10, lacak_inventori=True,
        )
        self.package = ProductPackage.objects.create(
            nama='Paket Promosi', sku='PKT-PROMO', harga_jual_offline=60000,
            harga_jual_online=70000, publikasi=True, tampil_pos=True,
        )
        ProductPackageItem.objects.create(paket=self.package, product=self.product, qty=2)

    @patch('accounting.services.pos_posting.post_pos_sale_journal')
    def test_pos_menyimpan_paket_dan_memotong_stok_komponen(self, post_journal):
        response = self.client.post('/api/pos/sales/', {
            'items': [{'package_id': self.package.id, 'qty': 2}],
            'status': 'paid', 'dibayar': 120000, 'metode_bayar': 'tunai',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.content)
        item = POSSaleItem.objects.get(sale_id=response.data['id'])
        self.assertEqual(item.paket_id, self.package.id)
        self.assertIsNone(item.product_id)
        self.assertEqual(item.harga_snapshot, 60000)
        self.assertEqual(item.subtotal, 120000)
        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, 6)
        post_journal.assert_called_once()

    def test_order_wa_mengunci_harga_master_paket_dan_masuk_laporan(self):
        order = Order.objects.create(
            id='ORD-WA-PAKET', nama='Pelanggan WA', nomor_wa='081234567890', sumber='wa',
        )
        response = self.client.post('/api/order-items/', {
            'order': order.id, 'paket': self.package.id, 'qty': 2,
            'jenis_produk': 'Harga dari browser', 'harga_jual': 1,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.content)
        item = OrderItem.objects.get(pk=response.data['id'])
        self.assertEqual(item.paket_id, self.package.id)
        self.assertIsNone(item.product_id)
        self.assertEqual(item.jenis_produk, self.package.nama)
        self.assertEqual(item.harga_jual, 140000)

        report = rpt_penjualan_paket({'start': None, 'end': None})
        self.assertEqual(report['rows'][0]['nama'], self.package.nama)
        self.assertEqual(report['rows'][0]['qty_jual'], 2)
        self.assertEqual(report['rows'][0]['total_jual'], 140000)

    def test_order_item_via_api_menolak_qty_nol_untuk_produk_biasa(self):
        # Sebelum diperbaiki: OrderItemSerializer.validate() cuma cek qty
        # kalau ada paket — item produk biasa (non-paket) lolos dengan qty 0
        # dan mencemari pencatatan inventori/akuntansi & pergerakan stok.
        order = Order.objects.create(nomor_wa="081234567890", nama="Jane")
        response = self.client.post('/api/order-items/', {
            'order': order.id, 'product': self.product.id, 'qty': 0,
            'jenis_produk': self.product.nama, 'harga_jual': 40000,
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('qty', response.data)
        self.assertEqual(order.items.count(), 0)

    def test_order_item_via_api_menolak_qty_nol_untuk_paket(self):
        order = Order.objects.create(nomor_wa="081234567891", nama="Jane 2")
        response = self.client.post('/api/order-items/', {
            'order': order.id, 'paket': self.package.id, 'qty': 0,
            'jenis_produk': self.package.nama, 'harga_jual': 1,
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(order.items.count(), 0)

    def test_sisa_paket_dihitung_dari_komponen_terendah(self):
        report = rpt_sisa_paket({'start': None, 'end': None})
        row = next(row for row in report['rows'] if row['nama'] == self.package.nama)
        self.assertEqual(row['qty'], 5)

    def test_kupon_yang_menargetkan_paket_hanya_mencocokkan_paketnya(self):
        coupon = DiscountCoupon.objects.create(
            kode='PKT10', judul='Diskon Paket', tipe_diskon='percent', jumlah_diskon=10,
            all_customers=True, all_products=False, all_brands=True, all_packages=False,
            show_pos=True, is_active=True,
        )
        coupon.paket_produk.add(self.package)
        result = evaluate_coupon_code('PKT10', KonteksPromo(
            baris=[BarisKeranjang(package=self.package, qty=1, harga=60000, subtotal=60000)],
            subtotal=60000,
        ))
        self.assertTrue(result.ok, result.alasan)
        self.assertEqual(result.diskon, 6000)
