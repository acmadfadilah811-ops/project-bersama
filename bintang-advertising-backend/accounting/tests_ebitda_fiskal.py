"""Laba Rugi lengkap (laba usaha, laba sebelum/sesudah pajak, EBITDA) + penyusutan pajak (2026-11-10)."""
import importlib
from datetime import date
from decimal import Decimal

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounting.models import Account, AccountClassification, FixedAsset
from accounting.services.assets import create_fixed_asset
from accounting.services.depreciation import post_monthly_depreciation
from accounting.services.journal import build_pair_lines, create_journal_entry
from accounting.services.ledger import get_income_statement
from accounting.services.penyusutan_fiskal import jadwal_fiskal, laporan_penyusutan_fiskal

User = get_user_model()


def _kls(nama, tipe):
    return AccountClassification.objects.get_or_create(name=nama, defaults={"account_type": tipe})[0]


class LabaRugiEbitdaTests(TestCase):
    def setUp(self):
        self.kas = Account.objects.create(code="11009", name="Kas", account_type="asset", classification=_kls("Kas & Bank", "asset"))

        def akun(kode, nama, kls, tipe, komponen=""):
            return Account.objects.create(code=kode, name=nama, account_type=tipe,
                                          classification=_kls(kls, tipe), komponen_ebitda=komponen)

        self.penjualan = akun("40009", "Penjualan", "Pendapatan", "revenue")
        self.hpp = akun("51009", "HPP", "Harga Pokok Penjualan", "expense")
        self.gaji = akun("60109", "Gaji", "Pengeluaran", "expense")
        self.susut = akun("60409", "Penyusutan", "Pengeluaran", "expense", "penyusutan")
        self.amort = akun("60809", "Amortisasi", "Pengeluaran", "expense", "amortisasi")
        self.bunga_masuk = akun("70109", "Pendapatan bunga", "Pendapatan Lain", "revenue", "pendapatan_bunga")
        self.bunga_keluar = akun("82009", "Beban bunga", "Pengeluaran Lain", "expense", "beban_bunga")
        self.pajak = akun("91009", "Beban pajak", "Beban Pajak Penghasilan", "expense")

    def jurnal(self, debit, kredit, jumlah):
        create_journal_entry(date=date(2026, 10, 15), lines=build_pair_lines(
            debit_account=debit, kredit_account=kredit, amount=Decimal(jumlah)))

    def test_urutan_laba_dan_ebitda(self):
        self.jurnal(self.kas, self.penjualan, "10000000")
        self.jurnal(self.hpp, self.kas, "4000000")
        self.jurnal(self.gaji, self.kas, "2000000")
        self.jurnal(self.susut, self.kas, "500000")
        self.jurnal(self.amort, self.kas, "100000")
        self.jurnal(self.kas, self.bunga_masuk, "50000")
        self.jurnal(self.bunga_keluar, self.kas, "200000")
        self.jurnal(self.pajak, self.kas, "300000")

        lr = get_income_statement(date(2026, 10, 1), date(2026, 10, 31))
        self.assertEqual(lr["total_laba_kotor"], Decimal("6000000"))
        self.assertEqual(lr["laba_usaha"], Decimal("3400000"))
        self.assertEqual(lr["laba_sebelum_pajak"], Decimal("3250000"))
        self.assertEqual(lr["total_pajak_penghasilan"], Decimal("300000"))
        self.assertEqual(lr["laba_setelah_pajak"], Decimal("2950000"))
        self.assertEqual(lr["laba_bersih"], Decimal("2950000"))
        e = lr["ebitda"]
        self.assertEqual(e["ebit"], Decimal("3400000"))
        self.assertEqual(e["ebitda"], Decimal("4000000"))
        self.assertEqual(e["margin_persen"], 40.0)
        # akun pajak tidak ikut terhitung di beban operasional/non-operasional
        self.assertEqual(lr["total_biaya_operasional"], Decimal("2600000"))
        self.assertEqual(lr["subtotal_biaya_non_operasional"], Decimal("200000"))

    def test_migrasi_menambah_akun_dan_menandai_penyusutan(self):
        for nama, tipe in [("Kewajiban Jangka Pendek", "liability"), ("Pengeluaran Lain", "expense")]:
            _kls(nama, tipe)
        lama = Account.objects.create(code="60400", name="Biaya penyusutan", account_type="expense",
                                      classification=_kls("Pengeluaran", "expense"))
        modul = importlib.import_module("accounting.migrations.0050_ebitda_pajak_fiskal")
        modul.tambah_akun(django_apps, None)
        modul.tambah_akun(django_apps, None)  # idempoten
        self.assertEqual(Account.objects.get(code="91000").classification.name, "Beban Pajak Penghasilan")
        self.assertEqual(Account.objects.get(code="82000").komponen_ebitda, "beban_bunga")
        self.assertEqual(Account.objects.get(code="60800").komponen_ebitda, "amortisasi")
        self.assertTrue(Account.objects.filter(code="21300").exists())
        lama.refresh_from_db()
        self.assertEqual(lama.komponen_ebitda, "penyusutan")


class PenyusutanFiskalTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(username="fiskal-owner", email="f@x.test", password="x", nip="FISKAL")
        self.owner.role = "owner"
        self.owner.save()
        kls = _kls("Aset Fiskal Tes", "asset")
        self.akun = {
            "asset_account": Account.objects.create(code="12009", name="Peralatan", account_type="asset", classification=kls),
            "accumulated_depreciation_account": Account.objects.create(
                code="14009", name="Akumulasi", account_type="asset", classification=kls, is_contra=True),
            "depreciation_expense_account": Account.objects.create(
                code="60419", name="Beban susut", account_type="expense", classification=_kls("Beban Fiskal", "expense")),
            "counter_account": Account.objects.create(code="11019", name="Kas", account_type="asset", classification=kls),
        }

    def buat(self, kode, tanggal, kelompok, metode="garis_lurus", umur=48):
        return create_fixed_asset(data={
            "asset_code": kode, "name": kode, "acquisition_date": tanggal, "acquisition_cost": Decimal("12000000"),
            "residual_value": Decimal("0"), "useful_life_months": umur, "kelompok_fiskal": kelompok,
            "metode_fiskal": metode, **self.akun,
        }, created_by=self.owner)

    def test_garis_lurus_kelompok_1_mulai_bulan_perolehan(self):
        aset = self.buat("AST-GL", date(2026, 7, 15), "k1")
        jadwal = jadwal_fiskal(aset, 2031)
        self.assertEqual(jadwal[2026][1], Decimal("1500000"))  # 6 bulan x 25%
        self.assertEqual(jadwal[2027][1], Decimal("3000000"))
        self.assertEqual(jadwal[2030][1], Decimal("1500000"))  # Jan-Jun, akhir masa
        self.assertEqual(jadwal[2030][2], Decimal("0"))
        self.assertEqual(jadwal[2031][1], Decimal("0"))

    def test_saldo_menurun_sisa_disusutkan_sekaligus_di_akhir_masa(self):
        aset = self.buat("AST-SM", date(2026, 1, 1), "k1", "saldo_menurun")
        jadwal = jadwal_fiskal(aset, 2029)
        self.assertEqual([jadwal[t][1] for t in range(2026, 2030)],
                         [Decimal("6000000"), Decimal("3000000"), Decimal("1500000"), Decimal("1500000")])
        self.assertEqual(jadwal[2029][2], Decimal("0"))

    def test_laporan_koreksi_fiskal_dan_belum_diatur(self):
        aset = self.buat("AST-KOR", date(2026, 1, 1), "k2", umur=48)  # komersial 4 th, fiskal 8 th
        self.buat("AST-NOL", date(2026, 1, 1), "")
        post_monthly_depreciation(period_end_date=date(2026, 12, 31))
        laporan = laporan_penyusutan_fiskal(2026)
        baris = {b["asset_code"]: b for b in laporan["aset"]}["AST-KOR"]
        self.assertEqual(baris["penyusutan_komersial"], Decimal("3000000"))  # 250rb x 12
        self.assertEqual(baris["penyusutan_fiskal"], Decimal("1500000"))  # 12,5%
        self.assertEqual(baris["koreksi"], Decimal("1500000"))
        self.assertEqual([b["asset_code"] for b in laporan["belum_diatur"]], ["AST-NOL"])
        self.assertEqual(aset.id, baris["id"])

    def test_bangunan_tidak_boleh_saldo_menurun(self):
        aset = self.buat("AST-BGN", date(2026, 1, 1), "bangunan_permanen")
        klien = APIClient()
        klien.force_authenticate(self.owner)
        res = klien.patch(f"/api/accounting/assets/{aset.id}/", {"metode_fiskal": "saldo_menurun"}, format="json")
        self.assertEqual(res.status_code, 400)
        res = klien.get("/api/accounting/assets/penyusutan-fiskal/", {"tahun": 2026})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Decimal(str(res.json()["total"]["penyusutan_fiskal"])), Decimal("600000"))  # 5%
        self.assertEqual(FixedAsset.objects.get(pk=aset.pk).metode_fiskal, "garis_lurus")
