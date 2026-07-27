from django.core.exceptions import ValidationError

from ..models import BankStatementLine, JournalEntry, JournalEntryLine


def get_unreconciled_bank_lines(account, date_from, date_to):
    return (
        BankStatementLine.objects
        .filter(
            account=account, status=BankStatementLine.Status.PENDING,
            date__gte=date_from, date__lte=date_to,
        )
        .order_by("date", "created_at")
    )


def get_unmatched_journal_lines(account, date_from, date_to):
    """JournalEntryLine untuk akun ini, dalam rentang, yang belum terpasang ke BankStatementLine manapun."""
    matched_line_ids = BankStatementLine.objects.exclude(
        matched_journal_entry_line__isnull=True,
    ).values_list("matched_journal_entry_line_id", flat=True)

    return (
        JournalEntryLine.objects
        .filter(
            account=account,
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__date__gte=date_from,
            journal_entry__date__lte=date_to,
        )
        .exclude(id__in=matched_line_ids)
        .select_related("journal_entry")
        .order_by("journal_entry__date", "journal_entry__created_at")
    )


def confirm_match(*, bank_statement_line, journal_entry_line, actor=None):
    """Konfirmasi 1 baris Bank Statement cocok dengan 1 baris Journal Entry — tandai Reconciled."""
    if bank_statement_line.account_id != journal_entry_line.account_id:
        raise ValidationError("Baris Bank Statement dan Journal Entry harus di akun yang sama.")
    if bank_statement_line.status == BankStatementLine.Status.RECONCILED:
        raise ValidationError("Baris Bank Statement ini sudah direkonsiliasi sebelumnya.")

    bank_statement_line.matched_journal_entry_line = journal_entry_line
    bank_statement_line.status = BankStatementLine.Status.RECONCILED
    bank_statement_line.save(update_fields=["matched_journal_entry_line", "status"])
    return bank_statement_line
