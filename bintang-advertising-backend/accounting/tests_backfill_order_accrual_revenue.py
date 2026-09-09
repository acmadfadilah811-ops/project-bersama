"""Backfill Piutang/Pendapatan (accrual) untuk Order 'selesai' lama --
management command api/management/commands/backfill_order_accrual_revenue.py.
Keputusan pengguna 2026-09-09: order lama juga di-backfill, bukan cuma
berlaku maju untuk order baru."""
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from api.models import CustomUser, Order, OrderActivityLog, OrderItem
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification


class BackfillOrderAccrualRevenueTestCase(TestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username="owner_backfill", password="pw", role="owner")

        asset_cls = AccountClassification.objects.create(
            name="Aset Backfill", account_type="asset", code_range_start=11000, code_range_end=11999,
        )
        rev_cls = AccountClassification.objects.create(
            name="Pendapatan Backfill", account_type="revenue", code_range_start=40000, code_range_end=49999,
        )
        self.revenue_account = Account.objects.create(
            code="41200", name="Pendapatan Order Backfill", account_type="revenue", classification=rev_cls,
        )
        self.receivable_account = Account.objects.create(
            code="11310", name="Piutang Usaha Backfill", account_type="asset", classification=asset_cls,
        )

        AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate().replace(day=1) - timezone.timedelta(days=90),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            order_sales_revenue_account=self.revenue_account,
            order_receivable_account=self.receivable_account,
        )

    def _order_selesai(self, harga=200_000, dengan_complete_log=True):
        order = Order.objects.create(
            nomor_wa="081399911100", nama="Pelanggan Lama", status_global="selesai",
        )
        OrderItem.objects.create(order=order, jenis_produk="Item Lama", harga_jual=harga)
        order.refresh_from_db()
        if dengan_complete_log:
            OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="COMPLETE", keterangan="selesai lama")
        return order

    def test_backfill_posting_order_selesai_lama(self):
        order = self._order_selesai(harga=200_000)
        call_command("backfill_order_accrual_revenue", stdout=StringIO())

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION,
        ).first()
        self.assertIsNotNone(entry)
        lines = list(entry.lines.all())
        self.assertEqual(sum(l.debit for l in lines), sum(l.kredit for l in lines))
        revenue_line = next(l for l in lines if l.account_id == self.revenue_account.id)
        self.assertEqual(revenue_line.kredit, Decimal("200000.00"))

    def test_backfill_idempotent_tidak_dobel(self):
        self._order_selesai(harga=150_000)
        call_command("backfill_order_accrual_revenue", stdout=StringIO())
        call_command("backfill_order_accrual_revenue", stdout=StringIO())

        count = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION,
        ).count()
        self.assertEqual(count, 1)

    def test_backfill_skip_order_total_harga_nol(self):
        order = Order.objects.create(nomor_wa="081399911101", nama="Pelanggan Kosong", status_global="selesai")
        self.assertEqual(order.total_harga, 0)
        call_command("backfill_order_accrual_revenue", stdout=StringIO())
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION).count(), 0,
        )

    def test_backfill_dry_run_tidak_menyimpan(self):
        self._order_selesai(harga=100_000)
        call_command("backfill_order_accrual_revenue", "--dry-run", stdout=StringIO())
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION).count(), 0,
        )

    def test_backfill_membuat_complete_log_kalau_belum_ada(self):
        """Order 'selesai' lama yang statusnya di-set langsung (bukan lewat
        selesaikan_order()) tidak punya log COMPLETE -- backfill harus tetap
        bisa memposting dengan membuat log itu otomatis."""
        order = self._order_selesai(harga=80_000, dengan_complete_log=False)
        self.assertFalse(OrderActivityLog.objects.filter(order=order, tindakan="COMPLETE").exists())

        call_command("backfill_order_accrual_revenue", stdout=StringIO())

        self.assertTrue(OrderActivityLog.objects.filter(order=order, tindakan="COMPLETE").exists())
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION).count(), 1,
        )
