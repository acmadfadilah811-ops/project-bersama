"""Nilai persediaan per tanggal untuk validasi tutup buku (audit 2026-10-06).

Dulu validasi membandingkan saldo Persediaan buku besar PER AKHIR PERIODE dengan
nilai stok HARI INI, sehingga periode yang sudah lewat tidak bisa ditutup bila ada
stok masuk sesudahnya -- dan karena tutup buku berurutan, semua periode terkunci."""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from accounting.services.period import get_computed_persediaan_value
from api.product_models import Product, ProductStockMovement, StockLayer, StockLayerConsumption


class PersediaanPerTanggalTests(TestCase):
    def setUp(self):
        self.hari_ini = timezone.localdate()
        self.batas = self.hari_ini - timedelta(days=5)
        self.p = Product.objects.create(nama="Kertas Uji", harga_beli=Decimal("100"), harga_jual_toko=Decimal("200"))
        # Lapisan A masuk sebelum batas (10 x 100), 4 terpakai SETELAH batas.
        self.a = StockLayer.objects.create(product=self.p, tanggal_masuk=self.hari_ini - timedelta(days=10),
                                           qty_masuk=10, sisa_qty=6, harga_beli=100)
        StockLayerConsumption.objects.create(layer=self.a, product=self.p, qty=4, harga_beli=100)
        # Lapisan B masuk hari ini (5 x 200).
        StockLayer.objects.create(product=self.p, tanggal_masuk=self.hari_ini, qty_masuk=5, sisa_qty=5, harga_beli=200)

    def test_tanpa_tanggal_sama_dengan_nilai_sekarang(self):
        self.assertEqual(get_computed_persediaan_value(), Decimal("1600"))
        self.assertEqual(get_computed_persediaan_value(self.hari_ini), Decimal("1600"))

    def test_per_tanggal_lampau_mengabaikan_masuk_dan_pakai_sesudahnya(self):
        # Per batas: lapisan A utuh (1000), lapisan B belum ada.
        self.assertEqual(get_computed_persediaan_value(self.batas), Decimal("1000"))

    def test_pemakaian_bertanggal_dokumen_sebelum_batas_tidak_ditambahkan_kembali(self):
        gerak = ProductStockMovement.objects.create(product=self.p, tipe="keluar", qty=2,
                                                    tanggal=self.batas - timedelta(days=1))
        StockLayerConsumption.objects.create(layer=self.a, product=self.p, movement=gerak, qty=2, harga_beli=100)
        StockLayer.objects.filter(pk=self.a.pk).update(sisa_qty=4)
        # Pemakaian 2 terjadi (tanggal dokumen) sebelum batas -> per batas tinggal 8 x 100.
        self.assertEqual(get_computed_persediaan_value(self.batas), Decimal("800"))
