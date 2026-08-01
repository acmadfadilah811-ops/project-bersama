from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import CustomUser, SaldoKasHarian
from api.pos_models import POSSale
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification
from accounting.models.cashbank import PaymentMethod
from accounting.services.pos_posting import post_pos_sale_journal
from accounting.services.pos_reconciliation import reconcile_pos_shift


class POSShiftReconciliationTestCase(TestCase):
    def setUp(self):
        cls_acc, _ = AccountClassification.objects.get_or_create(
            name="Aset Lancar Test",
            defaults={"account_type": "asset", "order": 1},
        )
        cls_rev, _ = AccountClassification.objects.get_or_create(
            name="Pendapatan Test",
            defaults={"account_type": "revenue", "order": 10},
        )

        self.kas_account = Account.objects.create(
            code="11101", name="Kas Tunai POS", account_type="asset", classification=cls_acc
        )
        self.revenue_account = Account.objects.create(
            code="41200", name="Pendapatan POS", account_type="revenue", classification=cls_rev
        )

        self.cash_pm = PaymentMethod.objects.create(
            name="Tunai POS",
            payment_type="Tunai",
            account=self.kas_account,
            is_cash=True,
        )

        self.owner = CustomUser.objects.create_superuser(
            username="owner_reconcile", email="reconcile@test.com", password="password123", nip="NIP-REC-001"
        )
        self.owner.role = "owner"
        self.owner.save()

        self.kasir = CustomUser.objects.create_user(
            username="kasir_recon", password="password123", role="kasir", nip="NIP-REC-002"
        )

        self.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate(),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=self.revenue_account,
        )

        self.shift = SaldoKasHarian.objects.create(
            tanggal=timezone.localdate(),
            kasir=self.kasir,
            shift="Shift Pagi",
            kas_awal=Decimal("100000"),
            kas_akhir=Decimal("250000"), # Physical count: 100k awal + 150k sale = 250k expected
            waktu_buka=timezone.now(),
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_reconcile_all_posted_balanced(self):
        """Semua sale paid terposting & kas akhir sesuai -> is_balanced True."""
        sale1 = POSSale.objects.create(
            nomor="POS-REC-001",
            total=150000,
            subtotal=150000,
            metode_bayar="Cash",
            accounting_payment_method=self.cash_pm,
            status="paid",
            shift=self.shift,
        )
        post_pos_sale_journal(sale1)

        result = reconcile_pos_shift(shift=self.shift)
        self.assertEqual(result["total_pos_paid_count"], 1)
        self.assertEqual(result["total_pos_paid_amount"], Decimal("150000"))
        self.assertEqual(result["posted_sales_count"], 1)
        self.assertEqual(result["unposted_sales_count"], 0)
        self.assertEqual(result["kas_awal"], Decimal("100000"))
        self.assertEqual(result["expected_kas_akhir"], Decimal("250000"))
        self.assertEqual(result["kas_difference"], Decimal("0"))
        self.assertTrue(result["is_balanced"])

    def test_reconcile_unposted_sale_detected(self):
        """Transaksi paid yang belum terposting berhasil dideteksi."""
        sale1 = POSSale.objects.create(
            nomor="POS-REC-002",
            total=80000,
            subtotal=80000,
            metode_bayar="Cash",
            accounting_payment_method=self.cash_pm,
            status="paid",
            shift=self.shift,
        )
        # sale1 is NOT posted to journal

        result = reconcile_pos_shift(shift=self.shift)
        self.assertEqual(result["total_pos_paid_count"], 1)
        self.assertEqual(result["posted_sales_count"], 0)
        self.assertEqual(result["unposted_sales_count"], 1)
        self.assertEqual(result["unposted_sales_amount"], Decimal("80000"))
        self.assertEqual(len(result["unposted_sales_list"]), 1)
        self.assertEqual(result["unposted_sales_list"][0]["nomor"], "POS-REC-002")
        self.assertFalse(result["is_balanced"])

    def test_reconcile_cash_difference_detected(self):
        """Selisih kas fisik shift vs expected kas akhir berhasil dideteksi."""
        # Change kas_akhir physical count to 240.000 (kurang 10.000)
        self.shift.kas_akhir = Decimal("240000")
        self.shift.save()

        sale = POSSale.objects.create(
            nomor="POS-REC-003",
            total=150000,
            subtotal=150000,
            metode_bayar="Cash",
            accounting_payment_method=self.cash_pm,
            status="paid",
            shift=self.shift,
        )
        post_pos_sale_journal(sale)

        result = reconcile_pos_shift(shift=self.shift)
        self.assertEqual(result["expected_kas_akhir"], Decimal("250000"))
        self.assertEqual(result["kas_akhir"], Decimal("240000"))
        self.assertEqual(result["kas_difference"], Decimal("-10000"))
        self.assertFalse(result["is_balanced"])

    def test_pos_reconciliation_api_endpoint(self):
        """GET /api/accounting/pos-reconciliation/?shift_id=... mengembalikan JSON summary."""
        response = self.client.get(f"/api/accounting/pos-reconciliation/?shift_id={self.shift.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_pos_paid_count", response.data)
        self.assertIn("unposted_sales_count", response.data)
        self.assertIn("kas_difference", response.data)
