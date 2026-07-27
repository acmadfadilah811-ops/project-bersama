from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from api.permissions import IsOwnerOrManager

from ..models import Account, AccountClassification
from ..serializers import AccountClassificationSerializer, AccountCreateSerializer, AccountListSerializer
from ..services.ledger import get_account_balances


def _period_end_date(period_str):
    """'2026-07' -> tanggal terakhir bulan itu. Default: bulan berjalan."""
    today = date.today()
    year, month = today.year, today.month
    if period_str:
        try:
            year_str, month_str = period_str.split("-")
            year, month = int(year_str), int(month_str)
        except (ValueError, AttributeError):
            pass
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


class AccountListView(generics.ListCreateAPIView):
    """
    GET /api/accounting/accounts/?search=&saldo=&exclude_zero=true&semua_akun=true&period=YYYY-MM&classification=
    POST /api/accounting/accounts/

    Daftar Akun dengan filter (Cari, Jumlah, "Nilai akun bukan 0") dan saldo
    kumulatif per periode (navigasi bulan di halaman Daftar Akun).
    - search: cocokkan ke nomor akun atau nama akun.
    - saldo: hanya akun dengan saldo persis senilai ini.
    - exclude_zero: sembunyikan akun bersaldo 0 ("Nilai akun bukan 0").
    - semua_akun: kalau true, ikutkan akun nonaktif juga (default: aktif saja).
    - period: "YYYY-MM", default bulan berjalan.
    - classification: nama klasifikasi persis (mis. "Kas & Bank") — dipakai
      ulang endpoint ini untuk "List Kas & Bank", bukan bikin view terpisah.

    POST — "Tambah Akun" cepat dari wizard Pengaturan Awal (dan dipakai ulang
    kalau nanti Daftar Akun butuh tambah akun manual juga).
    """

    permission_classes = [IsOwnerOrManager]

    def get_serializer_class(self):
        return AccountCreateSerializer if self.request.method == "POST" else AccountListSerializer

    def perform_create(self, serializer):
        try:
            serializer.save()
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))

    def get_queryset(self):
        qs = Account.objects.select_related("classification")

        if self.request.query_params.get("semua_akun") != "true":
            qs = qs.filter(is_active=True)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(code__icontains=search) | Q(name__icontains=search))

        classification = self.request.query_params.get("classification")
        if classification:
            qs = qs.filter(classification__name=classification)

        return qs.order_by("code")

    def list(self, request, *args, **kwargs):
        queryset = list(self.filter_queryset(self.get_queryset()))
        as_of_date = _period_end_date(request.query_params.get("period"))
        balances = get_account_balances(queryset, as_of_date)

        exclude_zero = request.query_params.get("exclude_zero") == "true"
        saldo_filter = request.query_params.get("saldo")
        saldo_target = None
        if saldo_filter:
            try:
                saldo_target = Decimal(saldo_filter)
            except InvalidOperation:
                saldo_target = None

        result = []
        for account in queryset:
            saldo = balances.get(account.id, 0)
            if exclude_zero and saldo == 0:
                continue
            if saldo_target is not None and saldo != saldo_target:
                continue
            result.append(account)

        serializer = self.get_serializer(
            result, many=True, context={**self.get_serializer_context(), "balances": balances},
        )
        return Response(serializer.data)


class AccountClassificationListView(generics.ListAPIView):
    """
    GET /api/accounting/account-classifications/

    21 klasifikasi COA (Kas & Bank, Investasi, ..., Pengeluaran Lain) — dipakai
    dropdown "Sub Kategori" di wizard Pengaturan Awal (Tambah Akun). Pengelompokan
    jadi 8 "Kategori" tampilan (Harta Lancar/Tetap/Tak Berwujud/dst) murni di
    frontend (lihat kategoriAkunMap.js) — di sini cukup daftar flat.
    """

    serializer_class = AccountClassificationSerializer
    permission_classes = [IsOwnerOrManager]
    queryset = AccountClassification.objects.all().order_by("account_type", "order")


import csv
import io
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser

from ..services.account_import import build_preview, commit_entries, parse_csv_file


class AccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/accounting/accounts/<id>/
    PUT/PATCH /api/accounting/accounts/<id>/
    DELETE /api/accounting/accounts/<id>/
    """

    permission_classes = [IsOwnerOrManager]
    queryset = Account.objects.all()
    serializer_class = AccountCreateSerializer

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))


class AccountImportTemplateView(APIView):
    """
    GET /api/accounting/accounts/import/template/

    Template CSV persis format resmi Olsera: cuma account_name + account_no.
    Klasifikasi & is_contra TIDAK diminta di sini — di-derive otomatis saat
    preview dari rentang kode (lihat AccountImportGuideView di bawah).
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        writer.writerow(["account_name", "account_no"])
        writer.writerow(["Kas Kecil Baru", "11105"])
        writer.writerow(["Piutang Karyawan", "11350"])

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="template_daftar_akun.csv"'
        return response


class AccountImportGuideView(APIView):
    """
    GET /api/accounting/accounts/import/guide/

    Panduan rentang kode akun per klasifikasi (account_group/first_no/last_no),
    dibaca langsung dari AccountClassification — selalu sinkron dengan validasi
    import & Account.clean(). Format & urutan (per code_range_start menaik)
    meniru file panduan resmi Olsera (templateGuideAccount, sheet "ruleAccountNo").
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        classifications = AccountClassification.objects.exclude(
            code_range_start__isnull=True, code_range_end__isnull=True,
        ).order_by("code_range_start")

        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        writer.writerow(["account_group", "first_no", "last_no"])
        for cls in classifications:
            writer.writerow([cls.name, cls.code_range_start, cls.code_range_end])

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="panduan_kode_akun.csv"'
        return response


class AccountImportPreviewView(APIView):
    """
    POST /api/accounting/accounts/import/preview/  (multipart, field 'file')

    Langkah 1 dari 2 (baca dulu, proses belakangan — seperti import Jurnal
    Umum): parse CSV, validasi tiap baris (kode wajib angka, masuk rentang
    klasifikasi, belum terdaftar), TIDAK menyimpan apa pun.
    """

    permission_classes = [IsOwnerOrManager]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "File CSV wajib diunggah (field 'file')."}, status=status.HTTP_400_BAD_REQUEST)

        rows, error_detail = parse_csv_file(file_obj)
        if error_detail:
            return Response({"detail": error_detail}, status=status.HTTP_400_BAD_REQUEST)
        if not rows:
            return Response({"detail": "File kosong."}, status=status.HTTP_400_BAD_REQUEST)

        preview = build_preview(rows)
        return Response({
            "total_rows": len(preview),
            "valid_rows": sum(1 for p in preview if p["is_valid"]),
            "entries": preview,
        })


class AccountImportCommitView(APIView):
    """
    POST /api/accounting/accounts/import/commit/

    Langkah 2 dari 2: body = {"entries": [...]} persis bentuk `entries` dari
    respons /import/preview/. Entry dengan is_valid=false dilewati.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        entries = request.data.get("entries") or []
        valid_entries = [e for e in entries if e.get("is_valid")]
        if not valid_entries:
            return Response({"detail": "Tidak ada data akun valid untuk di-import."}, status=status.HTTP_400_BAD_REQUEST)

        created_count, errors = commit_entries(valid_entries)
        return Response({
            "success": len(errors) == 0,
            "created_count": created_count,
            "errors": errors,
        })


class StoreCopyPlaceholderView(APIView):
    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        return Response({"message": "Berhasil menyalin daftar akun dari toko terpilih (Fitur Simulasi)."}, status=200)



