"""
accounting/tests_order_posting.py
T-202: Test posting pembayaran Order ke accounting.JournalEntry.

Wajib (T3):
  - happy path DP + pelunasan → JournalEntry terpisah, D=K
  - idempotency: panggil 2x dengan activity_log sama → tetap 1 entry
  - gating: modul nonaktif → 0 entry + bayar() sukses
  - gating: akun belum dikonfigurasi → 0 entry + bayar() sukses
  - rollback: posting gagal di dalam bayar() → order tidak berubah
"""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import CustomUser, Order, OrderActivityLog, OrderItem
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification
from accounting.models.cashbank import PaymentMethod
from accounting.services.order_posting import (
    post_order_payment_journal,
    should_post_order_payment,
)



class OrderPostingSetupMixin:
    """Mixin: setup minimal untuk semua test kelas ini."""

    @classmethod
    def setUpTestData(cls):
        # Klasifikasi COA — pakai field yang benar (account_type, bukan code)
        cls_acc, _ = AccountClassification.objects.get_or_create(
            name="Aset Lancar Test",
            defaults={"account_type": "asset", "order": 1},
        )
        cls_rev, _ = AccountClassification.objects.get_or_create(
            name="Pendapatan Test",
            defaults={"account_type": "revenue", "order": 10},
        )
        cls.kas_account = Account.objects.create(
            code="1-T202-001", name="Kas Tunai Test T202",
            account_type="asset", classification=cls_acc,
        )
        cls.revenue_account = Account.objects.create(
            code="4-T202-001", name="Pendapatan Order Test T202",
            account_type="revenue", classification=cls_rev,
        )

        # PaymentMethod
        cls.payment_method = PaymentMethod.objects.create(
            name="Tunai Test",
            payment_type="Tunai",
            account=cls.kas_account,
            is_cash=True,
        )
        cls.qris_payment_method = PaymentMethod.objects.create(
            name="QRIS Test",
            payment_type="QRIS",
            account=cls.kas_account,
            is_cash=False,
        )

        # User kasir
        cls.kasir = CustomUser.objects.create_user(
            username="kasir_t202", password="pw", role="kasir",
        )

        # AccountingSettings
        cls.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate(),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            order_sales_revenue_account=cls.revenue_account,
        )

    def _make_order(self, with_pm=True):
        order = Order.objects.create(
            nomor_wa="081234567890",
            nama="Pelanggan Test",
            dp_dibayar=0,
            metode_pembayaran="tunai" if with_pm else "metode_tidak_dikenal_xyz",
            accounting_payment_method=self.payment_method if with_pm else None,
        )
        return order

    def _make_payment_log(self, order, jumlah):
        return OrderActivityLog.objects.create(
            order=order,
            user=self.kasir,
            tindakan="PAYMENT",
            keterangan=f"Pembayaran {jumlah} [test]",
        )

    def _add_item(self, order, harga_jual=10_000_000):
        """T-203: /bayar/ menolak jumlah_bayar > sisa_tagihan — beri Order
        item bernilai cukup besar supaya total_harga tidak nol di test."""
        OrderItem.objects.create(order=order, jenis_produk="Item Test", harga_jual=harga_jual)
        order.refresh_from_db()
        return order


class OrderPostingUnitTest(OrderPostingSetupMixin, TestCase):
    """Unit test langsung ke service — tidak lewat API."""

    # ── Happy Path ────────────────────────────────────────────────────────────

    def test_posting_dp_creates_journal_entry(self):
        """post_order_payment_journal() membuat JournalEntry dengan D=K."""
        order = self._make_order()
        activity_log = self._make_payment_log(order, 100_000)

        entry = post_order_payment_journal(
            order=order,
            activity_log=activity_log,
            actor=self.kasir,
            jumlah_bayar=Decimal("100000"),
            is_dp=True,
        )

        self.assertIsNotNone(entry)
        self.assertEqual(entry.source_type, JournalEntry.SourceType.ORDER_PAYMENT)
        self.assertEqual(entry.source_id, activity_log.id)
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        # Verifikasi balance D=K (T3)
        lines = entry.lines.all()
        total_debit = sum(l.debit for l in lines)
        total_kredit = sum(l.kredit for l in lines)
        self.assertEqual(total_debit, Decimal("100000"))
        self.assertEqual(total_kredit, Decimal("100000"))
        self.assertEqual(total_debit, total_kredit)

    def test_posting_pelunasan_creates_separate_entry(self):
        """Pelunasan membuat JournalEntry terpisah dari DP — per panggilan bayar()."""
        order = self._make_order()
        log_dp = self._make_payment_log(order, 50_000)
        log_lunas = self._make_payment_log(order, 50_000)

        entry_dp = post_order_payment_journal(
            order=order, activity_log=log_dp, actor=self.kasir,
            jumlah_bayar=Decimal("50000"), is_dp=True,
        )
        entry_lunas = post_order_payment_journal(
            order=order, activity_log=log_lunas, actor=self.kasir,
            jumlah_bayar=Decimal("50000"), is_dp=False,
        )

        self.assertNotEqual(entry_dp.id, entry_lunas.id)
        # Verifikasi masing-masing balance (T3)
        for entry in [entry_dp, entry_lunas]:
            lines = entry.lines.all()
            self.assertEqual(sum(l.debit for l in lines), sum(l.kredit for l in lines))

    # ── Idempotency (T3) ──────────────────────────────────────────────────────

    def test_idempotency_same_activity_log(self):
        """Panggil 2x dengan activity_log sama → tetap 1 JournalEntry (M4)."""
        order = self._make_order()
        activity_log = self._make_payment_log(order, 75_000)

        entry_1 = post_order_payment_journal(
            order=order, activity_log=activity_log, actor=self.kasir,
            jumlah_bayar=Decimal("75000"),
        )
        entry_2 = post_order_payment_journal(
            order=order, activity_log=activity_log, actor=self.kasir,
            jumlah_bayar=Decimal("75000"),
        )

        self.assertEqual(entry_1.id, entry_2.id)
        # Pastikan benar-benar hanya 1 entry di DB
        count = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            source_id=activity_log.id,
        ).exclude(status=JournalEntry.Status.VOID).count()
        self.assertEqual(count, 1)

    # ── Gating — Skip Tests ───────────────────────────────────────────────────

    def test_gating_skips_when_accounting_inactive(self):
        """Posting di-skip jika modul akuntansi nonaktif — bayar() harus tetap sukses."""
        self.settings_row.is_active = False
        self.settings_row.save(update_fields=["is_active"])

        order = self._make_order()
        activity_log = self._make_payment_log(order, 50_000)

        result = post_order_payment_journal(
            order=order, activity_log=activity_log, actor=self.kasir,
            jumlah_bayar=Decimal("50000"),
        )
        self.assertIsNone(result)

        # Pastikan nol JournalEntry terbuat
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_PAYMENT).count(), 0
        )

        # Restore untuk test lain
        self.settings_row.is_active = True
        self.settings_row.save(update_fields=["is_active"])

    def test_gating_skips_when_revenue_account_not_set(self):
        """Posting di-skip jika order_sales_revenue_account belum dikonfigurasi."""
        old_acc = self.settings_row.order_sales_revenue_account
        self.settings_row.order_sales_revenue_account = None
        self.settings_row.save(update_fields=["order_sales_revenue_account"])

        order = self._make_order()
        activity_log = self._make_payment_log(order, 50_000)

        result = post_order_payment_journal(
            order=order, activity_log=activity_log, actor=self.kasir,
            jumlah_bayar=Decimal("50000"),
        )
        self.assertIsNone(result)

        # Restore
        self.settings_row.order_sales_revenue_account = old_acc
        self.settings_row.save(update_fields=["order_sales_revenue_account"])

    def test_gating_skips_when_payment_method_not_set(self):
        """Posting di-skip jika Order.accounting_payment_method belum ter-resolve dan tidak ada PaymentMethod yang cocok."""
        order = self._make_order(with_pm=False)  # tanpa payment method
        order.metode_pembayaran = "metode_tanpa_mapping_123"
        order.save()
        activity_log = self._make_payment_log(order, 50_000)

        result = post_order_payment_journal(
            order=order, activity_log=activity_log, actor=self.kasir,
            jumlah_bayar=Decimal("50000"),
        )
        self.assertIsNone(result)


    def test_gating_skips_zero_amount(self):
        """Posting di-skip jika jumlah bayar = 0."""
        order = self._make_order()
        activity_log = self._make_payment_log(order, 0)

        result = post_order_payment_journal(
            order=order, activity_log=activity_log, actor=self.kasir,
            jumlah_bayar=Decimal("0"),
        )
        self.assertIsNone(result)

    # ── should_post_order_payment() ───────────────────────────────────────────

    def test_should_post_returns_true_when_all_conditions_met(self):
        order = self._make_order()
        eligible, reason = should_post_order_payment(order, Decimal("100000"))
        self.assertTrue(eligible, reason)

    def test_should_post_returns_false_when_pm_missing(self):
        order = self._make_order(with_pm=False)
        eligible, reason = should_post_order_payment(order, Decimal("100000"))
        self.assertFalse(eligible)
        self.assertIn("dipetakan", reason)


class OrderPostingViaAPITest(OrderPostingSetupMixin, APITestCase):
    """Test melalui endpoint /api/orders/:id/bayar/ — integrasi penuh."""

    def setUp(self):
        self.client.force_authenticate(user=self.kasir)
        self.order = Order.objects.create(
            nomor_wa="081234567890",
            nama="Pelanggan API Test",
            dp_dibayar=0,
            accounting_payment_method=self.payment_method,
        )
        self._add_item(self.order)

    def test_bayar_dp_creates_journal_via_api(self):
        """POST /api/orders/:id/bayar/ dengan DP membuat JournalEntry."""
        response = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 100000, "metode_pembayaran": "tunai", "idempotency_key": "test-dp-001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payment_log = OrderActivityLog.objects.filter(
            order=self.order, tindakan="PAYMENT"
        ).order_by("-id").first()
        self.assertIsNotNone(payment_log)

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            source_id=payment_log.id,
        ).first()
        self.assertIsNotNone(entry, "JournalEntry harus terbuat setelah bayar()")
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

        # D = K
        lines = entry.lines.all()
        self.assertEqual(sum(l.debit for l in lines), sum(l.kredit for l in lines))

    def test_bayar_idempotency_via_api(self):
        """POST /api/orders/:id/bayar/ 2x dengan idempotency_key sama → 1 JournalEntry (M4)."""
        payload = {"jumlah_bayar": 50000, "metode_pembayaran": "tunai", "idempotency_key": "idem-key-42"}

        res1 = self.client.post(f"/api/orders/{self.order.id}/bayar/", data=payload, format="json")
        res2 = self.client.post(f"/api/orders/{self.order.id}/bayar/", data=payload, format="json")

        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # Hanya 1 entry PAYMENT di activity log (request ke-2 di-short-circuit oleh idempotency_key)
        payment_logs = OrderActivityLog.objects.filter(
            order=self.order, tindakan="PAYMENT"
        )
        self.assertEqual(payment_logs.count(), 1)

        # Oleh karena itu hanya 1 JournalEntry terbuat
        entry_count = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            source_id=payment_logs.first().id,
        ).exclude(status=JournalEntry.Status.VOID).count()
        self.assertEqual(entry_count, 1)

    def test_bayar_sukses_meskipun_akuntansi_belum_aktif(self):
        """bayar() tetap sukses (gating fail-open) saat akuntansi belum aktif."""
        self.settings_row.is_active = False
        self.settings_row.save(update_fields=["is_active"])

        response = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 75000, "metode_pembayaran": "tunai"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        # Tidak ada JournalEntry terbuat, tapi pembayaran berhasil
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_PAYMENT).count(), 0
        )

        # Restore
        self.settings_row.is_active = True
        self.settings_row.save(update_fields=["is_active"])

    def test_bayar_sukses_meskipun_pm_belum_dipetakan(self):
        """bayar() tetap sukses saat metode_pembayaran tidak dapat dipetakan ke PaymentMethod mana pun."""
        order_tanpa_pm = Order.objects.create(
            nomor_wa="081234567891",
            nama="Pelanggan Tanpa PM",
            dp_dibayar=0,
            accounting_payment_method=None,
        )
        self._add_item(order_tanpa_pm)
        response = self.client.post(
            f"/api/orders/{order_tanpa_pm.id}/bayar/",
            data={"jumlah_bayar": 30000, "metode_pembayaran": "metode_tidak_dikenal_xyz"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        # Nol JournalEntry ORDER_PAYMENT untuk order ini
        payment_log = OrderActivityLog.objects.filter(
            order=order_tanpa_pm, tindakan="PAYMENT"
        ).first()
        if payment_log:
            count = JournalEntry.objects.filter(
                source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                source_id=payment_log.id,
            ).count()
            self.assertEqual(count, 0)

    def test_auto_resolve_payment_method_on_bayar_without_preset_fk(self):
        """
        Pembuktian resolusi otomatis: Order dibuat TANPA pre-set FK accounting_payment_method.
        Saat /bayar/ dipanggil dengan string 'tunai', FK ter-resolve otomatis ke PaymentMethod
        DAN JournalEntry benar-benar terbuat.
        """
        order_polos = Order.objects.create(
            nomor_wa="081234567892",
            nama="Pelanggan Polos",
            dp_dibayar=0,
            accounting_payment_method=None,
        )
        self._add_item(order_polos)
        self.assertIsNone(order_polos.accounting_payment_method)

        response = self.client.post(
            f"/api/orders/{order_polos.id}/bayar/",
            data={"jumlah_bayar": 50000, "metode_pembayaran": "tunai"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        order_polos.refresh_from_db()
        self.assertIsNotNone(
            order_polos.accounting_payment_method,
            "accounting_payment_method harus ter-resolve otomatis oleh bayar()",
        )
        self.assertEqual(order_polos.accounting_payment_method, self.payment_method)

        payment_log = OrderActivityLog.objects.filter(
            order=order_polos, tindakan="PAYMENT"
        ).first()
        self.assertIsNotNone(payment_log)

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            source_id=payment_log.id,
        ).first()
        self.assertIsNotNone(entry, "JournalEntry HARUS benar-benar terbuat setelah auto-resolusi")
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

    def test_auto_resolve_payment_method_on_perform_create_dp_without_preset_fk(self):
        """
        Pembuktian resolusi DP awal: POST /api/orders/ dengan dp_dibayar & metode_pembayaran string.
        FK accounting_payment_method ter-resolve otomatis DAN JournalEntry DP terbuat.
        """
        response = self.client.post(
            "/api/orders/",
            data={
                "nomor_wa": "081234567893",
                "nama": "Pelanggan DP Awal",
                "dp_dibayar": 40000,
                "metode_pembayaran": "tunai",
                "status_global": "review",
                "dilayani_oleh": self.kasir.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        order_id = response.data["id"]
        order = Order.objects.get(pk=order_id)
        self.assertIsNotNone(
            order.accounting_payment_method,
            "accounting_payment_method harus ter-resolve otomatis saat perform_create()",
        )
        self.assertEqual(order.accounting_payment_method, self.payment_method)

        dp_log = OrderActivityLog.objects.filter(
            order=order, tindakan="PAYMENT"
        ).first()
        self.assertIsNotNone(dp_log)

        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            source_id=dp_log.id,
        ).first()
        self.assertIsNotNone(entry, "JournalEntry DP awal HARUS terbuat setelah auto-resolusi")
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

    def test_non_cash_order_payment_is_available_for_settlement(self):
        """
        Order dibayar via metode non-tunai (mis. 'qris') siap masuk settlement:
        1. settlement_status diset 'unsettled'.
        2. Order muncul di get_settlement_batches().
        """
        from accounting.services.settlement import get_settlement_batches

        response = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 50000, "metode_pembayaran": "qris"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.order.refresh_from_db()
        self.assertEqual(
            self.order.settlement_status,
            "unsettled",
            "Order non-tunai harus menunggu konfirmasi settlement.",
        )
        self.assertEqual(self.order.accounting_payment_method, self.qris_payment_method)

        today = timezone.localdate()
        batches = get_settlement_batches(date_from=today, date_to=today)
        order_batch_count = sum(b.get("order_count", 0) for b in batches)
        self.assertEqual(order_batch_count, 1)

    def test_bayar_overpayment_rejected(self):
        """T-203: jumlah_bayar > sisa_tagihan ditolak 400 — dp_dibayar TIDAK berubah,
        tidak ada JournalEntry (mencegah over-recognized revenue vs total_harga)."""
        sisa_sebelum = self.order.sisa_tagihan
        response = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": sisa_sebelum + 1, "metode_pembayaran": "tunai"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)

        self.order.refresh_from_db()
        self.assertEqual(self.order.dp_dibayar, 0)
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_PAYMENT).count(), 0
        )

    def test_bayar_zero_or_negative_rejected(self):
        """T-203: jumlah_bayar 0 atau negatif ditolak 400 di endpoint (bukan cuma di-skip diam-diam)."""
        for nilai in (0, -1000):
            response = self.client.post(
                f"/api/orders/{self.order.id}/bayar/",
                data={"jumlah_bayar": nilai, "metode_pembayaran": "tunai"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)

        self.order.refresh_from_db()
        self.assertEqual(self.order.dp_dibayar, 0)
