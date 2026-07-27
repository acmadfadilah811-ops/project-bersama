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
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum, Count, Q, F

from api.models import Order
from api.pos_models import POSSale
from ..models import Account, JournalEntry, PaymentMethod
from .journal import create_journal_entry


def _non_cash_filter():
    """Filter untuk transaksi non-tunai yang belum settled."""
    return Q(settlement_status="unsettled") & ~Q(accounting_payment_method__isnull=True)


def get_settlement_batches(date_from: date, date_to: date):
    """
    Return list of settlement batches, grouped by (tanggal, payment_method).
    Gabungan POSSale + Order.

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

    order_batches = (
        Order.objects
        .filter(_non_cash_filter(), waktu__date__gte=date_from, waktu__date__lte=date_to)
        .values(batch_date=F("waktu__date"), pm_id=F("accounting_payment_method_id"))
        .annotate(total=Sum("total_harga"), count=Count("id"))
    )

    # Merge by (date, payment_method_id)
    merged = {}
    pm_cache = {}

    for row in pos_batches:
        key = (row["batch_date"], row["pm_id"])
        if key not in merged:
            merged[key] = {"total": Decimal(0), "pos_count": 0, "order_count": 0}
        merged[key]["total"] += Decimal(str(row["total"] or 0))
        merged[key]["pos_count"] += row["count"]

    for row in order_batches:
        key = (row["batch_date"], row["pm_id"])
        if key not in merged:
            merged[key] = {"total": Decimal(0), "pos_count": 0, "order_count": 0}
        merged[key]["total"] += Decimal(str(row["total"] or 0))
        merged[key]["order_count"] += row["count"]

    # Resolve payment method names
    pm_ids = {k[1] for k in merged}
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
    bank_account = Account.objects.filter(id=bank_account_id).first()
    if not bank_account:
        raise ValidationError(f"Akun bank/kas tujuan ID {bank_account_id} tidak ditemukan.")

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

        # Collect matching transactions
        pos_qs = POSSale.objects.filter(
            _non_cash_filter(),
            status="paid",
            created_at__date=batch_date,
            accounting_payment_method_id=pm_id,
        )
        order_qs = Order.objects.filter(
            _non_cash_filter(),
            waktu__date=batch_date,
            accounting_payment_method_id=pm_id,
        )

        pos_total = pos_qs.aggregate(t=Sum("total"))["t"] or Decimal(0)
        order_total = order_qs.aggregate(t=Sum("total_harga"))["t"] or Decimal(0)
        gross_amount = Decimal(str(pos_total)) + Decimal(str(order_total))

        if gross_amount <= 0:
            continue  # skip empty batches

        # Calculate MDR
        mdr_amount = Decimal(0)
        if pm.mdr_percent and pm.mdr_percent > 0 and pm.mdr_debit_account:
            mdr_amount = (gross_amount * pm.mdr_percent / Decimal(100)).quantize(Decimal("1"))

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

        entry = create_journal_entry(
            date=batch_date,
            lines=lines,
            description=f"Konfirmasi Settlement — {pm.name} — {batch_date}",
            source_type=JournalEntry.SourceType.SETTLEMENT,
            created_by=actor,
        )

        # Mark transactions as settled
        pos_qs.update(settlement_status="settled")
        order_qs.update(settlement_status="settled")

        entries_created.append(entry)

    if not entries_created:
        raise ValidationError("Tidak ada transaksi yang perlu di-settle pada batch yang dipilih.")

    return entries_created
