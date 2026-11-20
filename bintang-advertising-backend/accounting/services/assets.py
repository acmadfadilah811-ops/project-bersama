from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import Account, AccountingSettings, FixedAsset, JournalEntry
from .journal import build_pair_lines, create_journal_entry
from .depreciation import get_accumulated_depreciation

MAX_IMPORT_ROWS = 500


def _validate_accounts(*, asset_account, depreciation_expense_account, accumulated_depreciation_account, counter_account, is_opening_balance):
    if not asset_account.is_active or asset_account.account_type != Account.AccountType.ASSET or asset_account.is_contra:
        raise ValidationError("Akun aset harus berupa akun Aset aktif dan bukan akun kontra.")
    if not depreciation_expense_account.is_active or depreciation_expense_account.account_type != Account.AccountType.EXPENSE:
        raise ValidationError("Akun beban penyusutan harus berupa akun Beban aktif.")
    if (
        not accumulated_depreciation_account.is_active
        or accumulated_depreciation_account.account_type != Account.AccountType.ASSET
        or not accumulated_depreciation_account.is_contra
    ):
        raise ValidationError("Akun akumulasi penyusutan harus berupa akun Aset kontra yang aktif.")
    if is_opening_balance:
        return
    if not counter_account or not counter_account.is_active:
        raise ValidationError("Akun kredit perolehan wajib dipilih dan harus aktif.")


def _opening_balance_account():
    settings_row = AccountingSettings.objects.select_related("opening_balance_equity_account").first()
    if not settings_row or not settings_row.opening_balance_equity_account_id:
        raise ValidationError("Akun penyeimbang Saldo Awal belum diatur pada Pengaturan Akuntansi.")
    return settings_row.opening_balance_equity_account


@transaction.atomic
def create_fixed_asset(*, data, created_by):
    """Buat register aset dan jurnal perolehannya dalam satu transaksi atomik.

    Aset saldo awal (dibeli sebelum Mulai Akuntansi, 2026-11-10): jurnal perolehannya
    bertanggal Mulai Akuntansi (jurnal sebelum tanggal itu ditolak), dan boleh membawa
    `opening_accumulated_depreciation` = akumulasi penyusutan s.d. akhir bulan sebelum
    Mulai Akuntansi. Jurnalnya: Dr Aset (perolehan), Cr Akumulasi (akumulasi awal),
    Cr Saldo Awal (nilai buku). Penyusutan otomatis mulai bulan Mulai Akuntansi."""
    data = dict(data)
    opening_accum = Decimal(data.pop("opening_accumulated_depreciation", None) or 0)
    asset_code = data["asset_code"].strip()
    if FixedAsset.objects.select_for_update().filter(asset_code=asset_code).exists():
        raise ValidationError(f"Kode aset '{asset_code}' sudah terdaftar.")

    cost = Decimal(data["acquisition_cost"])
    residual = Decimal(data.get("residual_value") or 0)
    if cost <= 0:
        raise ValidationError("Nilai perolehan harus lebih dari 0.")
    if residual < 0 or residual > cost:
        raise ValidationError("Nilai residu harus antara 0 dan nilai perolehan.")

    is_opening_balance = bool(data.get("is_opening_balance"))
    settings_row = AccountingSettings.objects.first()
    mulai_akuntansi = settings_row.accounting_start_date if settings_row else None
    acquisition_date = data["acquisition_date"]
    sebelum_mulai = bool(mulai_akuntansi and acquisition_date < mulai_akuntansi)
    if sebelum_mulai and not is_opening_balance:
        raise ValidationError(
            f"Aset dibeli sebelum Mulai Akuntansi ({mulai_akuntansi:%d-%m-%Y}). "
            "Centang 'Saldo Awal' supaya dicatat sebagai aset saldo awal."
        )
    if opening_accum < 0 or opening_accum > cost - residual:
        raise ValidationError("Akumulasi penyusutan awal harus antara 0 dan (nilai perolehan - nilai residu).")
    if opening_accum and not sebelum_mulai:
        raise ValidationError("Akumulasi penyusutan awal hanya untuk aset yang dibeli sebelum Mulai Akuntansi.")
    asset_account = data["asset_account"]
    depreciation_expense_account = data["depreciation_expense_account"]
    accumulated_depreciation_account = data["accumulated_depreciation_account"]
    counter_account = data.get("counter_account")
    _validate_accounts(
        asset_account=asset_account,
        depreciation_expense_account=depreciation_expense_account,
        accumulated_depreciation_account=accumulated_depreciation_account,
        counter_account=counter_account,
        is_opening_balance=is_opening_balance,
    )
    if is_opening_balance:
        counter_account = _opening_balance_account()

    asset_data = {
        **data,
        "asset_code": asset_code,
        "counter_account": counter_account,
        "created_by": created_by,
    }
    asset = FixedAsset.objects.create(**asset_data)
    keterangan = f"Perolehan aset {asset.asset_code} - {asset.name}"
    if sebelum_mulai:
        keterangan += f" (saldo awal, dibeli {asset.acquisition_date:%d-%m-%Y})"
    baris = {"description": keterangan, "external_document_no": asset.external_document_no}
    lines = [{"account": asset.asset_account, "debit": asset.acquisition_cost, "kredit": 0, **baris}]
    if opening_accum:
        lines.append({"account": asset.accumulated_depreciation_account, "debit": 0, "kredit": opening_accum, **baris})
    if asset.acquisition_cost - opening_accum > 0:
        lines.append({"account": counter_account, "debit": 0, "kredit": asset.acquisition_cost - opening_accum, **baris})
    entry = create_journal_entry(
        date=mulai_akuntansi if sebelum_mulai else asset.acquisition_date,
        lines=lines,
        description=keterangan,
        source_type=JournalEntry.SourceType.ASSET_ACQUISITION,
        source_id=asset.id,
        created_by=created_by,
        journal_template=asset.journal_template,
        department=asset.department,
    )
    asset.acquisition_journal = entry
    update_fields = ["acquisition_journal", "updated_at"]
    if sebelum_mulai:
        # Akumulasi awal dianggap s.d. akhir bulan sebelum Mulai Akuntansi; penyusutan
        # otomatis mulai bulan Mulai Akuntansi (bukan dari bulan pembelian bertahun lalu).
        asset.last_depreciation_date = mulai_akuntansi.replace(day=1) - timedelta(days=1)
        update_fields.append("last_depreciation_date")
    asset.save(update_fields=update_fields)
    return asset


@transaction.atomic
def create_fixed_assets_from_import(*, rows, shared_data, created_by):
    """Commit seluruh CSV atau rollback semuanya bila satu baris tidak valid."""
    if not rows:
        raise ValidationError("Tidak ada baris aset untuk diimport.")
    if len(rows) > MAX_IMPORT_ROWS:
        raise ValidationError(f"Maksimal {MAX_IMPORT_ROWS} baris per import.")

    assets = []
    for row in rows:
        payload = {
            **shared_data,
            "asset_code": row["asset_code"],
            "name": row["name"],
            "acquisition_date": date.fromisoformat(row["acquisition_date"]),
            "acquisition_cost": Decimal(str(row["acquisition_cost"])),
            "residual_value": row.get("residual_value") or Decimal(0),
            "external_document_no": row.get("external_document_no", ""),
            "description": row.get("description", ""),
        }
        assets.append(create_fixed_asset(data=payload, created_by=created_by))
    return assets


@transaction.atomic
def dispose_fixed_asset(*, asset, disposal_date, proceeds, proceeds_account, gain_loss_account, actor):
    """Lepas/jual aset: hapus dari buku (kredit asset_account sebesar
    acquisition_cost), hapus akumulasi penyusutan (debit
    accumulated_depreciation_account), catat hasil pelepasan yang diterima
    (debit proceeds_account -- 0 kalau dibuang/rusak, tidak apa-apa), dan
    akui untung/rugi pelepasan (selisih proceeds - nilai buku) ke
    gain_loss_account (baris ini dilewati kalau selisihnya persis 0)."""
    if asset.status == FixedAsset.Status.DISPOSED:
        raise ValidationError("Aset ini sudah dilepas sebelumnya.")
    if disposal_date < asset.acquisition_date:
        raise ValidationError("Tanggal pelepasan tidak boleh sebelum tanggal perolehan.")
    proceeds = Decimal(proceeds)
    if proceeds < 0:
        raise ValidationError("Nilai hasil pelepasan tidak boleh negatif.")
    if not proceeds_account.is_active:
        raise ValidationError("Akun penerima hasil pelepasan harus aktif.")
    if not gain_loss_account.is_active:
        raise ValidationError("Akun untung/rugi pelepasan harus aktif.")

    accumulated = get_accumulated_depreciation(asset)
    book_value = asset.acquisition_cost - accumulated
    gain_or_loss = proceeds - book_value

    lines = [
        {
            "account": asset.accumulated_depreciation_account, "debit": accumulated, "kredit": Decimal(0),
            "description": f"Hapus akumulasi penyusutan {asset.asset_code}",
        },
        {
            "account": proceeds_account, "debit": proceeds, "kredit": Decimal(0),
            "description": f"Hasil pelepasan aset {asset.asset_code}",
        },
        {
            "account": asset.asset_account, "debit": Decimal(0), "kredit": asset.acquisition_cost,
            "description": f"Hapus aset {asset.asset_code} dari buku",
        },
    ]
    if gain_or_loss > 0:
        lines.append({
            "account": gain_loss_account, "debit": Decimal(0), "kredit": gain_or_loss,
            "description": f"Untung pelepasan aset {asset.asset_code}",
        })
    elif gain_or_loss < 0:
        lines.append({
            "account": gain_loss_account, "debit": -gain_or_loss, "kredit": Decimal(0),
            "description": f"Rugi pelepasan aset {asset.asset_code}",
        })
    lines = [line for line in lines if line["debit"] > 0 or line["kredit"] > 0]

    entry = create_journal_entry(
        date=disposal_date,
        lines=lines,
        description=f"Pelepasan aset {asset.asset_code} - {asset.name}",
        source_type=JournalEntry.SourceType.ASSET_DISPOSAL,
        source_id=asset.id,
        created_by=actor,
    )
    asset.status = FixedAsset.Status.DISPOSED
    asset.disposal_date = disposal_date
    asset.disposal_proceeds = proceeds
    asset.disposal_journal = entry
    asset.save(update_fields=["status", "disposal_date", "disposal_proceeds", "disposal_journal", "updated_at"])
    return asset
