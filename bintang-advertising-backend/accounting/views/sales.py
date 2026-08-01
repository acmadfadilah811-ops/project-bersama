from collections import defaultdict

from django.db.models import Prefetch, Q
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import Order, OrderActivityLog, PengembalianOrder
from api.permissions import IsOwnerOrManager
from api.pos_models import POSSale

from ..models import JournalEntry
from ..serializers import AccountingSalesRecordSerializer


_CATEGORY_LABELS = {
    "pos": "Penjualan POS",
    "butuh_diproses": "Pesanan Butuh Diproses",
    "selesai": "Pesanan Selesai",
    "pengembalian": "Pengembalian",
    "dibatalkan": "Pesanan Dibatalkan",
}


def _journal_state(entries):
    """Ringkas status jurnal dengan prioritas posted > draft > void."""
    rows = list(entries)
    ids = [row["id"] for row in rows]
    statuses = {row["status"] for row in rows}
    if JournalEntry.Status.POSTED in statuses:
        state = "posted"
    elif JournalEntry.Status.DRAFT in statuses:
        state = "draft"
    elif JournalEntry.Status.VOID in statuses:
        state = "void"
    else:
        state = "not_posted"
    return state, ids


def _journal_map(source_type, source_ids):
    if not source_ids:
        return {}
    rows = JournalEntry.objects.filter(
        source_type=source_type, source_id__in=source_ids
    ).values("id", "source_id", "status")
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["source_id"]].append(row)
    entry_ids = [row["id"] for row in rows]
    reversed_ids = set(JournalEntry.objects.filter(reversed_entry_id__in=entry_ids).values_list("reversed_entry_id", flat=True))
    return {
        source_id: ("void", [row["id"] for row in entries])
        if any(row["id"] in reversed_ids for row in entries)
        else _journal_state(entries)
        for source_id, entries in grouped.items()
    }


def _payment_status(total, paid, transaction_status):
    if transaction_status == "void":
        return "void"
    if total <= 0:
        return "not_applicable"
    if paid >= total:
        return "paid"
    if paid > 0:
        return "partial"
    return "unpaid"


def _parse_filter_date(request, name):
    raw = (request.query_params.get(name) or "").strip()
    if not raw:
        return None, None
    parsed = parse_date(raw)
    if not parsed:
        return None, Response(
            {"detail": f"{name} harus berformat YYYY-MM-DD."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return parsed, None


class AccountingSalesView(APIView):
    """Daftar gabungan POS dan Order untuk Penjualan di Toko Akuntansi.

    Endpoint ini read-only dan tidak mengubah kontrak `/api/pos/sales/` atau
    `/api/orders/`. Semua status jurnal dihitung dari JournalEntry yang asli;
    endpoint tidak menandai transaksi terposting secara lokal.

    Query params: `date_from`, `date_to`, `search`, `source`, `category`.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        date_from, error = _parse_filter_date(request, "date_from")
        if error:
            return error
        date_to, error = _parse_filter_date(request, "date_to")
        if error:
            return error
        if date_from and date_to and date_from > date_to:
            return Response(
                {"detail": "date_from tidak boleh melebihi date_to."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source_filter = (request.query_params.get("source") or "").strip().lower()
        category_filter = (request.query_params.get("category") or "").strip().lower()
        search = (request.query_params.get("search") or "").strip().lower()
        valid_sources = {"", "pos", "order"}
        valid_categories = set(_CATEGORY_LABELS)
        if source_filter not in valid_sources:
            return Response({"detail": "source harus berupa pos atau order."}, status=400)
        if category_filter and category_filter not in valid_categories:
            return Response({"detail": "category tidak dikenali."}, status=400)

        records = []
        if source_filter in ("", "pos") and category_filter in ("", "pos"):
            pos_qs = POSSale.objects.select_related("pelanggan").all()
            if date_from:
                pos_qs = pos_qs.filter(created_at__date__gte=date_from)
            if date_to:
                pos_qs = pos_qs.filter(created_at__date__lte=date_to)
            pos_sales = list(pos_qs)
            pos_journals = _journal_map(
                JournalEntry.SourceType.POS_SALE, [sale.id for sale in pos_sales]
            )
            for sale in pos_sales:
                transaction_status = sale.status
                total = sale.total or 0
                paid = sale.dibayar or 0
                journal_status, journal_ids = pos_journals.get(
                    sale.id, ("not_posted", [])
                )
                records.append(
                    {
                        "id": f"pos:{sale.id}",
                        "source": "pos",
                        "source_id": str(sale.id),
                        "reference": sale.nomor,
                        "date": sale.created_at,
                        "customer": sale.pelanggan.nama if sale.pelanggan else "",
                        "category": "pos",
                        "category_label": _CATEGORY_LABELS["pos"],
                        "transaction_status": transaction_status,
                        "status_global": None,
                        "payment_status": _payment_status(total, paid, transaction_status),
                        "amount": total,
                        "paid_amount": paid,
                        "outstanding_amount": max(total - paid, 0),
                        "payment_method": sale.metode_bayar,
                        "settlement_status": sale.settlement_status,
                        "journal_status": journal_status,
                        "journal_entry_ids": journal_ids,
                    }
                )

        if source_filter in ("", "order") and category_filter != "pos":
            return self._order_records(
                records, date_from, date_to, search, category_filter
            )

        return self._finish(records, search)

    def _order_records(self, records, date_from, date_to, search, category_filter):
        return_records = list(records)
        return_records.extend(
            self._build_order_records(date_from, date_to, search, category_filter)
        )
        return self._finish(return_records, search)

    @staticmethod
    def _build_order_records(date_from, date_to, search, category_filter):
        return_qs = PengembalianOrder.objects.filter(status__in=("Draft", "Tunda", "Dikonfirmasi"))
        order_qs = Order.objects.prefetch_related(
            Prefetch("daftar_pengembalian", queryset=return_qs, to_attr="_active_returns")
        )
        if date_from:
            order_qs = order_qs.filter(waktu__date__gte=date_from)
        if date_to:
            order_qs = order_qs.filter(waktu__date__lte=date_to)
        if search:
            order_qs = order_qs.filter(Q(id__icontains=search) | Q(nama__icontains=search))

        orders = list(order_qs)
        order_ids = [order.id for order in orders]
        logs = list(OrderActivityLog.objects.filter(order_id__in=order_ids).values("id", "order_id"))
        log_to_order = {row["id"]: row["order_id"] for row in logs}
        order_journal_entries = defaultdict(list)
        if log_to_order:
            entries = JournalEntry.objects.filter(
                source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                source_id__in=list(log_to_order),
            ).values("id", "source_id", "status")
            for row in entries:
                order_journal_entries[log_to_order[row["source_id"]]].append(row)

        records = []
        for order in orders:
            if getattr(order, "_active_returns", []):
                category = "pengembalian"
            elif order.status_global == "selesai":
                category = "selesai"
            elif order.status_global == "batal":
                category = "dibatalkan"
            else:
                category = "butuh_diproses"
            if category_filter and category_filter != category:
                continue

            total = order.total_harga or 0
            paid = order.dp_dibayar or 0
            transaction_status = order.status_global
            journal_status, journal_ids = _journal_state(order_journal_entries[order.id])
            records.append(
                {
                    "id": f"order:{order.id}",
                    "source": "order",
                    "source_id": order.id,
                    "reference": order.id,
                    "date": order.waktu,
                    "customer": order.nama,
                    "category": category,
                    "category_label": _CATEGORY_LABELS[category],
                    "transaction_status": transaction_status,
                    "status_global": order.status_global,
                    "payment_status": _payment_status(total, paid, transaction_status),
                    "amount": total,
                    "paid_amount": paid,
                    "outstanding_amount": max(total - paid, 0),
                    "payment_method": order.metode_pembayaran,
                    "settlement_status": order.settlement_status,
                    "journal_status": journal_status,
                    "journal_entry_ids": journal_ids,
                }
            )
        return records

    @staticmethod
    def _finish(records, search):
        if search:
            records = [
                row
                for row in records
                if search in str(row["reference"]).lower()
                or search in (row["customer"] or "").lower()
            ]
        records.sort(key=lambda row: row["date"] or "", reverse=True)
        serializer = AccountingSalesRecordSerializer(records, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})
