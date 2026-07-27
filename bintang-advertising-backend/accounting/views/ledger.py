from datetime import date

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import Account
from ..serializers import LedgerLineSerializer, LedgerSummarySerializer
from ..services.ledger import get_account_line_history, get_account_movements
from ..services.ledger_export import (
    build_ledger_account_export,
    build_ledger_all_accounts_detail_export,
    build_ledger_summary_export,
)
from .common import resolve_date_range


def _active_accounts_queryset(search=None, classification=None):
    qs = Account.objects.select_related("classification").filter(is_active=True)
    if search:
        qs = qs.filter(Q(code__icontains=search) | Q(name__icontains=search))
    if classification:
        qs = qs.filter(classification__name=classification)
    return qs.order_by("code")


class LedgerSummaryView(generics.ListAPIView):
    """
    GET /api/accounting/ledger/?date_from=&date_to=&search=&classification=

    Buku Besar: semua akun + pergerakan debit/kredit dan saldo akhir dalam
    rentang tanggal terpilih (default hari ini, sama seperti Jurnal Umum).
    - search: cocokkan ke nomor akun atau nama akun.
    - classification: nama klasifikasi persis (mis. "Kas & Bank") — dipakai
      ulang endpoint ini untuk List Kas & Bank, sama seperti AccountListView.
    """

    serializer_class = LedgerSummarySerializer
    permission_classes = [IsOwnerOrManager]

    def get_queryset(self):
        return _active_accounts_queryset(
            self.request.query_params.get("search"),
            self.request.query_params.get("classification"),
        )

    def list(self, request, *args, **kwargs):
        queryset = list(self.filter_queryset(self.get_queryset()))
        date_from, date_to = resolve_date_range(request)
        movements = get_account_movements(queryset, date_from, date_to)

        serializer = self.get_serializer(
            queryset, many=True, context={**self.get_serializer_context(), "movements": movements},
        )
        return Response(serializer.data)


class LedgerSummaryExportView(APIView):
    """
    GET /api/accounting/ledger/export/?date_from=&date_to=&search=&classification=

    Excel Ringkasan Buku Besar. classification (opsional) — dipakai ulang
    endpoint ini untuk export List Kas & Bank (classification=Kas & Bank),
    sama seperti LedgerSummaryView.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        accounts = list(_active_accounts_queryset(
            request.query_params.get("search"),
            request.query_params.get("classification"),
        ))
        date_from, date_to = resolve_date_range(request)
        movements = get_account_movements(accounts, date_from, date_to)

        buffer = build_ledger_summary_export(accounts, movements)
        classification = request.query_params.get("classification")
        prefix = "kas-bank" if classification == "Kas & Bank" else "buku-besar"
        filename = f"{prefix}-{date.today():%Y%m%d}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class LedgerAllAccountsDetailView(APIView):
    """
    GET /api/accounting/ledger/detail/?date_from=&date_to=&search=

    Versi JSON dari LedgerDetailExportView (data sama persis, reuse
    get_account_line_history() yang sama) — dipakai tampilan cetak "Detail
    Rincian" (window.print() di frontend, lihat BukuBesarDetailPrint.jsx),
    bukan file Excel. Akun tanpa transaksi di rentang tanggal dilewati.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        accounts = list(_active_accounts_queryset(request.query_params.get("search")))
        date_from, date_to = resolve_date_range(request)

        result = []
        for account in accounts:
            history = get_account_line_history(account, date_from, date_to)
            if not history["rows"]:
                continue
            result.append({
                "account": {"id": account.id, "code": account.code, "name": account.name},
                "rows": LedgerLineSerializer(history["rows"], many=True).data,
            })

        return Response({"date_from": str(date_from), "date_to": str(date_to), "accounts": result})


class LedgerDetailExportView(APIView):
    """
    GET /api/accounting/ledger/export-detail/?date_from=&date_to=&search=

    Excel Detail Buku Besar — rincian transaksi SEMUA akun, dikelompokkan per
    akun. Akun tanpa transaksi di rentang tanggal tidak dimunculkan.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        accounts = list(_active_accounts_queryset(request.query_params.get("search")))
        date_from, date_to = resolve_date_range(request)
        accounts_with_history = [
            (account, get_account_line_history(account, date_from, date_to)) for account in accounts
        ]

        buffer = build_ledger_all_accounts_detail_export(accounts_with_history)
        filename = f"buku-besar-detail-{date.today():%Y%m%d}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class LedgerAccountDetailView(APIView):
    """
    GET /api/accounting/ledger/<int:account_id>/?date_from=&date_to=&search=

    Rincian Mutasi Akun (kartu kendali) — riwayat transaksi 1 akun dengan
    saldo berjalan per baris. search: cocokkan ke No. Transaksi.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request, account_id):
        account = get_object_or_404(Account, id=account_id)
        date_from, date_to = resolve_date_range(request)
        history = get_account_line_history(
            account, date_from, date_to, search=request.query_params.get("search"),
        )
        return Response({
            "account": {"id": account.id, "code": account.code, "name": account.name},
            "saldo_awal": history["saldo_awal"],
            "rows": LedgerLineSerializer(history["rows"], many=True).data,
        })


class LedgerAccountExportView(APIView):
    """GET /api/accounting/ledger/<int:account_id>/export/?date_from=&date_to= — Excel Rincian Mutasi Akun."""

    permission_classes = [IsOwnerOrManager]

    def get(self, request, account_id):
        account = get_object_or_404(Account, id=account_id)
        date_from, date_to = resolve_date_range(request)
        history = get_account_line_history(account, date_from, date_to)

        buffer = build_ledger_account_export(account, history)
        filename = f"buku-besar-{account.code}-{date.today():%Y%m%d}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
