from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, FixedAsset, JournalEntry
from accounting.services.asset_export import build_asset_xlsx

User = get_user_model()


class FixedAssetApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="asset-owner", email="asset-owner@example.com", password="password123", nip="ASSET-OWNER",
        )
        self.owner.role = "owner"
        self.owner.save()
        self.staff = User.objects.create_user(
            username="asset-staff", email="asset-staff@example.com", password="password123", nip="ASSET-STAFF",
        )
        self.staff.role = "kasir"
        self.staff.save()
        asset_class = AccountClassification.objects.create(name="Aset Test", account_type="asset")
        expense_class = AccountClassification.objects.create(name="Beban Test", account_type="expense")
        self.asset_account = Account.objects.create(code="15100", name="Peralatan Test", account_type="asset", classification=asset_class)
        self.cash_account = Account.objects.create(code="11101", name="Kas Test", account_type="asset", classification=asset_class)
        self.accumulated_account = Account.objects.create(code="15199", name="Akumulasi Test", account_type="asset", classification=asset_class, is_contra=True)
        self.expense_account = Account.objects.create(code="52100", name="Beban Penyusutan Test", account_type="expense", classification=expense_class)
        self.client = APIClient()

    def payload(self, **overrides):
        data = {
            "asset_code": "AST-001",
            "name": "Laptop Test",
            "acquisition_date": "2026-07-30",
            "acquisition_cost": "15000000",
            "residual_value": "1000000",
            "asset_account": self.asset_account.id,
            "depreciation_expense_account": self.expense_account.id,
            "accumulated_depreciation_account": self.accumulated_account.id,
            "counter_account": self.cash_account.id,
            "external_document_no": "INV-001",
        }
        data.update(overrides)
        return data

    def test_create_asset_posts_balanced_idempotent_journal(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/accounting/assets/", self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        asset = FixedAsset.objects.get(asset_code="AST-001")
        entry = asset.acquisition_journal
        self.assertEqual(entry.source_type, JournalEntry.SourceType.ASSET_ACQUISITION)
        self.assertEqual(sum(line.debit for line in entry.lines.all()), Decimal("15000000"))
        self.assertEqual(sum(line.kredit for line in entry.lines.all()), Decimal("15000000"))

        duplicate = self.client.post("/api/accounting/assets/", self.payload(), format="json")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FixedAsset.objects.count(), 1)
        self.assertEqual(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ASSET_ACQUISITION).count(), 1)

    def test_import_preview_and_commit_are_atomic(self):
        self.client.force_authenticate(self.owner)
        file_obj = SimpleUploadedFile(
            "aset.csv",
            b"asset_code,name,acquisition_date,acquisition_cost,residual_value\nAST-002,Printer,2026-07-30,3000000,0\n",
            content_type="text/csv",
        )
        config = self.payload(asset_code="ignored", name="ignored", acquisition_cost="1", residual_value="0")
        config.pop("asset_code")
        config.pop("name")
        config.pop("acquisition_date")
        config.pop("acquisition_cost")
        config.pop("residual_value")
        preview = self.client.post("/api/accounting/assets/import/preview/", {**config, "file": file_obj}, format="multipart")
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(preview.data["valid_rows"], 1)
        commit = self.client.post("/api/accounting/assets/import/commit/", {**config, "entries": preview.data["entries"]}, format="json")
        self.assertEqual(commit.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FixedAsset.objects.filter(asset_code="AST-002").count(), 1)

    def test_asset_api_rejects_non_manager(self):
        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/accounting/assets/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_account_lookup_includes_dropdown_fields(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/accounting/accounts/?semua_akun=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        asset_row = next(row for row in response.data if row["id"] == self.accumulated_account.id)
        self.assertEqual(asset_row["account_type"], "asset")
        self.assertTrue(asset_row["is_contra"])

    def test_export_returns_xlsx_after_asset_created(self):
        self.client.force_authenticate(self.owner)
        self.client.post("/api/accounting/assets/", self.payload(), format="json")
        self.assertTrue(build_asset_xlsx(FixedAsset.objects.all()).getvalue())
        response = self.client.get("/api/accounting/assets/?export=xlsx&all_dates=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", response["Content-Type"])
