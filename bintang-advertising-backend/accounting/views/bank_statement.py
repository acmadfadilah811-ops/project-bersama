from calendar import monthrange
from datetime import date

from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import Account, BankStatementLine, CashBankAccount
from ..serializers import BankStatementLineSerializer, CashBankAccountSerializer
from ..services.bank_statement import build_preview, commit_lines, parse_csv_file


def _resolve_month_range(request):
    """Default Bank Statement beda dari Jurnal Umum/Buku Besar: bulan berjalan penuh, bukan cuma hari ini."""
    date_from_str = request.query_params.get("date_from")
    date_to_str = request.query_params.get("date_to")
    if date_from_str and date_to_str:
        try:
            return date.fromisoformat(date_from_str), date.fromisoformat(date_to_str)
        except ValueError:
            pass
    today = date.today()
    start = today.replace(day=1)
    end = today.replace(day=monthrange(today.year, today.month)[1])
    return start, end


class CashBankAccountListView(generics.ListAPIView):
    """GET /api/accounting/cash-bank-accounts/ — daftar akun terkurasi untuk dropdown Bank Statement."""

    serializer_class = CashBankAccountSerializer
    permission_classes = [IsOwnerOrManager]
    queryset = CashBankAccount.objects.select_related("account").filter(is_active=True).order_by("account__code")


class BankStatementPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"

    def get_paginated_response(self, data):
        return Response({
            "total": self.page.paginator.count,
            "page": self.page.number,
            "num_pages": self.page.paginator.num_pages,
            "results": data,
        })


class BankStatementListView(generics.ListAPIView):
    """
    GET /api/accounting/bank-statement/?account=<id>&date_from=&date_to=

    List Bank Statement (default rentang bulan berjalan), dipaginasi.
    - account: filter ke 1 akun (opsional — "Semua Data" kalau kosong).
    """

    serializer_class = BankStatementLineSerializer
    permission_classes = [IsOwnerOrManager]
    pagination_class = BankStatementPagination

    def get_queryset(self):
        qs = BankStatementLine.objects.select_related("account")

        account_id = self.request.query_params.get("account")
        if account_id:
            qs = qs.filter(account_id=account_id)

        date_from, date_to = _resolve_month_range(self.request)
        qs = qs.filter(date__gte=date_from, date__lte=date_to)

        return qs.order_by("-date", "-created_at")


class BankStatementImportPreviewView(APIView):
    """
    POST /api/accounting/bank-statement/import/preview/  (multipart: file, account)

    Langkah 1 dari 2: parse CSV, validasi per baris, TIDAK menyimpan apa pun.
    """

    permission_classes = [IsOwnerOrManager]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "File CSV wajib diunggah (field 'file')."}, status=status.HTTP_400_BAD_REQUEST)

        account_id = request.data.get("account")
        if not account_id or not Account.objects.filter(id=account_id).exists():
            return Response({"detail": "Akun tujuan (field 'account') wajib diisi dan valid."}, status=status.HTTP_400_BAD_REQUEST)

        rows, file_errors = parse_csv_file(file_obj)
        if not rows:
            return Response({"detail": " ".join(file_errors) or "File kosong."}, status=status.HTTP_400_BAD_REQUEST)

        preview = build_preview(rows)
        return Response({
            "account": int(account_id),
            "file_warnings": file_errors,
            "total_rows": len(preview),
            "valid_rows": sum(1 for p in preview if p["is_valid"]),
            "rows": preview,
        })


class BankStatementImportCommitView(APIView):
    """
    POST /api/accounting/bank-statement/import/commit/
    body: {"account": <id>, "rows": [...]}  (bentuk `rows` dari respons preview)

    Langkah 2 dari 2: simpan baris valid ke BankStatementLine (status Pending).
    Ini BUKAN posting ke Journal Entry — menunggu diproses di Rekonsiliasi Bank.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        account_id = request.data.get("account")
        account = Account.objects.filter(id=account_id).first()
        if not account:
            return Response({"detail": "Akun tujuan tidak valid."}, status=status.HTTP_400_BAD_REQUEST)

        rows = request.data.get("rows") or []
        valid_rows = [r for r in rows if r.get("is_valid")]
        if not valid_rows:
            return Response({"detail": "Tidak ada baris valid untuk diproses."}, status=status.HTTP_400_BAD_REQUEST)

        created = commit_lines(account=account, preview_lines=valid_rows, imported_by=request.user)
        return Response({
            "created": len(created),
            "lines": BankStatementLineSerializer(created, many=True).data,
        })
