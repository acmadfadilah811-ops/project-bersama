from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import Account, AccountingSettings, FixedAsset, JournalEntry
from .journal import build_pair_lines, create_journal_entry

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
    """Buat register aset dan jurnal perolehannya dalam satu transaksi atomik."""
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
    entry = create_journal_entry(
        date=asset.acquisition_date,
        lines=build_pair_lines(
            debit_account=asset.asset_account,
            kredit_account=counter_account,
            amount=asset.acquisition_cost,
            description=f"Perolehan aset {asset.asset_code} - {asset.name}",
            external_document_no=asset.external_document_no,
        ),
        description=f"Perolehan aset {asset.asset_code} - {asset.name}",
        source_type=JournalEntry.SourceType.ASSET_ACQUISITION,
        source_id=asset.id,
        created_by=created_by,
        journal_template=asset.journal_template,
        department=asset.department,
    )
    asset.acquisition_journal = entry
    asset.save(update_fields=["acquisition_journal", "updated_at"])
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
