"""Penyusutan versi pajak (fiskal) aset tetap -- UU PPh Pasal 11 jo. PMK 72/2023 (2026-11-10).

Hanya perhitungan untuk SPT / rekonsiliasi fiskal; TIDAK pernah dijurnal. Penyusutan di buku
(komersial) tetap mengikuti FixedAsset.useful_life_months (lihat depreciation.py), dan selisih
keduanya ditampilkan sebagai koreksi fiskal.

Aturan yang dipakai:
- Kelompok harta bukan bangunan: 1 = 4 th (GL 25% / SM 50%), 2 = 8 th (12,5% / 25%),
  3 = 16 th (6,25% / 12,5%), 4 = 20 th (5% / 10%). Bangunan permanen 20 th (5%), tidak
  permanen 10 th (10%) -- bangunan hanya garis lurus.
- Penyusutan dimulai pada BULAN perolehan; tahun pertama dihitung sebanding jumlah bulan.
- Tanpa nilai sisa. Garis lurus: harga perolehan x tarif. Saldo menurun: nilai sisa buku
  fiskal awal tahun x tarif, dan sisa buku di akhir masa manfaat disusutkan sekaligus.
- Aset yang dilepas: disusutkan sampai bulan sebelum bulan pelepasan.
Angka dibulatkan ke rupiah penuh per tahun.
"""
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum

from ..models import FixedAsset, JournalEntry, JournalEntryLine

RUPIAH = Decimal("1")
NOL = Decimal("0")

# kelompok -> (masa manfaat tahun, tarif garis lurus, tarif saldo menurun atau None)
TARIF = {
    "k1": (4, Decimal("0.25"), Decimal("0.50")),
    "k2": (8, Decimal("0.125"), Decimal("0.25")),
    "k3": (16, Decimal("0.0625"), Decimal("0.125")),
    "k4": (20, Decimal("0.05"), Decimal("0.10")),
    "bangunan_permanen": (20, Decimal("0.05"), None),
    "bangunan_non_permanen": (10, Decimal("0.10"), None),
}


def _bulat(nilai):
    return nilai.quantize(RUPIAH, rounding=ROUND_HALF_UP)


def _indeks_bulan(d):
    return d.year * 12 + d.month - 1


def jadwal_fiskal(asset, sampai_tahun):
    """{tahun: (nilai_sisa_awal, penyusutan, nilai_sisa_akhir)} dari tahun perolehan s.d.
    `sampai_tahun`. Kosong bila kelompok belum diatur / tidak disusutkan."""
    aturan = TARIF.get(asset.kelompok_fiskal)
    if not aturan:
        return {}
    masa, tarif_gl, tarif_sm = aturan
    saldo_menurun = asset.metode_fiskal == FixedAsset.MetodeFiskal.SALDO_MENURUN and tarif_sm is not None
    harga = Decimal(asset.acquisition_cost)

    mulai = _indeks_bulan(asset.acquisition_date)
    akhir_masa = mulai + masa * 12 - 1  # bulan terakhir masa manfaat (inklusif)
    batas = akhir_masa
    if asset.status == FixedAsset.Status.DISPOSED and asset.disposal_date:
        batas = min(batas, _indeks_bulan(asset.disposal_date) - 1)

    hasil, sisa = {}, harga
    for tahun in range(asset.acquisition_date.year, sampai_tahun + 1):
        awal_tahun, akhir_tahun = tahun * 12, tahun * 12 + 11
        bulan = max(0, min(akhir_tahun, batas) - max(awal_tahun, mulai) + 1)
        if bulan == 0 or sisa <= 0:
            hasil[tahun] = (sisa, NOL, sisa)
            continue
        if akhir_tahun >= akhir_masa and batas == akhir_masa:
            susut = sisa  # akhir masa manfaat: sisa buku disusutkan sekaligus
        elif saldo_menurun:
            susut = _bulat(sisa * tarif_sm * bulan / 12)
        else:
            susut = _bulat(harga * tarif_gl * bulan / 12)
        susut = min(susut, sisa)
        hasil[tahun] = (sisa, susut, sisa - susut)
        sisa -= susut
    return hasil


def _komersial_tahun(asset, tahun):
    """Penyusutan komersial yang sudah DIJURNAL untuk aset ini pada tahun itu."""
    total = JournalEntryLine.objects.filter(
        journal_entry__status=JournalEntry.Status.POSTED,
        journal_entry__source_type=JournalEntry.SourceType.ASSET_DEPRECIATION,
        journal_entry__source_id=asset.id,
        journal_entry__date__range=(date(tahun, 1, 1), date(tahun, 12, 31)),
        account_id=asset.depreciation_expense_account_id,
    ).aggregate(v=Sum("debit"))["v"]
    return total or NOL


def laporan_penyusutan_fiskal(tahun):
    """Daftar penyusutan fiskal per aset untuk satu tahun pajak + perbandingan dengan komersial."""
    assets = (
        FixedAsset.objects.filter(acquisition_date__lte=date(tahun, 12, 31))
        .exclude(status=FixedAsset.Status.DISPOSED, disposal_date__lt=date(tahun, 1, 1))
        .order_by("asset_code")
    )
    baris, belum_diatur = [], []
    total = {"penyusutan_fiskal": NOL, "penyusutan_komersial": NOL, "koreksi": NOL}
    for asset in assets:
        if not asset.kelompok_fiskal:
            belum_diatur.append({"id": asset.id, "asset_code": asset.asset_code, "name": asset.name})
            continue
        if asset.kelompok_fiskal == FixedAsset.KelompokFiskal.TIDAK_DISUSUTKAN:
            continue
        awal, susut, akhir = jadwal_fiskal(asset, tahun).get(tahun, (NOL, NOL, NOL))
        komersial = _komersial_tahun(asset, tahun)
        koreksi = komersial - susut
        total["penyusutan_fiskal"] += susut
        total["penyusutan_komersial"] += komersial
        total["koreksi"] += koreksi
        baris.append({
            "id": asset.id,
            "asset_code": asset.asset_code,
            "name": asset.name,
            "acquisition_date": asset.acquisition_date,
            "acquisition_cost": asset.acquisition_cost,
            "kelompok": asset.get_kelompok_fiskal_display(),
            "metode": asset.get_metode_fiskal_display()
            if asset.kelompok_fiskal not in ("bangunan_permanen", "bangunan_non_permanen") else "Garis lurus",
            "nilai_sisa_awal": awal,
            "penyusutan_fiskal": susut,
            "nilai_sisa_akhir": akhir,
            "penyusutan_komersial": komersial,
            "koreksi": koreksi,
        })
    return {"tahun": tahun, "aset": baris, "belum_diatur": belum_diatur, "total": total}
