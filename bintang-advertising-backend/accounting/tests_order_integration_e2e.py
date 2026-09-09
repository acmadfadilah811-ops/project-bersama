"""
accounting/tests_order_integration_e2e.py
T-205: Test integrasi Orders-akuntansi end-to-end via APITestCase (pola T-106):
diskon, pembayaran DP+pelunasan (T-202/T-203), HPP bahan baku saat selesai
(T-204), dan pembatalan dengan jurnal pembalik (T-207) — semua lewat endpoint
HTTP nyata, dicek saling rekonsiliasi (bukan cuma masing-masing terisolasi).
"""
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import (
    CustomUser, Divisi, TahapProses, Order, OrderItem, JobBoard,
    InventoryItem, RestockHistory, OrderActivityLog,
)
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification
from accounting.models.cashbank import PaymentMethod


class OrderAccountingEndToEndTestCase(APITestCase):
    """Satu lifecycle Order penuh: buat -> DP -> tolak overpay (T-203) ->
    pelunasan -> selesai (HPP T-204) -> rekonsiliasi jurnal lintas tahap."""

    @classmethod
    def setUpTestData(cls):
        asset_cls, _ = AccountClassification.objects.get_or_create(
            name="Aset Lancar T205", defaults={"account_type": "asset", "order": 1},
        )
        rev_cls, _ = AccountClassification.objects.get_or_create(
            name="Pendapatan T205", defaults={"account_type": "revenue", "order": 10},
        )
        exp_cls, _ = AccountClassification.objects.get_or_create(
            name="Beban T205", defaults={"account_type": "expense", "order": 50},
        )
        liab_cls, _ = AccountClassification.objects.get_or_create(
            name="Kewajiban T205", defaults={"account_type": "liability", "order": 20},
        )

        cls.kas_account = Account.objects.create(
            code="1-T205-KAS", name="Kas Tunai T205", account_type="asset", classification=asset_cls,
        )
        cls.qris_account = Account.objects.create(
            code="1-T205-QRIS", name="Piutang QRIS T205", account_type="asset", classification=asset_cls,
        )
        cls.revenue_account = Account.objects.create(
            code="4-T205-REV", name="Pendapatan Order T205", account_type="revenue", classification=rev_cls,
        )
        cls.hpp_account = Account.objects.create(
            code="5-T205-HPP", name="HPP Bahan Baku T205", account_type="expense", classification=exp_cls,
        )
        cls.persediaan_account = Account.objects.create(
            code="1-T205-PERS", name="Persediaan Bahan Baku T205", account_type="asset", classification=asset_cls,
        )
        cls.receivable_account = Account.objects.create(
            code="1-T205-PIUT", name="Piutang Usaha T205", account_type="asset", classification=asset_cls,
        )
        cls.deposit_account = Account.objects.create(
            code="2-T205-UM", name="Uang Muka Pelanggan T205", account_type="liability", classification=liab_cls,
        )

        cls.settings_row = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            order_sales_revenue_account=cls.revenue_account,
            order_hpp_expense_account=cls.hpp_account,
            order_material_inventory_account=cls.persediaan_account,
            order_receivable_account=cls.receivable_account,
            order_customer_deposit_account=cls.deposit_account,
        )

        cls.pm_cash = PaymentMethod.objects.create(
            name="Tunai T205", payment_type="Tunai", account=cls.kas_account, is_cash=True,
        )
        cls.pm_qris = PaymentMethod.objects.create(
            name="QRIS T205", payment_type="QRIS", account=cls.qris_account, is_cash=False,
        )

        cls.divisi = Divisi.objects.create(nama="Produksi T205", keterangan="")
        cls.tahap = TahapProses.objects.create(nama="Cetak T205", divisi=cls.divisi, urutan=1)
        cls.staff = CustomUser.objects.create_user(
            username="staff_t205", password="pw", role="staff", divisi=cls.divisi,
        )
        cls.owner = CustomUser.objects.create_user(username="owner_t205", password="pw", role="owner")

    def setUp(self):
        self.client.force_authenticate(user=self.owner)
        # Order dengan diskon 10%: subtotal 500.000 -> total_harga 450.000
        self.order = Order.objects.create(
            nomor_wa="081399988877", nama="Pelanggan E2E T205", diskon_persen=10.0,
        )
        OrderItem.objects.create(
            order=self.order, jenis_produk="Spanduk Custom E2E", harga_jual=500_000, qty=1,
        )
        self.order.refresh_from_db()

    def test_full_lifecycle_dp_pelunasan_overpay_guard_selesai_hpp(self):
        self.assertEqual(self.order.total_harga, 450_000)
        self.assertEqual(self.order.sisa_tagihan, 450_000)

        # 1. DP tunai 200.000
        res_dp = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 200_000, "metode_pembayaran": "Tunai T205"},
            format="json",
        )
        self.assertEqual(res_dp.status_code, status.HTTP_200_OK, res_dp.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.dp_dibayar, 200_000)
        self.assertEqual(self.order.sisa_tagihan, 250_000)

        dp_log = OrderActivityLog.objects.filter(order=self.order, tindakan="PAYMENT").order_by("-id").first()
        dp_entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT, source_id=dp_log.id,
        ).first()
        self.assertIsNotNone(dp_entry)
        dp_lines = list(dp_entry.lines.all())
        self.assertEqual(sum(l.debit for l in dp_lines), sum(l.kredit for l in dp_lines))
        self.assertEqual(sum(l.debit for l in dp_lines), Decimal("200000.00"))
        # Accrual basis (keputusan finance 2026-09-09): DP SEBELUM order
        # 'selesai' kredit Uang Muka Pelanggan (kewajiban), BUKAN Pendapatan
        # langsung -- barang/jasa belum diserahkan, belum boleh diakui.
        deposit_line = next(l for l in dp_lines if l.account_id == self.deposit_account.id)
        self.assertEqual(deposit_line.kredit, Decimal("200000.00"))
        self.assertFalse(any(l.account_id == self.revenue_account.id for l in dp_lines))

        # 2. T-203: overpay ditolak — coba bayar lebih dari sisa (250.000)
        res_overpay = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 300_000, "metode_pembayaran": "QRIS T205"},
            format="json",
        )
        self.assertEqual(res_overpay.status_code, status.HTTP_400_BAD_REQUEST, res_overpay.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.dp_dibayar, 200_000, "Overpay yang ditolak tidak boleh mengubah dp_dibayar")
        self.assertEqual(
            JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_PAYMENT).count(), 1,
            "Overpay yang ditolak tidak boleh membuat JournalEntry kedua",
        )

        # 3. Pelunasan tepat sisa (250.000) via QRIS (non-tunai)
        res_pelunasan = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 250_000, "metode_pembayaran": "QRIS T205"},
            format="json",
        )
        self.assertEqual(res_pelunasan.status_code, status.HTTP_200_OK, res_pelunasan.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.dp_dibayar, 450_000)
        self.assertEqual(self.order.sisa_tagihan, 0)
        self.assertEqual(self.order.settlement_status, "unsettled", "QRIS non-tunai harus masuk antrean settlement")

        pelunasan_log = OrderActivityLog.objects.filter(order=self.order, tindakan="PAYMENT").order_by("-id").first()
        pelunasan_entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT, source_id=pelunasan_log.id,
        ).first()
        self.assertIsNotNone(pelunasan_entry)

        # Rekonsiliasi: total Uang Muka Pelanggan yang terjurnal dari kedua
        # pembayaran (SEBELUM order 'selesai') = total_harga persis (450.000).
        # Pendapatan BELUM diakui sama sekali di titik ini (accrual basis) --
        # baru diakui penuh saat selesaikan() di langkah 4.
        total_deposit = sum(
            line.kredit
            for entry in JournalEntry.objects.filter(
                source_type=JournalEntry.SourceType.ORDER_PAYMENT, status=JournalEntry.Status.POSTED,
            )
            for line in entry.lines.filter(account_id=self.deposit_account.id)
        )
        self.assertEqual(total_deposit, Decimal("450000.00"))
        total_revenue_before_selesai = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION,
        ).count()
        self.assertEqual(total_revenue_before_selesai, 0, "Pendapatan belum boleh diakui sebelum order selesai")

        # 4. Produksi: job + konsumsi bahan baku, lalu selesaikan()
        item = self.order.items.first()
        job = JobBoard.objects.create(
            order_item=item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan="dikerjakan",
        )
        bahan = InventoryItem.objects.create(
            id="INV-T205-E2E", nama="Vinyl E2E", stok=50.0, satuan="m2",
            kategori="Bahan Cetak", cost_per_unit=30_000,
        )
        RestockHistory.objects.create(
            item=bahan, user=self.staff, delta=-5, stok_awal=50.0, stok_akhir=45.0,
            keterangan=f"Pemakaian bahan Job #{job.id} untuk produksi E2E",
        )

        res_selesai = self.client.post(f"/api/orders/{self.order.id}/selesaikan/", format="json")
        self.assertEqual(res_selesai.status_code, status.HTTP_200_OK, res_selesai.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status_global, "selesai")

        complete_log = OrderActivityLog.objects.filter(order=self.order, tindakan="COMPLETE").last()
        hpp_entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_MATERIAL_HPP, source_id=complete_log.id,
        ).first()
        self.assertIsNotNone(hpp_entry, "JournalEntry HPP harus terbuat setelah selesaikan()")
        hpp_lines = list(hpp_entry.lines.all())
        self.assertEqual(sum(l.debit for l in hpp_lines), sum(l.kredit for l in hpp_lines))
        self.assertEqual(sum(l.debit for l in hpp_lines), Decimal("150000.00"))  # 5 x 30.000

        # 4b. Accrual basis: begitu order selesai, Pendapatan PENUH (450.000)
        # baru diakui sekarang -- lewat Piutang Usaha, lalu di entry yang sama
        # di-netting dengan Uang Muka Pelanggan (450.000, sudah lunas duluan)
        # sehingga Piutang akhir = 0 (sisa_tagihan memang 0).
        recognition_entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION, source_id=complete_log.id,
        ).first()
        self.assertIsNotNone(recognition_entry, "Pengakuan pendapatan harus terbuat setelah selesaikan()")
        recognition_lines = list(recognition_entry.lines.all())
        self.assertEqual(sum(l.debit for l in recognition_lines), sum(l.kredit for l in recognition_lines))
        revenue_line = next(l for l in recognition_lines if l.account_id == self.revenue_account.id)
        self.assertEqual(revenue_line.kredit, Decimal("450000.00"))
        piutang_net = (
            sum(l.debit for l in recognition_lines if l.account_id == self.receivable_account.id)
            - sum(l.kredit for l in recognition_lines if l.account_id == self.receivable_account.id)
        )
        self.assertEqual(piutang_net, Decimal("0.00"), "Piutang harus nol -- sudah lunas penuh lewat DP+pelunasan")

        # 5. Rekonsiliasi akhir: SEMUA jurnal terkait order ini (payment x2 +
        # pengakuan pendapatan + HPP) masing-masing balance individual DAN
        # gabungan (properti dasar double-entry).
        all_entries = list(JournalEntry.objects.filter(
            source_type__in=[
                JournalEntry.SourceType.ORDER_PAYMENT,
                JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION,
                JournalEntry.SourceType.ORDER_MATERIAL_HPP,
            ],
            status=JournalEntry.Status.POSTED,
        ).filter(source_id__in=[dp_log.id, pelunasan_log.id, complete_log.id]))
        self.assertEqual(len(all_entries), 4)
        grand_debit = sum(l.debit for e in all_entries for l in e.lines.all())
        grand_kredit = sum(l.kredit for e in all_entries for l in e.lines.all())
        self.assertEqual(grand_debit, grand_kredit)
        # 200k(DP) + 250k(pelunasan) + 150k(HPP) + 900k(pengakuan pendapatan,
        # 450k Piutang+Pendapatan + 450k netting Uang Muka->Piutang)
        self.assertEqual(grand_debit, Decimal("1500000.00"))

    def test_batalkan_after_dp_creates_balanced_reversal(self):
        """T-207 dalam konteks E2E: Order dibatalkan setelah DP -> jurnal pembalik seimbang."""
        res_dp = self.client.post(
            f"/api/orders/{self.order.id}/bayar/",
            data={"jumlah_bayar": 150_000, "metode_pembayaran": "Tunai T205"},
            format="json",
        )
        self.assertEqual(res_dp.status_code, status.HTTP_200_OK, res_dp.data)

        res_batal = self.client.post(f"/api/orders/{self.order.id}/batalkan/", format="json")
        self.assertEqual(res_batal.status_code, status.HTTP_200_OK, res_batal.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status_global, "batal")

        reversal = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_PAYMENT,
            reversed_entry__isnull=False,
        ).first()
        self.assertIsNotNone(reversal)
        rev_lines = list(reversal.lines.all())
        self.assertEqual(sum(l.debit for l in rev_lines), sum(l.kredit for l in rev_lines))
        self.assertEqual(sum(l.debit for l in rev_lines), Decimal("150000.00"))
