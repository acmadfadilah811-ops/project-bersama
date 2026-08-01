"""
accounting/services/pos_reconciliation.py

T-105: Rekonsiliasi Shift POS vs JournalEntry
- Membandingkan total transaksi POS status 'paid' dengan JournalEntry POS yang terposting.
- Menampilkan transaksi POS status 'paid' yang belum terposting ke jurnal.
- Memvalidasi kas awal/akhir shift, settlement, dan jurnal.
- Query server-side yang efisien.
"""

from decimal import Decimal
from typing import Dict, Any, Optional

from django.db.models import Sum, Count

from api.models import SaldoKasHarian
from api.pos_models import POSSale
from ..models import JournalEntry


def reconcile_pos_shift(
    shift: Optional[SaldoKasHarian] = None,
    shift_id: Optional[int] = None,
    date_from: Optional[Any] = None,
    date_to: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Melakukan rekonsiliasi shift POS vs JournalEntry.
    """
    if shift_id and not shift:
        shift = SaldoKasHarian.objects.filter(id=shift_id).first()

    paid_sales_qs = POSSale.objects.filter(status="paid")

    if shift:
        paid_sales_qs = paid_sales_qs.filter(shift=shift)

    if date_from:
        paid_sales_qs = paid_sales_qs.filter(created_at__date__gte=date_from)
    if date_to:
        paid_sales_qs = paid_sales_qs.filter(created_at__date__lte=date_to)

    agg_paid = paid_sales_qs.aggregate(
        total_amount=Sum("total"),
        total_count=Count("id"),
    )
    total_pos_paid_amount = Decimal(str(agg_paid["total_amount"] or 0))
    total_pos_paid_count = agg_paid["total_count"] or 0

    paid_sales_list = list(
        paid_sales_qs.select_related("accounting_payment_method").only(
            "id", "nomor", "total", "metode_bayar", "created_at",
            "accounting_payment_method__is_cash",
        )
    )
    paid_sales_ids = [s.id for s in paid_sales_list]

    posted_je_map = {}
    if paid_sales_ids:
        posted_je = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.POS_SALE,
            status=JournalEntry.Status.POSTED,
            source_id__in=paid_sales_ids,
        ).only("id", "source_id")
        posted_je_map = {je.source_id: je for je in posted_je}

    posted_sales = [s for s in paid_sales_list if s.id in posted_je_map]
    unposted_sales = [s for s in paid_sales_list if s.id not in posted_je_map]

    posted_sales_amount = sum(Decimal(str(s.total or 0)) for s in posted_sales)
    unposted_sales_amount = sum(Decimal(str(s.total or 0)) for s in unposted_sales)

    kas_awal = Decimal(str(shift.kas_awal or 0)) if shift else None
    kas_akhir = Decimal(str(shift.kas_akhir)) if (shift and shift.kas_akhir is not None) else None

    def is_cash_sale(sale):
        payment_method = getattr(sale, "accounting_payment_method", None)
        if payment_method is not None:
            return bool(payment_method.is_cash)
        return (sale.metode_bayar or "").strip().lower() in ("cash", "tunai")

    cash_sales = [s for s in paid_sales_list if is_cash_sale(s)]
    cash_sales_total = sum(Decimal(str(s.total or 0)) for s in cash_sales)

    expected_kas_akhir = (kas_awal + cash_sales_total) if kas_awal is not None else None
    kas_difference = (kas_akhir - expected_kas_akhir) if (kas_akhir is not None and expected_kas_akhir is not None) else Decimal("0")

    unsettled_non_cash = [
        s for s in paid_sales_list
        if getattr(s, "settlement_status", "not_applicable") == "unsettled"
        and not is_cash_sale(s)
    ]
    unsettled_non_cash_amount = sum(Decimal(str(s.total or 0)) for s in unsettled_non_cash)

    return {
        "shift_id": shift.id if shift else None,
        "shift_tanggal": str(shift.tanggal) if shift else None,
        "kasir_id": shift.kasir_id if shift else None,
        "kasir_name": shift.kasir.username if (shift and shift.kasir) else None,
        "total_pos_paid_count": total_pos_paid_count,
        "total_pos_paid_amount": total_pos_paid_amount,
        "posted_sales_count": len(posted_sales),
        "posted_sales_amount": posted_sales_amount,
        "unposted_sales_count": len(unposted_sales),
        "unposted_sales_amount": unposted_sales_amount,
        "unposted_sales_list": [
            {
                "id": s.id,
                "nomor": getattr(s, "nomor", str(s.id)),
                "total": Decimal(str(s.total or 0)),
                "metode_bayar": s.metode_bayar,
                "created_at": s.created_at.isoformat() if hasattr(s, "created_at") and s.created_at else None,
            }
            for s in unposted_sales
        ],
        "kas_awal": kas_awal,
        "kas_akhir": kas_akhir,
        "cash_sales_total": cash_sales_total,
        "expected_kas_akhir": expected_kas_akhir,
        "kas_difference": kas_difference,
        "unsettled_non_cash_count": len(unsettled_non_cash),
        "unsettled_non_cash_amount": unsettled_non_cash_amount,
        "is_balanced": (len(unposted_sales) == 0) and (kas_difference == Decimal("0")),
    }
