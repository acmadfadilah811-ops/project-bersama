"""Validasi & resolusi akun Posting Gaji -- fail-closed seperti purchase_accounts.py."""

from django.core.exceptions import ValidationError

from ..models import Account, AccountingSettings


def _cek(account, label, tipe):
    if account is None:
        return f"{label} belum diisi"
    if not account.is_active:
        return f"akun {label} tidak aktif"
    if account.account_type != tipe:
        return f"tipe akun {label} tidak sesuai"
    return None


def get_payroll_account_mappings():
    """Kembalikan akun inti Posting Gaji; gagal bila pengaturan belum lengkap.

    `employer_expense` boleh kosong di sini (hanya dibutuhkan bila ada iuran
    perusahaan) -- pemeriksaannya dilakukan saat menyusun jurnal."""
    row = AccountingSettings.objects.first()
    if not row:
        raise ValidationError("Pengaturan Akuntansi belum diinisialisasi.")

    masalah = [
        m for m in (
            _cek(row.payroll_expense_account, "Biaya gaji", Account.AccountType.EXPENSE),
            _cek(row.payroll_payable_account, "Hutang gaji", Account.AccountType.LIABILITY),
        ) if m
    ]
    if row.payroll_employer_contribution_expense_account_id:
        m = _cek(row.payroll_employer_contribution_expense_account, "Beban iuran perusahaan",
                 Account.AccountType.EXPENSE)
        if m:
            masalah.append(m)
    if masalah:
        raise ValidationError("Pengaturan akun Penggajian belum lengkap: " + "; ".join(masalah) + ".")

    return {
        "expense": row.payroll_expense_account,
        "payable": row.payroll_payable_account,
        "employer_expense": row.payroll_employer_contribution_expense_account,
    }
