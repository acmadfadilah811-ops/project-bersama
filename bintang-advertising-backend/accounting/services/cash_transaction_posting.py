"""Posting dan pembalikan jurnal untuk satu CashTransaction (Pendapatan/Pengeluaran).

Akun debit/kredit dipilih manual per transaksi (bukan akun default seperti
stok) — user yang menentukan pasangan akunnya lewat dropdown di layar.
"""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from ..models import JournalAuditLog, JournalEntry
from .journal import create_journal_entry


def _source_type():
    return JournalEntry.SourceType.CASH_TRANSACTION


def post_cash_transaction_journal(cash_transaction, actor=None):
    """Post satu CashTransaction ke jurnal, idempotent (satu jurnal per transaksi)."""
    if not cash_transaction.akun_debit_id or not cash_transaction.akun_kredit_id:
        raise ValidationError('Akun Debit dan Akun Kredit wajib dipilih sebelum posting.')
    if not cash_transaction.akun_debit.is_active or not cash_transaction.akun_kredit.is_active:
        raise ValidationError('Akun Debit/Kredit yang dipilih sudah tidak aktif.')

    existing = JournalEntry.objects.filter(
        source_type=_source_type(), source_id=cash_transaction.id,
    ).exclude(status=JournalEntry.Status.VOID).first()
    if existing:
        return existing

    amount = cash_transaction.jumlah
    description = f'{cash_transaction.get_arah_display()} {cash_transaction.nomor}'
    lines = [
        {
            'account': cash_transaction.akun_debit, 'debit': amount, 'kredit': 0,
            'description': description, 'external_document_no': cash_transaction.nomor,
        },
        {
            'account': cash_transaction.akun_kredit, 'debit': 0, 'kredit': amount,
            'description': description, 'external_document_no': cash_transaction.nomor,
        },
    ]

    for attempt in range(3):
        try:
            with transaction.atomic():
                return create_journal_entry(
                    date=cash_transaction.waktu.date(),
                    lines=lines,
                    description=description,
                    source_type=_source_type(),
                    source_id=cash_transaction.id,
                    created_by=actor,
                    status=JournalEntry.Status.POSTED,
                )
        except IntegrityError:
            existing = JournalEntry.objects.filter(
                source_type=_source_type(), source_id=cash_transaction.id,
            ).exclude(status=JournalEntry.Status.VOID).first()
            if existing:
                return existing
            if attempt == 2:
                raise
    return None


def reverse_cash_transaction_journal(cash_transaction, actor=None):
    """Buat jurnal pembalik; jurnal asli tidak dihapus (audit tetap utuh)."""
    original = JournalEntry.objects.filter(
        source_type=_source_type(), source_id=cash_transaction.id,
        status=JournalEntry.Status.POSTED,
    ).prefetch_related('lines').first()
    if not original:
        return None

    existing = JournalEntry.objects.filter(
        reversed_entry=original, status=JournalEntry.Status.POSTED,
    ).first()
    if existing:
        return existing

    description = f'Pembalikan {original.entry_number}: {original.description}'
    lines = [
        {
            'account': line.account, 'debit': line.kredit, 'kredit': line.debit,
            'description': description, 'external_document_no': line.external_document_no,
        }
        for line in original.lines.all()
    ]

    with transaction.atomic():
        reversal = create_journal_entry(
            date=timezone.localdate(),
            lines=lines,
            description=description,
            source_type=_source_type(),
            source_id=None,
            created_by=actor,
            status=JournalEntry.Status.POSTED,
        )
        reversal.reversed_entry = original
        reversal.save(update_fields=['reversed_entry'])
        JournalAuditLog.objects.create(
            journal_entry=reversal,
            action=JournalAuditLog.Action.REVERSED,
            actor=actor,
            note=f'Pembalikan jurnal CashTransaction#{cash_transaction.id}',
        )
    return reversal
