"""
accounting/tests_closing_entries.py
Test khusus fitur Jurnal Penutup tradisional (post_closing_entries /
_reverse_closing_entry di accounting/services/period.py) yang diminta owner
menggantikan tutup buku versi lama (yang cuma mengunci periode tanpa
memposting jurnal apa pun).
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from accounting.models import (
    Account,
    AccountClassification,
    AccountType,
    AccountingPeriod,
    AccountingSettings,
    JournalEntry,
)
from accounting.services.journal import create_journal_entry
from accounting.services.ledger import get_account_balances, get_balance_sheet
from accounting.services.period import (
    close_accounting_period,
    post_closing_entries,
    reopen_accounting_period,
)

User = get_user_model()


class ClosingEntriesTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner_ce", password="pw", role="owner")

        asset_cls = AccountClassification.objects.create(
            name="Aset CE", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999,
        )
        rev_cls = AccountClassification.objects.create(
            name="Pendapatan CE", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999,
        )
        exp_cls = AccountClassification.objects.create(
            name="Beban CE", account_type=AccountType.EXPENSE, code_range_start=60000, code_range_end=69999,
        )
        equity_cls = AccountClassification.objects.create(
            name="Ekuitas CE", account_type=AccountType.EQUITY, code_range_start=30000, code_range_end=39999,
        )

        self.kas = Account.objects.create(
            code="11001", name="Kas CE", classification=asset_cls, account_type=AccountType.ASSET,
        )
        self.pendapatan = Account.objects.create(
            code="41001", name="Pendapatan CE", classification=rev_cls, account_type=AccountType.REVENUE,
        )
        self.beban = Account.objects.create(
            code="61001", name="Beban CE", classification=exp_cls, account_type=AccountType.EXPENSE,
        )
        self.closing_acc = Account.objects.create(
            code="31001", name="Laba Ditahan CE", classification=equity_cls, account_type=AccountType.EQUITY,
        )

        self.start_date = date(2027, 1, 1)
        self.end_date = date(2027, 1, 31)

    def _make_settings(self, closing_account=None):
        return AccountingSettings.objects.create(
            accounting_start_date=date(2020, 1, 1),
            closing_account=closing_account,
        )

    def test_post_closing_entries_requires_closing_account_configured(self):
        """Fail-closed: tanpa closing_account diatur, tutup buku ditolak (bukan diam-diam skip)."""
        self._make_settings(closing_account=None)
        period = AccountingPeriod.objects.create(
            fiscal_year=2027, start_date=self.start_date, end_date=self.end_date,
            status=AccountingPeriod.Status.OPEN,
        )
        with self.assertRaisesMessage(ValidationError, "Akun Closing"):
            post_closing_entries(period=period, actor=self.owner)

    def test_post_closing_entries_zeroes_pl_accounts_and_credits_net_profit(self):
        """Untung: Pendapatan 100.000 - Beban 30.000 = laba bersih 70.000 dikredit ke Closing."""
        self._make_settings(closing_account=self.closing_acc)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": self.kas, "debit": Decimal("100000"), "kredit": Decimal("0")},
                {"account": self.pendapatan, "debit": Decimal("0"), "kredit": Decimal("100000")},
            ],
            description="Penjualan",
        )
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": self.beban, "debit": Decimal("30000"), "kredit": Decimal("0")},
                {"account": self.kas, "debit": Decimal("0"), "kredit": Decimal("30000")},
            ],
            description="Beban operasional",
        )

        # create_journal_entry() di atas sudah auto-vivify AccountingPeriod
        # untuk bulan ini (_get_or_create_period) -- pakai get_or_create di
        # sini juga supaya tidak bentrok unique (start_date, end_date).
        period, _ = AccountingPeriod.objects.get_or_create(
            start_date=self.start_date, end_date=self.end_date,
            defaults={"fiscal_year": 2027, "status": AccountingPeriod.Status.OPEN},
        )
        entry = post_closing_entries(period=period, actor=self.owner)

        self.assertIsNotNone(entry)
        self.assertEqual(entry.source_type, JournalEntry.SourceType.PERIOD_CLOSE)
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        # Total debit == total kredit (jurnal tetap balance)
        total_debit = sum((l.debit for l in entry.lines.all()), Decimal(0))
        total_kredit = sum((l.kredit for l in entry.lines.all()), Decimal(0))
        self.assertEqual(total_debit, total_kredit)

        # Pendapatan & Beban jadi nol setelah jurnal penutup
        balances = get_account_balances([self.pendapatan, self.beban, self.closing_acc], self.end_date)
        self.assertEqual(balances[self.pendapatan.id], Decimal("0"))
        self.assertEqual(balances[self.beban.id], Decimal("0"))
        # Laba bersih 70.000 masuk ke Closing (kredit, sesuai normal_balance ekuitas)
        self.assertEqual(balances[self.closing_acc.id], Decimal("70000"))

    def test_post_closing_entries_debits_net_loss(self):
        """Rugi: Beban 50.000 tanpa Pendapatan -- Closing di-debit (mengurangi Laba Ditahan)."""
        self._make_settings(closing_account=self.closing_acc)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": self.beban, "debit": Decimal("50000"), "kredit": Decimal("0")},
                {"account": self.kas, "debit": Decimal("0"), "kredit": Decimal("50000")},
            ],
            description="Beban tanpa pendapatan",
        )
        period, _ = AccountingPeriod.objects.get_or_create(
            start_date=self.start_date, end_date=self.end_date,
            defaults={"fiscal_year": 2027, "status": AccountingPeriod.Status.OPEN},
        )
        entry = post_closing_entries(period=period, actor=self.owner)
        self.assertIsNotNone(entry)

        balances = get_account_balances([self.beban, self.closing_acc], self.end_date)
        self.assertEqual(balances[self.beban.id], Decimal("0"))
        # Rugi 50.000 -- saldo kredit Closing turun jadi -50.000
        self.assertEqual(balances[self.closing_acc.id], Decimal("-50000"))

    def test_post_closing_entries_noop_when_no_pl_activity(self):
        """Tidak ada aktivitas Pendapatan/Beban -- tidak perlu jurnal penutup."""
        self._make_settings(closing_account=self.closing_acc)
        period = AccountingPeriod.objects.create(
            fiscal_year=2027, start_date=self.start_date, end_date=self.end_date,
            status=AccountingPeriod.Status.OPEN,
        )
        entry = post_closing_entries(period=period, actor=self.owner)
        self.assertIsNone(entry)
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.PERIOD_CLOSE).count(), 0
        )

    def test_post_closing_entries_idempotent(self):
        """Memanggil post_closing_entries 2x utk periode yang sama tidak membuat jurnal dobel."""
        self._make_settings(closing_account=self.closing_acc)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": self.kas, "debit": Decimal("100000"), "kredit": Decimal("0")},
                {"account": self.pendapatan, "debit": Decimal("0"), "kredit": Decimal("100000")},
            ],
            description="Penjualan",
        )
        period, _ = AccountingPeriod.objects.get_or_create(
            start_date=self.start_date, end_date=self.end_date,
            defaults={"fiscal_year": 2027, "status": AccountingPeriod.Status.OPEN},
        )
        entry1 = post_closing_entries(period=period, actor=self.owner)
        entry2 = post_closing_entries(period=period, actor=self.owner)
        self.assertEqual(entry1.id, entry2.id)
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.PERIOD_CLOSE).count(), 1
        )

    def test_reopen_reverses_closing_entry_and_reclose_posts_new_one(self):
        """Reopen membalikkan jurnal penutup; tutup ulang memposting jurnal penutup baru (bukan dianggap masih berlaku)."""
        self._make_settings(closing_account=self.closing_acc)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": self.kas, "debit": Decimal("100000"), "kredit": Decimal("0")},
                {"account": self.pendapatan, "debit": Decimal("0"), "kredit": Decimal("100000")},
            ],
            description="Penjualan",
        )

        period = close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        self.assertEqual(period.status, AccountingPeriod.Status.CLOSED)
        balances = get_account_balances([self.pendapatan, self.closing_acc], self.end_date)
        self.assertEqual(balances[self.pendapatan.id], Decimal("0"))
        self.assertEqual(balances[self.closing_acc.id], Decimal("100000"))

        reopened = reopen_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        self.assertEqual(reopened.status, AccountingPeriod.Status.OPEN)
        # Setelah reopen, jurnal penutup dibalik -- Pendapatan & Closing kembali ke saldo semula
        balances = get_account_balances([self.pendapatan, self.closing_acc], self.end_date)
        self.assertEqual(balances[self.pendapatan.id], Decimal("100000"))
        self.assertEqual(balances[self.closing_acc.id], Decimal("0"))

        # Tutup ulang -- harus memposting jurnal penutup BARU, bukan menganggap yang lama (sudah dibalik) masih berlaku
        reclosed = close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        self.assertEqual(reclosed.status, AccountingPeriod.Status.CLOSED)
        balances = get_account_balances([self.pendapatan, self.closing_acc], self.end_date)
        self.assertEqual(balances[self.pendapatan.id], Decimal("0"))
        self.assertEqual(balances[self.closing_acc.id], Decimal("100000"))

        active_closes = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.PERIOD_CLOSE,
            status=JournalEntry.Status.POSTED,
            reversed_entry__isnull=True,
        ).exclude(reversal_of__status=JournalEntry.Status.POSTED)
        self.assertEqual(active_closes.count(), 1, "Hanya boleh ada 1 jurnal penutup yang 'aktif' setelah reopen+reclose")

    def test_reopen_is_noop_when_no_closing_entry_exists(self):
        """Reopen periode yang belum pernah ditutup/tidak punya jurnal penutup tidak error."""
        self._make_settings(closing_account=self.closing_acc)
        period = AccountingPeriod.objects.create(
            fiscal_year=2027, start_date=self.start_date, end_date=self.end_date,
            status=AccountingPeriod.Status.CLOSED,
        )
        reopened = reopen_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        self.assertEqual(reopened.status, AccountingPeriod.Status.OPEN)
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.PERIOD_CLOSE).count(), 0
        )

    def test_balance_sheet_balances_regardless_of_date_from_after_close(self):
        """Bug lama: Neraca timpang tergantung date_from dipilih. Setelah tutup buku,
        Laba/Rugi Belum Ditutup harus 0 (sudah dipindah ke Closing) dan Neraca balance
        untuk SEMUA pilihan date_from, bukan cuma date_from == awal periode."""
        self._make_settings(closing_account=self.closing_acc)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": self.kas, "debit": Decimal("100000"), "kredit": Decimal("0")},
                {"account": self.pendapatan, "debit": Decimal("0"), "kredit": Decimal("100000")},
            ],
            description="Penjualan",
        )
        close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)

        for date_from in (self.start_date, self.start_date.replace(day=15), date(2020, 1, 1)):
            bs = get_balance_sheet(date_from, self.end_date)
            self.assertEqual(
                bs["total_aset"], bs["total_kewajiban_modal"],
                f"Neraca timpang untuk date_from={date_from}",
            )
            unclosed_row = next(r for r in bs["modal"] if r["id"] is None)
            self.assertEqual(unclosed_row["amount"], Decimal("0"), f"Laba belum ditutup harus 0 untuk date_from={date_from}")


class OrderConfirmedFilterTestCase(TestCase):
    """?confirmed=true di /api/orders/ -- kriteria sama dgn order_confirmed_q(),
    dipakai Daftar Piutang (sebelumnya bypass gate ini, T-... audit akuntansi 2026-09-08)."""

    def setUp(self):
        self.owner = User.objects.create_user(username="owner_ordconf", password="pw", role="owner")

    def test_confirmed_true_excludes_orders_without_dp_or_spk(self):
        from api.models import Order, OrderActivityLog
        from rest_framework.test import APIClient

        unconfirmed = Order.objects.create(nomor_wa="081300000001", nama="Belum Konfirmasi")
        paid = Order.objects.create(nomor_wa="081300000002", nama="Sudah DP", dp_dibayar=50000)
        spk = Order.objects.create(nomor_wa="081300000003", nama="SPK Terbit")
        OrderActivityLog.objects.create(order=spk, user=self.owner, tindakan="TERBITKAN_SPK", keterangan="x")

        client = APIClient()
        client.force_authenticate(user=self.owner)
        res = client.get("/api/orders/", {"confirmed": "true", "page_size": 100})
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data.get("results", res.data)}
        self.assertNotIn(unconfirmed.id, ids)
        self.assertIn(paid.id, ids)
        self.assertIn(spk.id, ids)

    def test_without_confirmed_param_returns_all(self):
        from api.models import Order
        from rest_framework.test import APIClient

        unconfirmed = Order.objects.create(nomor_wa="081300000004", nama="Belum Konfirmasi 2")

        client = APIClient()
        client.force_authenticate(user=self.owner)
        res = client.get("/api/orders/", {"page_size": 100})
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data.get("results", res.data)}
        self.assertIn(unconfirmed.id, ids)
