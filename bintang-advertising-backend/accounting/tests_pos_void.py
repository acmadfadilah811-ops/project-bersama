from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.exceptions import ValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

from api.models import Contact, SaldoKasHarian, POSPaymentMethod
from api.pos_models import POSSale
from api.pos_services import create_sale, void_sale
from accounting.models import (
    Account, AccountClassification, AccountType, AccountingSettings,
    JournalEntry, JournalAuditLog, PaymentMethod
)
from accounting.services.pos_posting import post_pos_sale_journal, post_pos_void_journal
from accounting.services.settlement import get_settlement_batches, confirm_settlement_batches

User = get_user_model()


class POSVoidPostingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner1", password="password123", role="owner"
        )
        self.shift = SaldoKasHarian.objects.create(
            kasir=self.user,
            tanggal=timezone.localdate(),
            kas_awal=Decimal("100000"),
            waktu_buka=timezone.now(),
        )
        self.customer = Contact.objects.create(nomor_wa="08123456789", nama="Pelanggan Umum")

        # Classifications
        self.asset_cls = AccountClassification.objects.create(
            name="Aset", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999
        )
        self.rev_cls = AccountClassification.objects.create(
            name="Pendapatan", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999
        )
        self.liab_cls = AccountClassification.objects.create(
            name="Kewajiban", account_type=AccountType.LIABILITY, code_range_start=20000, code_range_end=29999
        )

        # Accounts
        self.kas_account = Account.objects.create(
            code="11101", name="Kas Toko", classification=self.asset_cls
        )
        self.bank_account = Account.objects.create(
            code="11102", name="Bank BCA", classification=self.asset_cls
        )
        self.qris_transit_account = Account.objects.create(
            code="11201", name="Piutang QRIS", classification=self.asset_cls
        )
        self.revenue_account = Account.objects.create(
            code="41101", name="Pendapatan POS", classification=self.rev_cls
        )

        # Settings
        self.settings = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            pos_sales_revenue_account=self.revenue_account,
        )

        # Payment Methods
        self.pm_cash = PaymentMethod.objects.create(
            name="Tunai Fisik",
            payment_type="Tunai",
            account=self.kas_account,
            is_cash=True,
        )
        self.pm_qris = PaymentMethod.objects.create(
            name="QRIS BCA",
            payment_type="QRIS",
            account=self.qris_transit_account,
            is_cash=False,
        )

        # Master POS Payment Methods
        self.pos_pm_cash = POSPaymentMethod.objects.create(
            nama="Cash", tipe="Tunai", accounting_payment_method=self.pm_cash
        )
        self.pos_pm_qris = POSPaymentMethod.objects.create(
            nama="QRIS", tipe="QRIS", accounting_payment_method=self.pm_qris
        )

    def test_void_pos_creates_balanced_reversal_journal(self):
        """Void POS memicu jurnal pembalik yang membalik debit/kredit 1:1 dan menautkan reversed_entry."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 150000,
                "items": [{"nama": "Sticker Graftac", "harga": 150000, "qty": 1}],
            },
        )
        orig_entry = JournalEntry.objects.get(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        )
        self.assertEqual(orig_entry.status, JournalEntry.Status.POSTED)

        # Void sale
        void_sale(sale_id=sale.id, user=self.user)
        sale.refresh_from_db()
        self.assertEqual(sale.status, "void")

        # Verifikasi reversal entry
        reversal = JournalEntry.objects.get(reversed_entry=orig_entry)
        self.assertEqual(reversal.status, JournalEntry.Status.POSTED)

        # Cek baris-baris terbalik
        orig_lines = list(orig_entry.lines.all())
        rev_lines = list(reversal.lines.all())
        self.assertEqual(len(orig_lines), len(rev_lines))

        orig_kas_line = [l for l in orig_lines if l.account == self.kas_account][0]
        rev_kas_line = [l for l in rev_lines if l.account == self.kas_account][0]
        self.assertEqual(orig_kas_line.debit, Decimal("150000"))
        self.assertEqual(orig_kas_line.kredit, Decimal("0"))
        self.assertEqual(rev_kas_line.debit, Decimal("0"))
        self.assertEqual(rev_kas_line.kredit, Decimal("150000"))

        orig_rev_line = [l for l in orig_lines if l.account == self.revenue_account][0]
        rev_rev_line = [l for l in rev_lines if l.account == self.revenue_account][0]
        self.assertEqual(orig_rev_line.debit, Decimal("0"))
        self.assertEqual(orig_rev_line.kredit, Decimal("150000"))
        self.assertEqual(rev_rev_line.debit, Decimal("150000"))
        self.assertEqual(rev_rev_line.kredit, Decimal("0"))

        # Invariant: Jurnal original TIDAK DIHAPUS atau DIEDIT
        orig_entry.refresh_from_db()
        self.assertEqual(orig_entry.status, JournalEntry.Status.POSTED)
        self.assertTrue(JournalAuditLog.objects.filter(
            journal_entry=orig_entry, action=JournalAuditLog.Action.REVERSED
        ).exists())

    def test_void_pos_journal_idempotency(self):
        """Memanggil post_pos_void_journal 2x mengembalikan reversal entry yang sama tanpa duplikasi."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 100000,
                "items": [{"nama": "Print HVS", "harga": 100000, "qty": 1}],
            },
        )
        rev1 = post_pos_void_journal(sale, actor=self.user)
        rev2 = post_pos_void_journal(sale, actor=self.user)
        self.assertIsNotNone(rev1)
        self.assertEqual(rev1.id, rev2.id)

        # Pastikan hanya 1 reversal entry yang ada di DB
        orig_entry = JournalEntry.objects.get(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id, reversed_entry__isnull=True
        )
        count = JournalEntry.objects.filter(reversed_entry=orig_entry).count()
        self.assertEqual(count, 1)

    def test_void_pos_guard_settlement_status(self):
        """Sale non-tunai yang di-void berubah settlement_status='void' & tidak bisa ikut settlement. Sale 'settled' tidak dapat di-void."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "QRIS",
                "dibayar": 200000,
                "items": [{"nama": "Spanduk Flexi", "harga": 200000, "qty": 1}],
            },
        )
        self.assertEqual(sale.settlement_status, "unsettled")

        # Void sale
        void_sale(sale_id=sale.id, user=self.user)
        sale.refresh_from_db()
        self.assertEqual(sale.settlement_status, "void")

        # Pastikan tidak muncul di batch settlement
        tgl = timezone.localdate()
        batches = get_settlement_batches(date_from=tgl, date_to=tgl)
        self.assertEqual(len(batches), 0)

        # Uji guard pada sale berstatus 'settled'
        sale2 = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "QRIS",
                "dibayar": 300000,
                "items": [{"nama": "Banner Rollup", "harga": 300000, "qty": 1}],
            },
        )
        confirm_settlement_batches(
            batch_keys=[{"date": tgl, "payment_method_id": self.pm_qris.id}],
            bank_account_id=self.bank_account.id,
            actor=self.user,
        )
        sale2.refresh_from_db()
        self.assertEqual(sale2.settlement_status, "settled")

        # Void pada sale yang sudah settled WAJIB melempar ValidationError
        with self.assertRaises((ValidationError, DRFValidationError)):
            void_sale(sale_id=sale2.id, user=self.user)

    def test_void_pos_atomic_rollback_on_accounting_error(self):
        """Jika posting jurnal pembalik gagal saat void, seluruh void di-rollback."""
        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 50000,
                "items": [{"nama": "Stempel", "harga": 50000, "qty": 1}],
            },
        )

        # Nonaktifkan modul akuntansi untuk memicu failure saat void
        self.settings.is_active = False
        self.settings.save()

        with self.assertRaises((ValidationError, DRFValidationError)):
            void_sale(sale_id=sale.id, user=self.user)

        # Pastikan status sale di DB TETAP 'paid' (ter-rollback)
        sale.refresh_from_db()
        self.assertEqual(sale.status, "paid")

    def test_void_pos_without_prior_journal_skips_reversal(self):
        """Jika sale dibuat saat modul akuntansi mati (tanpa jurnal), void sale berhasil tanpa error dan skip reversal."""
        self.settings.is_active = False
        self.settings.save()

        sale = create_sale(
            user=self.user,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 50000,
                "items": [{"nama": "Stempel", "harga": 50000, "qty": 1}],
            },
        )
        self.assertIsNone(JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id
        ).first())

        # Nyalakan akuntansi kembali
        self.settings.is_active = True
        self.settings.save()

        # Void sale
        result = void_sale(sale_id=sale.id, user=self.user)
        self.assertEqual(result.status, "void")


class POSVoidAPIPermissionTestCase(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_user", password="password123", role="owner"
        )
        self.kasir = User.objects.create_user(
            username="kasir_user", password="password123", role="kasir"
        )

        self.shift = SaldoKasHarian.objects.create(
            kasir=self.kasir,
            tanggal=timezone.localdate(),
            kas_awal=Decimal("100000"),
            waktu_buka=timezone.now(),
        )
        self.customer = Contact.objects.create(nomor_wa="08123456789", nama="Pelanggan Umum")

        self.sale = create_sale(
            user=self.kasir,
            data={
                "status": "paid",
                "metode_bayar": "Cash",
                "dibayar": 50000,
                "items": [{"nama": "Brosur", "harga": 50000, "qty": 1}],
            },
        )

    def test_permission_void_endpoint(self):
        """Endpoint POST /api/pos/sales/{id}/void/ memverifikasi permission role."""
        url = f"/api/pos/sales/{self.sale.id}/void/"

        # 1. Anonymous -> 401 Unauthorized
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Kasir (tanpa role strict owner/manager) -> 403 Forbidden
        self.client.force_authenticate(user=self.kasir)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Owner -> 200 OK (lulus)
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "void")
