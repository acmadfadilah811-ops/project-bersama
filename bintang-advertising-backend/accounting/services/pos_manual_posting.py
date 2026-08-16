from django.core.exceptions import ValidationError
from django.db import transaction

from api.pos_models import POSSale

from ..models import JournalAuditLog, JournalEntry
from .pos_posting import post_pos_sale_journal, post_pos_void_journal


def post_pos_sales_manually(*, sale_ids, actor):
    return [_post_one(sale_id=sale_id, actor=actor) for sale_id in sale_ids]


def cancel_pos_sales_posting(*, sale_ids, actor):
    return [_cancel_one(sale_id=sale_id, actor=actor) for sale_id in sale_ids]


@transaction.atomic
def _post_one(*, sale_id, actor):
    # `of=('self',)` — `accounting_payment_method` adalah FK nullable, Postgres
    # menolak FOR UPDATE di sisi nullable outer join kalau ikut di-lock.
    sale = POSSale.objects.select_for_update(of=('self',)).select_related("accounting_payment_method").get(pk=sale_id)
    original = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id, reversed_entry__isnull=True,
    ).first()
    if original and JournalEntry.objects.filter(reversed_entry=original).exists():
        raise ValidationError(f"POS {sale.nomor} sudah dibatalkan postingnya dan tidak dapat diposting ulang otomatis.")

    entry = post_pos_sale_journal(sale, actor=actor, manual=True)
    if not entry:
        raise ValidationError(f"POS {sale.nomor} belum dapat diposting. Lengkapi pengaturan atau mapping pembayaran.")
    if not original:
        JournalAuditLog.objects.filter(journal_entry=entry, action=JournalAuditLog.Action.POSTED).update(
            note=f"Aksi manual post POS dari #{sale.nomor}",
        )
    return {"sale_id": sale.id, "reference": sale.nomor, "journal_entry": entry.entry_number, "result": "posted"}


@transaction.atomic
def _cancel_one(*, sale_id, actor):
    sale = POSSale.objects.select_for_update().get(pk=sale_id)
    if sale.status != "paid":
        raise ValidationError(f"POS {sale.nomor} bukan transaksi lunas.")
    reversal = post_pos_void_journal(sale, actor=actor, reason="Batal post manual POS")
    if not reversal:
        raise ValidationError(f"POS {sale.nomor} belum memiliki jurnal posted untuk dibatalkan.")
    return {"sale_id": sale.id, "reference": sale.nomor, "journal_entry": reversal.entry_number, "result": "reversed"}
