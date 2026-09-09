"""Posting otomatis selisih kas kasir (tutup shift) ke Jurnal Umum -- fitur
opsional (default mati), diminta pengguna 2026-09-09 sebagai pelengkap
rekonsiliasi kas shift (T-105/pos_reconciliation) yang sebelumnya cuma
tampil di laporan, tidak pernah masuk jurnal."""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import CustomUser, SaldoKasHarian
from accounting.models import AccountingSettings, JournalEntry
from accounting.models.coa import Account, AccountClassification
from accounting.models.cashbank import PaymentMethod
from api.pos_models import RingkasanShift
from accounting.services.shift_posting import post_shift_cash_variance_journal


class ShiftCashVarianceServiceTestCase(TestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username="owner_scv", password="pw", role="owner")

        kas_cls = AccountClassification.objects.create(
            name="Kas & Bank SCV", account_type="asset", code_range_start=11000, code_range_end=11999,
        )
        lain_cls = AccountClassification.objects.create(
            name="Pendapatan Lain SCV", account_type="revenue", code_range_start=70000, code_range_end=70999,
        )
        self.kas = Account.objects.create(code="11101", name="Kas SCV", classification=kas_cls, account_type="asset")
        self.selisih_account = Account.objects.create(
            code="70101", name="Selisih Kas SCV", classification=lain_cls, account_type="revenue",
        )
        self.pm_cash = PaymentMethod.objects.create(
            name="Tunai SCV", payment_type="Tunai", account=self.kas, is_cash=True, is_active=True,
        )
        self.settings = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate().replace(day=1),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
        )

    def _ringkasan(self, expected, aktual):
        return RingkasanShift.objects.create(
            tanggal=timezone.localdate(), kasir=self.owner,
            mulai=timezone.now(), berakhir=timezone.now(),
            expected=expected, aktual=aktual, rincian_tersedia=True,
        )

    def test_dilewati_kalau_sakelar_mati(self):
        ringkasan = self._ringkasan(Decimal("100000"), Decimal("110000"))
        self.assertIsNone(post_shift_cash_variance_journal(ringkasan, actor=self.owner))
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.SHIFT_CASH_VARIANCE).exists())

    def test_dilewati_kalau_selisih_nol(self):
        self.settings.shift_cash_variance_auto_post_enabled = True
        self.settings.shift_cash_variance_account = self.selisih_account
        self.settings.save()
        ringkasan = self._ringkasan(Decimal("100000"), Decimal("100000"))
        self.assertIsNone(post_shift_cash_variance_journal(ringkasan, actor=self.owner))

    def test_dilewati_kalau_akun_selisih_belum_diatur(self):
        self.settings.shift_cash_variance_auto_post_enabled = True
        self.settings.save()
        ringkasan = self._ringkasan(Decimal("100000"), Decimal("110000"))
        self.assertIsNone(post_shift_cash_variance_journal(ringkasan, actor=self.owner))

    def test_dilewati_kalau_tidak_ada_metode_bayar_tunai_aktif(self):
        self.pm_cash.is_active = False
        self.pm_cash.save()
        self.settings.shift_cash_variance_auto_post_enabled = True
        self.settings.shift_cash_variance_account = self.selisih_account
        self.settings.save()
        ringkasan = self._ringkasan(Decimal("100000"), Decimal("110000"))
        self.assertIsNone(post_shift_cash_variance_journal(ringkasan, actor=self.owner))

    def test_kas_lebih_debit_kas_kredit_selisih(self):
        self.settings.shift_cash_variance_auto_post_enabled = True
        self.settings.shift_cash_variance_account = self.selisih_account
        self.settings.save()
        ringkasan = self._ringkasan(Decimal("100000"), Decimal("115000"))  # lebih 15.000
        entry = post_shift_cash_variance_journal(ringkasan, actor=self.owner)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.source_type, JournalEntry.SourceType.SHIFT_CASH_VARIANCE)
        self.assertEqual(entry.source_id, ringkasan.id)
        lines = {l.account_id: l for l in entry.lines.all()}
        self.assertEqual(lines[self.kas.id].debit, Decimal("15000.00"))
        self.assertEqual(lines[self.selisih_account.id].kredit, Decimal("15000.00"))

    def test_kas_kurang_debit_selisih_kredit_kas(self):
        self.settings.shift_cash_variance_auto_post_enabled = True
        self.settings.shift_cash_variance_account = self.selisih_account
        self.settings.save()
        ringkasan = self._ringkasan(Decimal("100000"), Decimal("92000"))  # kurang 8.000
        entry = post_shift_cash_variance_journal(ringkasan, actor=self.owner)
        self.assertIsNotNone(entry)
        lines = {l.account_id: l for l in entry.lines.all()}
        self.assertEqual(lines[self.selisih_account.id].debit, Decimal("8000.00"))
        self.assertEqual(lines[self.kas.id].kredit, Decimal("8000.00"))


class ShiftCashVarianceApiTestCase(TestCase):
    """Lewat endpoint tutup shift sungguhan (/api/saldo-kas-harian/<id>/close/)."""

    def setUp(self):
        self.owner = CustomUser.objects.create_user(username="owner_scv_api", password="pw", role="owner")
        self.client = APIClient()

        kas_cls = AccountClassification.objects.create(
            name="Kas & Bank SCV API", account_type="asset", code_range_start=12000, code_range_end=12999,
        )
        lain_cls = AccountClassification.objects.create(
            name="Pendapatan Lain SCV API", account_type="revenue", code_range_start=71000, code_range_end=71999,
        )
        self.kas = Account.objects.create(code="12101", name="Kas SCV API", classification=kas_cls, account_type="asset")
        self.selisih_account = Account.objects.create(
            code="71101", name="Selisih Kas SCV API", classification=lain_cls, account_type="revenue",
        )
        PaymentMethod.objects.create(name="Tunai SCV API", payment_type="Tunai", account=self.kas, is_cash=True, is_active=True)
        AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate().replace(day=1),
            is_active=True,
            initial_setup_completed_at=timezone.now(),
            shift_cash_variance_auto_post_enabled=True,
            shift_cash_variance_account=self.selisih_account,
        )

    def test_tutup_shift_posting_selisih_kas_ke_jurnal(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post("/api/saldo-kas-harian/", {"shift": "Shift SCV", "kas_awal": 50000}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        shift_id = res.data["id"]

        res = self.client.post(f"/api/saldo-kas-harian/{shift_id}/close/", {"kas_akhir": 60000}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertTrue(res.data["selisih_kas_terposting"])

        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.SHIFT_CASH_VARIANCE)
        self.assertEqual(entry.status, JournalEntry.Status.POSTED)

    def test_tutup_shift_tanpa_selisih_tidak_posting(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post("/api/saldo-kas-harian/", {"shift": "Shift SCV 2", "kas_awal": 50000}, format="json")
        shift_id = res.data["id"]

        res = self.client.post(f"/api/saldo-kas-harian/{shift_id}/close/", {"kas_akhir": 50000}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertFalse(res.data["selisih_kas_terposting"])
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.SHIFT_CASH_VARIANCE).exists())
