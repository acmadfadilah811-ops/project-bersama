from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from api.pagination import OptionalPageNumberPagination
from api.permissions import IsStrictOwnerOrManager

from ..models import AccountingPeriod
from ..serializers.period import AccountingPeriodSerializer, PeriodJournalLineSerializer
from ..services.period import (
    close_accounting_period,
    close_all_open_periods,
    get_period_journal_lines,
)


class AccountingPeriodListView(generics.ListAPIView):
    """
    GET /api/accounting/periods/?fiscal_year= — list seluruh periode akuntansi & statusnya (Owner/Manager saja).
    """
    permission_classes = [IsAuthenticated, IsStrictOwnerOrManager]
    serializer_class = AccountingPeriodSerializer

    def get_queryset(self):
        qs = AccountingPeriod.objects.all().order_by("-start_date")
        fiscal_year = self.request.query_params.get("fiscal_year")
        if fiscal_year:
            qs = qs.filter(fiscal_year=fiscal_year)
        return qs


class AccountingPeriodDetailView(APIView):
    """GET /api/accounting/periods/<pk>/detail/?page=&page_size=."""

    permission_classes = [IsAuthenticated, IsStrictOwnerOrManager]
    pagination_class = OptionalPageNumberPagination

    def get(self, request, pk):
        period = get_object_or_404(AccountingPeriod, pk=pk)
        paginator = self.pagination_class()
        queryset = get_period_journal_lines(period)
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = PeriodJournalLineSerializer(page if page is not None else queryset, many=True)
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)


class AccountingPeriodCloseView(APIView):
    """
    POST /api/accounting/close-period/ atau POST /api/accounting/periods/<pk>/close/ — tutup buku / kunci periode akuntansi (Owner/Manager saja).
    """
    permission_classes = [IsAuthenticated, IsStrictOwnerOrManager]

    def post(self, request, pk=None):
        confirm = request.data.get("confirm")
        if confirm is not True:
            return Response(
                {"detail": "Field confirm wajib bernilai true untuk menutup periode."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")

        try:
            period = close_accounting_period(
                period_id=pk,
                start_date=start_date,
                end_date=end_date,
                actor=request.user,
            )
            return Response(
                {
                    "message": f"Berhasil menutup periode akuntansi {period.start_date} s/d {period.end_date}.",
                    "period": AccountingPeriodSerializer(period).data,
                },
                status=status.HTTP_200_OK,
            )
        except ValidationError as err:
            return Response(
                {"detail": err.message if hasattr(err, "message") else str(err)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class AccountingPeriodCloseAllView(APIView):
    """
    POST /api/accounting/periods/close-all/ — tutup semua periode Terbuka yang
    sudah berakhir (bulan berjalan tidak ikut), sekali klik (Owner/Manager
    saja). Body: {"confirm": true, "fiscal_year": <opsional>}. Periode yang
    gagal (mis. saldo negatif) dilewati, bukan menghentikan proses periode
    lain — hasil per periode dikembalikan supaya user tahu bulan mana yang
    masih perlu diperbaiki.
    """
    permission_classes = [IsAuthenticated, IsStrictOwnerOrManager]

    def post(self, request):
        confirm = request.data.get("confirm")
        if confirm is not True:
            return Response(
                {"detail": "Field confirm wajib bernilai true untuk menutup semua periode."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fiscal_year = request.data.get("fiscal_year")
        closed, failed = close_all_open_periods(fiscal_year=fiscal_year, actor=request.user)
        return Response(
            {
                "closed_count": len(closed),
                "failed_count": len(failed),
                "closed": AccountingPeriodSerializer(closed, many=True).data,
                "failed": [
                    {
                        "period": AccountingPeriodSerializer(item["period"]).data,
                        "reason": item["reason"],
                    }
                    for item in failed
                ],
            },
            status=status.HTTP_200_OK,
        )


# CATATAN (T-612, verifikasi manager 2026-08-01): tidak ada view/endpoint HTTP
# untuk reopen periode di sini SENGAJA — desain approved poin 5 eksplisit
# menolak reopen self-service lewat API. Servis `reopen_accounting_period()`
# (accounting/services/period.py) tetap ada untuk pemakaian admin
# Django shell manual case-by-case, bukan permukaan API. Sebelumnya sempat
# ada `AccountingPeriodReopenView` yang dibangun tapi tidak pernah didaftarkan
# ke urls.py — dihapus karena kontradiksi desain approved, bukan sekadar
# "belum dipakai".
