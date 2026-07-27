from decimal import Decimal

from django.core.exceptions import ValidationError

from ..models import AccountingSettings, JournalEntry
from .journal import create_journal_entry


def submit_opening_balances(*, entries, actor):
    """
    "Masukan Saldo Awal" — popup yang muncul otomatis setelah wizard Pengaturan
    Awal selesai (skippable). Baris nonzero jadi 1 JournalEntry: tiap akun taruh
    di sisi normal_balance-nya sendiri, lalu SATU baris penyeimbang otomatis ke
    AccountingSettings.opening_balance_equity_account sebesar SELISIH
    (total_debit - total_kredit) dari baris yang diisi user — bukan jumlah semua
    baris, karena satu submit bisa mencampur akun Aset & Kewajiban sekaligus
    (mis. isi Kas 1.000.000 + Hutang dagang 400.000 -> penyeimbang kredit
    600.000, bukan 1.400.000).

    entries: OpeningBalanceSubmitSerializer.validated_data["entries"] — list of
    {"account": <Account instance>, "amount": <Decimal>}.
    """
    settings_row = AccountingSettings.objects.first()
    if not settings_row:
        raise ValidationError("Pengaturan akuntansi belum ada — selesaikan Pengaturan Awal dahulu.")
    if not settings_row.opening_balance_equity_account_id:
        raise ValidationError("Akun penyeimbang Saldo Awal belum diatur (opening_balance_equity_account).")

    nonzero = [entry for entry in entries if entry["amount"]]
    if not nonzero:
        return None

    lines = []
    total_debit = Decimal(0)
    total_kredit = Decimal(0)
    for entry in nonzero:
        account, amount = entry["account"], Decimal(entry["amount"])
        if account.normal_balance == "debit":
            lines.append({"account": account, "debit": amount, "kredit": 0})
            total_debit += amount
        else:
            lines.append({"account": account, "debit": 0, "kredit": amount})
            total_kredit += amount

    diff = total_debit - total_kredit
    equity_account = settings_row.opening_balance_equity_account
    if diff > 0:
        lines.append({"account": equity_account, "debit": 0, "kredit": diff})
    elif diff < 0:
        lines.append({"account": equity_account, "debit": -diff, "kredit": 0})
    # diff == 0: baris yang diisi user sudah balance sendiri (butuh >=2 entries
    # nonzero di sisi berlawanan) — tidak perlu baris penyeimbang tambahan.

    return create_journal_entry(
        date=settings_row.accounting_start_date,
        lines=lines,
        description="Saldo Awal",
        source_type=JournalEntry.SourceType.OPENING_BALANCE,
        created_by=actor,
    )
