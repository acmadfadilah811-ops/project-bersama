"""Penyusutan aset tetap -- garis lurus (straight-line), satu-satunya metode
yang didukung saat ini (FixedAsset tidak punya field metode -- kalau nanti
perlu saldo-menurun dkk, tambah field baru, jangan overload field ini).

Sebelum modul ini ada, field `depreciation_expense_account`/
`accumulated_depreciation_account` di FixedAsset cuma tersimpan tanpa
pernah dibaca kode apa pun -- akun Akumulasi Penyusutan selamanya nol dan
Neraca menampilkan semua aset tetap pada nilai perolehan penuh (ditemukan
audit 2026-09-08).

Akumulasi penyusutan SENGAJA tidak disimpan sebagai field tersendiri di
FixedAsset (hindari sumber kebenaran kedua yang bisa drift dari jurnal
aslinya) -- selalu dihitung dari JournalEntryLine kredit ke
accumulated_depreciation_account (jurnal penyusutan + akumulasi awal di jurnal
perolehan aset saldo awal), source_id=asset.id, journal_entry.status=POSTED.

2026-11-10 (audit PSAK): aset yang perolehannya setelah bulan diposting tidak lagi
ikut disusutkan, bulan yang terlewat disusulkan, dan ada proyeksi penyusutan.
"""
import calendar
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import AccountingPeriod, AccountingSettings, FixedAsset, JournalEntry, JournalEntryLine
from .journal import build_pair_lines, create_journal_entry
from .period_rules import rentang_periode

RUPIAH = Decimal("1")
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
         "September", "Oktober", "November", "Desember"]


def akhir_bulan(tanggal):
    return tanggal.replace(day=calendar.monthrange(tanggal.year, tanggal.month)[1])


def bulan_berikut(tanggal):
    return (tanggal.replace(day=28) + timedelta(days=4)).replace(day=1)


def get_accumulated_depreciation(asset):
    """Total penyusutan yang sudah diposting utk 1 aset, dihitung dari jurnal
    (bukan field tersimpan) -- lihat docstring modul.

    Termasuk akumulasi penyusutan AWAL aset saldo awal: baris kredit ke akun
    akumulasi di jurnal perolehannya sendiri (aset yang dibeli sebelum Mulai
    Akuntansi sudah susut sebagian saat dicatat)."""
    total = JournalEntryLine.objects.filter(
        journal_entry__status=JournalEntry.Status.POSTED,
        journal_entry__source_type__in=[
            JournalEntry.SourceType.ASSET_DEPRECIATION, JournalEntry.SourceType.ASSET_ACQUISITION,
        ],
        journal_entry__source_id=asset.id,
        account_id=asset.accumulated_depreciation_account_id,
    ).aggregate(total=Sum("kredit"))["total"]
    return total or Decimal("0")


def get_book_value(asset):
    """Nilai buku = harga perolehan - akumulasi penyusutan (bisa dipanggil
    berkali-kali dgn aman, murni baca)."""
    return asset.acquisition_cost - get_accumulated_depreciation(asset)


def calculate_monthly_depreciation_amount(asset):
    """Beban penyusutan garis lurus per bulan: (perolehan - residu) / umur
    manfaat (bulan), dibulatkan ke rupiah penuh (acquisition_cost tidak
    punya desimal). None kalau aset tidak disusutkan (umur manfaat kosong/0,
    atau nilai residu >= nilai perolehan)."""
    if not asset.useful_life_months:
        return None
    depreciable_base = asset.acquisition_cost - asset.residual_value
    if depreciable_base <= 0:
        return None
    return (depreciable_base / asset.useful_life_months).quantize(RUPIAH, rounding=ROUND_HALF_UP)


def _bulan_pertama_belum_disusutkan(asset):
    """Awal bulan pertama yang belum diposting: bulan setelah last_depreciation_date,
    atau bulan perolehan untuk aset yang belum pernah disusutkan."""
    if asset.last_depreciation_date:
        return bulan_berikut(asset.last_depreciation_date)
    return asset.acquisition_date.replace(day=1)


def _tidak_bisa_diposting(tanggal, mulai_akuntansi):
    """Tanggal sebelum Mulai Akuntansi atau di periode yang sudah Tutup Buku."""
    if mulai_akuntansi and tanggal < mulai_akuntansi:
        return True
    awal, akhir = rentang_periode(tanggal)
    return AccountingPeriod.objects.filter(
        start_date=awal, end_date=akhir, status=AccountingPeriod.Status.CLOSED,
    ).exists()


@transaction.atomic
def post_monthly_depreciation(*, period_end_date, actor=None):
    """Posting jurnal penyusutan garis lurus utk SEMUA aset aktif yang punya
    useful_life_months, s.d. bulan yang mengandung `period_end_date`.

    - Idempoten per aset per bulan lewat FixedAsset.last_depreciation_date.
    - Aset yang tanggal perolehannya setelah `period_end_date` belum disusutkan.
    - Bulan yang terlewat (aset didaftarkan terlambat, jadwal tidak jalan) DISUSULKAN:
      satu jurnal per bulan bertanggal akhir bulan itu. Bulan yang tidak bisa diposting
      (sebelum Mulai Akuntansi / periode sudah Tutup Buku) digabung ke jurnal bulan
      terbuka berikutnya, dengan keterangan "termasuk susulan".
    - Baris terakhir di-cap supaya tidak menyusutkan melebihi (perolehan - residu).

    Return list JournalEntry yang baru diposting.
    """
    period_start = period_end_date.replace(day=1)
    settings_row = AccountingSettings.objects.first()
    mulai_akuntansi = settings_row.accounting_start_date if settings_row else None
    assets = (
        FixedAsset.objects.select_for_update()
        .filter(status=FixedAsset.Status.ACTIVE, useful_life_months__isnull=False,
                acquisition_date__lte=period_end_date)
        .exclude(useful_life_months=0)
        .select_related("depreciation_expense_account", "accumulated_depreciation_account")
        .order_by("asset_code")
    )

    posted = []
    for asset in assets:
        monthly_amount = calculate_monthly_depreciation_amount(asset)
        if not monthly_amount:
            continue
        bulan = _bulan_pertama_belum_disusutkan(asset)
        if bulan > period_start:
            continue
        remaining = asset.acquisition_cost - asset.residual_value - get_accumulated_depreciation(asset)

        tertunda, bulan_tertunda = Decimal("0"), 0
        while bulan <= period_start and remaining > 0:
            amount = min(monthly_amount, remaining)
            remaining -= amount
            tanggal = akhir_bulan(bulan)
            if _tidak_bisa_diposting(tanggal, mulai_akuntansi):
                tertunda += amount
                bulan_tertunda += 1
                bulan = bulan_berikut(bulan)
                continue
            keterangan = (
                f"Penyusutan aset {asset.asset_code} - {asset.name} periode "
                f"{BULAN[bulan.month - 1]} {bulan.year}"
            )
            if bulan_tertunda:
                keterangan += f" (termasuk susulan {bulan_tertunda} bulan)"
            entry = create_journal_entry(
                date=tanggal,
                lines=build_pair_lines(
                    debit_account=asset.depreciation_expense_account,
                    kredit_account=asset.accumulated_depreciation_account,
                    amount=amount + tertunda,
                    description=keterangan,
                ),
                description=keterangan,
                source_type=JournalEntry.SourceType.ASSET_DEPRECIATION,
                source_id=asset.id,
                created_by=actor,
            )
            posted.append(entry)
            tertunda, bulan_tertunda = Decimal("0"), 0
            asset.last_depreciation_date = tanggal
            asset.save(update_fields=["last_depreciation_date", "updated_at"])
            bulan = bulan_berikut(bulan)
        # Sisa `tertunda` (semua bulan s.d. period_end_date tertutup) sengaja tidak dicatat:
        # last_depreciation_date tidak maju, jadi run berikutnya menyusulkannya.

    return posted


def proyeksi_penyusutan(*, bulan=12, mulai=None):
    """Estimasi beban penyusutan per bulan ke depan (tanpa menjurnal apa pun).

    Mulai bulan berjalan (atau `mulai`) selama `bulan` bulan, untuk semua aset aktif yang
    disusutkan. Bulan lalu yang belum diposting dihitung terpisah sebagai `belum_diposting`
    (ikut tersusul saat penyusutan berikutnya dijalankan)."""
    awal = (mulai or timezone.localdate()).replace(day=1)
    daftar_bulan = [awal]
    for _ in range(max(1, bulan) - 1):
        daftar_bulan.append(bulan_berikut(daftar_bulan[-1]))
    indeks = {b: i for i, b in enumerate(daftar_bulan)}

    total = [Decimal("0")] * len(daftar_bulan)
    rincian, belum_diposting = [], Decimal("0")
    assets = (
        FixedAsset.objects.filter(status=FixedAsset.Status.ACTIVE, useful_life_months__isnull=False)
        .exclude(useful_life_months=0).order_by("asset_code")
    )
    for asset in assets:
        monthly_amount = calculate_monthly_depreciation_amount(asset)
        if not monthly_amount:
            continue
        akumulasi = get_accumulated_depreciation(asset)
        remaining = asset.acquisition_cost - asset.residual_value - akumulasi
        per_bulan = [Decimal("0")] * len(daftar_bulan)
        b = _bulan_pertama_belum_disusutkan(asset)
        while remaining > 0 and b <= daftar_bulan[-1]:
            amount = min(monthly_amount, remaining)
            remaining -= amount
            if b < awal:
                belum_diposting += amount
            elif b in indeks:
                per_bulan[indeks[b]] += amount
                total[indeks[b]] += amount
            b = bulan_berikut(b)
        jumlah = sum(per_bulan, Decimal("0"))
        if not jumlah:
            continue
        nilai_buku = asset.acquisition_cost - akumulasi
        rincian.append({
            "id": asset.id,
            "asset_code": asset.asset_code,
            "name": asset.name,
            "nilai_buku": nilai_buku,
            "per_bulan": per_bulan,
            "total": jumlah,
            "nilai_buku_akhir": nilai_buku - jumlah,
        })
    return {
        "bulan": [f"{b:%Y-%m}" for b in daftar_bulan],
        "label": [f"{BULAN[b.month - 1][:3]} {b.year}" for b in daftar_bulan],
        "total_per_bulan": total,
        "total": sum(total, Decimal("0")),
        "belum_diposting": belum_diposting,
        "aset": rincian,
    }
