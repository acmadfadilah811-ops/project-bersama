"""
accounting/tests_order_hpp.py
T-204: Test posting HPP bahan baku Order (via JobBoard) ke accounting.JournalEntry.
"""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import (
    CustomUser, Divisi, TahapProses, Order, OrderItem, JobBoard,
    InventoryItem, RestockHistory,
)
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification
from accounting.services.order_posting import (
    compute_order_material_hpp,
    post_order_material_hpp_journal,
)


class OrderHppSetupMixin:
    @classmethod
    def setUpTestData(cls):
        cls_asset, _ = AccountClassification.objects.get_or_create(
            name="Aset Lancar Test HPP",
            defaults={"account_type": "asset", "order": 1},
        )
        cls_exp, _ = AccountClassification.objects.get_or_create(
            name="Beban Test HPP",
            defaults={"account_type": "expense", "order": 50},
        )
        cls.hpp_account = Account.objects.create(
            code="5-T204-001", name="HPP Bahan Baku Order Test",
            account_type="expense", classification=cls_exp,
        )
        cls.persediaan_account = Account.objects.create(
            code="1-T204-001", name="Persediaan Bahan Baku Test",
            account_type="asset", classification=cls_asset,
        )

        cls.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            order_hpp_expense_account=cls.hpp_account,
            order_material_inventory_account=cls.persediaan_account,
        )

        cls.divisi = Divisi.objects.create(nama="Produksi Test", keterangan="")
        cls.tahap = TahapProses.objects.create(nama="Cetak", divisi=cls.divisi, urutan=1)
        cls.staff = CustomUser.objects.create_user(
            username="staff_produksi_t204", password="pw", role="staff", divisi=cls.divisi,
        )
        cls.owner = CustomUser.objects.create_user(
            username="owner_t204", password="pw", role="owner",
        )

    def _make_order_with_job(self, harga_jual=200000, cost_per_unit=15000, qty_consumed=3):
        """Order + 1 OrderItem + 1 JobBoard yang mengonsumsi InventoryItem via
        RestockHistory bertanda 'Job #<id>' (satu-satunya tautan yang ada)."""
        order = Order.objects.create(nomor_wa="081298765432", nama="Pelanggan HPP Test")
        item = OrderItem.objects.create(order=order, jenis_produk="Banner Custom", harga_jual=harga_jual)
        job = JobBoard.objects.create(
            order_item=item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan="antrean",
        )
        bahan = InventoryItem.objects.create(
            id="INV-T204-TEST", nama="Vinyl Test", stok=100.0, satuan="m2",
            kategori="Bahan Cetak", cost_per_unit=cost_per_unit,
        )
        RestockHistory.objects.create(
            item=bahan, user=self.staff, delta=-qty_consumed,
            stok_awal=100.0, stok_akhir=100.0 - qty_consumed,
            keterangan=f"Pemakaian bahan Job #{job.id} untuk produksi",
        )
        return order, job


class ComputeOrderMaterialHppTestCase(OrderHppSetupMixin, TestCase):
    def test_compute_hpp_sums_matching_job_history(self):
        order, _job = self._make_order_with_job(cost_per_unit=15000, qty_consumed=3)
        hpp = compute_order_material_hpp(order)
        self.assertEqual(hpp, Decimal("45000"))

    def test_compute_hpp_zero_when_no_job(self):
        order = Order.objects.create(nomor_wa="081200000000", nama="Tanpa Job")
        self.assertEqual(compute_order_material_hpp(order), Decimal("0"))


class PostOrderMaterialHppJournalTestCase(OrderHppSetupMixin, TestCase):
    def test_posts_balanced_journal(self):
        order, job = self._make_order_with_job(cost_per_unit=20000, qty_consumed=2)
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="COMPLETE", keterangan="selesai")

        entry = post_order_material_hpp_journal(order=order, actor=self.owner, activity_log=log)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 2)
        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, total_kredit)
        self.assertEqual(total_debit, Decimal("40000.00"))

    def test_idempotent_on_same_activity_log(self):
        order, job = self._make_order_with_job()
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="COMPLETE", keterangan="selesai")

        entry1 = post_order_material_hpp_journal(order=order, actor=self.owner, activity_log=log)
        entry2 = post_order_material_hpp_journal(order=order, actor=self.owner, activity_log=log)
        self.assertEqual(entry1.id, entry2.id)

    def test_skips_when_accounts_not_configured(self):
        self.settings_row.order_hpp_expense_account = None
        self.settings_row.save(update_fields=["order_hpp_expense_account"])

        order, job = self._make_order_with_job()
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="COMPLETE", keterangan="selesai")
        result = post_order_material_hpp_journal(order=order, actor=self.owner, activity_log=log)
        self.assertIsNone(result)

        self.settings_row.order_hpp_expense_account = self.hpp_account
        self.settings_row.save(update_fields=["order_hpp_expense_account"])

    def test_no_journal_when_no_material_consumed(self):
        order = Order.objects.create(nomor_wa="081200000001", nama="Tanpa Bahan")
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.create(order=order, user=self.owner, tindakan="COMPLETE", keterangan="selesai")
        result = post_order_material_hpp_journal(order=order, actor=self.owner, activity_log=log)
        self.assertIsNone(result)


class SelesaikanOrderHppApiTestCase(OrderHppSetupMixin, APITestCase):
    """Integrasi penuh lewat POST /api/orders/:id/selesaikan/."""

    def setUp(self):
        self.client.force_authenticate(user=self.owner)

    def test_selesaikan_posts_hpp_journal(self):
        order, job = self._make_order_with_job(cost_per_unit=25000, qty_consumed=4)

        response = self.client.post(f"/api/orders/{order.id}/selesaikan/", format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status_global, "selesai")

        from api.models import OrderActivityLog
        complete_log = OrderActivityLog.objects.filter(order=order, tindakan="COMPLETE").last()
        self.assertIsNotNone(complete_log)

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_MATERIAL_HPP,
            source_id=complete_log.id,
        ).first()
        self.assertIsNotNone(entry, "JournalEntry HPP harus terbuat setelah selesaikan()")
        lines = list(entry.lines.all())
        self.assertEqual(sum(l.debit for l in lines), Decimal("100000.00"))
        self.assertEqual(sum(l.kredit for l in lines), Decimal("100000.00"))

    def test_selesaikan_succeeds_without_material_consumed(self):
        """Order tanpa job/bahan tetap bisa diselesaikan tanpa error (HPP nol → skip, bukan blocker)."""
        order = Order.objects.create(nomor_wa="081200000002", nama="Order Polos")
        response = self.client.post(f"/api/orders/{order.id}/selesaikan/", format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        order.refresh_from_db()
        self.assertEqual(order.status_global, "selesai")
