"""Qty dengan koma di kasir (produk Custom: qty = nominal / harga satuan), 2026-10-28."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from api.models import Contact
from api.pos_services import create_sale
from api.product_models import Product

User = get_user_model()


class PosQtyDesimalTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='kasir_qty_koma', password='x', role='owner')
        Contact.objects.create(nomor_wa='6281200011100', nama='Pelanggan Koma')
        self.produk = Product.objects.create(nama='CUSTOM ADV UJI', price_type='flat', harga_jual_toko=10000, lacak_inventori=False)

    def _jual(self, qty, dibayar=100000):
        return create_sale(user=self.user, data={
            'pelanggan': '6281200011100', 'status': 'paid', 'metode_bayar': 'Cash', 'dibayar': dibayar,
            'items': [{'product_id': self.produk.id, 'qty': qty}],
        })

    def test_qty_koma_total_sesuai_harga_kali_qty(self):
        sale = self._jual('3.75')
        self.assertEqual(sale.total, Decimal('37500.00'))
        self.assertEqual(sale.items.first().qty, Decimal('3.75'))

    def test_qty_lebih_dari_dua_desimal_dibulatkan_ke_dua_desimal(self):
        sale = self._jual('1.234')
        self.assertEqual(sale.items.first().qty, Decimal('1.23'))
        self.assertEqual(sale.total, Decimal('12300.00'))
