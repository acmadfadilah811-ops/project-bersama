from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from api.models import CustomUser
from accounting.models import Account, AccountClassification, CashBankAccount, PaymentMethod, PaymentMethodAuditLog


class PaymentMethodMdrApiTest(TestCase):
    def setUp(self):
        asset_classification = AccountClassification.objects.create(
            name="Aset Lancar MDR API", account_type="asset", order=1,
        )
        expense_classification = AccountClassification.objects.create(
            name="Beban MDR API", account_type="expense", order=2,
        )
        self.cash_account = Account.objects.create(
            code="11191", name="Kas MDR API", account_type="asset", classification=asset_classification,
        )
        self.expense_account = Account.objects.create(
            code="69991", name="Biaya MDR API", account_type="expense", classification=expense_classification,
        )
        CashBankAccount.objects.create(name="Kas MDR API", account=self.cash_account, kind="cash")
        self.payment_method = PaymentMethod.objects.create(
            name="QRIS MDR API", payment_type="QRIS", account=self.cash_account,
        )
        self.owner = CustomUser.objects.create_superuser(
            username="owner_mdr_api", email="owner_mdr_api@test.com", password="password123", nip="NIP-MDR-API",
        )
        self.owner.role = "owner"
        self.owner.save()
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_owner_can_update_mdr_and_read_audit_log(self):
        response = self.client.patch(
            f"/api/accounting/payment-methods/{self.payment_method.id}/mdr/",
            {
                "mdr_debit_account": self.expense_account.id,
                "mdr_kredit_account": self.cash_account.id,
                "mdr_percent": "1.25",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mdr_debit_account_name"], "Biaya MDR API")
        self.assertEqual(response.data["mdr_kredit_account_code"], "11191")
        self.assertEqual(response.data["mdr_percent"], "1.25")

        self.payment_method.refresh_from_db()
        self.assertEqual(self.payment_method.mdr_percent, Decimal("1.25"))
        audit_log = PaymentMethodAuditLog.objects.get(payment_method=self.payment_method)
        self.assertIn("Debit 69991 Biaya MDR API", audit_log.detail)
        self.assertIn("Rating 1.25%", audit_log.detail)
        self.assertEqual(audit_log.account_code, "11191")
        self.assertEqual(audit_log.previous_account_code, "11191")

        log_response = self.client.get(f"/api/accounting/payment-methods/{self.payment_method.id}/log/")
        self.assertEqual(log_response.status_code, status.HTTP_200_OK)
        self.assertEqual(log_response.data[0]["detail"], audit_log.detail)

    def test_account_update_keeps_new_and_previous_account_snapshots(self):
        second_cash = Account.objects.create(
            code="11192", name="Bank MDR API", account_type="asset", classification=self.cash_account.classification,
        )
        CashBankAccount.objects.create(name="Bank MDR API", account=second_cash, kind="bank")

        response = self.client.post(
            "/api/accounting/payment-methods/bulk-update-account/",
            {"payment_method_ids": [self.payment_method.id], "account": second_cash.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit_log = PaymentMethodAuditLog.objects.get(payment_method=self.payment_method)
        self.assertEqual(audit_log.account_code, "11192")
        self.assertEqual(audit_log.previous_account_code, "11191")
        self.assertEqual(audit_log.account_name, "Bank MDR API")
        self.assertEqual(audit_log.previous_account_name, "Kas MDR API")
