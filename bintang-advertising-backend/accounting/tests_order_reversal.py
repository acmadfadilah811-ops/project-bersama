from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import CustomUser, Order, OrderActivityLog
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification
from accounting.models.cashbank import PaymentMethod
from accounting.services.order_posting import post_order_payment_journal, post_order_reversal_journal


class OrderReversalTestCase(TestCase):
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
            code="11101", name="Kas Tunai Test", account_type="asset", classification=cls_acc
        )
        self.revenue_account = Account.objects.create(
            code="41100", name="Pendapatan Order Test", account_type="revenue", classification=cls_rev
        )

        self.payment_method = PaymentMethod.objects.create(
            name="Tunai Test",
            payment_type="Tunai",
            account=self.kas_account,
            is_cash=True,
        )

        self.user = CustomUser.objects.create_user(
            username="kasir_reversal", password="password123", role="kasir", nip="NIP-REV-001"
        )
        self.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate(),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            order_sales_revenue_account=self.revenue_account,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_cancellation_creates_reversal_journal(self):
        """Order dibatalkan via POST /api/orders/{id}/batalkan/ memposting JournalEntry pembalik."""
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Batal",
            dp_dibayar=50000,
            accounting_payment_method=self.payment_method,
            status_global="proses",
        )
        log = OrderActivityLog.objects.create(order=order, user=self.user, tindakan="PAYMENT")
        orig_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.user, jumlah_bayar=Decimal("50000")
        )
        self.assertIsNotNone(orig_entry)

        res = self.client.post(f"/api/orders/{order.id}/batalkan/", data={"alasan": "Batal pesan"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        order.refresh_from_db()
        self.assertEqual(order.status_global, "batal")

        reversal_entries = JournalEntry.objects.filter(reversed_entry=orig_entry)
        self.assertEqual(reversal_entries.count(), 1)
        reversal = reversal_entries.first()
        self.assertEqual(reversal.status, JournalEntry.Status.POSTED)

        # Debit == Credit check
        lines = list(reversal.lines.all())
        sum_debit = sum(l.debit for l in lines)
        sum_kredit = sum(l.kredit for l in lines)
        self.assertEqual(sum_debit, Decimal("50000"))
        self.assertEqual(sum_kredit, Decimal("50000"))

        # In reversed entry, Kas (asset) is KREDIT 50.000, Pendapatan is DEBIT 50.000
        kas_line = reversal.lines.get(account=self.kas_account)
        rev_line = reversal.lines.get(account=self.revenue_account)
        self.assertEqual(kas_line.kredit, Decimal("50000"))
        self.assertEqual(rev_line.debit, Decimal("50000"))

    def test_return_creates_reversal_journal(self):
        """Order diretur via POST /api/orders/{id}/retur/ memposting JournalEntry pembalik."""
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Retur",
            dp_dibayar=75000,
            accounting_payment_method=self.payment_method,
            status_global="selesai",
        )
        log = OrderActivityLog.objects.create(order=order, user=self.user, tindakan="PAYMENT")
        orig_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.user, jumlah_bayar=Decimal("75000")
        )
        self.assertIsNotNone(orig_entry)

        res = self.client.post(
            f"/api/orders/{order.id}/retur/",
            data={"catatan": "Barang cacat", "nominal_refund": 75000},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        reversal_entries = JournalEntry.objects.filter(reversed_entry=orig_entry)
        self.assertEqual(reversal_entries.count(), 1)
        reversal = reversal_entries.first()
        self.assertEqual(reversal.status, JournalEntry.Status.POSTED)

        # Debit == Credit check
        sum_debit = sum(l.debit for l in reversal.lines.all())
        sum_kredit = sum(l.kredit for l in reversal.lines.all())
        self.assertEqual(sum_debit, Decimal("75000"))
        self.assertEqual(sum_kredit, Decimal("75000"))

    def test_reversal_idempotency_retry(self):
        """Service post_order_reversal_journal dipanggil 2x tidak menggandakan jurnal."""
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Idempotent",
            dp_dibayar=30000,
            accounting_payment_method=self.payment_method,
            status_global="proses",
        )
        log = OrderActivityLog.objects.create(order=order, user=self.user, tindakan="PAYMENT")
        orig_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.user, jumlah_bayar=Decimal("30000")
        )
        self.assertIsNotNone(orig_entry)

        res1 = post_order_reversal_journal(order=order, actor=self.user)
        self.assertEqual(len(res1), 1)

        res2 = post_order_reversal_journal(order=order, actor=self.user)
        self.assertEqual(len(res2), 1)
        self.assertEqual(res1[0].id, res2[0].id)

    def test_batalkan_reversal_failure_rolls_back_order_status(self):
        """
        M5 (verifikasi manager 2026-08-01): kegagalan posting jurnal pembalik
        harus rollback SELURUH aksi batalkan (status Order, activity log),
        bukan cuma jurnalnya yang diam-diam gagal sementara status tetap 'batal'.
        """
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Gagal Reversal",
            dp_dibayar=40000,
            accounting_payment_method=self.payment_method,
            status_global="proses",
        )
        log = OrderActivityLog.objects.create(order=order, user=self.user, tindakan="PAYMENT")
        orig_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.user, jumlah_bayar=Decimal("40000")
        )
        self.assertIsNotNone(orig_entry)
        activity_count_before = OrderActivityLog.objects.filter(order=order).count()

        with mock.patch(
            "accounting.services.order_posting.post_order_reversal_journal",
            side_effect=RuntimeError("Simulasi kegagalan posting jurnal pembalik"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(f"/api/orders/{order.id}/batalkan/", data={"alasan": "Batal"}, format="json")

        order.refresh_from_db()
        self.assertEqual(
            order.status_global, "proses",
            "Status Order harus tetap 'proses' setelah rollback — bukan 'batal' dengan jurnal yang hilang diam-diam.",
        )
        self.assertEqual(
            OrderActivityLog.objects.filter(order=order).count(), activity_count_before,
            "Activity log CANCEL tidak boleh ikut ter-commit kalau jurnal pembalik gagal.",
        )
        self.assertEqual(JournalEntry.objects.filter(reversed_entry=orig_entry).count(), 0)

    def test_retur_reversal_failure_rolls_back_pengembalian_order(self):
        """M5: sama seperti batalkan() — kegagalan reversal harus rollback PengembalianOrder juga."""
        from api.models import PengembalianOrder

        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Gagal Retur",
            dp_dibayar=60000,
            accounting_payment_method=self.payment_method,
            status_global="selesai",
        )
        log = OrderActivityLog.objects.create(order=order, user=self.user, tindakan="PAYMENT")
        orig_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.user, jumlah_bayar=Decimal("60000")
        )
        self.assertIsNotNone(orig_entry)

        with mock.patch(
            "accounting.services.order_posting.post_order_reversal_journal",
            side_effect=RuntimeError("Simulasi kegagalan posting jurnal pembalik"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    f"/api/orders/{order.id}/retur/",
                    data={"catatan": "Barang cacat", "nominal_refund": 60000},
                    format="json",
                )

        self.assertEqual(
            PengembalianOrder.objects.filter(order=order).count(), 0,
            "PengembalianOrder tidak boleh ter-commit kalau jurnal pembalik retur gagal.",
        )
        self.assertEqual(JournalEntry.objects.filter(reversed_entry=orig_entry).count(), 0)

    def test_order_without_journal_reversal_graceful_skip(self):
        """Order tanpa jurnal asli di-cancel / di-retur tidak melempar exception dan 0 reversal entry."""
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Tanpa Jurnal",
            dp_dibayar=0,
            status_global="proses",
        )

        res = self.client.post(f"/api/orders/{order.id}/batalkan/", data={"alasan": "Batal"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        count = JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_PAYMENT).count()
        self.assertEqual(count, 0)
