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
accumulated_depreciation_account, source_type=ASSET_DEPRECIATION,
source_id=asset.id, journal_entry.status=POSTED.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum

from ..models import FixedAsset, JournalEntry, JournalEntryLine
from .journal import build_pair_lines, create_journal_entry

RUPIAH = Decimal("1")


def get_accumulated_depreciation(asset):
    """Total penyusutan yang sudah diposting utk 1 aset, dihitung dari jurnal
    (bukan field tersimpan) -- lihat docstring modul."""
    total = JournalEntryLine.objects.filter(
        journal_entry__status=JournalEntry.Status.POSTED,
        journal_entry__source_type=JournalEntry.SourceType.ASSET_DEPRECIATION,
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


@transaction.atomic
def post_monthly_depreciation(*, period_end_date, actor=None):
    """Posting jurnal penyusutan garis lurus utk SEMUA aset aktif yang
    punya useful_life_months, utk bulan yang mengandung `period_end_date`.

    Idempoten per aset per bulan lewat FixedAsset.last_depreciation_date
    (aset yang last_depreciation_date-nya sudah >= awal bulan ini di-skip).
    Baris terakhir aset (saat akumulasi mendekati nilai residu) otomatis
    di-cap supaya tidak menyusutkan melebihi (perolehan - residu).

    Return list JournalEntry yang baru diposting (aset yang di-skip --
    sudah lunas, sudah diposting bulan ini, atau tidak disusutkan -- tidak
    ikut dalam list).
    """
    period_start = period_end_date.replace(day=1)
    assets = (
        FixedAsset.objects.select_for_update()
        .filter(status=FixedAsset.Status.ACTIVE, useful_life_months__isnull=False)
        .exclude(useful_life_months=0)
        .select_related("depreciation_expense_account", "accumulated_depreciation_account")
        .order_by("asset_code")
    )

    posted = []
    for asset in assets:
        if asset.last_depreciation_date and asset.last_depreciation_date >= period_start:
            continue

        monthly_amount = calculate_monthly_depreciation_amount(asset)
        if not monthly_amount:
            continue

        depreciable_base = asset.acquisition_cost - asset.residual_value
        already = get_accumulated_depreciation(asset)
        remaining = depreciable_base - already
        if remaining <= 0:
            continue
        amount = min(monthly_amount, remaining)

        entry = create_journal_entry(
            date=period_end_date,
            lines=build_pair_lines(
                debit_account=asset.depreciation_expense_account,
                kredit_account=asset.accumulated_depreciation_account,
                amount=amount,
                description=f"Penyusutan aset {asset.asset_code} - {asset.name} periode {period_start:%B %Y}",
            ),
            description=f"Penyusutan aset {asset.asset_code} - {asset.name} periode {period_start:%B %Y}",
            source_type=JournalEntry.SourceType.ASSET_DEPRECIATION,
            source_id=asset.id,
            created_by=actor,
        )
        asset.last_depreciation_date = period_end_date
        asset.save(update_fields=["last_depreciation_date", "updated_at"])
        posted.append(entry)

    return posted
