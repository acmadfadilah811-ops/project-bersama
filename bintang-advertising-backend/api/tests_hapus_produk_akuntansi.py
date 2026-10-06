"""Produk/varian berstok atau berriwayat tidak boleh dihapus (audit akuntansi
2026-10-06): hapus produk dulu meng-CASCADE lapisan stok tanpa jurnal pembalik
sehingga Persediaan di buku besar tidak cocok dengan nilai stok."""
from datetime import date
from decimal import Decimal

from rest_framework.test import APITestCase

from .models import CustomUser
from .product_models import Product, ProductStockMovement, ProductVariant, StockLayer


class HapusProdukAkuntansiTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username='owner.hapus', password='x12345678', role='owner')
        self.client.force_authenticate(self.owner)

    def produk(self, nama, qty=0):
        return Product.objects.create(nama=nama, harga_beli=Decimal('1000'), harga_jual_toko=Decimal('2000'), qty_stok=qty)

    def test_produk_berstok_ditolak_lapisan_tetap(self):
        p = self.produk('Berstok', qty=5)
        StockLayer.objects.create(product=p, tanggal_masuk=date.today(), qty_masuk=5, sisa_qty=5, harga_beli=1000)
        res = self.client.delete(f'/api/products/{p.id}/')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn('masih memiliki stok', res.data['error'])
        self.assertTrue(StockLayer.objects.filter(product_id=p.id).exists())

    def test_produk_stok_nol_tapi_berriwayat_ditolak(self):
        p = self.produk('Berriwayat', qty=0)
        ProductStockMovement.objects.create(product=p, tipe=ProductStockMovement.TIPE_CHOICES[0][0], qty=1)
        res = self.client.delete(f'/api/products/{p.id}/')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn('riwayat', res.data['error'])
        self.assertTrue(Product.objects.filter(pk=p.id).exists())

    def test_produk_baru_tanpa_stok_dan_riwayat_boleh_dihapus(self):
        p = self.produk('Salah Ketik')
        self.assertEqual(self.client.delete(f'/api/products/{p.id}/').status_code, 204)
        self.assertFalse(Product.objects.filter(pk=p.id).exists())

    def test_varian_berstok_ditolak(self):
        p = self.produk('Induk Varian')
        v = ProductVariant.objects.create(product=p, nama_varian='A3', qty_stok=3, harga_beli=Decimal('1000'))
        res = self.client.delete(f'/api/product-variants/{v.id}/')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertTrue(ProductVariant.objects.filter(pk=v.id).exists())


class KoreksiSaldoAwalStokYatimTests(APITestCase):
    """Jurnal saldo awal stok yang produknya sudah terhapus dibalik dengan jurnal pembalik."""

    def setUp(self):
        from django.utils import timezone

        from accounting.models.coa import Account, AccountClassification
        from accounting.models.settings import AccountingSettings

        aset, _ = AccountClassification.objects.get_or_create(name="Aset Uji Yatim", defaults={"account_type": "asset", "order": 1})
        ekuitas, _ = AccountClassification.objects.get_or_create(name="Ekuitas Uji Yatim", defaults={"account_type": "equity", "order": 30})
        self.persediaan = Account.objects.get_or_create(code="11400", defaults={"name": "Persediaan", "account_type": "asset", "classification": aset})[0]
        self.ekuitas = Account.objects.create(code="3-YATIM", name="Saldo Awal Uji", account_type="equity", classification=ekuitas)
        AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate().replace(day=1),
            is_active=True, initial_setup_completed_at=timezone.now(),
            opening_balance_equity_account=self.ekuitas,
        )

    def saldo_persediaan(self):
        from django.db.models import Sum

        from accounting.models.journal import JournalEntryLine
        a = JournalEntryLine.objects.filter(journal_entry__status="posted", account=self.persediaan).aggregate(d=Sum("debit"), k=Sum("kredit"))
        return (a["d"] or 0) - (a["k"] or 0)

    def test_jurnal_produk_terhapus_dibalik_sekali_dan_produk_aktif_tidak(self):
        import io

        from django.core.management import call_command
        from django.utils import timezone

        from .product_views import catat_saldo_awal_stok

        hapus = Product.objects.create(nama="Akan Dihapus", harga_beli=Decimal("1000"), harga_jual_toko=Decimal("2000"))
        tetap = Product.objects.create(nama="Tetap Ada", harga_beli=Decimal("1000"), harga_jual_toko=Decimal("2000"))
        catat_saldo_awal_stok(hapus, None, Decimal("5"), Decimal("1000"), timezone.localdate(), None)
        catat_saldo_awal_stok(tetap, None, Decimal("2"), Decimal("1000"), timezone.localdate(), None)
        self.assertEqual(self.saldo_persediaan(), 7000)
        hapus.delete()  # meniru penghapusan lama (sebelum aturan baru)

        keluar = io.StringIO()
        call_command("koreksi_saldo_awal_stok_yatim", stdout=keluar)
        self.assertIn("1 jurnal akan dibalik", keluar.getvalue())
        self.assertEqual(self.saldo_persediaan(), 7000)  # rencana tidak mengubah apa pun

        call_command("koreksi_saldo_awal_stok_yatim", "--terapkan", stdout=io.StringIO())
        self.assertEqual(self.saldo_persediaan(), 2000)  # hanya produk yang masih ada
        call_command("koreksi_saldo_awal_stok_yatim", "--terapkan", stdout=io.StringIO())
        self.assertEqual(self.saldo_persediaan(), 2000)  # aman diulang
