"""Tanggal potong periode akuntansi (2026-09-29): potong 25 -> periode 26 s/d 25,
jurnal tanggal 26+ masuk periode baru sehingga operasional tetap jalan setelah
periode lama ditutup."""

from datetime import date
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command
from django.test import TestCase
from rest_framework.test import APIClient

from accounting.models import (
    Account,
    AccountClassification,
    AccountingPeriod,
    AccountingSettings,
    AccountType,
    JournalEntry,
)
from accounting.services.journal import create_journal_entry
from accounting.services.period import close_accounting_period, reopen_accounting_period
from accounting.services.period_rules import nama_periode, rentang_menurut_aturan, rentang_periode

User = get_user_model()


class RentangMenurutAturanTest(TestCase):
    def test_potong_25(self):
        self.assertEqual(rentang_menurut_aturan(date(2026, 9, 25), 25), (date(2026, 8, 26), date(2026, 9, 25)))
        self.assertEqual(rentang_menurut_aturan(date(2026, 9, 26), 25), (date(2026, 9, 26), date(2026, 10, 25)))
        self.assertEqual(rentang_menurut_aturan(date(2026, 9, 1), 25), (date(2026, 8, 26), date(2026, 9, 25)))
        self.assertEqual(rentang_menurut_aturan(date(2026, 9, 30), 25), (date(2026, 9, 26), date(2026, 10, 25)))

    def test_pergantian_tahun(self):
        self.assertEqual(rentang_menurut_aturan(date(2027, 1, 10), 25), (date(2026, 12, 26), date(2027, 1, 25)))
        self.assertEqual(rentang_menurut_aturan(date(2026, 12, 27), 25), (date(2026, 12, 26), date(2027, 1, 25)))

    def test_potong_28_dan_februari(self):
        self.assertEqual(rentang_menurut_aturan(date(2027, 3, 5), 28), (date(2027, 3, 1), date(2027, 3, 28)))
        self.assertEqual(rentang_menurut_aturan(date(2027, 2, 28), 28), (date(2027, 1, 29), date(2027, 2, 28)))
        self.assertEqual(rentang_menurut_aturan(date(2027, 2, 15), 28), (date(2027, 1, 29), date(2027, 2, 28)))

    def test_nol_berarti_bulan_kalender(self):
        self.assertEqual(rentang_menurut_aturan(date(2028, 2, 10), 0), (date(2028, 2, 1), date(2028, 2, 29)))

    def test_nama_periode(self):
        self.assertEqual(nama_periode(date(2026, 9, 1), date(2026, 9, 30)), "Sep 2026")
        self.assertEqual(nama_periode(date(2026, 8, 26), date(2026, 9, 25)), "Sep 2026 (26 Agu-25 Sep)")


class PeriodePotongBase(TestCase):
    hari = 25

    def setUp(self):
        self.owner = User.objects.create_user(username="owner_potong", password="x", role="owner")
        aset = AccountClassification.objects.create(
            name="Aset Potong", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999)
        pendapatan = AccountClassification.objects.create(
            name="Pendapatan Potong", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999)
        ekuitas = AccountClassification.objects.create(
            name="Ekuitas Potong", account_type=AccountType.EQUITY, code_range_start=30000, code_range_end=39999)
        self.kas = Account.objects.create(code="11001", name="Kas", classification=aset, account_type=AccountType.ASSET)
        self.pend = Account.objects.create(
            code="41001", name="Pendapatan", classification=pendapatan, account_type=AccountType.REVENUE)
        laba = Account.objects.create(
            code="31001", name="Laba Ditahan", classification=ekuitas, account_type=AccountType.EQUITY)
        self.pengaturan = AccountingSettings.objects.create(
            accounting_start_date=date(2020, 1, 1), closing_account=laba, period_cutoff_day=self.hari)

    def jurnal(self, tanggal, nominal=1000):
        return create_journal_entry(
            date=tanggal, description=f"Penjualan {tanggal}", created_by=self.owner,
            lines=[
                {"account": self.kas, "debit": nominal, "kredit": 0},
                {"account": self.pend, "debit": 0, "kredit": nominal},
            ],
        )


class PostingDanTutupBukuPotong25Test(PeriodePotongBase):
    def test_jurnal_tgl_25_dan_26_masuk_periode_berbeda(self):
        a = self.jurnal(date(2026, 9, 25))
        b = self.jurnal(date(2026, 9, 26))
        self.assertEqual((a.period.start_date, a.period.end_date), (date(2026, 8, 26), date(2026, 9, 25)))
        self.assertEqual((b.period.start_date, b.period.end_date), (date(2026, 9, 26), date(2026, 10, 25)))
        self.assertEqual(a.period.fiscal_year, 2026)

    def test_operasional_tgl_26_jalan_setelah_periode_lama_ditutup(self):
        self.jurnal(date(2026, 9, 10))
        periode = close_accounting_period(
            start_date="2026-08-26", end_date="2026-09-25", actor=self.owner)
        self.assertEqual(periode.status, AccountingPeriod.Status.CLOSED)
        baru = self.jurnal(date(2026, 9, 29))  # tidak ditolak
        self.assertEqual(baru.period.start_date, date(2026, 9, 26))
        with self.assertRaises(ValidationError):
            self.jurnal(date(2026, 9, 25))  # masih dalam periode yang ditutup

    def test_tutup_buku_menolak_rentang_bulan_kalender(self):
        with self.assertRaises(ValidationError) as ctx:
            close_accounting_period(start_date="2026-09-01", end_date="2026-09-30", actor=self.owner)
        self.assertIn("tanggal potong 25", str(ctx.exception))
        self.assertIn("26 Sep 2026 s/d 25 Oct 2026", str(ctx.exception))

    def test_periode_lama_bulan_kalender_tetap_dipakai_dan_tetangga_dipotong(self):
        lama = AccountingPeriod.objects.create(
            fiscal_year=2026, start_date=date(2026, 9, 1), end_date=date(2026, 9, 30))
        self.assertEqual(self.jurnal(date(2026, 9, 28)).period_id, lama.id)
        oktober = self.jurnal(date(2026, 10, 5)).period
        # Aturan: 26 Sep-25 Okt, tetapi 26-30 Sep sudah milik periode lama.
        self.assertEqual((oktober.start_date, oktober.end_date), (date(2026, 10, 1), date(2026, 10, 25)))

    def test_rentang_periode_tanpa_data_mengikuti_aturan(self):
        self.assertEqual(rentang_periode(date(2026, 11, 3)), (date(2026, 10, 26), date(2026, 11, 25)))


class PeriodeBulanKalenderTidakBerubahTest(PeriodePotongBase):
    hari = 0

    def test_bulan_kalender_seperti_sebelumnya(self):
        j = self.jurnal(date(2026, 9, 29))
        self.assertEqual((j.period.start_date, j.period.end_date), (date(2026, 9, 1), date(2026, 9, 30)))
        with self.assertRaises(ValidationError) as ctx:
            close_accounting_period(start_date="2026-08-26", end_date="2026-09-25", actor=self.owner)
        self.assertIn("bulan kalender penuh", str(ctx.exception))


class PerintahAturPeriodePotongTest(PeriodePotongBase):
    hari = 0

    def _data_lama(self):
        self.jurnal(date(2026, 9, 20))
        self.jurnal(date(2026, 9, 28))
        self.jurnal(date(2026, 9, 30))

    def _jalankan(self, *args):
        out = StringIO()
        call_command("atur_periode_potong", *args, stdout=out)
        return out.getvalue()

    def test_dry_run_tidak_mengubah_apa_pun(self):
        self._data_lama()
        keluaran = self._jalankan("--hari", "25")
        self.assertIn("DRY-RUN", keluaran)
        self.assertEqual(AccountingPeriod.objects.count(), 1)
        self.pengaturan.refresh_from_db()
        self.assertEqual(self.pengaturan.period_cutoff_day, 0)

    def test_terapkan_memindahkan_jurnal_dan_menghapus_periode_kosong(self):
        self._data_lama()
        self._jalankan("--hari", "25", "--terapkan")
        self.pengaturan.refresh_from_db()
        self.assertEqual(self.pengaturan.period_cutoff_day, 25)
        periode = list(AccountingPeriod.objects.order_by("start_date"))
        self.assertEqual(
            [(p.start_date, p.end_date) for p in periode],
            [(date(2026, 8, 26), date(2026, 9, 25)), (date(2026, 9, 26), date(2026, 10, 25))],
        )
        self.assertEqual(periode[0].journal_entries.count(), 1)
        self.assertEqual(periode[1].journal_entries.count(), 2)
        self.assertEqual(JournalEntry.objects.count(), 3)  # tidak ada jurnal hilang/bertambah

    def test_menolak_bila_ada_periode_ditutup(self):
        self.jurnal(date(2026, 9, 20))
        close_accounting_period(start_date="2026-09-01", end_date="2026-09-30", actor=self.owner)
        with self.assertRaises(CommandError):
            self._jalankan("--hari", "25", "--terapkan")
        reopen_accounting_period(start_date="2026-09-01", end_date="2026-09-30", actor=self.owner)
        self._jalankan("--hari", "25", "--terapkan")  # setelah dibuka ulang: jalan

    def test_hari_di_luar_rentang_ditolak(self):
        with self.assertRaises(CommandError):
            self._jalankan("--hari", "31")


class ApiPeriodeTest(PeriodePotongBase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_periode_berjalan_dan_nama_di_daftar(self):
        res = self.client.get("/api/accounting/periods/berjalan/")
        self.assertEqual(res.status_code, 200)
        mulai, akhir = rentang_menurut_aturan(date.today(), 25)
        self.assertEqual(res.data["start_date"], mulai)
        self.assertEqual(res.data["end_date"], akhir)
        self.assertEqual(res.data["hari_potong"], 25)
        self.jurnal(date(2026, 9, 10))
        daftar = self.client.get("/api/accounting/periods/")
        data = daftar.data if isinstance(daftar.data, list) else daftar.data["results"]
        self.assertEqual(data[0]["nama"], "Sep 2026 (26 Agu-25 Sep)")

    def test_pengaturan_menyimpan_tanggal_potong_dan_menolak_di_atas_28(self):
        ok = self.client.patch("/api/accounting/settings/", {"period_cutoff_day": 20}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["period_cutoff_day"], 20)
        salah = self.client.patch("/api/accounting/settings/", {"period_cutoff_day": 31}, format="json")
        self.assertEqual(salah.status_code, 400)
