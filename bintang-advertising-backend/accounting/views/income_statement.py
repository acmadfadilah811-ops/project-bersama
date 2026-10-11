from datetime import date

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerManagerAdminOrFinanceRole

from ..services.ledger import (
    get_balance_sheet, get_cash_flow, get_cash_flow_detail, get_changes_in_equity, get_income_statement,
)
from ..services.report_export import build_balance_sheet_xlsx, build_income_statement_xlsx
from .common import resolve_date_range

_XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _department_unit(request):
    """`?unit_bisnis=<id>` -> id departemen unit itu (Laba Rugi per unit, 2026-10-11)."""
    from ..services.unit_bisnis import department_id_untuk_filter

    unit = str(request.query_params.get("unit_bisnis") or "").strip()
    if not unit:
        return None, None
    if not unit.isdigit():
        return None, Response({"error": "Unit bisnis tidak valid."}, status=status.HTTP_400_BAD_REQUEST)
    dept_id = department_id_untuk_filter(int(unit))
    if not dept_id:
        return None, Response(
            {"error": "Departemen unit bisnis ini belum diatur di Akun Unit Bisnis."}, status=status.HTTP_400_BAD_REQUEST,
        )
    return dept_id, None


class IncomeStatementView(APIView):
    """
    GET /api/accounting/reports/income-statement/?date_from=&date_to=

    Laba Rugi (Akuntansi > Laba Rugi Satu Periode) — dihitung dari
    `accounting.JournalEntry` per klasifikasi COA (Pendapatan, HPP,
    Pengeluaran, Pendapatan Lain, Pengeluaran Lain), bukan dari transaksi
    penjualan mentah. Untuk tampilan Multi Periode, frontend memanggil
    endpoint ini beberapa kali (1x per kolom periode) — tidak ada endpoint
    terpisah supaya perhitungan selalu dari satu fungsi yang sama.
    """

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        dept_id, galat = _department_unit(request)
        if galat:
            return galat
        return Response(get_income_statement(date_from, date_to, department_id=dept_id))


class IncomeStatementExportView(APIView):
    """GET /api/accounting/reports/income-statement/export/?date_from=&date_to= — Excel Laba Rugi."""

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        dept_id, galat = _department_unit(request)
        if galat:
            return galat
        data = get_income_statement(date_from, date_to, department_id=dept_id)
        buffer = build_income_statement_xlsx(data)
        filename = f"laba-rugi-{timezone.localdate():%Y%m%d}.xlsx"
        response = HttpResponse(buffer.getvalue(), content_type=_XLSX_CONTENT_TYPE)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class BalanceSheetView(APIView):
    """
    GET /api/accounting/reports/balance-sheet/?date_from=&date_to=

    Neraca — saldo Aset/Kewajiban/Modal kumulatif per `date_to`. `date_from`
    tidak memengaruhi baris "Laba/Rugi Belum Ditutup" (kumulatif sampai
    `date_to`, lihat `get_balance_sheet`/`_unclosed_pl_net`) — hanya
    dipertahankan di response untuk kompatibilitas UI.
    """

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        return Response(get_balance_sheet(date_from, date_to))


class BalanceSheetExportView(APIView):
    """GET /api/accounting/reports/balance-sheet/export/?date_from=&date_to= — Excel Neraca."""

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        data = get_balance_sheet(date_from, date_to)
        buffer = build_balance_sheet_xlsx(data)
        filename = f"neraca-{timezone.localdate():%Y%m%d}.xlsx"
        response = HttpResponse(buffer.getvalue(), content_type=_XLSX_CONTENT_TYPE)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ChangesInEquityView(APIView):
    """GET /api/accounting/reports/changes-in-equity/?date_from=&date_to=."""

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        return Response(get_changes_in_equity(date_from, date_to))


class CashFlowView(APIView):
    """GET /api/accounting/reports/cash-flow/?date_from=&date_to=."""

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        return Response(get_cash_flow(date_from, date_to))


class CashFlowDetailView(APIView):
    """GET /api/accounting/reports/cash-flow/<category>/?date_from=&date_to=&page=."""

    permission_classes = [IsOwnerManagerAdminOrFinanceRole]
    valid_categories = {
        "penerimaan_pelanggan", "penerimaan_penjualan_aset_lancar", "pembayaran_pemasok",
        "biaya_operasional", "pendapatan_lain", "pengeluaran_lain", "aset_tetap",
        "aset_tidak_berwujud", "investasi_lain", "pembayaran_penerimaan_pinjaman",
        "penambahan_pengambilan_modal",
    }

    def get(self, request, category):
        if category not in self.valid_categories:
            return Response({"detail": "Kategori Arus Kas tidak valid."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 10))))
        except (TypeError, ValueError):
            page_size = 10
        date_from, date_to = resolve_date_range(request)
        return Response(get_cash_flow_detail(date_from, date_to, category, page=page, page_size=page_size))
