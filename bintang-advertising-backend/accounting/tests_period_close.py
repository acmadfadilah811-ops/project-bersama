from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounting.models import Account, AccountClassification, AccountingPeriod, AccountingLifecycleLog, JournalEntry
from accounting.services.period import close_accounting_period, close_all_open_periods, reopen_accounting_period
from accounting.services.journal import create_journal_entry

User = get_user_model()


class AccountingPeriodCloseTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="owner_user", email="owner@example.com", password="password123", nip="NIP-OWNER-001"
        )
        self.owner.role = "owner"
        self.owner.save()

        self.staff = User.objects.create_user(
            username="staff_user", email="staff@example.com", password="password123", nip="NIP-STAFF-001"
        )
        self.staff.role = "kasir"
        self.staff.is_staff = False
        self.staff.save()

        self.manager = User.objects.create_user(
            username="manager_user", email="manager@example.com", password="password123", nip="NIP-MANAGER-001"
        )
        self.manager.role = "manager"
        self.manager.is_staff = False
        self.manager.save()

        self.client = APIClient()
        self.start_date = date(2026, 7, 1)
        self.end_date = date(2026, 7, 31)

    def test_close_and_reopen_period_service(self):
        """Service: Kunci dan buka kembali periode akuntansi."""
        period = close_accounting_period(
            start_date=self.start_date, end_date=self.end_date, actor=self.owner
        )
        self.assertEqual(period.status, AccountingPeriod.Status.CLOSED)
        self.assertIsNotNone(period.closed_at)
        self.assertEqual(period.closed_by, self.owner)

        # Verified audit log created — model Action: STOP = close, START = reopen
        log = AccountingLifecycleLog.objects.filter(
            action=AccountingLifecycleLog.Action.STOP
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.owner)

        # Reopen
        reopened = reopen_accounting_period(
            start_date=self.start_date, end_date=self.end_date, actor=self.owner
        )
        self.assertEqual(reopened.status, AccountingPeriod.Status.OPEN)
        self.assertIsNone(reopened.closed_at)

        log_reopen = AccountingLifecycleLog.objects.filter(
            action=AccountingLifecycleLog.Action.START
        ).first()
        self.assertIsNotNone(log_reopen)
        self.assertEqual(log_reopen.actor, self.owner)

    def test_duplicate_close_period_request(self):
        """Service: Request tutup buku ganda pada periode yang sudah ditutup harus idempotent (T-612)."""
        p1 = close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        p2 = close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        self.assertEqual(p1.id, p2.id)
        self.assertEqual(p2.status, AccountingPeriod.Status.CLOSED)

    def test_close_period_rejected_when_active_account_has_negative_balance(self):
        kas_classification = AccountClassification.objects.create(
            name="Kas & Bank", account_type="asset", code_range_start=11000, code_range_end=11999,
        )
        expense_classification = AccountClassification.objects.create(
            name="Pengeluaran", account_type="expense", code_range_start=60000, code_range_end=69999,
        )
        kas = Account.objects.create(code="11101", name="Kas", account_type="asset", classification=kas_classification)
        biaya = Account.objects.create(code="60101", name="Biaya Test", account_type="expense", classification=expense_classification)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": biaya, "debit": Decimal("384000"), "kredit": 0},
                {"account": kas, "debit": 0, "kredit": Decimal("384000")},
            ],
            description="Kas minus untuk validasi tutup buku",
        )

        with self.assertRaisesMessage(ValidationError, "11101 - Kas: -384000"):
            close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)

        period = AccountingPeriod.objects.get(start_date=self.start_date, end_date=self.end_date)
        self.assertEqual(period.status, AccountingPeriod.Status.OPEN)
        self.assertIsNone(period.closed_at)

    def test_close_period_allowed_when_negative_account_flagged_ignore_minus_closing(self):
        """Akun ditandai ignore_minus_closing=True dikecualikan dari blokir saldo minus (T-629)."""
        kas_classification = AccountClassification.objects.create(
            name="Kas & Bank 2", account_type="asset", code_range_start=12000, code_range_end=12999,
        )
        expense_classification = AccountClassification.objects.create(
            name="Pengeluaran 2", account_type="expense", code_range_start=61000, code_range_end=69999,
        )
        transit = Account.objects.create(
            code="12101", name="Kas Transit", account_type="asset",
            classification=kas_classification, ignore_minus_closing=True,
        )
        biaya = Account.objects.create(code="61101", name="Biaya Test 2", account_type="expense", classification=expense_classification)
        create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": biaya, "debit": Decimal("50000"), "kredit": 0},
                {"account": transit, "debit": 0, "kredit": Decimal("50000")},
            ],
            description="Kas transit minus, ditandai diabaikan",
        )

        period = close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)
        self.assertEqual(period.status, AccountingPeriod.Status.CLOSED)

    def test_close_period_permission(self):
        """API Endpoint: Hanya staff/admin/owner yang bisa tutup buku."""
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            "/api/accounting/close-period/",
            {"start_date": "2026-07-01", "end_date": "2026-07-31", "confirm": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/accounting/close-period/",
            {"start_date": "2026-07-01", "end_date": "2026-07-31", "confirm": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["period"]["status"], "closed")

        self.client.force_authenticate(user=self.manager)
        res = self.client.post(
            "/api/accounting/close-period/",
            {"start_date": "2026-08-01", "end_date": "2026-08-31", "confirm": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_period_detail_returns_posted_journal_lines(self):
        asset_classification = AccountClassification.objects.create(
            name="Kas & Bank", account_type="asset", code_range_start=11000, code_range_end=11999,
        )
        revenue_classification = AccountClassification.objects.create(
            name="Pendapatan", account_type="revenue", code_range_start=40000, code_range_end=49999,
        )
        kas = Account.objects.create(code="11101", name="Kas", account_type="asset", classification=asset_classification)
        pendapatan = Account.objects.create(code="40001", name="Pendapatan Test", account_type="revenue", classification=revenue_classification)
        entry = create_journal_entry(
            date=self.end_date,
            lines=[
                {"account": kas, "debit": Decimal("25000"), "kredit": 0, "description": "Pembayaran dari AGUS"},
                {"account": pendapatan, "debit": 0, "kredit": Decimal("25000")},
            ],
            description="Pembayaran penjualan",
        )
        period = close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"/api/accounting/periods/{period.id}/detail/", {"page": 1, "page_size": 20})

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 2)
        self.assertEqual(res.data["results"][0]["entry_number"], entry.entry_number)
        self.assertEqual(res.data["results"][0]["account_code"], "11101")

    def test_posting_journal_blocked_on_closed_period(self):
        """Service: Posting jurnal baru pada periode yang dikunci harus ditolak (ValidationError)."""
        close_accounting_period(start_date=self.start_date, end_date=self.end_date, actor=self.owner)

        from accounting.models import Account, AccountClassification
        # Buat AccountClassification dan Account minimal jika belum ada
        classification, _ = AccountClassification.objects.get_or_create(
            name="ASET",
            defaults={"account_type": "asset", "code_range_start": 10000, "code_range_end": 19999},
        )
        acc1, _ = Account.objects.get_or_create(
            code="11100",
            defaults={"name": "Kas Test", "account_type": "asset", "classification": classification},
        )
        classification2, _ = AccountClassification.objects.get_or_create(
            name="PENDAPATAN",
            defaults={"account_type": "revenue", "code_range_start": 40000, "code_range_end": 49999},
        )
        acc2, _ = Account.objects.get_or_create(
            code="41100",
            defaults={"name": "Pendapatan Test", "account_type": "revenue", "classification": classification2},
        )

        with self.assertRaises(Exception):
            create_journal_entry(
                date=date(2026, 7, 15),
                lines=[
                    {"account": acc1, "debit": Decimal("100000"), "kredit": 0},
                    {"account": acc2, "debit": 0, "kredit": Decimal("100000")},
                ],
                description="Posting saat periode tertutup",
            )


class CloseAllOpenPeriodsTestCase(TestCase):
    """T-629 — tombol "Tutup Semua" (bulk close semua periode Terbuka yang sudah berakhir)."""

    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="owner_all", email="owner_all@example.com", password="password123", nip="NIP-OWNER-ALL"
        )
        self.owner.role = "owner"
        self.owner.save()

        self.staff = User.objects.create_user(
            username="staff_all", email="staff_all@example.com", password="password123", nip="NIP-STAFF-ALL"
        )
        self.staff.role = "kasir"
        self.staff.is_staff = False
        self.staff.save()

        self.client = APIClient()
        self.kas_cls = AccountClassification.objects.create(
            name="Kas & Bank All", account_type="asset", code_range_start=13000, code_range_end=13999,
        )
        self.pendapatan_cls = AccountClassification.objects.create(
            name="Pendapatan All", account_type="revenue", code_range_start=42000, code_range_end=42999,
        )
        self.expense_cls = AccountClassification.objects.create(
            name="Pengeluaran All", account_type="expense", code_range_start=62000, code_range_end=62999,
        )
        self.kas = Account.objects.create(code="13101", name="Kas All", account_type="asset", classification=self.kas_cls)

    def test_close_all_skips_current_ongoing_period(self):
        """Periode yang belum berakhir (end_date di masa depan) tidak ikut ditutup."""
        past_start, past_end = date(2026, 5, 1), date(2026, 5, 31)
        ongoing_start, ongoing_end = date(2026, 8, 1), date(2026, 8, 31)
        AccountingPeriod.objects.create(fiscal_year=2026, start_date=past_start, end_date=past_end, status=AccountingPeriod.Status.OPEN)
        AccountingPeriod.objects.create(fiscal_year=2026, start_date=ongoing_start, end_date=ongoing_end, status=AccountingPeriod.Status.OPEN)

        closed, failed = close_all_open_periods(actor=self.owner)

        self.assertEqual(len(failed), 0)
        closed_ranges = [(p.start_date, p.end_date) for p in closed]
        self.assertIn((past_start, past_end), closed_ranges)
        self.assertNotIn((ongoing_start, ongoing_end), closed_ranges)
        ongoing = AccountingPeriod.objects.get(start_date=ongoing_start, end_date=ongoing_end)
        self.assertEqual(ongoing.status, AccountingPeriod.Status.OPEN)

    def test_close_all_continues_after_one_period_fails(self):
        """Kegagalan satu periode (saldo minus) tidak menghentikan periode lain yang valid."""
        pendapatan = Account.objects.create(code="42101", name="Pendapatan Bersih", account_type="revenue", classification=self.pendapatan_cls)
        biaya = Account.objects.create(code="62101", name="Biaya Minus", account_type="expense", classification=self.expense_cls)

        clean_start, clean_end = date(2026, 3, 1), date(2026, 3, 31)
        bad_start, bad_end = date(2026, 4, 1), date(2026, 4, 30)
        AccountingPeriod.objects.create(fiscal_year=2026, start_date=clean_start, end_date=clean_end, status=AccountingPeriod.Status.OPEN)
        AccountingPeriod.objects.create(fiscal_year=2026, start_date=bad_start, end_date=bad_end, status=AccountingPeriod.Status.OPEN)

        create_journal_entry(
            date=clean_end,
            lines=[{"account": self.kas, "debit": Decimal("100000"), "kredit": 0}, {"account": pendapatan, "debit": 0, "kredit": Decimal("100000")}],
            description="Penjualan Maret",
        )
        create_journal_entry(
            date=bad_end,
            lines=[{"account": biaya, "debit": Decimal("500000"), "kredit": 0}, {"account": self.kas, "debit": 0, "kredit": Decimal("500000")}],
            description="Biaya April bikin Kas minus",
        )

        closed, failed = close_all_open_periods(fiscal_year=2026, actor=self.owner)

        self.assertEqual(len(closed), 1)
        self.assertEqual((closed[0].start_date, closed[0].end_date), (clean_start, clean_end))
        self.assertEqual(len(failed), 1)
        self.assertEqual((failed[0]["period"].start_date, failed[0]["period"].end_date), (bad_start, bad_end))
        self.assertIn("13101", failed[0]["reason"])

        bad_period = AccountingPeriod.objects.get(start_date=bad_start, end_date=bad_end)
        self.assertEqual(bad_period.status, AccountingPeriod.Status.OPEN)

    def test_close_all_endpoint_permission_and_response_shape(self):
        AccountingPeriod.objects.create(
            fiscal_year=2026, start_date=date(2026, 2, 1), end_date=date(2026, 2, 28), status=AccountingPeriod.Status.OPEN,
        )

        self.client.force_authenticate(user=self.staff)
        res = self.client.post("/api/accounting/periods/close-all/", {"confirm": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.owner)
        res = self.client.post("/api/accounting/periods/close-all/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        res = self.client.post("/api/accounting/periods/close-all/", {"confirm": True, "fiscal_year": 2026}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["closed_count"], 1)
        self.assertEqual(res.data["failed_count"], 0)
        self.assertEqual(res.data["closed"][0]["status"], "closed")
