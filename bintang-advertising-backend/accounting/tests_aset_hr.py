"""Audit penyusutan 2026-11-10 + sambungan Aset HR -> Aset Tetap akuntansi.

Celah yang ditutup: aset yang dibeli setelah bulan diposting ikut disusutkan, aset saldo
awal tidak bisa didaftarkan (jurnal sebelum Mulai Akuntansi ditolak) dan tidak bisa membawa
akumulasi penyusutan awal, bulan yang terlewat tidak disusulkan. Plus antrean aset dari HR.
"""
from datetime import date
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from accounting.models import (
    Account, AccountClassification, AccountingPeriod, AccountingSettings, AsetHRMasuk, FixedAsset,
    JournalEntry, NotifikasiKeuangan,
)
from accounting.services.assets import create_fixed_asset
from accounting.services.depreciation import (
    get_accumulated_depreciation, post_monthly_depreciation, proyeksi_penyusutan,
)

User = get_user_model()
KUNCI = "kunci-aset-hr-tes"
BRIDGE = "/api/bridge/hr-aset/"


class DasarAset(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="aset-owner", email="aset-owner@example.com", password="x", nip="ASET-OWNER",
        )
        self.owner.role = "owner"
        self.owner.save()
        aset_cls = AccountClassification.objects.create(name="Aset Tes HR", account_type="asset")
        ekuitas_cls = AccountClassification.objects.create(name="Ekuitas Tes HR", account_type="equity")
        beban_cls = AccountClassification.objects.create(name="Beban Tes HR", account_type="expense")
        self.akun_aset = Account.objects.create(code="12001", name="Peralatan Tes", account_type="asset", classification=aset_cls)
        self.kas = Account.objects.create(code="11001", name="Kas Tes", account_type="asset", classification=aset_cls)
        self.akum = Account.objects.create(
            code="14001", name="Akumulasi Tes", account_type="asset", classification=aset_cls, is_contra=True,
        )
        self.beban = Account.objects.create(code="60401", name="Beban Penyusutan Tes", account_type="expense", classification=beban_cls)
        self.saldo_awal = Account.objects.create(code="34001", name="Saldo Awal Tes", account_type="equity", classification=ekuitas_cls)
        self.akun = {
            "asset_account": self.akun_aset, "depreciation_expense_account": self.beban,
            "accumulated_depreciation_account": self.akum,
        }

    def buat(self, kode, tanggal, harga, umur=12, **lain):
        data = {"asset_code": kode, "name": kode, "acquisition_date": tanggal,
                "acquisition_cost": Decimal(harga), "residual_value": Decimal("0"),
                "useful_life_months": umur, "counter_account": self.kas, **self.akun, **lain}
        return create_fixed_asset(data=data, created_by=self.owner)


class PenyusutanCelahTests(DasarAset):
    def test_aset_dibeli_setelah_bulan_diposting_tidak_disusutkan(self):
        aset = self.buat("AST-DEPAN", date(2026, 3, 10), "1200000")
        self.assertEqual(post_monthly_depreciation(period_end_date=date(2026, 2, 28)), [])
        self.assertEqual(get_accumulated_depreciation(aset), 0)

    def test_bulan_terlewat_disusulkan_per_bulan(self):
        aset = self.buat("AST-SUSUL", date(2026, 1, 15), "1200000")
        jurnal = post_monthly_depreciation(period_end_date=date(2026, 3, 31))
        self.assertEqual([j.date for j in jurnal], [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)])
        self.assertEqual(get_accumulated_depreciation(aset), Decimal("300000"))
        # idempoten
        self.assertEqual(post_monthly_depreciation(period_end_date=date(2026, 3, 31)), [])

    def test_bulan_tutup_buku_digabung_ke_bulan_terbuka(self):
        aset = self.buat("AST-TUTUP", date(2026, 1, 5), "1200000")
        post_monthly_depreciation(period_end_date=date(2026, 1, 31))
        feb = JournalEntry.objects.filter(date=date(2026, 1, 31)).first().period  # pastikan periode ada
        AccountingPeriod.objects.get_or_create(start_date=date(2026, 2, 1), end_date=date(2026, 2, 28),
                                               defaults={"fiscal_year": 2026})
        AccountingPeriod.objects.filter(start_date=date(2026, 2, 1)).update(status=AccountingPeriod.Status.CLOSED)
        self.assertIsNotNone(feb)
        jurnal = post_monthly_depreciation(period_end_date=date(2026, 3, 31))
        self.assertEqual(len(jurnal), 1)
        self.assertEqual(jurnal[0].date, date(2026, 3, 31))
        self.assertIn("susulan 1 bulan", jurnal[0].description)
        self.assertEqual(get_accumulated_depreciation(aset), Decimal("300000"))


class AsetSaldoAwalTests(DasarAset):
    def setUp(self):
        super().setUp()
        AccountingSettings.objects.create(
            accounting_start_date=date(2026, 9, 5), opening_balance_equity_account=self.saldo_awal,
        )

    def test_aset_lama_dengan_akumulasi_awal(self):
        aset = self.buat("AST-LAMA", date(2024, 9, 1), "4800000", umur=48, is_opening_balance=True,
                         counter_account=None, opening_accumulated_depreciation=Decimal("2400000"))
        jurnal = aset.acquisition_journal
        self.assertEqual(jurnal.date, date(2026, 9, 5))
        baris = {(l.account_id, l.debit, l.kredit) for l in jurnal.lines.all()}
        self.assertEqual(baris, {
            (self.akun_aset.id, Decimal("4800000"), 0),
            (self.akum.id, 0, Decimal("2400000")),
            (self.saldo_awal.id, 0, Decimal("2400000")),
        })
        self.assertEqual(aset.last_depreciation_date, date(2026, 8, 31))
        self.assertEqual(get_accumulated_depreciation(aset), Decimal("2400000"))

        post_monthly_depreciation(period_end_date=date(2026, 9, 30))
        self.assertEqual(get_accumulated_depreciation(aset), Decimal("2500000"))

    def test_aset_sebelum_mulai_tanpa_centang_saldo_awal_ditolak(self):
        with self.assertRaisesMessage(ValidationError, "Saldo Awal"):
            self.buat("AST-SALAH", date(2026, 1, 1), "1000000")

    def test_akumulasi_awal_melebihi_nilai_disusutkan_ditolak(self):
        with self.assertRaises(ValidationError):
            self.buat("AST-LEBIH", date(2025, 1, 1), "1000000", is_opening_balance=True, counter_account=None,
                      opening_accumulated_depreciation=Decimal("1000001"))


class ProyeksiTests(DasarAset):
    def test_proyeksi_dua_belas_bulan(self):
        self.buat("AST-PROY", date(2026, 1, 1), "1200000", umur=10)  # 120.000/bulan, habis Okt 2026
        hasil = proyeksi_penyusutan(bulan=12, mulai=date(2026, 9, 1))
        self.assertEqual(hasil["bulan"][0], "2026-09")
        self.assertEqual(hasil["total_per_bulan"][:3], [Decimal("120000"), Decimal("120000"), Decimal("0")])
        self.assertEqual(hasil["belum_diposting"], Decimal("960000"))  # Jan-Agu belum diposting
        self.assertEqual(hasil["total"], Decimal("240000"))


@mock.patch.dict("os.environ", {"HR_BRIDGE_API_KEY": KUNCI})
class JembatanAsetHRTests(DasarAset):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

    def kirim(self, **ubah):
        data = {"aksi": "kirim", "hr_asset_id": 7, "kode": "AST-00007", "nama": "Laptop Desain",
                "kategori": "Komputer", "tanggal_beli": "2026-10-01", "harga": "9000000", "jumlah": 1,
                "pemegang": "Budi", "status_hr": "In use"}
        data.update(ubah)
        return self.client.post(BRIDGE, data, format="json", HTTP_X_API_KEY=KUNCI)

    def test_tanpa_kunci_ditolak(self):
        res = self.client.post(BRIDGE, {"aksi": "kirim"}, format="json")
        self.assertIn(res.status_code, (401, 403))

    def test_harga_dan_tanggal_wajib(self):
        self.assertEqual(self.kirim(tanggal_beli="").status_code, 400)
        self.assertEqual(self.kirim(harga="0").status_code, 400)
        self.assertFalse(AsetHRMasuk.objects.exists())

    def test_kirim_masuk_antrean_tanpa_jurnal_dan_beri_notifikasi(self):
        res = self.kirim()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "menunggu")
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ASSET_ACQUISITION).exists())
        self.assertTrue(NotifikasiKeuangan.objects.filter(jenis=NotifikasiKeuangan.Jenis.ASET_HR).exists())
        self.kirim(nama="Laptop Desain Baru")  # kirim ulang = perbarui, bukan dobel
        self.assertEqual(AsetHRMasuk.objects.get().nama, "Laptop Desain Baru")

    def test_tarik_sebelum_diproses(self):
        self.kirim()
        res = self.client.post(BRIDGE, {"aksi": "tarik", "hr_asset_id": 7}, format="json", HTTP_X_API_KEY=KUNCI)
        self.assertEqual(res.json()["status"], "ditarik")
        self.assertEqual(self.kirim().json()["status"], "menunggu")  # dikirim ulang -> antre lagi

    def _proses(self):
        masuk = AsetHRMasuk.objects.get()
        staf = APIClient()
        staf.force_authenticate(self.owner)
        return staf.post(f"/api/accounting/assets/dari-hr/{masuk.id}/proses/", {
            "asset_code": masuk.kode, "name": masuk.nama, "acquisition_date": "2026-10-01",
            "acquisition_cost": "9000000", "residual_value": "0", "useful_life_months": 48,
            "asset_account": self.akun_aset.id, "depreciation_expense_account": self.beban.id,
            "accumulated_depreciation_account": self.akum.id, "counter_account": self.kas.id,
        }, format="json")

    def test_finance_proses_jadi_aset_tetap_dan_hr_bisa_baca_status(self):
        self.kirim()
        res = self._proses()
        self.assertEqual(res.status_code, 201, res.content)
        aset = FixedAsset.objects.get()
        self.assertEqual(aset.hr_asset_id, 7)
        self.assertIsNotNone(aset.acquisition_journal)
        self.assertEqual(AsetHRMasuk.objects.get().status, "diproses")

        status_hr = self.client.get(BRIDGE, {"ids": "7,99"}, HTTP_X_API_KEY=KUNCI).json()["hasil"]
        self.assertEqual(len(status_hr), 1)
        self.assertEqual(status_hr[0]["kode_aset_akuntansi"], "AST-00007")
        self.assertEqual(status_hr[0]["nilai_buku"], "9000000")

        # setelah diproses: tarik ditolak, status bermasalah di HR -> perlu ditinjau Finance
        tarik = self.client.post(BRIDGE, {"aksi": "tarik", "hr_asset_id": 7}, format="json", HTTP_X_API_KEY=KUNCI)
        self.assertEqual(tarik.status_code, 400)
        self.kirim(status_hr="Not-Available")
        self.assertTrue(AsetHRMasuk.objects.get().perlu_ditinjau)
        self.assertEqual(FixedAsset.objects.get().status, FixedAsset.Status.ACTIVE)  # tidak dilepas otomatis

    def test_proses_dua_kali_ditolak(self):
        self.kirim()
        self.assertEqual(self._proses().status_code, 201)
        self.assertEqual(self._proses().status_code, 400)
