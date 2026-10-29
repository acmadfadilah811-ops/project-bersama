"""Jurnal uang makan mingguan dari HR (2026-10-30): POST /api/bridge/hr-uang-makan/.

Dr Biaya uang makan / Cr Kas (tunai) atau Bank (transfer); idempotent per id pembayaran HR; batal = jurnal
pembalik (M7); akun kosong = ditolak (fail-closed); tanpa kunci jembatan = 401."""

from datetime import date
from decimal import Decimal as D
from unittest import mock

from rest_framework.test import APITestCase

from .models import Account, AccountClassification, AccountingSettings, JournalEntry

URL = "/api/bridge/hr-uang-makan/"
KUNCI = "kunci-uji-uang-makan"


def _bayar(**ubah):
    data = {
        "aksi": "bayar", "hr_pembayaran_id": 41, "hr_employee_id": 68, "nama": "Aditia Agit Wijaya",
        "minggu_mulai": "2026-10-25", "minggu_selesai": "2026-10-31", "total": "38000.00",
        "metode": "tunai", "tanggal": "2026-10-31",
    }
    data.update(ubah)
    return data


@mock.patch.dict("os.environ", {"HR_BRIDGE_API_KEY": KUNCI})
class UangMakanJurnalTest(APITestCase):
    def setUp(self):
        kas_bank = AccountClassification.objects.create(name="Kas & Bank", account_type="asset")
        beban = AccountClassification.objects.create(name="Pengeluaran", account_type="expense")
        self.kas = Account.objects.create(code="11101", name="Kas", account_type="asset", classification=kas_bank)
        self.bank = Account.objects.create(code="11201", name="Bank BCA", account_type="asset", classification=kas_bank)
        self.biaya = Account.objects.create(code="60700", name="Biaya uang makan", account_type="expense", classification=beban)
        self.settings = AccountingSettings.objects.create(
            accounting_start_date=date(2026, 1, 1), uang_makan_expense_account=self.biaya,
            uang_makan_tunai_account=self.kas, uang_makan_transfer_account=self.bank,
        )

    def _post(self, data, kunci=KUNCI):
        return self.client.post(URL, data, format="json", HTTP_X_API_KEY=kunci)

    def _saldo(self, entry):
        return {l.account.code: l.debit - l.kredit for l in entry.lines.select_related("account")}

    def test_bayar_tunai_membuat_jurnal_seimbang(self):
        res = self._post(_bayar())
        self.assertEqual(res.status_code, 201, res.content)
        entry = JournalEntry.objects.get(pk=res.json()["jurnal_id"])
        self.assertEqual(entry.source_type, "uang_makan")
        self.assertEqual(entry.source_id, 41)
        self.assertEqual(entry.date, date(2026, 10, 31))
        self.assertEqual(self._saldo(entry), {"60700": D("38000"), "11101": D("-38000")})
        self.assertIn("Aditia Agit Wijaya", entry.description)

    def test_transfer_memakai_akun_bank(self):
        res = self._post(_bayar(metode="transfer", hr_pembayaran_id=42))
        self.assertEqual(res.status_code, 201, res.content)
        entry = JournalEntry.objects.get(pk=res.json()["jurnal_id"])
        self.assertEqual(self._saldo(entry), {"60700": D("38000"), "11201": D("-38000")})

    def test_kirim_dua_kali_tetap_satu_jurnal(self):
        pertama = self._post(_bayar())
        kedua = self._post(_bayar())
        self.assertEqual(kedua.status_code, 200)
        self.assertEqual(pertama.json()["jurnal_id"], kedua.json()["jurnal_id"])
        self.assertEqual(JournalEntry.objects.filter(source_type="uang_makan").count(), 1)

    def test_batal_membuat_jurnal_pembalik_dan_bisa_bayar_ulang(self):
        asal = JournalEntry.objects.get(pk=self._post(_bayar()).json()["jurnal_id"])
        res = self._post({"aksi": "batal", "hr_pembayaran_id": 41})
        self.assertEqual(res.status_code, 200, res.content)
        rev = JournalEntry.objects.get(pk=res.json()["jurnal_pembalik_id"])
        self.assertEqual(rev.reversed_entry, asal)
        self.assertEqual(self._saldo(rev), {"60700": D("-38000"), "11101": D("38000")})
        # Batal kedua kali tidak membuat pembalik baru.
        self.assertIsNone(self._post({"aksi": "batal", "hr_pembayaran_id": 41}).json()["jurnal_pembalik_id"])
        self.assertEqual(JournalEntry.objects.filter(reversed_entry=asal).count(), 1)

    def test_akun_belum_diatur_ditolak_tanpa_jurnal(self):
        self.settings.uang_makan_tunai_account = None
        self.settings.save()
        res = self._post(_bayar())
        self.assertEqual(res.status_code, 400)
        self.assertIn("Atur Akun Uang Makan", res.json()["error"])
        self.assertFalse(JournalEntry.objects.filter(source_type="uang_makan").exists())

    def test_data_tidak_valid_ditolak(self):
        for salah in ({"total": "0"}, {"metode": "kredit"}, {"tanggal": "kemarin"}):
            self.assertEqual(self._post(_bayar(**salah)).status_code, 400, salah)
        self.assertEqual(self._post({"aksi": "hapus"}).status_code, 400)
        self.assertFalse(JournalEntry.objects.exists())

    def test_tanpa_kunci_atau_kunci_salah_401(self):
        self.assertEqual(self._post(_bayar(), kunci="").status_code, 401)
        self.assertEqual(self._post(_bayar(), kunci="salah").status_code, 401)
        self.assertFalse(JournalEntry.objects.exists())
