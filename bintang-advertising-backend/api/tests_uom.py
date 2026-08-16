"""uom.resolve() — konversi satuan alternatif (Multi Satuan/UOM).

Bug ditemukan 2026-08-13: toggle per-produk `Product.uom_enabled` (tab
Satuan di detail produk) tersimpan tapi tidak pernah dicek di sini — hanya
gerbang global (SystemConfig `uom_multi_enabled`) yang benar-benar
menentukan apakah konversi jalan. Akibatnya produk dengan toggle-nya
sendiri mati (default False) tetap bisa ikut terkonversi kalau global aktif
dan caller mengirim `uom_kode` langsung tanpa lewat UI POS yang sudah benar
mengecek keduanya (mis. import CSV stock-in/out/opname)."""
from decimal import Decimal

from django.test import TestCase

from . import uom
from .models import SystemConfig
from .product_models import Product


class ResolveUomTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            nama='Kertas A4', satuan='lembar', uom_enabled=True,
            uom_units=[{'id': '1', 'kode_satuan': 'RIM', 'konverter': 500, 'variant_id': 'all'}],
        )

    def _aktifkan_global(self, aktif=True):
        SystemConfig.objects.update_or_create(
            key=uom.UOM_ENABLED_KEY, defaults={'value': 'true' if aktif else 'false'},
        )

    def test_konversi_jalan_saat_global_dan_produk_aktif(self):
        self._aktifkan_global(True)
        hasil = uom.resolve(self.product, 'RIM', 2, harga_satuan=Decimal('100000'))
        self.assertEqual(hasil['qty_dasar'], Decimal('1000'))
        self.assertEqual(hasil['uom_kode'], 'RIM')
        self.assertEqual(hasil['uom_konverter'], Decimal('500'))

    def test_konversi_diabaikan_kalau_toggle_produk_mati(self):
        # Regresi bug: sebelum fix, ini tetap terkonversi karena resolve()
        # cuma cek gerbang global, bukan product.uom_enabled.
        self._aktifkan_global(True)
        self.product.uom_enabled = False
        self.product.save()
        hasil = uom.resolve(self.product, 'RIM', 2, harga_satuan=Decimal('100000'))
        self.assertEqual(hasil['qty_dasar'], Decimal('2'))
        self.assertEqual(hasil['uom_kode'], '')
        self.assertEqual(hasil['uom_konverter'], Decimal('1'))

    def test_konversi_diabaikan_kalau_gerbang_global_mati(self):
        self._aktifkan_global(False)
        hasil = uom.resolve(self.product, 'RIM', 2, harga_satuan=Decimal('100000'))
        self.assertEqual(hasil['qty_dasar'], Decimal('2'))
        self.assertEqual(hasil['uom_kode'], '')

    def test_tanpa_kode_selalu_diabaikan(self):
        self._aktifkan_global(True)
        hasil = uom.resolve(self.product, '', 2, harga_satuan=Decimal('100000'))
        self.assertEqual(hasil['qty_dasar'], Decimal('2'))
        self.assertEqual(hasil['uom_kode'], '')
