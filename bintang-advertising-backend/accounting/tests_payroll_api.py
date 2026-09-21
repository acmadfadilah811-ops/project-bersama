"""Uji API Posting Gaji (izin, endpoint, pemetaan), perintah seed_akun_gaji, dan
matinya jalur bayar payroll lama."""
from datetime import date
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APITestCase

from .models import (
    Account, AccountClassification, AccountingSettings, JournalEntry, PayrollComponentMapping, PayrollPosting,
)
from .tests_payroll_posting import BPJS, MOCK_HR, PayrollBase, _data

BASE = "/api/accounting/payroll/"


class PayrollApiTests(PayrollBase, APITestCase):
    def setUp(self):
        super().setUp()
        U = get_user_model()
        self.manager = U.objects.create_user(username="pay_mgr", password="pw12345", role="manager")
        self.kasir = U.objects.create_user(username="pay_kasir", password="pw12345", role="kasir")
        self.spv = U.objects.create_user(username="pay_spv", password="pw12345", role="spv")
        self.admin = U.objects.create_user(username="pay_admin", password="pw12345", role="admin")

    def _as(self, user):
        self.client.force_authenticate(user)
        return self.client

    def test_hanya_owner_dan_manager(self):
        for u in (self.kasir, self.spv, self.admin):
            c = self._as(u)
            self.assertEqual(c.get(BASE + "pratinjau/?tahun=2026&bulan=9").status_code, 403, u.role)
            self.assertEqual(c.post(BASE + "posting/", {"tahun": 2026, "bulan": 9}, format="json").status_code, 403, u.role)
            self.assertEqual(c.get(BASE + "pemetaan/").status_code, 403, u.role)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(BASE + "riwayat/").status_code, 401)

    def test_pratinjau_menampilkan_jurnal_dan_masalah_pemetaan(self):
        c = self._as(self.manager)
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)):
            r = c.get(BASE + "pratinjau/?tahun=2026&bulan=9")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status_posting"], "belum")
        self.assertTrue(any("belum dipetakan" in m for m in r.json()["masalah"]))
        self.assertEqual(JournalEntry.objects.count(), 0)  # baca-saja

    def test_alur_posting_lalu_bayar_lalu_riwayat(self):
        for b in BPJS:
            self.peta(b["judul"], "kewajiban", self.hutang_bpjs, self.hutang_bpjs)
        c = self._as(self.user)  # owner (dibuat di PayrollBase)
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)):
            r = c.post(BASE + "posting/", {"tahun": 2026, "bulan": 9}, format="json")
            self.assertEqual(r.status_code, 201, r.content)
            self.assertEqual(r.json()["status"], "aktif")
            dua = c.post(BASE + "posting/", {"tahun": 2026, "bulan": 9}, format="json")
            self.assertEqual(dua.status_code, 400)
            self.assertIn("sudah diposting", dua.json()["error"])
        r = c.post(BASE + "bayar/", {"tahun": 2026, "bulan": 9, "akun_kas": self.kas.id, "tanggal": "2026-10-01"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNotNone(r.json()["payment_journal_entry"])
        riwayat = c.get(BASE + "riwayat/").json()
        self.assertEqual(len(riwayat), 1)
        self.assertEqual(riwayat[0]["bulan"], 9)

    def test_posting_ditolak_pesan_jelas_dan_tanpa_efek(self):
        c = self._as(self.manager)
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)):
            r = c.post(BASE + "posting/", {"tahun": 2026, "bulan": 9}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("BPJS Kesehatan", r.json()["error"])
        self.assertEqual(PayrollPosting.objects.count(), 0)

    def test_parameter_periode_tidak_valid_400(self):
        c = self._as(self.manager)
        self.assertEqual(c.get(BASE + "pratinjau/?tahun=abc&bulan=9").status_code, 400)
        self.assertEqual(c.post(BASE + "posting/", {"tahun": 2026, "bulan": 13}, format="json").status_code, 400)

    def test_format_tanggal_bayar_salah_400(self):
        c = self._as(self.manager)
        r = c.post(BASE + "bayar/", {"tahun": 2026, "bulan": 9, "akun_kas": self.kas.id, "tanggal": "besok"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_pemetaan_crud_dan_validasi_tipe_akun(self):
        c = self._as(self.manager)
        ok = c.post(BASE + "pemetaan/", {"judul": "BPJS Kesehatan", "jenis": "kewajiban", "akun": self.hutang_bpjs.id,
                                          "akun_iuran_perusahaan": self.hutang_bpjs.id}, format="json")
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(ok.json()["akun_display"], "21200 - Hutang BPJS")
        # kewajiban harus akun bertipe kewajiban
        salah = c.post(BASE + "pemetaan/", {"judul": "X", "jenis": "kewajiban", "akun": self.kas.id}, format="json")
        self.assertEqual(salah.status_code, 400)
        # piutang harus akun aset
        salah = c.post(BASE + "pemetaan/", {"judul": "Y", "jenis": "piutang", "akun": self.hutang_bpjs.id}, format="json")
        self.assertEqual(salah.status_code, 400)
        # kewajiban tanpa akun ditolak
        self.assertEqual(c.post(BASE + "pemetaan/", {"judul": "Z", "jenis": "kewajiban"}, format="json").status_code, 400)
        # pengurang beban: akun diabaikan
        pb = c.post(BASE + "pemetaan/", {"judul": "Denda telat", "jenis": "pengurang_beban", "akun": self.kas.id}, format="json")
        self.assertEqual(pb.status_code, 201)
        self.assertIsNone(pb.json()["akun"])
        # judul unik
        dup = c.post(BASE + "pemetaan/", {"judul": "Denda telat", "jenis": "pengurang_beban"}, format="json")
        self.assertEqual(dup.status_code, 400)
        # hapus
        pid = PayrollComponentMapping.objects.get(judul="Denda telat").id
        self.assertEqual(c.delete(f"{BASE}pemetaan/{pid}/").status_code, 204)


class JalurLamaMatiTests(PayrollBase, APITestCase):
    def test_bayar_slip_lama_dinonaktifkan_410_tanpa_jurnal(self):
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/hr/slip-gaji/1/pay/")
        self.assertEqual(r.status_code, 410)
        self.assertIn("Posting Gaji", r.json()["detail"])
        self.assertEqual(JournalEntry.objects.count(), 0)


class SeedAkunGajiTests(APITestCase):
    def setUp(self):
        AccountClassification.objects.create(name="Kewajiban Jangka Pendek", account_type="liability")
        AccountClassification.objects.create(name="Pengeluaran", account_type="expense")
        kls = AccountClassification.objects.get(name="Pengeluaran")
        Account.objects.create(code="60100", name="Biaya gaji", account_type="expense", classification=kls)
        AccountingSettings.objects.create(accounting_start_date=date(2026, 1, 1))

    def _jalan(self):
        out = StringIO()
        call_command("seed_akun_gaji", stdout=out)
        return out.getvalue()

    def test_membuat_tiga_akun_dan_mengisi_pemetaan_idempotent(self):
        self._jalan()
        self.assertEqual(Account.objects.filter(code__in=["21100", "21200", "60600"]).count(), 3)
        row = AccountingSettings.objects.first()
        self.assertEqual(row.payroll_expense_account.code, "60100")
        self.assertEqual(row.payroll_payable_account.code, "21100")
        self.assertEqual(row.payroll_employer_contribution_expense_account.code, "60600")
        jumlah = Account.objects.count()
        self.assertIn("sudah ada", self._jalan())
        self.assertEqual(Account.objects.count(), jumlah)  # tidak dobel

    def test_tidak_menimpa_pemetaan_yang_sudah_diisi(self):
        lain = Account.objects.create(
            code="60999", name="Lain", account_type="expense", classification=AccountClassification.objects.get(name="Pengeluaran"))
        row = AccountingSettings.objects.first()
        row.payroll_expense_account = lain
        row.save()
        self._jalan()
        row.refresh_from_db()
        self.assertEqual(row.payroll_expense_account.code, "60999")

    def test_tidak_menghidupkan_akun_lain_yang_sengaja_dihapus(self):
        # Beda dengan seed_coa: hanya 3 akun gaji yang disentuh.
        self._jalan()
        self.assertFalse(Account.objects.filter(code="21000").exists())
