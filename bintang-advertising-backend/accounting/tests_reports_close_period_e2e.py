"""
accounting/tests_reports_close_period_e2e.py
T-611: Validasi laporan dan tutup buku end-to-end terhadap jurnal posted
nyata — bukan tiap laporan diuji terisolasi (sudah dicakup
tests_balance_sheet.py/tests_income_statement.py dkk), tapi SEMUA laporan
dicek SALING KONSISTEN dari kumpulan transaksi yang sama, lalu periode
ditutup dan dibuktikan mem-block posting baru tanpa merusak angka yang
sudah dilaporkan.
"""
from decimal import Decimal
from calendar import monthrange

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from api.models import CustomUser
from api.pos_models import POSSale
from api.product_models import Product
from accounting.models import (
    Account, AccountClassification, AccountType, AccountingPeriod,
    AccountingSettings, JournalEntry, PaymentMethod,
)
from accounting.services.journal import create_journal_entry
from accounting.services.ledger import (
    get_balance_sheet, get_income_statement, get_cash_flow,
    get_changes_in_equity, get_account_balances,
)
from accounting.services.period import close_accounting_period
from accounting.services.pos_posting import post_pos_sale_journal
from accounting.services.order_posting import post_order_payment_journal


class ReportsAndClosePeriodEndToEndTestCase(TestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username="owner_t611", password="pw", role="owner")

        asset_cls = AccountClassification.objects.create(
            name="Kas & Bank", account_type=AccountType.ASSET, code_range_start=11000, code_range_end=11999,
        )
        persediaan_cls = AccountClassification.objects.create(
            name="Persediaan", account_type=AccountType.ASSET, code_range_start=13000, code_range_end=13999,
        )
        rev_cls = AccountClassification.objects.create(
            name="Pendapatan", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999,
        )
        hpp_cls = AccountClassification.objects.create(
            name="Harga Pokok Penjualan", account_type=AccountType.EXPENSE, code_range_start=50000, code_range_end=50999,
        )
        equity_cls = AccountClassification.objects.create(
            name="Ekuitas", account_type=AccountType.EQUITY, code_range_start=30000, code_range_end=30999,
        )

        self.kas = Account.objects.create(
            code="11101", name="Kas T611", classification=asset_cls, account_type=AccountType.ASSET,
        )
        self.persediaan = Account.objects.create(
            code="13101", name="Persediaan T611", classification=persediaan_cls, account_type=AccountType.ASSET,
        )
        self.pendapatan = Account.objects.create(
            code="41101", name="Pendapatan T611", classification=rev_cls, account_type=AccountType.REVENUE,
        )
        self.hpp = Account.objects.create(
            code="51101", name="HPP T611", classification=hpp_cls, account_type=AccountType.EXPENSE,
        )
        self.modal = Account.objects.create(
            code="31101", name="Modal T611", classification=equity_cls, account_type=AccountType.EQUITY,
        )

        self.settings = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate().replace(day=1) - timezone.timedelta(days=60),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=self.pendapatan,
            pos_cogs_expense_account=self.hpp,
            pos_inventory_account=self.persediaan,
            order_sales_revenue_account=self.pendapatan,
        )

        self.pm_cash = PaymentMethod.objects.create(
            name="Tunai T611", payment_type="Tunai", account=self.kas, is_cash=True,
        )

        self.product = Product.objects.create(
            nama="Produk T611", sku="T611-001", harga_beli=Decimal("10000"),
            harga_jual_toko=Decimal("25000"), lacak_inventori=True, qty_stok=Decimal("50"),
        )

        today = timezone.localdate()
        self.period_start = today.replace(day=1)
        self.period_end = today.replace(day=monthrange(today.year, today.month)[1])
        self.opening_date = self.period_start - timezone.timedelta(days=1)  # bulan sebelumnya

    def _post_opening_equity(self, kas_amount, persediaan_amount):
        """Modal awal harus meng-cover saldo awal Persediaan juga — kalau tidak,
        HPP yang mengurangi Persediaan (T-107) akan membuatnya negatif dan
        tutup buku ditolak (guard T-629 bekerja benar, ini realistis)."""
        total = kas_amount + persediaan_amount
        return create_journal_entry(
            date=self.opening_date,
            lines=[
                {"account": self.kas, "debit": kas_amount, "kredit": Decimal("0"), "description": "Modal awal — kas"},
                {"account": self.persediaan, "debit": persediaan_amount, "kredit": Decimal("0"), "description": "Modal awal — persediaan"},
                {"account": self.modal, "debit": Decimal("0"), "kredit": total, "description": "Modal awal"},
            ],
            description="Setoran modal awal T611",
            source_type=JournalEntry.SourceType.OPENING_BALANCE,
            source_id=None,
            created_by=self.owner,
            status=JournalEntry.Status.POSTED,
        )

    def test_reports_reconcile_and_close_period_blocks_new_posting(self):
        # 1. Modal awal di bulan sebelumnya (saldo awal, bukan pergerakan periode ini):
        # kas 1.000.000 + persediaan 500.000 (supaya HPP T-107 tidak membuat Persediaan negatif)
        self._post_opening_equity(kas_amount=Decimal("1000000"), persediaan_amount=Decimal("500000"))

        # 2. POS sale hari ini: 1 unit produk (harga jual 25.000, HPP 10.000) — reuse T-107
        sale = POSSale.objects.create(
            nomor="POS-T611-0001", kasir=self.owner, subtotal=Decimal("25000"),
            total=Decimal("25000"), metode_bayar="Tunai T611", dibayar=Decimal("25000"),
            status="paid", accounting_payment_method=self.pm_cash,
        )
        from api.pos_models import POSSaleItem
        from api.product_models import ProductStockMovement
        from api import stock_fifo
        POSSaleItem.objects.create(
            sale=sale, product=self.product, nama_snapshot=self.product.nama,
            harga_snapshot=Decimal("25000"), qty=Decimal("1"), subtotal=Decimal("25000"),
        )
        movement = ProductStockMovement.objects.create(
            product=self.product, tipe="penjualan", qty=Decimal("1"),
            stok_awal=Decimal("50"), stok_akhir=Decimal("49"), pos_sale=sale,
            catatan=f"Penjualan POS {sale.nomor}", tanggal=self.period_start,
        )
        stock_fifo.consume_layers(self.product, None, Decimal("1"), movement=movement)
        sale.created_at = timezone.now()  # tetap hari ini, di dalam periode berjalan
        sale.save(update_fields=["created_at"])
        pos_entry = post_pos_sale_journal(sale, actor=self.owner)
        self.assertIsNotNone(pos_entry, "Posting POS harus berhasil (semua akun sudah dikonfigurasi)")

        # 3. Order payment hari ini: Rp150.000 tunai
        from api.models import Order, OrderActivityLog
        order = Order.objects.create(
            nomor_wa="081399988800", nama="Pelanggan T611", accounting_payment_method=self.pm_cash,
        )
        log = OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="PAYMENT", keterangan="test")
        order_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.owner, jumlah_bayar=Decimal("150000"),
        )
        self.assertIsNotNone(order_entry)

        # ── Validasi laporan SEBELUM tutup buku ──────────────────────────
        bs_before = get_balance_sheet(self.period_start, self.period_end)
        self.assertEqual(
            bs_before["total_aset"], bs_before["total_kewajiban_modal"],
            "Neraca harus balance: Total Aset = Total Kewajiban + Modal",
        )

        income = get_income_statement(self.period_start, self.period_end)
        # Pendapatan periode ini: 25.000 (POS) + 150.000 (Order) = 175.000; HPP: 10.000
        self.assertEqual(income["subtotal_pendapatan"], Decimal("175000.00"))
        self.assertEqual(income["subtotal_hpp"], Decimal("10000.00"))
        expected_laba = Decimal("175000.00") - Decimal("10000.00")
        self.assertEqual(income["laba_bersih"], expected_laba)

        equity = get_changes_in_equity(self.period_start, self.period_end)
        self.assertEqual(equity["modal_awal"], Decimal("1500000"))
        self.assertEqual(equity["total_laba"], expected_laba, "Laba di Perubahan Modal harus sama dgn Laba Rugi")
        self.assertEqual(equity["modal_akhir_periode"], Decimal("1500000") + expected_laba)

        cash_flow = get_cash_flow(self.period_start, self.period_end)
        actual_kas_balance = get_account_balances([self.kas], self.period_end)[self.kas.id]
        self.assertEqual(
            cash_flow["saldo_kas_akhir"], actual_kas_balance,
            "Arus Kas saldo akhir harus rekonsiliasi dengan saldo Kas riil dari ledger",
        )

        # Neraca modal (baris "Pendapatan periode ini") harus konsisten dengan Laba Rugi
        modal_periode_ini_row = next(r for r in bs_before["modal"] if r["id"] is None)
        self.assertEqual(modal_periode_ini_row["amount"], expected_laba)

        # ── Tutup Buku ────────────────────────────────────────────────────
        period = AccountingPeriod.objects.get(start_date=self.period_start, end_date=self.period_end)
        closed_period = close_accounting_period(period_id=period.id, actor=self.owner)
        self.assertEqual(closed_period.status, AccountingPeriod.Status.CLOSED)

        # Posting baru ke periode yang sudah closed HARUS ditolak (guard sudah
        # aktif otomatis di create_journal_entry, lihat T-612 desain poin 1)
        with self.assertRaises(ValidationError):
            create_journal_entry(
                date=self.period_start,
                lines=[
                    {"account": self.kas, "debit": Decimal("5000"), "kredit": Decimal("0"), "description": "x"},
                    {"account": self.pendapatan, "debit": Decimal("0"), "kredit": Decimal("5000"), "description": "x"},
                ],
                description="Percobaan posting ke periode closed",
                source_type=JournalEntry.SourceType.MANUAL,
                source_id=None,
                created_by=self.owner,
                status=JournalEntry.Status.POSTED,
            )

        # ── Validasi laporan SETELAH tutup buku: angka tidak berubah ─────
        bs_after = get_balance_sheet(self.period_start, self.period_end)
        self.assertEqual(bs_after["total_aset"], bs_before["total_aset"])
        self.assertEqual(bs_after["total_kewajiban_modal"], bs_before["total_kewajiban_modal"])
        self.assertEqual(
            bs_after["total_aset"], bs_after["total_kewajiban_modal"],
            "Neraca tetap balance setelah tutup buku (percobaan post yang ditolak tidak boleh merusak apa pun)",
        )
