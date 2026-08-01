from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from api.models import Contact, SaldoKasHarian, POSPaymentMethod
from api.pos_models import POSSale
from api.pos_services import create_sale
from api.product_models import Product
from accounting.models import (
    Account, AccountClassification, AccountType, AccountingSettings,
    JournalEntry, PaymentMethod
)
from accounting.services.pos_posting import post_pos_sale_journal, should_post_sale
from accounting.services.settlement import get_settlement_batches, confirm_settlement_batches

User = get_user_model()


class POSPostingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="kasir1", password="password123", role="kasir"
        )
        self.shift = SaldoKasHarian.objects.create(
            kasir=self.user,
            tanggal=timezone.localdate(),
            kas_awal=Decimal("100000"),
            waktu_buka=timezone.now(),
        )
        self.customer = Contact.objects.create(nomor_wa="08123456789", nama="Pelanggan Umum")

        # Classifications
        self.asset_cls = AccountClassification.objects.create(
            name="Aset", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999
        )
        self.rev_cls = AccountClassification.objects.create(
            name="Pendapatan", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999
        )
        self.liab_cls = AccountClassification.objects.create(
            name="Kewajiban", account_type=AccountType.LIABILITY, code_range_start=20000, code_range_end=29999
        )

        # Accounts
        self.kas_account = Account.objects.create(
            code="11101", name="Kas Toko", classification=self.asset_cls
        )
        self.bank_account = Account.objects.create(
            code="11102", name="Bank BCA", classification=self.asset_cls
        )
        self.qris_transit_account = Account.objects.create(
            code="11201", name="Piutang QRIS", classification=self.asset_cls
        )
        self.revenue_account = Account.objects.create(
            code="41101", name="Pendapatan POS", classification=self.rev_cls
        )
        self.ppn_account = Account.objects.create(
            code="21201", name="PPN Keluaran", classification=self.liab_cls
        )

        # Settings
        self.settings = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=self.revenue_account,
            pos_ppn_output_account=self.ppn_account,
        )

        # Payment Methods
        self.pm_cash = PaymentMethod.objects.create(
            name="Tunai Fisik",
            payment_type="Tunai",
            account=self.kas_account,
            is_cash=True,
        )
        self.pm_qris = PaymentMethod.objects.create(
            name="QRIS BCA",
            payment_type="QRIS",
            account=self.qris_transit_account,
            is_cash=False,
        )

        # Master POS Payment Methods
        self.pos_pm_cash = POSPaymentMethod.objects.create(
            nama="Cash", tipe="Tunai", accounting_payment_method=self.pm_cash
        )
        self.pos_pm_qris = POSPaymentMethod.objects.create(
            nama="QRIS", tipe="QRIS", accounting_payment_method=self.pm_qris
        )

    def test_gating_and_posting_cash_sale(self):
        """Sale tunai: settlement_status='not_applicable', journal created with D Kas / K Revenue."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 50000,
                "items": [{"nama": "Cetak A4", "harga": 50000, "qty": 1}],
            },
        )

        self.assertEqual(sale.settlement_status, "not_applicable")
        self.assertEqual(sale.accounting_payment_method, self.pm_cash)

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        # Test balance (D == K)
        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 2)

        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, Decimal("50000.00"))
        self.assertEqual(total_kredit, Decimal("50000.00"))

    def test_idempotency_posting(self):
        """Memanggil post_pos_sale_journal dua kali mengembalikan entry yang sama."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 30000,
                "items": [{"nama": "Sticker", "harga": 30000, "qty": 1}],
            },
        )
        entry1 = post_pos_sale_journal(sale)
        entry2 = post_pos_sale_journal(sale)
        self.assertEqual(entry1.id, entry2.id)

    def test_sale_with_ppn(self):
        """Sale dengan PPN: 3 baris jurnal (D Transit/Kas, K Pendapatan, K PPN)."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "QRIS",
                "dibayar": 110000,
                "pajak_persen": 10,
                "items": [{"nama": "Spanduk Flexi", "harga": 100000, "qty": 1}],
            },
        )

        self.assertEqual(sale.settlement_status, "unsettled")
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry)

        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 3)

        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, Decimal("110000.00"))
        self.assertEqual(total_kredit, Decimal("110000.00"))

    def test_hold_sale_not_posted(self):
        """Sale 'hold' tidak diposting ke jurnal."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "hold",
                "metode_bayar": "Cash",
                "items": [{"nama": "Brosur", "harga": 20000, "qty": 1}],
            },
        )
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNone(entry)

    def test_non_cash_settlement_flow(self):
        """Non-tunai: transit terdebit saat sale, saldo transit 0 setelah settlement."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "QRIS",
                "dibayar": 200000,
                "items": [{"nama": "Banner Roll Up", "harga": 200000, "qty": 1}],
            },
        )
        self.assertEqual(sale.settlement_status, "unsettled")

        # Cek batch settlement
        tgl = timezone.localdate()
        batches = get_settlement_batches(date_from=tgl, date_to=tgl)
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0]["payment_method_id"], self.pm_qris.id)
        self.assertEqual(batches[0]["total_amount"], Decimal("200000.00"))

        # Confirm settlement
        entries = confirm_settlement_batches(
            batch_keys=[{"date": tgl, "payment_method_id": self.pm_qris.id}],
            bank_account_id=self.bank_account.id,
            actor=self.user,
        )
        self.assertEqual(len(entries), 1)

        sale.refresh_from_db()
        self.assertEqual(sale.settlement_status, "settled")

    def test_sale_with_ppn_missing_account_skips_posting(self):
        """Pajak > 0 tapi akun PPN belum diatur: sale sukses, posting di-skip via gating (bukan error 500)."""
        self.settings.pos_ppn_output_account = None
        self.settings.save()

        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 110000,
                "pajak_persen": 10,
                "items": [{"nama": "Spanduk Flexi", "harga": 100000, "qty": 1}],
            },
        )
        self.assertEqual(sale.status, "paid")
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNone(entry)

    def test_resolved_non_cash_pm_overrides_string_name(self):
        """Jika PaymentMethod ter-resolve dan is_cash=False, walau string 'Cash', settlement_status tetap 'unsettled'."""
        pm_non_cash_named_cash = PaymentMethod.objects.create(
            name="Bank Cash Account",
            payment_type="Bank",
            account=self.qris_transit_account,
            is_cash=False,
        )
        pos_pm_custom = POSPaymentMethod.objects.create(
            nama="Custom Cash Bank", tipe="Transfer", accounting_payment_method=pm_non_cash_named_cash
        )

        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Custom Cash Bank",
                "dibayar": 100000,
                "items": [{"nama": "Cetak Brosur", "harga": 100000, "qty": 1}],
            },
        )
        self.assertEqual(sale.accounting_payment_method, pm_non_cash_named_cash)
        self.assertEqual(sale.settlement_status, "unsettled")


class POSHppPostingTestCase(TestCase):
    """T-107: HPP penjualan POS (D HPP / K Persediaan) untuk produk berlacak inventori."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="kasir2", password="password123", role="kasir"
        )
        self.shift = SaldoKasHarian.objects.create(
            kasir=self.user,
            tanggal=timezone.localdate(),
            kas_awal=Decimal("100000"),
            waktu_buka=timezone.now(),
        )

        self.asset_cls = AccountClassification.objects.create(
            name="Aset", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999
        )
        self.rev_cls = AccountClassification.objects.create(
            name="Pendapatan", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999
        )
        self.exp_cls = AccountClassification.objects.create(
            name="Beban", account_type=AccountType.EXPENSE, code_range_start=50000, code_range_end=59999
        )

        self.kas_account = Account.objects.create(
            code="11101", name="Kas Toko", classification=self.asset_cls
        )
        self.revenue_account = Account.objects.create(
            code="41101", name="Pendapatan POS", classification=self.rev_cls
        )
        self.hpp_account = Account.objects.create(
            code="51101", name="Harga Pokok Penjualan", classification=self.exp_cls
        )
        self.persediaan_account = Account.objects.create(
            code="11301", name="Persediaan Barang Dagang", classification=self.asset_cls
        )

        self.settings = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=self.revenue_account,
        )

        self.pm_cash = PaymentMethod.objects.create(
            name="Tunai Fisik", payment_type="Tunai", account=self.kas_account, is_cash=True,
        )
        POSPaymentMethod.objects.create(nama="Cash", tipe="Tunai", accounting_payment_method=self.pm_cash)

        self.product = Product.objects.create(
            nama="Kertas A4 Rim",
            sku="KA4-001",
            harga_beli=Decimal("40000"),
            harga_jual_toko=Decimal("60000"),
            lacak_inventori=True,
            qty_stok=Decimal("100"),
        )

    def test_sale_with_inventory_product_posts_hpp_and_inventory_lines(self):
        """Produk berlacak inventori terjual: jurnal punya D HPP / K Persediaan tambahan, tetap balance."""
        self.settings.pos_cogs_expense_account = self.hpp_account
        self.settings.pos_inventory_account = self.persediaan_account
        self.settings.save()

        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 60000,
                "items": [{"product_id": self.product.id, "qty": 1}],
            },
        )

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry)

        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 4)

        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, total_kredit)

        hpp_lines = [l for l in lines if l.account_id == self.hpp_account.id]
        persediaan_lines = [l for l in lines if l.account_id == self.persediaan_account.id]
        self.assertEqual(len(hpp_lines), 1)
        self.assertEqual(len(persediaan_lines), 1)
        self.assertEqual(hpp_lines[0].debit, Decimal("40000.00"))
        self.assertEqual(persediaan_lines[0].kredit, Decimal("40000.00"))

        self.product.refresh_from_db()
        self.assertEqual(self.product.qty_stok, Decimal("99.00"))

    def test_sale_with_inventory_product_missing_hpp_account_skips_posting(self):
        """HPP muncul (produk berlacak inventori terjual) tapi akun HPP/Persediaan belum
        diatur: gating menolak seluruh posting (bukan posting jurnal timpang), sale tetap sukses."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 60000,
                "items": [{"product_id": self.product.id, "qty": 1}],
            },
        )
        self.assertEqual(sale.status, "paid")
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNone(entry)

    def test_sale_without_inventory_tracking_has_no_hpp_lines(self):
        """Item kustom (tanpa product_id) tidak memicu HPP — 2 baris seperti biasa, tanpa akun HPP diatur."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 25000,
                "items": [{"nama": "Jasa Desain", "harga": 25000, "qty": 1}],
            },
        )
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry)
        self.assertEqual(len(list(entry.lines.all())), 2)
