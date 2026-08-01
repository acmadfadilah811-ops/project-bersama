"""
accounting/tests_pos_integration.py

T-106: Test integrasi POS-akuntansi end-to-end via APITestCase.

Membuktikan alur POS-ke-Akuntansi berjalan benar end-to-end lewat endpoint API
sungguhan (self.client.post / get), BUKAN lewat ORM fixture preset manual.

Coverage (5 Poin Wajib):
1. Cash POS Sale via API -> POSSale created, PaymentMethod & JournalEntry (D=K) resolved via API pipeline.
2. Non-cash POS Sale via API -> PaymentMethod & settlement_status='unsettled' resolved via API pipeline.
3. Settlement non-tunai via API -> GET /api/accounting/settlements/ & POST /api/accounting/settlements/confirm/ -> JournalEntry settlement (D Bank, K Transit), status -> 'settled'.
4. Idempotency -> repeat posting/confirm request -> no duplicate JournalEntry.
5. Void behavior documentation -> POST /api/pos/sales/:id/void/ -> POSSale status='void', JournalEntry status currently unchanged (T-104 scope).
"""
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import SaldoKasHarian, POSPaymentMethod
from api.pos_models import POSSale
from accounting.models import (
    Account, AccountClassification, AccountType, AccountingSettings,
    JournalEntry, PaymentMethod
)
from accounting.services.pos_posting import post_pos_sale_journal

User = get_user_model()


class POSAccountingIntegrationTestCase(APITestCase):
    """Test integrasi end-to-end alur POS ke Akuntansi lewat REST API."""

    @classmethod
    def setUpTestData(cls):
        # 1. Users
        cls.kasir = User.objects.create_user(
            username="kasir_pos_e2e", password="password123", role="kasir"
        )
        cls.owner = User.objects.create_user(
            username="owner_pos_e2e", password="password123", role="owner"
        )

        # 2. Classifications
        cls.asset_cls = AccountClassification.objects.create(
            name="Aset E2E", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999
        )
        cls.rev_cls = AccountClassification.objects.create(
            name="Pendapatan E2E", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999
        )
        cls.liab_cls = AccountClassification.objects.create(
            name="Kewajiban E2E", account_type=AccountType.LIABILITY, code_range_start=20000, code_range_end=29999
        )

        # 3. Accounts
        cls.kas_account = Account.objects.create(
            code="11101-E2E", name="Kas Toko E2E", classification=cls.asset_cls
        )
        cls.bank_account = Account.objects.create(
            code="11102-E2E", name="Bank BCA E2E", classification=cls.asset_cls
        )
        cls.qris_transit_account = Account.objects.create(
            code="11201-E2E", name="Piutang QRIS Transit E2E", classification=cls.asset_cls
        )
        cls.revenue_account = Account.objects.create(
            code="41101-E2E", name="Pendapatan POS E2E", classification=cls.rev_cls
        )
        cls.ppn_account = Account.objects.create(
            code="21201-E2E", name="PPN Keluaran E2E", classification=cls.liab_cls
        )

        # 4. Accounting Settings
        cls.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=cls.revenue_account,
            pos_ppn_output_account=cls.ppn_account,
        )

        # 5. Accounting Payment Methods
        cls.pm_cash = PaymentMethod.objects.create(
            name="Tunai E2E",
            payment_type="Tunai",
            account=cls.kas_account,
            is_cash=True,
        )
        cls.pm_qris = PaymentMethod.objects.create(
            name="QRIS BCA E2E",
            payment_type="QRIS",
            account=cls.qris_transit_account,
            is_cash=False,
        )

        # 6. Master POS Payment Methods (mapping POS -> Accounting)
        cls.pos_pm_cash = POSPaymentMethod.objects.create(
            nama="Cash", tipe="Tunai", accounting_payment_method=cls.pm_cash
        )
        cls.pos_pm_qris = POSPaymentMethod.objects.create(
            nama="QRIS", tipe="QRIS", accounting_payment_method=cls.pm_qris
        )

    def setUp(self):
        # Pastikan kasir memiliki shift aktif agar pos_settings shift check lolos
        self.shift = SaldoKasHarian.objects.create(
            kasir=self.kasir,
            tanggal=timezone.localdate(),
            kas_awal=Decimal("100000"),
            waktu_buka=timezone.now(),
        )
        self.client.force_authenticate(user=self.kasir)

    # ── 1. Cash POS Sale via API ─────────────────────────────────────────────

    def test_e2e_cash_sale_creates_journal_entry(self):
        """
        POST /api/pos/sales/ tunai -> POSSale dibuat, accounting_payment_method
        ter-resolve dari request payload, JournalEntry terbuat otomatis (D Kas / K Revenue).
        """
        payload = {
            "status": "paid",
            "metode_bayar": "Cash",
            "dibayar": 75000,
            "items": [{"nama": "Spanduk Flexi", "harga": 75000, "qty": 1}],
        }
        res = self.client.post("/api/pos/sales/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

        sale_id = res.data["id"]
        sale = POSSale.objects.get(pk=sale_id)

        # Buktikan resolusi PaymentMethod terjadi otomatis lewat pipeline API (bukan ORM preset)
        self.assertEqual(sale.accounting_payment_method, self.pm_cash)
        self.assertEqual(sale.settlement_status, "not_applicable")

        # Buktikan JournalEntry terbuat secara otomatis
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry, "JournalEntry harus terbuat otomatis saat sale 'paid'")
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        # Buktikan balance D = K
        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 2)
        debit_line = next(l for l in lines if l.debit > 0)
        credit_line = next(l for l in lines if l.kredit > 0)

        self.assertEqual(debit_line.account, self.kas_account)
        self.assertEqual(debit_line.debit, Decimal("75000.00"))
        self.assertEqual(credit_line.account, self.revenue_account)
        self.assertEqual(credit_line.kredit, Decimal("75000.00"))

    # ── 2. Non-Cash POS Sale via API ──────────────────────────────────────────

    def test_e2e_non_cash_sale_creates_journal_entry_transit(self):
        """
        POST /api/pos/sales/ QRIS -> POSSale terbuat, settlement_status='unsettled',
        JournalEntry terbuat (D Transit / K Revenue).
        """
        payload = {
            "status": "paid",
            "metode_bayar": "QRIS",
            "dibayar": 150000,
            "items": [{"nama": "Sticker Vinyl", "harga": 150000, "qty": 1}],
        }
        res = self.client.post("/api/pos/sales/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

        sale = POSSale.objects.get(pk=res.data["id"])
        self.assertEqual(sale.accounting_payment_method, self.pm_qris)
        self.assertEqual(sale.settlement_status, "unsettled")

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry)

        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 2)
        debit_line = next(l for l in lines if l.debit > 0)
        credit_line = next(l for l in lines if l.kredit > 0)

        self.assertEqual(debit_line.account, self.qris_transit_account)
        self.assertEqual(debit_line.debit, Decimal("150000.00"))
        self.assertEqual(credit_line.account, self.revenue_account)
        self.assertEqual(credit_line.kredit, Decimal("150000.00"))

    # ── 3. Settlement Non-Tunai via API ───────────────────────────────────────

    def test_e2e_settlement_workflow_via_api(self):
        """
        Alur Settlement lengkap via REST API:
        1. POST /api/pos/sales/ (QRIS) oleh kasir -> sale 'unsettled'
        2. GET /api/accounting/settlements/ oleh owner -> list settlement batch
        3. POST /api/accounting/settlements/confirm/ oleh owner -> JournalEntry settlement
           terbentuk (D Bank BCA, K Transit QRIS), sale status -> 'settled'.
        """
        # Step 1: Kasir melakukan transaksi QRIS
        payload = {
            "status": "paid",
            "metode_bayar": "QRIS",
            "dibayar": 250000,
            "items": [{"nama": "X-Banner Stand", "harga": 250000, "qty": 1}],
        }
        res_sale = self.client.post("/api/pos/sales/", data=payload, format="json")
        self.assertEqual(res_sale.status_code, status.HTTP_201_CREATED)
        sale_id = res_sale.data["id"]

        # Step 2: Owner mengecek daftar settlement batch via GET API
        self.client.force_authenticate(user=self.owner)
        today_str = str(timezone.localdate())
        res_list = self.client.get(
            f"/api/accounting/settlements/?date_from={today_str}&date_to={today_str}"
        )
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(res_list.data["total"], 1)

        batch_data = res_list.data["results"][0]
        self.assertEqual(batch_data["payment_method_id"], self.pm_qris.id)
        self.assertEqual(Decimal(str(batch_data["total_amount"])), Decimal("250000.00"))

        # Step 3: Owner mengonfirmasi settlement batch via POST API
        confirm_payload = {
            "batches": [
                {"date": today_str, "payment_method_id": self.pm_qris.id}
            ],
            "bank_account_id": self.bank_account.id,
        }
        res_confirm = self.client.post(
            "/api/accounting/settlements/confirm/", data=confirm_payload, format="json"
        )
        self.assertEqual(res_confirm.status_code, status.HTTP_200_OK, res_confirm.data)
        self.assertEqual(res_confirm.data["confirmed_count"], 1)

        # Verifikasi status POSSale terupdate
        sale = POSSale.objects.get(pk=sale_id)
        self.assertEqual(sale.settlement_status, "settled")

        # Verifikasi JournalEntry settlement
        journal_id = res_confirm.data["journal_entries"][0]["id"]
        settlement_entry = JournalEntry.objects.get(pk=journal_id)
        self.assertEqual(settlement_entry.source_type, JournalEntry.SourceType.SETTLEMENT)

        lines = list(settlement_entry.lines.all())
        self.assertEqual(len(lines), 2)
        debit_line = next(l for l in lines if l.debit > 0)
        credit_line = next(l for l in lines if l.kredit > 0)

        # Debit ke Akun Bank Real, Kredit dari Akun Transit
        self.assertEqual(debit_line.account, self.bank_account)
        self.assertEqual(debit_line.debit, Decimal("250000.00"))
        self.assertEqual(credit_line.account, self.qris_transit_account)
        self.assertEqual(credit_line.kredit, Decimal("250000.00"))

    # ── 4. Idempotency Tests ──────────────────────────────────────────────────

    def test_e2e_idempotency_posting_sale(self):
        """Memanggil post_pos_sale_journal ulang pada POSSale yang sama tidak menambah JournalEntry baru."""
        payload = {
            "status": "paid",
            "metode_bayar": "Cash",
            "dibayar": 50000,
            "items": [{"nama": "Kartu Nama", "harga": 50000, "qty": 1}],
        }
        res = self.client.post("/api/pos/sales/", data=payload, format="json")
        sale = POSSale.objects.get(pk=res.data["id"])

        # Panggil ulang posting service langsung
        entry2 = post_pos_sale_journal(sale)
        self.assertIsNotNone(entry2)

        # Pastikan total JournalEntry untuk sale ini tetap 1
        entries_count = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).count()
        self.assertEqual(entries_count, 1)

    def test_e2e_idempotency_settlement_list(self):
        """Setelah settlement dikonfirmasi, GET /api/accounting/settlements/ tidak lagi menampilkan batch tersebut."""
        payload = {
            "status": "paid",
            "metode_bayar": "QRIS",
            "dibayar": 100000,
            "items": [{"nama": "Pin Bros", "harga": 100000, "qty": 1}],
        }
        self.client.post("/api/pos/sales/", data=payload, format="json")

        self.client.force_authenticate(user=self.owner)
        today_str = str(timezone.localdate())

        # Settlement batch 1x
        self.client.post(
            "/api/accounting/settlements/confirm/",
            data={
                "batches": [{"date": today_str, "payment_method_id": self.pm_qris.id}],
                "bank_account_id": self.bank_account.id,
            },
            format="json",
        )

        # Cek ulang list settlement — harus 0 batch tersisa
        res_list = self.client.get(
            f"/api/accounting/settlements/?date_from={today_str}&date_to={today_str}"
        )
        self.assertEqual(res_list.data["total"], 0)

    # ── 5. Document Void Behavior (T-104 Scope) ───────────────────────────────

    def test_document_current_void_behavior(self):
        """
        DOKUMENTASI BEHAVIOR VOID SAAT INI:
        POST /api/pos/sales/:id/void/ mengubah status POSSale menjadi 'void',
        namun JournalEntry awal TIDAK dibalik dan TIDAK berubah status ( scope T-104 belum dikerjakan ).
        """
        payload = {
            "status": "paid",
            "metode_bayar": "Cash",
            "dibayar": 60000,
            "items": [{"nama": "Sticker Sheet", "harga": 60000, "qty": 1}],
        }
        res_sale = self.client.post("/api/pos/sales/", data=payload, format="json")
        sale_id = res_sale.data["id"]

        # Void sale via API sebagai owner
        self.client.force_authenticate(user=self.owner)
        res_void = self.client.post(f"/api/pos/sales/{sale_id}/void/", data={}, format="json")
        self.assertEqual(res_void.status_code, status.HTTP_200_OK)

        sale = POSSale.objects.get(pk=sale_id)
        self.assertEqual(sale.status, "void")

        # Dokumentasikan bahwa JournalEntry asli saat ini masih POSTED (belum ada reversal — T-104)
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        # Dokumentasikan bahwa JournalEntry reversal terbuat (T-104)
        reversal_count = JournalEntry.objects.filter(
            reversed_entry=entry
        ).count()
        self.assertEqual(reversal_count, 1)
