"""Penyusutan Aset Tetap (garis lurus) -- sebelumnya field
depreciation_expense_account/accumulated_depreciation_account di FixedAsset
cuma tersimpan tanpa pernah dibaca kode apa pun, tidak ada field umur
manfaat sama sekali, dan akun Akumulasi Penyusutan selamanya bersaldo nol
(ditemukan audit 2026-09-08).
"""
import calendar
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, FixedAsset, JournalEntry
from accounting.services.assets import create_fixed_asset
from accounting.services.depreciation import (
    calculate_monthly_depreciation_amount,
    get_accumulated_depreciation,
    get_book_value,
    post_monthly_depreciation,
)

User = get_user_model()


class DepreciationTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="depr-owner", email="depr-owner@example.com", password="password123", nip="DEPR-OWNER",
        )
        self.owner.role = "owner"
        self.owner.save()

        asset_class = AccountClassification.objects.create(name="Aset Depr Test", account_type="asset")
        expense_class = AccountClassification.objects.create(name="Beban Depr Test", account_type="expense")
        self.asset_account = Account.objects.create(code="15200", name="Kendaraan Test", account_type="asset", classification=asset_class)
        self.cash_account = Account.objects.create(code="11201", name="Kas Depr Test", account_type="asset", classification=asset_class)
        self.accumulated_account = Account.objects.create(
            code="15299", name="Akumulasi Penyusutan Kendaraan Test", account_type="asset",
            classification=asset_class, is_contra=True,
        )
        self.expense_account = Account.objects.create(
            code="52200", name="Beban Penyusutan Kendaraan Test", account_type="expense", classification=expense_class,
        )

        # Nilai bulat habis dibagi: 12.000.000 perolehan - 0 residu, umur 12
        # bulan = 1.000.000/bulan.
        self.asset = create_fixed_asset(
            data={
                "asset_code": "AST-DEPR-001", "name": "Motor Operasional", "acquisition_date": date(2026, 1, 1),
                "acquisition_cost": Decimal("12000000"), "residual_value": Decimal("0"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
                "useful_life_months": 12,
            },
            created_by=self.owner,
        )

    def test_calculate_monthly_depreciation_amount(self):
        self.assertEqual(calculate_monthly_depreciation_amount(self.asset), Decimal("1000000"))

    def test_asset_tanpa_umur_manfaat_tidak_dihitung(self):
        tanah = create_fixed_asset(
            data={
                "asset_code": "AST-DEPR-TANAH", "name": "Tanah Kantor", "acquisition_date": date(2026, 1, 1),
                "acquisition_cost": Decimal("500000000"), "residual_value": Decimal("0"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
            },
            created_by=self.owner,
        )
        self.assertIsNone(calculate_monthly_depreciation_amount(tanah))

    def test_post_monthly_depreciation_membuat_jurnal_seimbang(self):
        entries = post_monthly_depreciation(period_end_date=date(2026, 1, 31), actor=self.owner)
        self.assertEqual(len(entries), 1)
        entry = entries[0]
        self.assertEqual(entry.source_type, JournalEntry.SourceType.ASSET_DEPRECIATION)
        self.assertEqual(entry.source_id, self.asset.id)
        lines = list(entry.lines.all())
        self.assertEqual(sum(l.debit for l in lines), Decimal("1000000"))
        self.assertEqual(sum(l.kredit for l in lines), Decimal("1000000"))
        self.assertEqual(get_accumulated_depreciation(self.asset), Decimal("1000000"))
        self.assertEqual(get_book_value(self.asset), Decimal("11000000"))

        self.asset.refresh_from_db()
        self.assertEqual(self.asset.last_depreciation_date, date(2026, 1, 31))

    def test_post_monthly_depreciation_idempoten_per_bulan(self):
        post_monthly_depreciation(period_end_date=date(2026, 1, 31), actor=self.owner)
        second = post_monthly_depreciation(period_end_date=date(2026, 1, 31), actor=self.owner)
        self.assertEqual(len(second), 0)
        self.assertEqual(get_accumulated_depreciation(self.asset), Decimal("1000000"))

    def test_post_monthly_depreciation_bulan_berikutnya_lanjut(self):
        post_monthly_depreciation(period_end_date=date(2026, 1, 31), actor=self.owner)
        entries_feb = post_monthly_depreciation(period_end_date=date(2026, 2, 28), actor=self.owner)
        self.assertEqual(len(entries_feb), 1)
        self.assertEqual(get_accumulated_depreciation(self.asset), Decimal("2000000"))

    def test_penyusutan_berhenti_setelah_habis_disusutkan(self):
        # Susutkan 12 bulan penuh -- bulan ke-13 tidak boleh ada jurnal baru
        # lagi (sudah 100% tersusutkan, remaining <= 0).
        for month in range(1, 13):
            post_monthly_depreciation(period_end_date=date(2026, month, calendar.monthrange(2026, month)[1]), actor=self.owner)
        self.assertEqual(get_accumulated_depreciation(self.asset), Decimal("12000000"))
        self.assertEqual(get_book_value(self.asset), Decimal("0"))

        entries_13 = post_monthly_depreciation(period_end_date=date(2027, 1, 31), actor=self.owner)
        self.assertEqual(len(entries_13), 0)
        self.assertEqual(get_accumulated_depreciation(self.asset), Decimal("12000000"))

    def test_penyusutan_terakhir_di_cap_supaya_tidak_melebihi_nilai_residu(self):
        # Perolehan 10.000.000, residu 500.000, umur 3 bulan -> 3.166.666,67/bulan
        # dibulatkan 3.166.667 -- 3 bulan = 9.500.001, kelebihan 1 dari basis
        # (9.500.000) -- bulan terakhir harus di-cap.
        asset2 = create_fixed_asset(
            data={
                "asset_code": "AST-DEPR-CAP", "name": "Mesin Cap Test", "acquisition_date": date(2026, 1, 1),
                "acquisition_cost": Decimal("10000000"), "residual_value": Decimal("500000"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
                "useful_life_months": 3,
            },
            created_by=self.owner,
        )
        for month in range(1, 4):
            post_monthly_depreciation(period_end_date=date(2026, month, calendar.monthrange(2026, month)[1]), actor=self.owner)
        self.assertEqual(get_accumulated_depreciation(asset2), Decimal("9500000"))
        self.assertEqual(get_book_value(asset2), Decimal("500000"))

    def test_aset_nonaktif_dilewati(self):
        self.asset.status = FixedAsset.Status.DISPOSED
        self.asset.save(update_fields=["status"])
        entries = post_monthly_depreciation(period_end_date=date(2026, 1, 31), actor=self.owner)
        self.assertEqual(len(entries), 0)


class DepreciationApiTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="depr-api-owner", email="depr-api-owner@example.com", password="password123", nip="DEPR-API-OWNER",
        )
        self.owner.role = "owner"
        self.owner.save()
        self.staff = User.objects.create_user(
            username="depr-api-staff", email="depr-api-staff@example.com", password="password123", nip="DEPR-API-STAFF",
        )
        self.staff.role = "kasir"
        self.staff.save()

        asset_class = AccountClassification.objects.create(name="Aset Depr API", account_type="asset")
        expense_class = AccountClassification.objects.create(name="Beban Depr API", account_type="expense")
        self.asset_account = Account.objects.create(code="15300", name="Peralatan API", account_type="asset", classification=asset_class)
        self.cash_account = Account.objects.create(code="11301", name="Kas Depr API", account_type="asset", classification=asset_class)
        self.accumulated_account = Account.objects.create(
            code="15399", name="Akumulasi API", account_type="asset", classification=asset_class, is_contra=True,
        )
        self.expense_account = Account.objects.create(code="52300", name="Beban Penyusutan API", account_type="expense", classification=expense_class)

        self.asset = create_fixed_asset(
            data={
                "asset_code": "AST-DEPR-API-001", "name": "Komputer API", "acquisition_date": date(2026, 1, 1),
                "acquisition_cost": Decimal("6000000"), "residual_value": Decimal("0"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
                "useful_life_months": 6,
            },
            created_by=self.owner,
        )
        self.client = APIClient()

    def test_manual_post_endpoint_dgn_period_eksplisit(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/accounting/assets/depreciation/post/", {"period": "2026-01"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(response.data["posted_count"], 1)
        self.assertEqual(response.data["period"], "2026-01")

    def test_manual_post_endpoint_ditolak_untuk_staff(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post("/api/accounting/assets/depreciation/post/", {"period": "2026-01"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_read_serializer_menampilkan_field_penyusutan(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/accounting/assets/{self.asset.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data["monthly_depreciation_amount"]), Decimal("1000000"))
        self.assertEqual(Decimal(response.data["accumulated_depreciation"]), Decimal("0"))
        self.assertEqual(Decimal(response.data["book_value"]), Decimal("6000000"))

    def test_update_serializer_bisa_mengisi_umur_manfaat_aset_lama(self):
        aset_lama = create_fixed_asset(
            data={
                "asset_code": "AST-DEPR-API-OLD", "name": "Meja Lama", "acquisition_date": date(2025, 1, 1),
                "acquisition_cost": Decimal("2000000"), "residual_value": Decimal("0"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
            },
            created_by=self.owner,
        )
        self.assertIsNone(aset_lama.useful_life_months)
        self.client.force_authenticate(self.owner)
        response = self.client.patch(f"/api/accounting/assets/{aset_lama.id}/", {"useful_life_months": 24}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        aset_lama.refresh_from_db()
        self.assertEqual(aset_lama.useful_life_months, 24)

    def test_management_command_post_monthly_depreciation(self):
        out = call_command("post_monthly_depreciation", period="2026-01")
        self.assertEqual(get_accumulated_depreciation(self.asset), Decimal("1000000"))


