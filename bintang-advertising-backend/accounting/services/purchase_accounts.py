"""Validasi dan resolusi akun yang dipakai seluruh alur Pembelian."""

from django.core.exceptions import ValidationError

from ..models import Account, AccountingSettings


def get_purchase_account_mappings(supplier=None):
    """Kembalikan mapping Pembelian aktif; gagal tertutup bila setup belum lengkap.

    `supplier` opsional: kalau diisi dan Supplier.akun_hutang-nya sudah diset
    (Pengaturan Supplier), akun hutang KHUSUS supplier itu dipakai untuk
    mapping 'payable', menggantikan akun hutang global. Sebelumnya field ini
    bisa diisi & tampil di layar tapi tidak pernah benar-benar dipakai saat
    posting jurnal — semua supplier selalu jatuh ke satu akun hutang global
    (ditemukan lewat audit produksi 2026-09-05). Kalau supplier tidak diisi
    atau akun_hutang-nya kosong, perilaku tetap sama seperti sebelumnya."""
    settings_row = AccountingSettings.objects.first()
    if not settings_row:
        raise ValidationError("Pengaturan Akuntansi belum diinisialisasi.")

    payable_account = settings_row.purchase_payable_account
    payable_label = "payable"
    if supplier is not None and supplier.akun_hutang_id:
        payable_account = supplier.akun_hutang
        payable_label = f"Akun Hutang supplier '{supplier.nama}'"

    mappings = {
        "inventory": settings_row.purchase_inventory_account,
        "payable": payable_account,
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
    error_labels = {"inventory": "inventory", "payable": payable_label, "advance": "advance"}
    for key, account in mappings.items():
        if not account.is_active:
            raise ValidationError(f"Akun {error_labels[key]} Pembelian tidak aktif.")
        if account.account_type != expected_types[key]:
            raise ValidationError(f"Tipe akun {error_labels[key]} Pembelian tidak sesuai.")
    return mappings
