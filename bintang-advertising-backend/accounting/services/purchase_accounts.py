"""Validasi dan resolusi akun yang dipakai seluruh alur Pembelian."""

from django.core.exceptions import ValidationError

from ..models import Account, AccountingSettings


def get_purchase_account_mappings():
    """Kembalikan mapping Pembelian aktif; gagal tertutup bila setup belum lengkap."""
    settings_row = AccountingSettings.objects.first()
    if not settings_row:
        raise ValidationError("Pengaturan Akuntansi belum diinisialisasi.")

    mappings = {
        "inventory": settings_row.purchase_inventory_account,
        "payable": settings_row.purchase_payable_account,
        "advance": settings_row.purchase_advance_account,
    }
    missing = [label for label, account in mappings.items() if not account]
    if missing:
        raise ValidationError(
            "Mapping akun Pembelian belum lengkap: " + ", ".join(missing) + "."
        )

    expected_types = {
        "inventory": Account.AccountType.ASSET,
        "payable": Account.AccountType.LIABILITY,
        "advance": Account.AccountType.ASSET,
    }
    for label, account in mappings.items():
        if not account.is_active:
            raise ValidationError(f"Akun {label} Pembelian tidak aktif.")
        if account.account_type != expected_types[label]:
            raise ValidationError(f"Tipe akun {label} Pembelian tidak sesuai.")
    return mappings
