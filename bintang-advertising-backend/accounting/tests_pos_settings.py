from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, AccountType, AccountingSettings


class POSDefaultAccountSettingsTestCase(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username="pos_settings_owner", password="password123", role="owner",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        classification = AccountClassification.objects.create(
            name="Aset Pengaturan POS", account_type=AccountType.ASSET,
            code_range_start=10000, code_range_end=19999,
        )
        self.account = Account.objects.create(
            code="11101", name="Kas Pengaturan POS", classification=classification,
        )
        AccountingSettings.objects.create(accounting_start_date=timezone.localdate())

    def test_owner_can_persist_pos_default_accounts(self):
        response = self.client.patch("/api/accounting/settings/", {
            "pos_auto_post_enabled": False,
            "pos_post_discount_line_enabled": False,
            "pos_marketplace_admin_fee_account": self.account.id,
            "pos_sales_delivery_account": self.account.id,
            "pos_sales_rounding_account": self.account.id,
            "pos_sales_unique_payment_account": self.account.id,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["pos_auto_post_enabled"])
        self.assertFalse(response.data["pos_post_discount_line_enabled"])
        self.assertEqual(response.data["pos_sales_delivery_account"], self.account.id)
        self.assertEqual(response.data["pos_sales_rounding_account"], self.account.id)
        self.assertEqual(response.data["pos_sales_unique_payment_account"], self.account.id)

        logs_response = self.client.get("/api/accounting/settings/pos-posting-logs/")
        self.assertEqual(logs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(logs_response.data[0]["action"], "disable")
        self.assertEqual(logs_response.data[0]["actor_email"], self.owner.email)

    def test_owner_can_persist_komisi_penjualan_accounts(self):
        response = self.client.patch("/api/accounting/settings/", {
            "komisi_penjualan_debit_account": self.account.id,
            "komisi_penjualan_kredit_account": self.account.id,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["komisi_penjualan_debit_account"], self.account.id)
        self.assertEqual(response.data["komisi_penjualan_kredit_account"], self.account.id)

    def test_complete_setup_marks_wizard_as_completed(self):
        response = self.client.post("/api/accounting/settings/complete-setup/", {
            "accounting_start_date": "2026-07-30",
            "default_payment_due_days": 14,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_active"])
        self.assertEqual(response.data["default_payment_due_days"], 14)
        self.assertIsNotNone(response.data["initial_setup_completed_at"])
