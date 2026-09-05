"""Posting akuntansi yang terkait dengan dokumen stok Pembelian."""

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

from accounting.models import JournalEntry
from accounting.services.journal import create_journal_entry
from accounting.services.purchase_accounts import get_purchase_account_mappings


def post_stock_journal(document, actor, *, direction="in"):
    """Post stok Pembelian dan aplikasi DP secara idempoten per dokumen stok."""
    amount = sum(
        (Decimal(str(item.qty or 0)) * Decimal(str(item.harga_beli or 0))
         for item in document.items.all()),
        Decimal("0"),
    ).quantize(Decimal("1"))
    if amount <= 0:
        return None

    source_type = JournalEntry.SourceType.STOCK_IN if direction == "in" else JournalEntry.SourceType.STOCK_OUT
    existing = JournalEntry.objects.filter(source_type=source_type, source_id=document.id).exclude(
        status=JournalEntry.Status.VOID,
    ).first()
    if existing:
        return existing

    try:
        accounts = get_purchase_account_mappings()
    except DjangoValidationError as exc:
        raise ValidationError(getattr(exc, "messages", [str(exc)])) from exc
    inventory, payable, advance = accounts["inventory"], accounts["payable"], accounts["advance"]
    label = "Stok masuk" if direction == "in" else "Retur stok"
    lines = [
        {
            "account": inventory if direction == "in" else payable,
            "debit": amount,
            "kredit": 0,
            "description": f"{label} {document.nomor}",
            "external_document_no": document.nomor,
        },
        {
            "account": payable if direction == "in" else inventory,
            "debit": 0,
            "kredit": amount,
            "description": f"{label} {document.nomor}",
            "external_document_no": document.nomor,
        },
    ]

    purchase = getattr(document, "purchase", None)
    if direction == "in" and purchase:
        from api.product_models import PurchasePayment

        advance_amount = sum(
            (payment.nominal for payment in PurchasePayment.objects.filter(
                purchase=purchase,
                jenis=PurchasePayment.Jenis.ADVANCE,
            )),
            Decimal("0"),
        ).quantize(Decimal("1"))
        if advance_amount > 0:
            lines.extend([
                {
                    "account": payable,
                    "debit": advance_amount,
                    "kredit": 0,
                    "description": f"Aplikasi DP Pembelian {purchase.nomor}",
                    "external_document_no": purchase.nomor,
                },
                {
                    "account": advance,
                    "debit": 0,
                    "kredit": advance_amount,
                    "description": f"Aplikasi DP Pembelian {purchase.nomor}",
                    "external_document_no": purchase.nomor,
                },
            ])

    try:
        return create_journal_entry(
            date=document.tanggal,
            lines=lines,
            description=f"{label} {document.nomor}",
            source_type=source_type,
            source_id=document.id,
            created_by=actor,
        )
    except DjangoValidationError as exc:
        raise ValidationError(getattr(exc, "messages", [str(exc)])) from exc
