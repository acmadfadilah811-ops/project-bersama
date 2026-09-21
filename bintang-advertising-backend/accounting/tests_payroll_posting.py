"""Uji Posting Gaji (HR -> jurnal): perhitungan, posting, koreksi, pembayaran, dan
semua penolakan fail-closed. HR di-mock (ambil_payroll_hr)."""
from datetime import date
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import (
    Account, AccountClassification, AccountingPeriod, AccountingSettings, JournalEntry,
    PayrollComponentMapping, PayrollPosting,
)
from .services import payroll_posting as svc

MOCK_HR = "accounting.services.payroll_posting.ambil_payroll_hr"
D = Decimal


def _slip(sid=1, gross=3250000, deduction=120000, net=3130000, potongan_net=0):
    return {"id": sid, "karyawan_id": 100 + sid, "status": "confirmed", "gross_pay": gross,
            "deduction": deduction, "net_pay": net, "potongan_net": potongan_net,
            "selisih": round(gross - deduction - potongan_net - net, 2)}


def _data(slip=None, potongan=None, dikecualikan=None, federal_tax_total=0, hash="h1"):
    return {
        "periode": "2026-09", "tahun": 2026, "bulan": 9,
        "slip": [_slip()] if slip is None else slip,
        "potongan": potongan or [], "tunjangan": [], "federal_tax_total": federal_tax_total,
        "dikecualikan": dikecualikan or {"draft": 0, "review_ongoing": 0}, "hash": hash,
    }


BPJS = [
    {"judul": "BPJS Kesehatan", "total": 30000, "iuran_perusahaan_total": 120000, "kelompok": "dalam_total"},
    {"judul": "BPJS JHT", "total": 60000, "iuran_perusahaan_total": 111000, "kelompok": "dalam_total"},
    {"judul": "BPJS JP", "total": 30000, "iuran_perusahaan_total": 60000, "kelompok": "dalam_total"},
    {"judul": "BPJS JKK", "total": 0, "iuran_perusahaan_total": 7200, "kelompok": "dalam_total"},
    {"judul": "BPJS JKM", "total": 0, "iuran_perusahaan_total": 9000, "kelompok": "dalam_total"},
]


class PayrollBase(TestCase):
    def setUp(self):
        kas_bank = AccountClassification.objects.create(name="Kas & Bank", account_type="asset")
        hutang = AccountClassification.objects.create(name="Kewajiban Jangka Pendek", account_type="liability")
        beban = AccountClassification.objects.create(name="Pengeluaran", account_type="expense")
        self.kas = Account.objects.create(code="11101", name="Kas", account_type="asset", classification=kas_bank)
        self.biaya = Account.objects.create(code="60100", name="Biaya gaji", account_type="expense", classification=beban)
        self.beban_iuran = Account.objects.create(code="60600", name="Beban BPJS", account_type="expense", classification=beban)
        self.hutang_gaji = Account.objects.create(code="21100", name="Hutang gaji", account_type="liability", classification=hutang)
        self.hutang_bpjs = Account.objects.create(code="21200", name="Hutang BPJS", account_type="liability", classification=hutang)
        self.piutang = Account.objects.create(code="11800", name="Piutang karyawan", account_type="asset", classification=kas_bank)
        self.settings = AccountingSettings.objects.create(
            accounting_start_date=date(2026, 1, 1), payroll_expense_account=self.biaya,
            payroll_payable_account=self.hutang_gaji,
            payroll_employer_contribution_expense_account=self.beban_iuran,
        )
        self.user = get_user_model().objects.create_user(username="pay_owner", password="pw12345", role="owner")

    def peta(self, judul, jenis, akun=None, iuran=None):
        return PayrollComponentMapping.objects.create(
            judul=judul, jenis=jenis, akun=akun, akun_iuran_perusahaan=iuran)

    def peta_bpjs(self):
        for b in BPJS:
            self.peta(b["judul"], "kewajiban", self.hutang_bpjs, self.hutang_bpjs)

    def akun_inti(self):
        return {"expense": self.biaya, "payable": self.hutang_gaji, "employer_expense": self.beban_iuran}

    def susun(self, data):
        pemetaan = {m.judul: m for m in PayrollComponentMapping.objects.select_related("akun", "akun_iuran_perusahaan")}
        return svc.susun_jurnal(data, self.akun_inti(), pemetaan)

    @staticmethod
    def per_akun(hasil):
        out = {}
        for l in hasil["lines"]:
            out[l["account"].code] = out.get(l["account"].code, D(0)) + l["debit"] - l["kredit"]
        return out


class PerhitunganTests(PayrollBase):
    def test_tanpa_potongan_biaya_sama_dengan_hutang(self):
        r = self.susun(_data(slip=[_slip(gross=5000000, deduction=0, net=5000000)]))
        self.assertEqual(r["masalah"], [])
        self.assertEqual(self.per_akun(r), {"60100": D(5000000), "21100": D(-5000000)})

    def test_bpjs_karyawan_dan_perusahaan_seimbang(self):
        self.peta_bpjs()
        r = self.susun(_data(potongan=BPJS))
        self.assertEqual(r["masalah"], [])
        self.assertEqual(self.per_akun(r), {
            "60100": D(3250000), "60600": D(307200), "21100": D(-3130000), "21200": D(-427200)})
        self.assertEqual(r["ringkasan"]["total_debit"], r["ringkasan"]["total_kredit"])
        self.assertEqual(r["ringkasan"]["total_debit"], D(3557200))

    def test_potongan_tanpa_judul_jadi_pengurang_biaya_dengan_peringatan(self):
        # mis. potong hari tak masuk: tidak tercantum di komponen, tetap mengurangi gross.
        r = self.susun(_data(slip=[_slip(gross=3000000, deduction=1000000, net=2000000)]))
        self.assertEqual(r["masalah"], [])
        self.assertEqual(self.per_akun(r), {"60100": D(2000000), "21100": D(-2000000)})
        self.assertTrue(r["peringatan"])

    def test_potongan_net_piutang_karyawan(self):
        self.peta("Cicilan Kasbon", "piutang", self.piutang)
        pot = [{"judul": "Cicilan Kasbon", "total": 100000, "iuran_perusahaan_total": 0, "kelompok": "net"}]
        r = self.susun(_data(slip=[_slip(gross=1000000, deduction=0, net=900000, potongan_net=100000)], potongan=pot))
        self.assertEqual(r["masalah"], [])
        self.assertEqual(self.per_akun(r), {"60100": D(1000000), "21100": D(-900000), "11800": D(-100000)})

    def test_pengurang_beban_terpetakan(self):
        self.peta("Denda telat", "pengurang_beban")
        pot = [{"judul": "Denda telat", "total": 50000, "iuran_perusahaan_total": 0, "kelompok": "dalam_total"}]
        r = self.susun(_data(slip=[_slip(gross=1000000, deduction=50000, net=950000)], potongan=pot))
        self.assertEqual(r["masalah"], [])
        self.assertEqual(self.per_akun(r), {"60100": D(950000), "21100": D(-950000)})

    def test_pajak_bawaan_horilla_wajib_dipetakan(self):
        slip = [_slip(gross=1000000, deduction=10000, net=990000)]
        r = self.susun(_data(slip=slip, federal_tax_total=10000))
        self.assertTrue(any("belum dipetakan" in m for m in r["masalah"]))
        self.peta(svc.JUDUL_PAJAK_BAWAAN, "kewajiban", self.hutang_bpjs)
        r = self.susun(_data(slip=slip, federal_tax_total=10000))
        self.assertEqual(r["masalah"], [])
        self.assertEqual(self.per_akun(r)["21200"], D(-10000))


class PenolakanTests(PayrollBase):
    def test_komponen_belum_dipetakan_ditolak(self):
        r = self.susun(_data(potongan=BPJS))
        self.assertTrue(any("BPJS Kesehatan" in m for m in r["masalah"]))

    def test_slip_draft_menghalangi(self):
        r = self.susun(_data(dikecualikan={"draft": 2, "review_ongoing": 1}))
        self.assertTrue(any("3 slip yang belum final" in m for m in r["masalah"]))

    def test_tanpa_slip_ditolak(self):
        r = self.susun(_data(slip=[]))
        self.assertTrue(any("Tidak ada slip" in m for m in r["masalah"]))

    def test_slip_tidak_konsisten_ditolak(self):
        s = _slip()
        s["selisih"] = 500.0
        r = self.susun(_data(slip=[s]))
        self.assertTrue(any("tidak konsisten" in m for m in r["masalah"]))

    def test_iuran_tanpa_akun_beban_ditolak(self):
        self.peta_bpjs()
        akun = self.akun_inti()
        akun["employer_expense"] = None
        pemetaan = {m.judul: m for m in PayrollComponentMapping.objects.select_related("akun", "akun_iuran_perusahaan")}
        r = svc.susun_jurnal(_data(potongan=BPJS), akun, pemetaan)
        self.assertTrue(any("Beban iuran perusahaan belum diisi" in m for m in r["masalah"]))

    def test_iuran_tanpa_akun_hutang_iuran_ditolak(self):
        for b in BPJS:
            self.peta(b["judul"], "kewajiban", self.hutang_bpjs, None)
        r = self.susun(_data(potongan=BPJS))
        self.assertTrue(any("belum punya akun hutang iuran" in m for m in r["masalah"]))

    def test_pengaturan_akun_belum_lengkap_ditolak(self):
        self.settings.payroll_payable_account = None
        self.settings.save()
        with mock.patch(MOCK_HR, return_value=_data()), self.assertRaises(svc.PayrollError) as ctx:
            svc.posting(2026, 9, self.user)
        self.assertIn("belum lengkap", str(ctx.exception))
        self.assertEqual(JournalEntry.objects.count(), 0)


class PostingTests(PayrollBase):
    def setUp(self):
        super().setUp()
        self.peta_bpjs()

    def _posting(self, data=None):
        with mock.patch(MOCK_HR, return_value=data or _data(potongan=BPJS)):
            return svc.posting(2026, 9, self.user)

    def test_posting_membuat_jurnal_seimbang_dan_catatan(self):
        p = self._posting()
        je = p.journal_entry
        self.assertEqual(je.source_type, JournalEntry.SourceType.PAYROLL)
        self.assertEqual(je.source_id, p.pk)
        self.assertEqual(je.date, date(2026, 9, 30))
        self.assertEqual(je.status, JournalEntry.Status.POSTED)
        self.assertEqual(sum(l.debit for l in je.lines.all()), sum(l.kredit for l in je.lines.all()))
        self.assertEqual((p.tahun, p.bulan, p.versi, p.status), (2026, 9, 1, "aktif"))
        self.assertEqual(p.total_net, D(3130000))
        self.assertEqual(p.payload["hash"], "h1")

    def test_posting_dua_kali_ditolak_dan_hanya_satu_jurnal(self):
        self._posting()
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)), self.assertRaises(svc.PayrollError):
            svc.posting(2026, 9, self.user)
        self.assertEqual(JournalEntry.objects.filter(source_type="payroll").count(), 1)
        self.assertEqual(PayrollPosting.objects.count(), 1)

    def test_posting_ditolak_tidak_meninggalkan_apa_pun(self):
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS, dikecualikan={"draft": 1})):
            with self.assertRaises(svc.PayrollError):
                svc.posting(2026, 9, self.user)
        self.assertEqual(JournalEntry.objects.count(), 0)
        self.assertEqual(PayrollPosting.objects.count(), 0)

    def test_hr_tidak_bisa_dihubungi(self):
        with mock.patch(MOCK_HR, side_effect=svc.PayrollSumberError("HR down")):
            with self.assertRaises(svc.PayrollSumberError):
                svc.posting(2026, 9, self.user)
        self.assertEqual(JournalEntry.objects.count(), 0)

    def test_periode_tertutup_ditolak(self):
        AccountingPeriod.objects.create(
            fiscal_year=2026, start_date=date(2026, 9, 1), end_date=date(2026, 9, 30),
            status=AccountingPeriod.Status.CLOSED)
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)), self.assertRaises(svc.PayrollError) as ctx:
            svc.posting(2026, 9, self.user)
        self.assertIn("ditutup", str(ctx.exception).lower())
        self.assertEqual(PayrollPosting.objects.count(), 0)

    def test_status_pratinjau_belum_sudah_berbeda(self):
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)):
            self.assertEqual(svc.pratinjau(2026, 9)["status_posting"], "belum")
        self._posting()
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)):
            self.assertEqual(svc.pratinjau(2026, 9)["status_posting"], "sudah")
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS, hash="h2")):
            self.assertEqual(svc.pratinjau(2026, 9)["status_posting"], "berbeda")


class KoreksiDanPembayaranTests(PayrollBase):
    def setUp(self):
        super().setUp()
        self.peta_bpjs()
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)):
            self.p1 = svc.posting(2026, 9, self.user)

    def test_koreksi_membalik_lama_dan_membuat_versi_baru(self):
        data2 = _data(slip=[_slip(gross=3300000, deduction=120000, net=3180000)], potongan=BPJS, hash="h2")
        with mock.patch(MOCK_HR, return_value=data2):
            p2 = svc.koreksi(2026, 9, self.user)
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, "dibalik")
        self.assertEqual((p2.versi, p2.status, p2.total_net), (2, "aktif", D(3180000)))
        rev = JournalEntry.objects.get(reversed_entry=self.p1.journal_entry)
        self.assertEqual(sum(l.debit for l in rev.lines.all()), D(3557200))
        # saldo bersih akun hutang gaji = hanya versi baru
        neto = sum(l.kredit - l.debit for e in JournalEntry.objects.all() for l in e.lines.all()
                   if l.account_id == self.hutang_gaji.id)
        self.assertEqual(neto, D(3180000))

    def test_koreksi_ditolak_bila_versi_baru_bermasalah_versi_lama_tetap_aktif(self):
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS, dikecualikan={"draft": 1})):
            with self.assertRaises(svc.PayrollError):
                svc.koreksi(2026, 9, self.user)
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, "aktif")
        self.assertFalse(JournalEntry.objects.filter(reversed_entry__isnull=False).exists())

    def test_koreksi_tanpa_posting_ditolak(self):
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS)), self.assertRaises(svc.PayrollError):
            svc.koreksi(2026, 10, self.user)

    def test_bayar_membuat_jurnal_dan_menutup_hutang(self):
        p = svc.bayar(2026, 9, self.kas.id, date(2026, 10, 1), self.user)
        je = p.payment_journal_entry
        self.assertEqual(je.source_type, JournalEntry.SourceType.PAYROLL_PAYMENT)
        self.assertEqual(je.source_id, p.pk)
        by_acc = {l.account.code: (l.debit, l.kredit) for l in je.lines.all()}
        self.assertEqual(by_acc, {"21100": (D(3130000), D(0)), "11101": (D(0), D(3130000))})
        saldo = sum(l.kredit - l.debit for e in JournalEntry.objects.all() for l in e.lines.all()
                    if l.account_id == self.hutang_gaji.id)
        self.assertEqual(saldo, D(0))

    def test_bayar_dua_kali_ditolak(self):
        svc.bayar(2026, 9, self.kas.id, None, self.user)
        with self.assertRaises(svc.PayrollError) as ctx:
            svc.bayar(2026, 9, self.kas.id, None, self.user)
        self.assertIn("sudah dibayar", str(ctx.exception))
        self.assertEqual(JournalEntry.objects.filter(source_type="payroll_payment").count(), 1)

    def test_bayar_sebelum_posting_ditolak(self):
        with self.assertRaises(svc.PayrollError):
            svc.bayar(2026, 10, self.kas.id, None, self.user)

    def test_bayar_dengan_akun_bukan_kas_bank_ditolak(self):
        with self.assertRaises(svc.PayrollError):
            svc.bayar(2026, 9, self.biaya.id, None, self.user)
        self.assertFalse(JournalEntry.objects.filter(source_type="payroll_payment").exists())

    def test_koreksi_setelah_dibayar_ditolak(self):
        svc.bayar(2026, 9, self.kas.id, None, self.user)
        with mock.patch(MOCK_HR, return_value=_data(potongan=BPJS, hash="h2")), self.assertRaises(svc.PayrollError) as ctx:
            svc.koreksi(2026, 9, self.user)
        self.assertIn("sudah dibayar", str(ctx.exception))


class AmbilHrTests(PayrollBase):
    def test_tanpa_kunci_ditolak(self):
        with mock.patch.dict("os.environ", {}, clear=True), self.assertRaises(svc.PayrollSumberError):
            svc.ambil_payroll_hr(2026, 9)

    def test_gagal_jaringan_dan_format_salah(self):
        import requests
        with mock.patch.dict("os.environ", {"INSIGHTS_BRIDGE_API_KEY": "k"}):
            with mock.patch("accounting.services.payroll_posting.requests.get",
                            side_effect=requests.ConnectionError("putus")):
                with self.assertRaises(svc.PayrollSumberError):
                    svc.ambil_payroll_hr(2026, 9)
            resp = mock.Mock()
            resp.raise_for_status.return_value = None
            resp.json.return_value = {"bukan": "format"}
            with mock.patch("accounting.services.payroll_posting.requests.get", return_value=resp):
                with self.assertRaises(svc.PayrollSumberError):
                    svc.ambil_payroll_hr(2026, 9)
