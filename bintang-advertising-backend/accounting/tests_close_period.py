import threading
import time
from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.utils import OperationalError
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounting.models import (
    Account,
    AccountClassification,
    AccountType,
    AccountingLifecycleLog,
    AccountingPeriod,
    JournalEntry,
)
from accounting.services.journal import create_journal_entry
from accounting.services.period import close_accounting_period, reopen_accounting_period

User = get_user_model()


class ClosePeriodTestCase(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_close", password="password123", role="owner"
        )
        self.manager = User.objects.create_user(
            username="mgr_close", password="password123", role="manager"
        )
        self.admin = User.objects.create_user(
            username="admin_close", password="password123", role="admin"
        )
        self.kasir = User.objects.create_user(
            username="kasir_close", password="password123", role="kasir"
        )

        self.asset_cls = AccountClassification.objects.create(
            name="Aset Close", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999
        )
        self.rev_cls = AccountClassification.objects.create(
            name="Pendapatan Close", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999
        )

        self.kas_acc = Account.objects.create(code="11001", name="Kas", classification=self.asset_cls)
        self.rev_acc = Account.objects.create(code="41001", name="Pendapatan", classification=self.rev_cls)

    def test_permission_matrix(self):
        """Owner dan Manager diizinkan (200), Admin dan Kasir ditolak (403)."""
        url = "/api/accounting/close-period/"
        payload = {"start_date": "2026-06-01", "end_date": "2026-06-30", "confirm": True}

        # Kasir -> 403
        self.client.force_authenticate(user=self.kasir)
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Admin -> 403
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Manager -> 200
        self.client.force_authenticate(user=self.manager)
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Owner -> 200 (idempotent)
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_close_requires_explicit_confirmation(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/accounting/close-period/",
            {"start_date": "2026-07-01", "end_date": "2026-07-31"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm", res.data["detail"])

    def test_posting_blocked_after_close(self):
        """Posting jurnal ke periode yang sudah CLOSED harus ditolak oleh ValidationError."""
        start_d = date(2026, 5, 1)
        end_d = date(2026, 5, 31)

        period = close_accounting_period(start_date=start_d, end_date=end_d, actor=self.owner)
        self.assertEqual(period.status, AccountingPeriod.Status.CLOSED)

        # Coba create_journal_entry di periode yang closed
        lines = [
            {"account": self.kas_acc, "debit": Decimal("100000"), "kredit": Decimal("0")},
            {"account": self.rev_acc, "debit": Decimal("0"), "kredit": Decimal("100000")},
        ]
        with self.assertRaises(ValidationError) as ctx:
            create_journal_entry(
                date=date(2026, 5, 15),
                lines=lines,
                description="Test Posting Closed Period",
                status=JournalEntry.Status.POSTED,
            )
        self.assertIn("sudah ditutup", str(ctx.exception))

    def test_draft_entries_block_close_period(self):
        """Tutup buku harus ditolak (400) jika masih ada JournalEntry berstatus DRAFT."""
        lines = [
            {"account": self.kas_acc, "debit": Decimal("50000"), "kredit": Decimal("0")},
            {"account": self.rev_acc, "debit": Decimal("0"), "kredit": Decimal("50000")},
        ]
        create_journal_entry(
            date=date(2026, 4, 10),
            lines=lines,
            description="Draft Entry",
            status=JournalEntry.Status.DRAFT,
        )

        self.client.force_authenticate(user=self.owner)
        res = self.client.post("/api/accounting/close-period/", {"start_date": "2026-04-01", "end_date": "2026-04-30", "confirm": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("DRAFT", res.data["detail"])

    def test_close_period_idempotency_and_audit(self):
        """Memanggil close-period 2x mengembalikan 200 OK dan mencatat closed_by serta closed_at."""
        self.client.force_authenticate(user=self.owner)
        payload = {"start_date": "2026-03-01", "end_date": "2026-03-31", "confirm": True}

        res1 = self.client.post("/api/accounting/close-period/", payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        res2 = self.client.post("/api/accounting/close-period/", payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        period = AccountingPeriod.objects.get(start_date="2026-03-01")
        self.assertEqual(period.status, AccountingPeriod.Status.CLOSED)
        self.assertEqual(period.closed_by, self.owner)
        self.assertIsNotNone(period.closed_at)


class ClosePeriodConcurrencyTestCase(TransactionTestCase):
    """
    T-612 (verifikasi manager 2026-08-01): desain approved eksplisit mewajibkan
    test 2 request close BERSAMAAN (concurrency), bukan cuma retry sequential
    (yang sudah dites di test_close_period_idempotency_and_audit /
    test_duplicate_close_period_request). Butuh TransactionTestCase (bukan
    TestCase/APITestCase) supaya tiap thread benar-benar dapat koneksi DB
    terpisah dan select_for_update() di close_accounting_period() teruji nyata,
    bukan cuma jalan di satu transaction test yang sama.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_concurrency", password="password123", role="owner"
        )

    def test_concurrent_close_requests_do_not_race(self):
        period = AccountingPeriod.objects.create(
            fiscal_year=2026,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            status=AccountingPeriod.Status.OPEN,
        )

        results = []
        errors = []

        def do_close():
            # SQLite (dev/test) tidak punya row-level lock sungguhan seperti
            # PostgreSQL (produksi) — dua koneksi tulis bersamaan bisa dapat
            # "database is locked" alih-alih antre di select_for_update().
            # Retry pendek di sini murni mengkompensasi keterbatasan SQLite,
            # BUKAN menyembunyikan bug: yang diuji tetap logika aplikasi
            # (idempotency + row-lock), bukan perilaku locking SQLite.
            client = APIClient()
            client.force_authenticate(user=self.owner)
            last_exc = None
            for attempt in range(20):
                try:
                    res = client.post(
                        f"/api/accounting/periods/{period.id}/close/",
                        {"confirm": True},
                        format="json",
                    )
                    results.append(res.status_code)
                    return
                except OperationalError as exc:
                    last_exc = exc
                    time.sleep(0.05 * (attempt + 1))
            errors.append(last_exc)

        threads = [threading.Thread(target=do_close) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(errors, [], f"Request close paralel melempar exception: {errors}")
        self.assertEqual(sorted(results), [200, 200], "Kedua request close paralel harus sukses (idempotent).")

        period.refresh_from_db()
        self.assertEqual(period.status, AccountingPeriod.Status.CLOSED)

        stop_logs = AccountingLifecycleLog.objects.filter(action=AccountingLifecycleLog.Action.STOP)
        self.assertEqual(
            stop_logs.count(), 1,
            "select_for_update() harus mencegah dua request close bersamaan sama-sama "
            "lolos idempotency check dan menulis log STOP dua kali.",
        )
