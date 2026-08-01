from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Contact, POSPaymentMethod, SaldoKasHarian
from api.pos_services import create_sale
from accounting.models import (
    Account,
    AccountClassification,
    AccountingSettings,
    AccountType,
    JournalEntry,
    PaymentMethod,
)


class POSSaleJournalLogApiTestCase(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            username="pos_log_owner",
            email="owner@example.com",
            password="password123",
            role="owner",
        )
        SaldoKasHarian.objects.create(
            kasir=self.owner,
            tanggal=timezone.localdate(),
            kas_awal=Decimal("0"),
            waktu_buka=timezone.now(),
        )
        Contact.objects.create(nomor_wa="08123456789", nama="Pelanggan POS")

        asset = AccountClassification.objects.create(
            name="Aset Log POS",
            account_type=AccountType.ASSET,
            code_range_start=10000,
            code_range_end=19999,
        )
        revenue = AccountClassification.objects.create(
            name="Pendapatan Log POS",
            account_type=AccountType.REVENUE,
            code_range_start=40000,
            code_range_end=49999,
        )
        cash_account = Account.objects.create(code="11110", name="Kas Log POS", classification=asset)
        revenue_account = Account.objects.create(code="41110", name="Penjualan Log POS", classification=revenue)
        self.settings = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate(),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=revenue_account,
        )
        payment_method = PaymentMethod.objects.create(
            name="Tunai Log POS",
            payment_type="Tunai",
            account=cash_account,
            is_cash=True,
        )
        POSPaymentMethod.objects.create(
            nama="Cash",
            tipe="Tunai",
            accounting_payment_method=payment_method,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def create_unposted_sale(self):
        self.settings.pos_auto_post_enabled = False
        self.settings.save(update_fields=["pos_auto_post_enabled"])
        return create_sale(
            user=self.owner,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 100000,
                "items": [{"nama": "Produk POS", "harga": 100000, "qty": 1}],
            },
        )

    def test_owner_reads_journal_audit_log_for_real_pos_sale(self):
        sale = create_sale(
            user=self.owner,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 100000,
                "items": [{"nama": "Produk POS", "harga": 100000, "qty": 1}],
            },
        )

        response = self.client.get(f"/api/accounting/sales/pos/{sale.id}/log/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({row["action"] for row in response.data}, {"created", "posted"})
        self.assertTrue(all(row["actor_email"] == self.owner.email for row in response.data))
        self.assertTrue(all(row["journal_entry"] for row in response.data))

    def test_owner_can_post_cancel_and_read_manual_pos_audit_idempotently(self):
        sale = self.create_unposted_sale()
        post_url = "/api/accounting/sales/pos/post/"
        cancel_url = "/api/accounting/sales/pos/cancel-post/"

        first_post = self.client.post(post_url, {"sale_ids": [sale.id]}, format="json")
        second_post = self.client.post(post_url, {"sale_ids": [sale.id]}, format="json")

        self.assertEqual(first_post.status_code, status.HTTP_200_OK)
        self.assertEqual(second_post.status_code, status.HTTP_200_OK)
        self.assertEqual(
            first_post.data["results"][0]["journal_entry"],
            second_post.data["results"][0]["journal_entry"],
        )
        originals = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE,
            source_id=sale.id,
            reversed_entry__isnull=True,
        )
        self.assertEqual(originals.count(), 1)

        first_cancel = self.client.post(cancel_url, {"sale_ids": [sale.id]}, format="json")
        second_cancel = self.client.post(cancel_url, {"sale_ids": [sale.id]}, format="json")
        self.assertEqual(first_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(second_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(
            first_cancel.data["results"][0]["journal_entry"],
            second_cancel.data["results"][0]["journal_entry"],
        )
        self.assertEqual(JournalEntry.objects.filter(reversed_entry=originals.get()).count(), 1)

        re_post = self.client.post(post_url, {"sale_ids": [sale.id]}, format="json")
        self.assertEqual(re_post.status_code, status.HTTP_400_BAD_REQUEST)

        log_response = self.client.get(f"/api/accounting/sales/pos/{sale.id}/log/")
        self.assertEqual(log_response.status_code, status.HTTP_200_OK)
        self.assertIn("reversed", {row["action"] for row in log_response.data})
        self.assertTrue(
            any(row["note"].startswith("Aksi manual post POS dari #") for row in log_response.data)
        )

    def test_staff_cannot_call_manual_pos_actions_or_read_log(self):
        sale = self.create_unposted_sale()
        staff = get_user_model().objects.create_user(
            username="pos_log_staff",
            password="password123",
            role="staff",
        )
        client = APIClient()
        client.force_authenticate(staff)

        self.assertEqual(
            client.post("/api/accounting/sales/pos/post/", {"sale_ids": [sale.id]}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            client.get(f"/api/accounting/sales/pos/{sale.id}/log/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_manual_post_rejects_missing_payment_mapping_without_creating_journal(self):
        sale = self.create_unposted_sale()
        sale.accounting_payment_method = None
        sale.save(update_fields=["accounting_payment_method"])
        self.settings.default_pos_payment_method = None
        self.settings.save(update_fields=["default_pos_payment_method"])

        response = self.client.post(
            "/api/accounting/sales/pos/post/",
            {"sale_ids": [sale.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            JournalEntry.objects.filter(
                source_type=JournalEntry.SourceType.POS_SALE,
                source_id=sale.id,
            ).count(),
            0,
        )
