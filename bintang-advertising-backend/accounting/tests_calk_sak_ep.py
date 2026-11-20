"""SAK EP (2026-11-15): rapikan akun, penutupan akun Saldo Awal, dan CALK otomatis."""
import importlib
from datetime import date
from decimal import Decimal

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, AccountingSettings
from accounting.services.assets import create_fixed_asset
from accounting.services.calk import susun_calk
from accounting.services.journal import build_pair_lines, create_journal_entry
from accounting.services.opening_balance import saldo_akun_saldo_awal, tutup_saldo_awal

User = get_user_model()


def _kls(nama, tipe):
    return AccountClassification.objects.get_or_create(name=nama, defaults={"account_type": tipe})[0]


class DasarSakEp(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(username="sakep", email="sakep@x.test", password="x", nip="SAKEP")
        self.owner.role = "owner"
        self.owner.save()
        self.kas = Account.objects.create(code="11101", name="Kas", account_type="asset", classification=_kls("Kas & Bank", "asset"))
        self.modal = Account.objects.create(code="31000", name="Modal", account_type="equity", classification=_kls("Ekuitas", "equity"))
        self.saldo_awal = Account.objects.create(code="34000", name="Saldo Awal", account_type="equity", classification=_kls("Ekuitas", "equity"))
        self.penjualan = Account.objects.create(code="40000", name="Penjualan", account_type="revenue", classification=_kls("Pendapatan", "revenue"))
        AccountingSettings.objects.create(accounting_start_date=date(2026, 9, 5), opening_balance_equity_account=self.saldo_awal)

    def jurnal(self, debit, kredit, jumlah, tgl=date(2026, 10, 1)):
        return create_journal_entry(date=tgl, lines=build_pair_lines(debit_account=debit, kredit_account=kredit, amount=Decimal(jumlah)))


class TutupSaldoAwalTests(DasarSakEp):
    def test_saldo_pindah_ke_modal_dan_tidak_bisa_dua_kali(self):
        self.jurnal(self.kas, self.saldo_awal, "5000000", tgl=date(2026, 9, 5))
        self.assertEqual(saldo_akun_saldo_awal(date(2026, 11, 15))[1], Decimal("5000000"))
        entry = tutup_saldo_awal(target_account=self.modal, tanggal=date(2026, 11, 15), actor=self.owner)
        self.assertTrue(entry.entry_number)
        self.assertEqual(saldo_akun_saldo_awal(date(2026, 11, 15))[1], Decimal("0"))
        with self.assertRaisesMessage(ValidationError, "sudah nol"):
            tutup_saldo_awal(target_account=self.modal, tanggal=date(2026, 11, 15))

    def test_tujuan_harus_ekuitas(self):
        self.jurnal(self.kas, self.saldo_awal, "1000", tgl=date(2026, 9, 5))
        with self.assertRaises(ValidationError):
            tutup_saldo_awal(target_account=self.kas, tanggal=date(2026, 11, 15))

    def test_endpoint(self):
        self.jurnal(self.kas, self.saldo_awal, "1000", tgl=date(2026, 9, 5))
        klien = APIClient()
        klien.force_authenticate(self.owner)
        res = klien.post("/api/accounting/reports/tutup-saldo-awal/", {"akun_tujuan": self.modal.id, "tanggal": "2026-11-15"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)


class RapikanAkunTests(DasarSakEp):
    def test_akun_antar_cabang_dan_pembelian_periodik_dinonaktifkan_bila_belum_dipakai(self):
        hpp = _kls("Harga Pokok Penjualan", "expense")
        antar = Account.objects.create(code="41000", name="Penjualan antar cabang", account_type="revenue", classification=_kls("Pendapatan", "revenue"))
        pembelian = Account.objects.create(code="50000", name="Pembelian", account_type="expense", classification=hpp)
        Account.objects.create(code="50100", name="Pembelian antar cabang", account_type="expense", classification=hpp)
        self.jurnal(pembelian, self.kas, "1000")  # 50000 pernah dipakai -> tetap aktif
        modul = importlib.import_module("accounting.migrations.0051_sak_ep_rapikan_akun")
        modul.nonaktifkan(django_apps, None)
        antar.refresh_from_db()
        pembelian.refresh_from_db()
        self.assertFalse(antar.is_active)
        self.assertIn("SAK EP", antar.description)
        self.assertTrue(pembelian.is_active)
        self.assertFalse(Account.objects.get(code="50100").is_active)


class CalkTests(DasarSakEp):
    def test_calk_berisi_kebijakan_rincian_aset_tetap_dan_pengungkapan(self):
        self.jurnal(self.kas, self.saldo_awal, "10000000", tgl=date(2026, 9, 5))
        self.jurnal(self.kas, self.penjualan, "2500000")
        aset_kls = _kls("Aktiva Tetap", "asset")
        akun = {
            "asset_account": Account.objects.create(code="12000", name="Aset Tetap", account_type="asset", classification=aset_kls),
            "accumulated_depreciation_account": Account.objects.create(
                code="14000", name="Akumulasi", account_type="asset", classification=_kls("Akumulasi penyusutan aset tetap", "asset"), is_contra=True),
            "depreciation_expense_account": Account.objects.create(
                code="60400", name="Biaya penyusutan", account_type="expense", classification=_kls("Pengeluaran", "expense")),
        }
        create_fixed_asset(data={
            "asset_code": "AST-CALK", "name": "Printer", "acquisition_date": date(2026, 10, 1),
            "acquisition_cost": Decimal("12000000"), "residual_value": Decimal("0"), "useful_life_months": 12,
            "counter_account": self.kas, **akun,
        }, created_by=self.owner)

        calk = susun_calk(date(2026, 10, 1), date(2026, 10, 31))
        self.assertIn("SAK EP", calk["umum"]["standar"])
        judul = [k["judul"] for k in calk["kebijakan"]]
        self.assertIn("Persediaan", judul)
        self.assertIn("Aset tetap", judul)
        pendapatan = next(r for r in calk["rincian"] if r["judul"] == "Pendapatan")
        self.assertEqual(pendapatan["total"], Decimal("2500000"))
        self.assertEqual(calk["aset_tetap"]["jumlah"]["tambah"], Decimal("12000000"))
        self.assertEqual(calk["aset_tetap"]["aset"][0]["kode"], "AST-CALK")
        self.assertTrue(any("Saldo Awal" in b for b in calk["belum_diterapkan"]))
        self.assertEqual(len(calk["umur_piutang"]), 4)

    def test_endpoint_calk(self):
        klien = APIClient()
        klien.force_authenticate(self.owner)
        res = klien.get("/api/accounting/reports/calk/", {"date_from": "2026-10-01", "date_to": "2026-10-31"})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn("kebijakan", res.json())
