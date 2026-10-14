"""Qty diisi dari form edit untuk produk yang belum pernah punya stok = Saldo Awal
(jurnal Persediaan / Saldo Awal ekuitas), bukan selisih opname (2026-10-14).
Produk yang sudah punya riwayat tetap lewat Stok Opname otomatis."""
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CustomUser
from .product_models import Product, ProductActivityLog, ProductStockMovement, ProductVariant, StockLayer, StockOpnameDocument


class IsiStokPertamaTests(APITestCase):
    def setUp(self):
        from accounting.models.coa import Account, AccountClassification
        from accounting.models.settings import AccountingSettings

        aset, _ = AccountClassification.objects.get_or_create(name="Aset Uji Stok", defaults={"account_type": "asset", "order": 1})
        ekuitas, _ = AccountClassification.objects.get_or_create(name="Ekuitas Uji Stok", defaults={"account_type": "equity", "order": 30})
        self.persediaan = Account.objects.get_or_create(code="11400", defaults={"name": "Persediaan", "account_type": "asset", "classification": aset})[0]
        self.ekuitas = Account.objects.create(code="3-STOKAWAL", name="Saldo Awal Uji", account_type="equity", classification=ekuitas)
        beban, _ = AccountClassification.objects.get_or_create(name="Beban Uji Stok", defaults={"account_type": "expense", "order": 60})
        Account.objects.get_or_create(code="81000", defaults={"name": "Penyesuaian Barang", "account_type": "expense", "classification": beban})
        AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate().replace(day=1),
            is_active=True, initial_setup_completed_at=timezone.now(),
            opening_balance_equity_account=self.ekuitas,
        )
        self.owner = CustomUser.objects.create_user(username='owner.stokawal', password='x12345678', role='owner')
        self.client.force_authenticate(self.owner)

    def saldo(self, akun):
        from accounting.models.journal import JournalEntryLine
        a = JournalEntryLine.objects.filter(journal_entry__status="posted", account=akun).aggregate(d=Sum("debit"), k=Sum("kredit"))
        return (a["d"] or 0) - (a["k"] or 0)

    def test_produk_kosong_diisi_jadi_saldo_awal(self):
        p = Product.objects.create(nama='Pigura 10R', harga_beli=Decimal('15000'), harga_jual_toko=Decimal('30000'), lacak_inventori=True)
        res = self.client.patch(f'/api/products/{p.id}/', {'qty_stok': 4}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        p.refresh_from_db()
        self.assertEqual(p.qty_stok, 4)
        mv = ProductStockMovement.objects.get(product=p)
        self.assertEqual(mv.tipe, 'saldo_awal')
        self.assertEqual(StockLayer.objects.get(product=p).sisa_qty, 4)
        self.assertEqual(self.saldo(self.persediaan), 60000)
        self.assertEqual(self.saldo(self.ekuitas), -60000)
        self.assertFalse(StockOpnameDocument.objects.exists())
        self.assertTrue(ProductActivityLog.objects.filter(product=p, aksi__icontains='stok awal').exists())

    def test_produk_berriwayat_tetap_lewat_opname(self):
        p = Product.objects.create(nama='Album', harga_beli=Decimal('20000'), harga_jual_toko=Decimal('50000'), lacak_inventori=True)
        self.client.patch(f'/api/products/{p.id}/', {'qty_stok': 2}, format='json')  # saldo awal
        res = self.client.patch(f'/api/products/{p.id}/', {'qty_stok': 5}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        p.refresh_from_db()
        self.assertEqual(p.qty_stok, 5)
        self.assertEqual(StockOpnameDocument.objects.count(), 1)
        self.assertEqual(ProductStockMovement.objects.filter(product=p, tipe='saldo_awal').count(), 1)

    def test_varian_kosong_diisi_jadi_saldo_awal(self):
        p = Product.objects.create(nama='Pigura', harga_beli=Decimal('0'), harga_jual_toko=Decimal('0'), has_variant=True, lacak_inventori=True)
        v = ProductVariant.objects.create(product=p, nama_varian='8R', harga_beli=Decimal('10000'), lacak_inventori=True)
        res = self.client.patch(f'/api/product-variants/{v.id}/', {'qty_stok': 3}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        v.refresh_from_db()
        self.assertEqual(v.qty_stok, 3)
        self.assertEqual(ProductStockMovement.objects.get(variant=v).tipe, 'saldo_awal')
        self.assertEqual(self.saldo(self.persediaan), 30000)
        self.assertTrue(ProductActivityLog.objects.filter(product=p, aksi__icontains="varian '8R'").exists())
