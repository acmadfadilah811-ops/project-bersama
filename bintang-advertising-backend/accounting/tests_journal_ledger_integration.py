from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, AccountingSettings, JournalEntry
from accounting.services.journal import create_journal_entry
from accounting.services.ledger import get_account_line_history, get_account_movements
from django.contrib.auth import get_user_model


User = get_user_model()


class JournalLedgerRealDataTestCase(TestCase):
    """Membuktikan Jurnal Umum dan Buku Besar membaca JournalEntry asli."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="journal_ledger_owner", password="password123", role="owner"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        asset_cls = AccountClassification.objects.create(
            name="Kas & Bank Test", account_type="asset",
            code_range_start=10000, code_range_end=19999,
        )
        revenue_cls = AccountClassification.objects.create(
            name="Pendapatan Test", account_type="revenue",
            code_range_start=40000, code_range_end=49999,
        )
        self.cash = Account.objects.create(
            code="11991", name="Kas Integrasi Test", account_type="asset",
            classification=asset_cls,
        )
        self.revenue = Account.objects.create(
            code="41991", name="Pendapatan Integrasi Test", account_type="revenue",
            classification=revenue_cls,
        )
        AccountingSettings.objects.create(
            accounting_start_date=date.today(),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
        )

    def test_posted_entry_flows_to_journal_and_ledger(self):
        entry = create_journal_entry(
            date=date.today(),
            lines=[
                {"account": self.cash, "debit": Decimal("125000"), "kredit": 0},
                {"account": self.revenue, "debit": 0, "kredit": Decimal("125000")},
            ],
            description="INTEGRATION-REAL-JOURNAL",
            created_by=self.user,
        )

        journal_response = self.client.get(
            "/api/accounting/journal-entries/",
            {"date_from": str(date.today()), "date_to": str(date.today()), "search": entry.entry_number},
        )
        self.assertEqual(journal_response.status_code, 200)
        self.assertEqual(len(journal_response.data), 1)
        self.assertEqual(
            Decimal(str(journal_response.data[0]["lines"][0]["debit"])),
            Decimal("125000"),
        )

        movements = get_account_movements([self.cash, self.revenue], date.today(), date.today())
        self.assertEqual(movements[self.cash.id]["debit"], Decimal("125000"))
        self.assertEqual(movements[self.revenue.id]["kredit"], Decimal("125000"))

        history = get_account_line_history(self.cash, date.today(), date.today())
        self.assertEqual(len(history["rows"]), 1)
        self.assertEqual(history["rows"][0]["entry_number"], entry.entry_number)

        ledger_response = self.client.get(
            "/api/accounting/ledger/",
            {"date_from": str(date.today()), "date_to": str(date.today()), "search": self.cash.code},
        )
        self.assertEqual(ledger_response.status_code, 200)
        self.assertEqual(len(ledger_response.data), 1)
        self.assertEqual(
            Decimal(str(ledger_response.data[0]["debit"])), Decimal("125000")
        )

    def test_journal_detail_returns_all_pair_lines_and_processor(self):
        entry = create_journal_entry(
            date=date.today(),
            lines=[
                {"account": self.cash, "debit": Decimal("75000"), "kredit": 0, "description": "Penjualan dari POS"},
                {"account": self.revenue, "debit": 0, "kredit": Decimal("75000"), "description": "Penjualan dari POS"},
            ],
            description="Pembayaran penjualan",
            source_type=JournalEntry.SourceType.POS_SALE,
            created_by=self.user,
        )

        response = self.client.get(f"/api/accounting/journal-entries/{entry.entry_number}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source_type_label"], "Penjualan POS")
        self.assertEqual(response.data["processed_by_name"], self.user.username)
        self.assertEqual(len(response.data["lines"]), 2)
        self.assertEqual(response.data["lines"][0]["account_code"], self.cash.code)
        self.assertEqual(Decimal(str(response.data["lines"][1]["kredit"])), Decimal("75000"))

    def test_manual_multi_journal_api_posts_balanced_lines(self):
        response = self.client.post(
            "/api/accounting/journal-entries/",
            {
                "date": str(date.today()),
                "source_type": "manual",
                "description": "MULTI-JOURNAL-FORM",
                "lines": [
                    {"account": self.cash.id, "debit": "100000", "kredit": "0", "description": "Kas"},
                    {"account": self.revenue.id, "debit": "0", "kredit": "70000", "description": "Pendapatan"},
                    {"account": self.revenue.id, "debit": "0", "kredit": "30000", "description": "Pendapatan lain"},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["description"], "MULTI-JOURNAL-FORM")
        self.assertEqual(len(response.data["lines"]), 3)
        self.assertEqual(
            sum(Decimal(str(line["debit"])) for line in response.data["lines"]),
            sum(Decimal(str(line["kredit"])) for line in response.data["lines"]),
        )

    def test_manual_single_journal_api_posts_pair_accounts(self):
        response = self.client.post(
            "/api/accounting/journal-entries/",
            {
                "date": str(date.today()),
                "source_type": "manual",
                "description": "SINGLE-JOURNAL-FORM",
                "external_document_no": "SJF-001",
                "amount": "125000",
                "debit_account": self.cash.id,
                "kredit_account": self.revenue.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["description"], "SINGLE-JOURNAL-FORM")
        self.assertEqual(len(response.data["lines"]), 2)
        self.assertEqual(Decimal(str(response.data["lines"][0]["debit"])), Decimal("125000"))
        self.assertEqual(Decimal(str(response.data["lines"][1]["kredit"])), Decimal("125000"))

    def test_order_payment_source_ids_filter_returns_its_real_journal(self):
        order_entry = create_journal_entry(
            date=date.today(),
            lines=[
                {"account": self.cash, "debit": Decimal("25000"), "kredit": 0},
                {"account": self.revenue, "debit": 0, "kredit": Decimal("25000")},
            ],
            description="Pembayaran Order 123",
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            source_id=98765,
            created_by=self.user,
        )
        create_journal_entry(
            date=date.today(),
            lines=[
                {"account": self.cash, "debit": Decimal("10000"), "kredit": 0},
                {"account": self.revenue, "debit": 0, "kredit": Decimal("10000")},
            ],
            description="Jurnal manual lain",
            source_type=JournalEntry.SourceType.MANUAL,
            source_id=98765,
            created_by=self.user,
        )

        response = self.client.get(
            "/api/accounting/journal-entries/",
            {"source_type": "order_payment", "source_ids": "98765"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["entry_number"], order_entry.entry_number)
        self.assertEqual(len(response.data[0]["lines"]), 2)
