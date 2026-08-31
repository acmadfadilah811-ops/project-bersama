"""AI Business Analyst.

Fokus: klasifikasi ABC/margin/stok lambat benar-benar dihitung dari data
POSSaleItem/ProductStockMovement/Product nyata, dan hanya owner/manager yang
boleh mengakses (sama seperti Dashboard Eksekutif).
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .pos_models import POSSale, POSSaleItem
from .product_models import Product, ProductCategory, ProductStockMovement

URL = '/api/ai-business-analyst/'


class AiBusinessAnalystTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir', password='x', role='kasir')

        self.kat_a = ProductCategory.objects.create(nama='Kategori Besar')
        self.kat_b = ProductCategory.objects.create(nama='Kategori Kecil')

        self.produk_a = Product.objects.create(
            nama='Produk Laris', kategori=self.kat_a,
            harga_beli=Decimal('40000'), harga_jual_toko=Decimal('100000'),
            qty_stok=Decimal('10'), lacak_inventori=True, stok_minimum=Decimal('2'),
        )
        self.produk_b = Product.objects.create(
            nama='Produk Sepi', kategori=self.kat_b,
            harga_beli=Decimal('5000'), harga_jual_toko=Decimal('10000'),
            qty_stok=Decimal('50'), lacak_inventori=True, stok_minimum=Decimal('2'),
        )

    def _jual(self, produk, total, hpp, hari_lalu=0):
        waktu = timezone.now() - timedelta(days=hari_lalu)
        sale = POSSale.objects.create(nomor=f'POS-{produk.id}-{total}-{hari_lalu}', total=Decimal(total), status='paid')
        POSSale.objects.filter(pk=sale.pk).update(created_at=waktu)
        POSSaleItem.objects.create(
            sale=sale, product=produk, nama_snapshot=produk.nama,
            harga_snapshot=Decimal(total), qty=Decimal('1'), subtotal=Decimal(total),
        )
        mov = ProductStockMovement.objects.create(
            product=produk, tipe='penjualan', qty=Decimal('1'),
            hpp_total=Decimal(hpp), stok_awal=Decimal('10'), stok_akhir=Decimal('9'),
        )
        ProductStockMovement.objects.filter(pk=mov.pk).update(created_at=waktu)
        return sale

    def test_kasir_tidak_boleh_melihat(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_periode_tidak_dikenal_ditolak_400(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(URL, {'period': 'sepanjang-masa'})
        self.assertEqual(res.status_code, 400)

    def test_abc_kategori_dan_margin_terhitung_benar(self):
        # Kategori Besar: 900.000 (90%) -> kelas A. Kategori Kecil: 100.000 (10%) -> kelas B/C.
        self._jual(self.produk_a, '900000', '360000')
        self._jual(self.produk_b, '100000', '50000')
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'period': 'ytd'}).json()

        modul = data['modul']['penjualan_produk']
        self.assertTrue(modul['tersedia'])
        abc = {r['kategori']: r for r in data['modul']['penjualan_produk']['abc_kategori']}
        self.assertEqual(abc['Kategori Besar']['kelas'], 'A')
        self.assertEqual(abc['Kategori Besar']['persen'], 90.0)

        margin = {r['kategori']: r for r in data['modul']['profitabilitas']['margin_kategori']}
        self.assertEqual(margin['Kategori Besar']['margin'], 540000.0)
        self.assertEqual(margin['Kategori Kecil']['margin'], 50000.0)

    def test_stok_lambat_terdeteksi_dari_tanggal_penjualan_terakhir(self):
        # Produk Sepi tidak pernah terjual sama sekali -> harus masuk stok lambat.
        # Produk Laris terjual hari ini -> tidak masuk stok lambat.
        self._jual(self.produk_a, '100000', '40000', hari_lalu=0)
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'period': 'ytd'}).json()

        stok = {r['kategori']: r for r in data['modul']['stok']['kategori']}
        self.assertEqual(stok['Kategori Kecil']['jumlah_stok_lambat'], 1)
        self.assertEqual(stok['Kategori Besar']['jumlah_stok_lambat'], 0)

    def test_modul_belum_dibangun_ditandai_jujur(self):
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'period': 'ytd'}).json()
        for kunci in ('pelanggan', 'keuangan', 'produksi', 'anomali', 'resep_bom', 'varian', 'tingkatan_harga'):
            self.assertFalse(data['modul'][kunci]['tersedia'])
            self.assertTrue(data['modul'][kunci]['alasan'])
