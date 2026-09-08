"""Pelepasan/penjualan Aset Tetap -- sebelumnya FixedAsset.Status.DISPOSED
tidak pernah bisa dicapai sama sekali (tidak ada endpoint, tidak ada
service, tidak ada perhitungan untung/rugi pelepasan). Aset yang sudah
dicatat permanen ada di register tanpa cara resmi menandainya
dijual/dibuang/rusak (ditemukan audit 2026-09-08).
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, FixedAsset, JournalEntry
from accounting.services.assets import create_fixed_asset, dispose_fixed_asset
from accounting.services.depreciation import get_accumulated_depreciation, post_monthly_depreciation

User = get_user_model()


class AssetDisposalTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="disp-owner", email="disp-owner@example.com", password="password123", nip="DISP-OWNER",
        )
        self.owner.role = "owner"
        self.owner.save()

        asset_class = AccountClassification.objects.create(name="Aset Disp Test", account_type="asset")
        expense_class = AccountClassification.objects.create(name="Beban Disp Test", account_type="expense")
        revenue_class = AccountClassification.objects.create(name="Pendapatan Disp Test", account_type="revenue")
        self.asset_account = Account.objects.create(code="15400", name="Mesin Disp Test", account_type="asset", classification=asset_class)
        self.cash_account = Account.objects.create(code="11401", name="Kas Disp Test", account_type="asset", classification=asset_class)
        self.accumulated_account = Account.objects.create(
            code="15499", name="Akumulasi Disp Test", account_type="asset", classification=asset_class, is_contra=True,
        )
        self.expense_account = Account.objects.create(code="52400", name="Beban Penyusutan Disp Test", account_type="expense", classification=expense_class)
        self.gain_loss_account = Account.objects.create(code="72000", name="Untung/Rugi Pelepasan Aset", account_type="revenue", classification=revenue_class)

        # 12.000.000 perolehan, residu 0, umur 12 bulan -> 1.000.000/bulan.
        self.asset = create_fixed_asset(
            data={
                "asset_code": "AST-DISP-001", "name": "Mesin Cetak", "acquisition_date": date(2026, 1, 1),
                "acquisition_cost": Decimal("12000000"), "residual_value": Decimal("0"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
                "useful_life_months": 12,
            },
            created_by=self.owner,
        )

    def _susutkan(self, bulan_ke):
        """Susutkan aset sampai bulan ke-N (1-indexed) dari Januari 2026."""
        import calendar
        for month in range(1, bulan_ke + 1):
            post_monthly_depreciation(period_end_date=date(2026, month, calendar.monthrange(2026, month)[1]), actor=self.owner)

    def test_pelepasan_dengan_untung_diakui_benar(self):
        # Susutkan 3 bulan -> akumulasi 3.000.000, nilai buku 9.000.000.
        self._susutkan(3)
        # Dijual 10.000.000 -> untung 1.000.000.
        asset = dispose_fixed_asset(
            asset=self.asset, disposal_date=date(2026, 4, 15), proceeds=Decimal("10000000"),
            proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
        )
        self.assertEqual(asset.status, FixedAsset.Status.DISPOSED)
        self.assertEqual(asset.disposal_proceeds, Decimal("10000000"))
        entry = asset.disposal_journal
        self.assertEqual(entry.source_type, JournalEntry.SourceType.ASSET_DISPOSAL)
        lines = list(entry.lines.all())
        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, total_kredit)

        gain_line = next(l for l in lines if l.account_id == self.gain_loss_account.id)
        self.assertEqual(gain_line.kredit, Decimal("1000000"))
        self.assertEqual(gain_line.debit, Decimal("0"))

    def test_pelepasan_dengan_rugi_diakui_benar(self):
        # Susutkan 3 bulan -> nilai buku 9.000.000. Dijual cuma 2.000.000 -> rugi 7.000.000.
        self._susutkan(3)
        asset = dispose_fixed_asset(
            asset=self.asset, disposal_date=date(2026, 4, 15), proceeds=Decimal("2000000"),
            proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
        )
        entry = asset.disposal_journal
        lines = list(entry.lines.all())
        loss_line = next(l for l in lines if l.account_id == self.gain_loss_account.id)
        self.assertEqual(loss_line.debit, Decimal("7000000"))
        self.assertEqual(loss_line.kredit, Decimal("0"))

    def test_pelepasan_menghapus_aset_dan_akumulasi_dari_buku(self):
        self._susutkan(3)
        asset = dispose_fixed_asset(
            asset=self.asset, disposal_date=date(2026, 4, 15), proceeds=Decimal("9000000"),
            proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
        )
        entry = asset.disposal_journal
        lines = list(entry.lines.all())
        asset_line = next(l for l in lines if l.account_id == self.asset_account.id)
        self.assertEqual(asset_line.kredit, Decimal("12000000"))
        accum_line = next(l for l in lines if l.account_id == self.accumulated_account.id)
        self.assertEqual(accum_line.debit, Decimal("3000000"))

    def test_pelepasan_aset_yang_belum_pernah_disusutkan_dan_dibuang_gratis(self):
        # Belum pernah disusutkan, dilepas (dibuang, proceeds=0) -> rugi penuh 12.000.000.
        asset = dispose_fixed_asset(
            asset=self.asset, disposal_date=date(2026, 2, 1), proceeds=Decimal("0"),
            proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
        )
        entry = asset.disposal_journal
        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 2, "Baris akumulasi & proceeds yang 0 harus di-skip, cuma sisa 2 baris.")
        loss_line = next(l for l in lines if l.account_id == self.gain_loss_account.id)
        self.assertEqual(loss_line.debit, Decimal("12000000"))

    def test_pelepasan_dua_kali_ditolak(self):
        dispose_fixed_asset(
            asset=self.asset, disposal_date=date(2026, 2, 1), proceeds=Decimal("11000000"),
            proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
        )
        with self.assertRaises(ValidationError):
            dispose_fixed_asset(
                asset=self.asset, disposal_date=date(2026, 3, 1), proceeds=Decimal("5000000"),
                proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
            )

    def test_aset_yang_sudah_dilepas_tidak_ikut_disusutkan_lagi(self):
        self._susutkan(2)
        dispose_fixed_asset(
            asset=self.asset, disposal_date=date(2026, 3, 1), proceeds=Decimal("9000000"),
            proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
        )
        accumulated_before = get_accumulated_depreciation(self.asset)
        post_monthly_depreciation(period_end_date=date(2026, 3, 31), actor=self.owner)
        self.assertEqual(get_accumulated_depreciation(self.asset), accumulated_before, "Aset yang sudah DISPOSED tidak boleh disusutkan lagi.")

    def test_tanggal_pelepasan_sebelum_perolehan_ditolak(self):
        with self.assertRaises(ValidationError):
            dispose_fixed_asset(
                asset=self.asset, disposal_date=date(2025, 12, 1), proceeds=Decimal("0"),
                proceeds_account=self.cash_account, gain_loss_account=self.gain_loss_account, actor=self.owner,
            )


class AssetDisposalApiTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="disp-api-owner", email="disp-api-owner@example.com", password="password123", nip="DISP-API-OWNER",
        )
        self.owner.role = "owner"
        self.owner.save()
        self.staff = User.objects.create_user(
            username="disp-api-staff", email="disp-api-staff@example.com", password="password123", nip="DISP-API-STAFF",
        )
        self.staff.role = "kasir"
        self.staff.save()

        asset_class = AccountClassification.objects.create(name="Aset Disp API", account_type="asset")
        expense_class = AccountClassification.objects.create(name="Beban Disp API", account_type="expense")
        revenue_class = AccountClassification.objects.create(name="Pendapatan Disp API", account_type="revenue")
        self.asset_account = Account.objects.create(code="15500", name="Peralatan Disp API", account_type="asset", classification=asset_class)
        self.cash_account = Account.objects.create(code="11501", name="Kas Disp API", account_type="asset", classification=asset_class)
        self.accumulated_account = Account.objects.create(
            code="15599", name="Akumulasi Disp API", account_type="asset", classification=asset_class, is_contra=True,
        )
        self.expense_account = Account.objects.create(code="52500", name="Beban Penyusutan Disp API", account_type="expense", classification=expense_class)
        self.gain_loss_account = Account.objects.create(code="72100", name="Untung/Rugi Pelepasan API", account_type="revenue", classification=revenue_class)

        self.asset = create_fixed_asset(
            data={
                "asset_code": "AST-DISP-API-001", "name": "Laptop Disp API", "acquisition_date": date(2026, 1, 1),
                "acquisition_cost": Decimal("9000000"), "residual_value": Decimal("0"),
                "asset_account": self.asset_account, "depreciation_expense_account": self.expense_account,
                "accumulated_depreciation_account": self.accumulated_account, "counter_account": self.cash_account,
                "useful_life_months": 9,
            },
            created_by=self.owner,
        )
        self.client = APIClient()

    def test_dispose_endpoint_sukses(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/accounting/assets/{self.asset.id}/dispose/", {
            "disposal_date": "2026-02-01", "proceeds": "8500000",
            "proceeds_account": self.cash_account.id, "gain_loss_account": self.gain_loss_account.id,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(response.data["status"], "disposed")
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.status, FixedAsset.Status.DISPOSED)

    def test_dispose_endpoint_ditolak_untuk_staff(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post(f"/api/accounting/assets/{self.asset.id}/dispose/", {
            "disposal_date": "2026-02-01", "proceeds": "8500000",
            "proceeds_account": self.cash_account.id, "gain_loss_account": self.gain_loss_account.id,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_status_tidak_bisa_diubah_lewat_update_serializer_biasa(self):
        """status SENGAJA dikeluarkan dari FixedAssetUpdateSerializer -- satu-
        satunya jalur ke DISPOSED adalah endpoint dispose/."""
        self.client.force_authenticate(self.owner)
        response = self.client.patch(f"/api/accounting/assets/{self.asset.id}/", {"status": "disposed"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.status, FixedAsset.Status.ACTIVE, "PATCH status harus diam-diam diabaikan, bukan mengubah status.")
