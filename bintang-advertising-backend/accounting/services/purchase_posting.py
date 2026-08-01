"""Posting dan pembalikan jurnal untuk satu pembayaran pembelian."""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from ..models import Account, JournalAuditLog, JournalEntry
from .journal import create_journal_entry


def _source_type():
    return JournalEntry.SourceType.PURCHASE_PAYMENT


def post_purchase_payment_journal(payment, cash_account, actor=None):
    """Post pembayaran PO secara idempotent, satu jurnal per PurchasePayment."""
    if not cash_account or not cash_account.is_active:
        raise ValidationError('Akun Kas/Bank pembayaran wajib aktif.')
    if cash_account.account_type != Account.AccountType.ASSET:
        raise ValidationError('Akun pembayaran harus bertipe Aset (Kas/Bank).')

    existing = JournalEntry.objects.filter(
        source_type=_source_type(), source_id=payment.id,
    ).exclude(status=JournalEntry.Status.VOID).first()
    if existing:
        return existing

    hutang = Account.objects.filter(code='21000', is_active=True).first()
    if not hutang:
        raise ValidationError('COA 21000 (Hutang Dagang) wajib tersedia dan aktif.')

    amount = payment.nominal
    description = f'Pembayaran Pembelian PO #{payment.purchase.nomor}'
    lines = [
        {
            'account': hutang, 'debit': amount, 'kredit': 0,
            'description': description, 'external_document_no': payment.purchase.nomor,
        },
        {
            'account': cash_account, 'debit': 0, 'kredit': amount,
            'description': description, 'external_document_no': payment.purchase.nomor,
        },
    ]

    # Unique source id menjamin retry tidak menghasilkan jurnal ganda.
    for attempt in range(3):
        try:
            with transaction.atomic():
                return create_journal_entry(
                    date=payment.tanggal,
                    lines=lines,
                    description=description,
                    source_type=_source_type(),
                    source_id=payment.id,
                    created_by=actor,
                    status=JournalEntry.Status.POSTED,
                )
        except IntegrityError:
            existing = JournalEntry.objects.filter(
                source_type=_source_type(), source_id=payment.id,
            ).exclude(status=JournalEntry.Status.VOID).first()
            if existing:
                return existing
            if attempt == 2:
                raise
    return None


def reverse_purchase_payment_journal(payment, actor=None):
    """Buat jurnal pembalik; jurnal asli tidak dihapus agar audit tetap utuh."""
    original = JournalEntry.objects.filter(
        source_type=_source_type(), source_id=payment.id,
        status=JournalEntry.Status.POSTED,
    ).prefetch_related('lines').first()
    if not original:
        return None

    existing = JournalEntry.objects.filter(
        reversed_entry=original, status=JournalEntry.Status.POSTED,
    ).first()
    if existing:
        return existing

    lines = [
        {
            'account': line.account,
            'debit': line.kredit,
            'kredit': line.debit,
            'description': f'Pembalikan {original.entry_number}: {line.description}',
            'external_document_no': line.external_document_no,
        }
        for line in original.lines.all()
    ]
    reversal = create_journal_entry(
        date=timezone.localdate(),
        lines=lines,
        description=f'Pembalikan pembayaran PO #{payment.purchase.nomor} ({original.entry_number})',
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
        note=f'Pembalikan jurnal pembayaran PurchasePayment#{payment.id}',
    )
    return reversal
