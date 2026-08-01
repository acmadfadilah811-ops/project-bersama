from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Order, OrderActivityLog, PengembalianOrder
from accounting.models import Account, AccountClassification, AccountingSettings
from accounting.services.journal import create_journal_entry


class AccountingSalesSourceTestCase(TestCase):
    """Endpoint akuntansi harus membaca POS/order dan status jurnal asli."""

    def setUp(self):
        from django.contrib.auth import get_user_model

        self.user = get_user_model().objects.create_user(
            username="accounting_sales_owner", password="password123", role="owner"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        asset_class = AccountClassification.objects.create(
            name="Aset Sales Source Test", account_type="asset",
            code_range_start=10000, code_range_end=19999,
        )
        revenue_class = AccountClassification.objects.create(
            name="Revenue Sales Source Test", account_type="revenue",
            code_range_start=40000, code_range_end=49999,
        )
        self.cash = Account.objects.create(
            code="1-SALES-SOURCE", name="Kas Sales Source Test",
            account_type="asset", classification=asset_class,
        )
        self.revenue = Account.objects.create(
            code="4-SALES-SOURCE", name="Revenue Sales Source Test",
            account_type="revenue", classification=revenue_class,
        )
        AccountingSettings.objects.create(
            accounting_start_date=date.today(), is_active=True,
            initial_setup_completed_at=timezone.now(),
        )

    def _order(self, order_id, status_global):
        return Order.objects.create(
            id=order_id,
            nomor_wa="081234567890",
            nama=f"Customer {order_id}",
            status_global=status_global,
            sumber="manual",
            total_harga=100000,
            dp_dibayar=50000,
            sisa_tagihan=50000,
        )

    def test_all_order_categories_are_exposed(self):
        self._order("ORD-SOURCE-PROSES", "proses")
        self._order("ORD-SOURCE-SELESAI", "selesai")
        returned = self._order("ORD-SOURCE-RETURN", "review")
        PengembalianOrder.objects.create(order=returned, status="Tunda")
        self._order("ORD-SOURCE-BATAL", "batal")

        response = self.client.get("/api/accounting/sales/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 4)
        categories = {row["category"] for row in response.data["results"]}
        self.assertEqual(
            categories,
            {"butuh_diproses", "selesai", "pengembalian", "dibatalkan"},
        )

    def test_order_journal_status_comes_from_order_payment_entry(self):
        order = self._order("ORD-SOURCE-JOURNAL", "selesai")
        activity = OrderActivityLog.objects.create(
            order=order, user=self.user, tindakan="PAYMENT",
            keterangan="Test payment journal",
        )
        create_journal_entry(
            date=date.today(),
            lines=[
                {"account": self.cash, "debit": Decimal("50000"), "kredit": 0},
                {"account": self.revenue, "debit": 0, "kredit": Decimal("50000")},
            ],
            source_type="order_payment", source_id=activity.id,
            created_by=self.user,
        )

        response = self.client.get(
            "/api/accounting/sales/", {"source": "order", "search": order.id}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["journal_status"], "posted")
        self.assertTrue(row["journal_entry_ids"])
