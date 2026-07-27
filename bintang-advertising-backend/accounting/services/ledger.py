from datetime import timedelta

from django.db.models import Sum

from ..models import JournalEntry, JournalEntryLine


def _sum_debit_kredit(accounts, date_from=None, date_to=None):
    """Agregat debit & kredit mentah per akun (belum diarahkan ke normal_balance), rentang tanggal opsional."""
    qs = JournalEntryLine.objects.filter(account__in=accounts, journal_entry__status=JournalEntry.Status.POSTED)
    if date_from:
        qs = qs.filter(journal_entry__date__gte=date_from)
    if date_to:
        qs = qs.filter(journal_entry__date__lte=date_to)
    totals = qs.values("account_id").annotate(total_debit=Sum("debit"), total_kredit=Sum("kredit"))
    return {row["account_id"]: row for row in totals}


def get_account_balances(accounts, as_of_date):
    """
    Saldo kumulatif tiap akun sampai as_of_date (inklusif), dari JournalEntryLine
    yang statusnya sudah Posted. Return dict {account_id: Decimal}.
    """
    totals_map = _sum_debit_kredit(accounts, date_to=as_of_date)
    balances = {}
    for account in accounts:
        row = totals_map.get(account.id)
        total_debit = row["total_debit"] if row else 0
        total_kredit = row["total_kredit"] if row else 0
        if account.normal_balance == "debit":
            balances[account.id] = (total_debit or 0) - (total_kredit or 0)
        else:
            balances[account.id] = (total_kredit or 0) - (total_debit or 0)
    return balances


def get_account_movements(accounts, date_from, date_to):
    """
    Buku Besar (ringkasan): per akun, saldo_awal (kumulatif sebelum date_from),
    debit & kredit pergerakan dalam rentang date_from..date_to, dan saldo_akhir.
    Return dict {account_id: {"saldo_awal", "debit", "kredit", "saldo_akhir"}}.
    """
    opening_balances = get_account_balances(accounts, date_from - timedelta(days=1))
    period_totals = _sum_debit_kredit(accounts, date_from=date_from, date_to=date_to)

    movements = {}
    for account in accounts:
        row = period_totals.get(account.id)
        debit = row["total_debit"] if row else 0
        kredit = row["total_kredit"] if row else 0
        saldo_awal = opening_balances.get(account.id, 0)
        delta = (debit or 0) - (kredit or 0) if account.normal_balance == "debit" else (kredit or 0) - (debit or 0)
        movements[account.id] = {
            "saldo_awal": saldo_awal,
            "debit": debit or 0,
            "kredit": kredit or 0,
            "saldo_akhir": saldo_awal + delta,
        }
    return movements


def get_account_line_history(account, date_from, date_to, search=None):
    """
    Rincian Mutasi Akun: riwayat baris jurnal 1 akun dalam rentang tanggal,
    urut kronologis, dengan saldo berjalan (running balance) per baris.
    """
    saldo_awal = get_account_balances([account], date_from - timedelta(days=1)).get(account.id, 0)

    lines = (
        JournalEntryLine.objects
        .filter(
            account=account,
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__date__gte=date_from,
            journal_entry__date__lte=date_to,
        )
        .select_related("journal_entry", "supplier", "customer")
        .order_by("journal_entry__date", "journal_entry__created_at", "id")
    )
    if search:
        lines = lines.filter(journal_entry__entry_number__icontains=search)

    running = saldo_awal
    rows = []
    for line in lines:
        delta = (
            (line.debit - line.kredit)
            if account.normal_balance == "debit"
            else (line.kredit - line.debit)
        )
        running += delta
        rows.append({
            "date": line.journal_entry.date,
            "entry_number": line.journal_entry.entry_number,
            "pelanggan_supplier": (
                (line.customer.nama if line.customer else None)
                or (line.supplier.nama if line.supplier else None)
                or ""
            ),
            "description": line.description or line.journal_entry.description,
            "external_document_no": line.external_document_no,
            "debit": line.debit,
            "kredit": line.kredit,
            "running_balance": running,
        })
    return {"saldo_awal": saldo_awal, "rows": rows}
