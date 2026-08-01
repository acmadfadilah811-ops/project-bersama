from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import CustomUser, Order, OrderActivityLog
from api.pos_models import POSSale
from accounting.models import AccountingSettings, JournalEntry, JournalEntryLine, PaymentMethod
from accounting.models.coa import Account, AccountClassification
from accounting.services.order_posting import post_order_payment_journal
from accounting.services.pos_posting import post_pos_sale_journal
from accounting.services.settlement import get_settlement_batches, confirm_settlement_batches


class OrderSettlementTestCase(TestCase):
    def setUp(self):
        cls_acc, _ = AccountClassification.objects.get_or_create(
            name="Aset Lancar Test",
            defaults={"account_type": "asset", "order": 1},
        )
        cls_rev, _ = AccountClassification.objects.get_or_create(
            name="Pendapatan Test",
            defaults={"account_type": "revenue", "order": 10},
        )

        self.bank_account = Account.objects.create(
            code="11102", name="Bank BCA Test", account_type="asset", classification=cls_acc
        )
        self.transit_account = Account.objects.create(
            code="11201", name="Transit QRIS Test", account_type="asset", classification=cls_acc
        )
        self.revenue_account = Account.objects.create(
            code="41100", name="Pendapatan Order Test", account_type="revenue", classification=cls_rev
        )
        self.mdr_account = Account.objects.create(
            code="60500", name="Beban MDR Test", account_type="expense", classification=cls_rev
        )

        self.qris_pm = PaymentMethod.objects.create(
            name="QRIS BCA",
            payment_type="QRIS",
            account=self.transit_account,
            is_cash=False,
            mdr_percent=Decimal("1.00"),
            mdr_debit_account=self.mdr_account,
        )

        self.owner = CustomUser.objects.create_superuser(
            username="owner_settlement", email="owner@test.com", password="password123", nip="NIP-SETTLE-001"
        )
        self.owner.role = "owner"
        self.owner.save()

        self.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate(),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            order_sales_revenue_account=self.revenue_account,
            pos_sales_revenue_account=self.revenue_account,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_order_settlement_success(self):
        """Settlement Order berhasil: DP non-tunai memposting JournalEntryLine unsettled, lalu di-settle."""
        today = timezone.localdate()
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Settlement",
            dp_dibayar=100000,
            accounting_payment_method=self.qris_pm,
            metode_pembayaran="qris",
        )
        log = OrderActivityLog.objects.create(
            order=order, user=self.owner, tindakan="PAYMENT", keterangan="DP QRIS"
        )

        entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.owner, jumlah_bayar=Decimal("100000"), is_dp=True
        )
        self.assertIsNotNone(entry)

        # Check line status is unsettled
        transit_line = entry.lines.filter(account=self.transit_account).first()
        self.assertIsNotNone(transit_line)
        self.assertEqual(transit_line.settlement_status, "unsettled")

        # Batches list should show this batch
        batches = get_settlement_batches(date_from=today, date_to=today)
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0]["order_count"], 1)
        self.assertEqual(batches[0]["total_amount"], Decimal("100000"))

        # Confirm settlement
        confirm_entries = confirm_settlement_batches(
            batch_keys=[{"date": today.isoformat(), "payment_method_id": self.qris_pm.id}],
            bank_account_id=self.bank_account.id,
            actor=self.owner,
        )
        self.assertEqual(len(confirm_entries), 1)
        settle_entry = confirm_entries[0]
        self.assertEqual(settle_entry.source_type, JournalEntry.SourceType.SETTLEMENT)

        # Total debit == total credit
        lines = list(settle_entry.lines.all())
        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, Decimal("100000"))
        self.assertEqual(total_kredit, Decimal("100000"))

        # Check MDR 1% calculation: 1.00% of 100,000 = 1,000
        bank_line = settle_entry.lines.filter(account=self.bank_account).first()
        mdr_line = settle_entry.lines.filter(account=self.mdr_account).first()
        self.assertEqual(bank_line.debit, Decimal("99000"))
        self.assertEqual(mdr_line.debit, Decimal("1000"))

        # Re-query transit line, status should be settled
        transit_line.refresh_from_db()
        self.assertEqual(transit_line.settlement_status, "settled")
        order.refresh_from_db()
        self.assertEqual(order.settlement_status, "settled")

    def test_settlement_retry_idempotency(self):
        """Retry confirm batch yang sama tidak menggandakan jurnal."""
        today = timezone.localdate()
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Retry",
            dp_dibayar=50000,
            accounting_payment_method=self.qris_pm,
            metode_pembayaran="qris",
        )
        log = OrderActivityLog.objects.create(
            order=order, user=self.owner, tindakan="PAYMENT", keterangan="DP QRIS"
        )
        post_order_payment_journal(
            order=order, activity_log=log, actor=self.owner, jumlah_bayar=Decimal("50000"), is_dp=True
        )

        entries1 = confirm_settlement_batches(
            batch_keys=[{"date": today.isoformat(), "payment_method_id": self.qris_pm.id}],
            bank_account_id=self.bank_account.id,
            actor=self.owner,
        )
        self.assertEqual(len(entries1), 1)

        # Retry confirm
        entries2 = confirm_settlement_batches(
            batch_keys=[{"date": today.isoformat(), "payment_method_id": self.qris_pm.id}],
            bank_account_id=self.bank_account.id,
            actor=self.owner,
        )
        self.assertEqual(len(entries2), 1)
        self.assertEqual(entries1[0].id, entries2[0].id)

    def test_settlement_empty_or_no_unsettled_items(self):
        """Confirm pada batch tanpa transaksi unsettled harus gagal/raise ValidationError."""
        today = timezone.localdate()
        with self.assertRaises(Exception):
            confirm_settlement_batches(
                batch_keys=[{"date": today.isoformat(), "payment_method_id": self.qris_pm.id}],
                bank_account_id=self.bank_account.id,
                actor=self.owner,
            )

    def test_pos_and_order_combined_settlement_regression(self):
        """Regresi: POS + Order pada tanggal & PM sama berhasil digabung dalam 1 settlement entry."""
        today = timezone.localdate()

        # POS Sale
        pos_sale = POSSale.objects.create(
            nomor="POS-SETTLE-001",
            total=150000,
            subtotal=150000,
            metode_bayar="qris",
            accounting_payment_method=self.qris_pm,
            status="paid",
            settlement_status="unsettled",
        )
        pos_entry = post_pos_sale_journal(pos_sale)
        self.assertIsNotNone(pos_entry)

        # Order payment
        order = Order.objects.create(
            nomor_wa="08123456789",
            nama="Pelanggan Combined",
            dp_dibayar=50000,
            accounting_payment_method=self.qris_pm,
            metode_pembayaran="qris",
        )
        log = OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="PAYMENT")
        order_entry = post_order_payment_journal(
            order=order, activity_log=log, actor=self.owner, jumlah_bayar=Decimal("50000")
        )
        self.assertIsNotNone(order_entry)

        # Combined batch in get_settlement_batches
        batches = get_settlement_batches(date_from=today, date_to=today)
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0]["pos_sale_count"], 1)
        self.assertEqual(batches[0]["order_count"], 1)
        self.assertEqual(batches[0]["total_amount"], Decimal("200000"))

        # Confirm combined settlement
        entries = confirm_settlement_batches(
            batch_keys=[{"date": today.isoformat(), "payment_method_id": self.qris_pm.id}],
            bank_account_id=self.bank_account.id,
            actor=self.owner,
        )
        self.assertEqual(len(entries), 1)
        self.assertEqual(sum(l.kredit for l in entries[0].lines.all()), Decimal("200000"))
