"""
Konfirmasi Settlement — konsolidasi transaksi non-tunai dari POSSale + Order,
grouped by (tanggal, metode bayar), dengan aksi confirm yang membuat JournalEntry
lewat satu pintu create_journal_entry().

Jurnal saat confirm:
  KREDIT  PaymentMethod.account  (piutang pihak ketiga — dana menggantung)
  DEBIT   Bank Account tujuan     (kas/bank — dana cair riil, user pilih saat confirm)
  DEBIT   PaymentMethod.mdr_debit_account  (biaya MDR, kalau mdr_percent > 0)

Pendekatan: PaymentMethod.account = akun piutang transit (misal: Piutang GoPay).
Saat confirm, dana cair ke rekening bank perusahaan — akun tujuan diambil dari
bank_account_id yang dikirim user. PaymentMethod.account jadi KREDIT (hapus piutang).
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction, IntegrityError
from django.db.models import Sum, Count, Q, F

from api.models import Order, OrderActivityLog
from api.pos_models import POSSale
from ..models import Account, JournalEntry, JournalEntryLine, PaymentMethod
from .journal import create_journal_entry


def _non_cash_filter():
    """Filter untuk transaksi POS non-tunai yang belum settled."""
    return (
        Q(settlement_status="unsettled")
        & ~Q(accounting_payment_method__isnull=True)
        & Q(accounting_payment_method__is_cash=False)
    )


def get_settlement_batches(date_from: date, date_to: date):
    """
    Return list of settlement batches, grouped by (tanggal, payment_method).
    Gabungan POSSale + Order (via JournalEntryLine transit).

    Tiap batch: {
        "date": date,
        "payment_method_id": int,
        "payment_method_name": str,
        "payment_type": str,
        "total_amount": Decimal,
        "transaction_count": int,
        "pos_sale_count": int,
        "order_count": int,
    }
    """
    pos_batches = (
        POSSale.objects
        .filter(_non_cash_filter(), status="paid", created_at__date__gte=date_from, created_at__date__lte=date_to)
        .values(batch_date=F("created_at__date"), pm_id=F("accounting_payment_method_id"))
        .annotate(total=Sum("total"), count=Count("id"))
    )

    # Order-side settlement (T-212 / Opsi B): read JournalEntryLine of ORDER_PAYMENT
    pm_account_map = {
        pm.account_id: pm.id
        for pm in PaymentMethod.objects.filter(account__isnull=False, is_cash=False)
    }

    order_batches = []
    if pm_account_map:
        order_batches = (
            JournalEntryLine.objects
            .filter(
                journal_entry__source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                journal_entry__status=JournalEntry.Status.POSTED,
                journal_entry__date__gte=date_from,
                journal_entry__date__lte=date_to,
                settlement_status="unsettled",
                debit__gt=0,
                account_id__in=pm_account_map.keys(),
            )
            .values(batch_date=F("journal_entry__date"), acc_id=F("account_id"))
            .annotate(total=Sum("debit"), count=Count("id"))
        )

    # Merge by (date, payment_method_id)
    merged = {}

    for row in pos_batches:
        key = (row["batch_date"], row["pm_id"])
        if key not in merged:
            merged[key] = {"total": Decimal(0), "pos_count": 0, "order_count": 0}
        merged[key]["total"] += Decimal(str(row["total"] or 0))
        merged[key]["pos_count"] += row["count"]

    for row in order_batches:
        pm_id = pm_account_map.get(row["acc_id"])
        if not pm_id:
            continue
        key = (row["batch_date"], pm_id)
        if key not in merged:
            merged[key] = {"total": Decimal(0), "pos_count": 0, "order_count": 0}
        merged[key]["total"] += Decimal(str(row["total"] or 0))
        merged[key]["order_count"] += row["count"]

    # Resolve payment method names
    pm_ids = {k[1] for k in merged}
    pm_cache = {}
    if pm_ids:
        pm_cache = {
            pm.id: pm
            for pm in PaymentMethod.objects.filter(id__in=pm_ids).select_related("account")
        }

    result = []
    for (batch_date, pm_id), data in sorted(merged.items()):
        pm = pm_cache.get(pm_id)
        if not pm:
            continue
        result.append({
            "date": batch_date,
            "payment_method_id": pm_id,
            "payment_method_name": pm.name,
            "payment_type": pm.payment_type,
            "total_amount": data["total"],
            "transaction_count": data["pos_count"] + data["order_count"],
            "pos_sale_count": data["pos_count"],
            "order_count": data["order_count"],
        })

    return result


@transaction.atomic
def confirm_settlement_batches(*, batch_keys, bank_account_id, actor):
    """
    Confirm satu atau lebih batch settlement. Tiap batch = 1 JournalEntry.

    batch_keys: list of {"date": "YYYY-MM-DD", "payment_method_id": int}
    bank_account_id: int — akun kas/bank tujuan pencairan riil
    actor: User

    Returns: list of created JournalEntry
    """
    bank_account = Account.objects.select_related("classification").filter(id=bank_account_id).first()
    if not bank_account:
        raise ValidationError(f"Akun bank/kas tujuan ID {bank_account_id} tidak ditemukan.")
    # Sebagian akun legacy hanya mengisi klasifikasi (account_type kosong).
    bank_account_type = bank_account.account_type or (
        bank_account.classification.account_type if bank_account.classification else None
    )
    if bank_account_type != "asset":
        raise ValidationError("Akun tujuan settlement harus bertipe aset (kas/bank).")

    entries_created = []

    for batch in batch_keys:
        batch_date = batch["date"]
        if isinstance(batch_date, str):
            batch_date = date.fromisoformat(batch_date)
        pm_id = batch["payment_method_id"]

        pm = PaymentMethod.objects.select_related(
            "account", "mdr_debit_account", "mdr_kredit_account"
        ).filter(id=pm_id).first()
        if not pm:
            raise ValidationError(f"PaymentMethod ID {pm_id} tidak ditemukan.")
        if not pm.account_id:
            raise ValidationError(f"PaymentMethod '{pm.name}' belum memiliki akun transit.")

        # Idempotency check with row locking (T-212)
        existing = (
            JournalEntry.objects.select_for_update()
            .filter(
                source_type=JournalEntry.SourceType.SETTLEMENT,
                source_id=pm.id,
                date=batch_date,
                status=JournalEntry.Status.POSTED,
            )
            .first()
        )
        if existing:
            entries_created.append(existing)
            continue

        # Collect matching POS transactions with locking
        pos_ids = list(
            POSSale.objects.select_for_update()
            .filter(
                _non_cash_filter(),
                status="paid",
                created_at__date=batch_date,
                accounting_payment_method_id=pm_id,
            )
            .values_list("id", flat=True)
        )

        # Collect matching Order JournalEntryLines with locking
        order_line_ids = list(
            JournalEntryLine.objects.select_for_update()
            .filter(
                journal_entry__source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                journal_entry__status=JournalEntry.Status.POSTED,
                journal_entry__date=batch_date,
                account_id=pm.account_id,
                settlement_status="unsettled",
                debit__gt=0,
            )
            .values_list("id", flat=True)
        )

        pos_qs = POSSale.objects.filter(id__in=pos_ids)
        order_lines_qs = JournalEntryLine.objects.filter(id__in=order_line_ids)

        pos_total = pos_qs.aggregate(t=Sum("total"))["t"] or Decimal(0)
        order_total = order_lines_qs.aggregate(t=Sum("debit"))["t"] or Decimal(0)
        gross_amount = Decimal(str(pos_total)) + Decimal(str(order_total))

        if gross_amount <= 0:
            continue  # skip empty/already settled batches

        # Calculate MDR
        if pm.mdr_percent and pm.mdr_percent > 0 and not pm.mdr_debit_account_id:
            raise ValidationError(
                f"PaymentMethod '{pm.name}' memiliki MDR {pm.mdr_percent}% "
                "tetapi akun beban MDR belum dikonfigurasi."
            )

        mdr_amount = Decimal(0)
        if pm.mdr_percent and pm.mdr_percent > 0:
            mdr_amount = (
                gross_amount * pm.mdr_percent / Decimal(100)
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        net_amount = gross_amount - mdr_amount

        # Build journal lines
        lines = []

        # DEBIT: Kas/Bank tujuan (dana cair riil)
        lines.append({
            "account": bank_account,
            "debit": net_amount,
            "kredit": 0,
            "description": f"Settlement {pm.name} {batch_date}",
        })

        if mdr_amount > 0:
            # DEBIT: Biaya MDR
            lines.append({
                "account": pm.mdr_debit_account,
                "debit": mdr_amount,
                "kredit": 0,
                "description": f"MDR {pm.mdr_percent}% — {pm.name} {batch_date}",
            })

        # KREDIT: Piutang pihak ketiga (PaymentMethod.account — dana menggantung)
        lines.append({
            "account": pm.account,
            "debit": 0,
            "kredit": gross_amount,
            "description": f"Settlement {pm.name} {batch_date}",
        })

        try:
            entry = create_journal_entry(
                date=batch_date,
                lines=lines,
                description=f"Konfirmasi Settlement — {pm.name} — {batch_date}",
                source_type=JournalEntry.SourceType.SETTLEMENT,
                source_id=pm.id,
                created_by=actor,
            )
        except IntegrityError:
            entry = JournalEntry.objects.filter(
                source_type=JournalEntry.SourceType.SETTLEMENT,
                source_id=pm.id,
                date=batch_date,
            ).first()
            if entry:
                entries_created.append(entry)
                continue
            raise

        # Mark transactions as settled
        pos_qs.update(settlement_status="settled")
        order_lines_qs.update(settlement_status="settled")

        # Sinkronkan status dokumen Order dengan line jurnal. Jika satu Order
        # masih memiliki pembayaran lain yang belum settle, jangan menandainya
        # settled terlalu dini (partial settlement).
        order_log_ids = list(
            order_lines_qs.values_list("journal_entry__source_id", flat=True)
        )
        order_ids = list(
            OrderActivityLog.objects.filter(
                id__in=order_log_ids,
                tindakan="PAYMENT",
            ).values_list("order_id", flat=True)
        )
        for order_id in set(order_ids):
            payment_log_ids = OrderActivityLog.objects.filter(
                order_id=order_id,
                tindakan="PAYMENT",
            ).values_list("id", flat=True)
            has_unsettled = JournalEntryLine.objects.filter(
                journal_entry__source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                journal_entry__source_id__in=payment_log_ids,
                settlement_status="unsettled",
            ).exists()
            Order.objects.filter(pk=order_id).update(
                settlement_status="unsettled" if has_unsettled else "settled"
            )

        entries_created.append(entry)

    if not entries_created:
        raise ValidationError("Tidak ada transaksi yang perlu di-settle pada batch yang dipilih.")

    return entries_created
