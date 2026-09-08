import calendar
import csv
import io
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import FixedAsset
from ..serializers.assets import (
    FixedAssetAccountConfigSerializer,
    FixedAssetCreateSerializer,
    FixedAssetDisposeSerializer,
    FixedAssetReadSerializer,
    FixedAssetUpdateSerializer,
)
from ..services.asset_export import build_asset_pdf, build_asset_xlsx
from ..services.asset_import import build_preview, parse_csv_file
from ..services.assets import create_fixed_assets_from_import
from ..services.depreciation import post_monthly_depreciation
from .common import resolve_date_range


class AssetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def _asset_export_response(assets, export_format):
    if export_format == "pdf":
        response = HttpResponse(build_asset_pdf(assets), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="daftar-aset-{date.today():%Y%m%d}.pdf"'
        return response
    if export_format != "xlsx":
        return Response({"detail": "Format export harus xlsx atau pdf."}, status=status.HTTP_400_BAD_REQUEST)
    response = HttpResponse(
        build_asset_xlsx(assets).getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="daftar-aset-{date.today():%Y%m%d}.xlsx"'
    return response


class FixedAssetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsOwnerOrManager]
    pagination_class = AssetPagination

    def get_queryset(self):
        queryset = FixedAsset.objects.select_related(
            "asset_account", "depreciation_expense_account", "accumulated_depreciation_account",
            "counter_account", "acquisition_journal", "department", "journal_template",
        )
        date_from, date_to = resolve_date_range(self.request)
        if self.request.query_params.get("all_dates") != "true":
            queryset = queryset.filter(acquisition_date__range=(date_from, date_to))
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(asset_code__icontains=search) | queryset.filter(name__icontains=search)
        return queryset.order_by("-acquisition_date", "-id")

    def get_serializer_class(self):
        return FixedAssetCreateSerializer if self.request.method == "POST" else FixedAssetReadSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        export_format = request.query_params.get("export")
        if export_format:
            return _asset_export_response(queryset, export_format)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            asset = serializer.save()
        except DjangoValidationError as exc:
            return Response({"detail": getattr(exc, "messages", [str(exc)])}, status=status.HTTP_400_BAD_REQUEST)
        return Response(FixedAssetReadSerializer(asset).data, status=status.HTTP_201_CREATED)


class FixedAssetDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsOwnerOrManager]
    queryset = FixedAsset.objects.select_related("asset_account", "acquisition_journal")

    def get_serializer_class(self):
        return FixedAssetUpdateSerializer if self.request.method in ("PUT", "PATCH") else FixedAssetReadSerializer


class FixedAssetTemplateView(APIView):
    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "asset_code", "name", "acquisition_date", "acquisition_cost", "residual_value",
            "external_document_no", "description",
        ])
        writer.writerow(["AST-001", "Laptop kantor", "2026-07-01", "15000000", "1000000", "INV-001", "Aset contoh"])
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="template_aset.csv"'
        return response


class FixedAssetImportPreviewView(APIView):
    permission_classes = [IsOwnerOrManager]
    parser_classes = [MultiPartParser]

    def post(self, request):
        config = FixedAssetAccountConfigSerializer(data=request.data)
        config.is_valid(raise_exception=True)
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "File CSV wajib diunggah."}, status=status.HTTP_400_BAD_REQUEST)
        rows, errors = parse_csv_file(file_obj)
        if errors:
            return Response({"detail": " ".join(errors)}, status=status.HTTP_400_BAD_REQUEST)
        preview = build_preview(rows)
        return Response({
            "total_rows": len(preview),
            "valid_rows": sum(1 for row in preview if row["is_valid"]),
            "entries": preview,
        })


class FixedAssetImportCommitView(APIView):
    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        config = FixedAssetAccountConfigSerializer(data=request.data)
        config.is_valid(raise_exception=True)
        entries = request.data.get("entries") or []
        valid_entries = [entry for entry in entries if entry.get("is_valid")]
        if not valid_entries:
            return Response({"detail": "Tidak ada baris valid untuk diimport."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            assets = create_fixed_assets_from_import(
                rows=valid_entries, shared_data=config.validated_data, created_by=request.user,
            )
        except (DjangoValidationError, ValueError) as exc:
            return Response({"detail": getattr(exc, "messages", [str(exc)])}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"created_count": len(assets), "assets": FixedAssetReadSerializer(assets, many=True).data}, status=201)


class FixedAssetDepreciationPostView(APIView):
    """POST /api/accounting/assets/depreciation/post/ {"period": "2026-09"}

    Posting manual jurnal penyusutan bulanan (juga dijadwalkan otomatis
    lewat management command post_monthly_depreciation, lihat cron/systemd
    timer VPS) -- disediakan supaya Owner/Manager bisa memicu langsung
    (mis. baru isi umur manfaat aset lama, tidak mau nunggu jadwal
    berikutnya) atau susulan bulan yang terlewat.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        period_raw = str(request.data.get("period") or "").strip()
        today = timezone.localdate()
        if period_raw:
            try:
                year, month = (int(part) for part in period_raw.split("-"))
                period_end_date = date(year, month, calendar.monthrange(year, month)[1])
            except (ValueError, TypeError):
                return Response({"detail": "Format period harus YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            period_end_date = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])

        entries = post_monthly_depreciation(period_end_date=period_end_date, actor=request.user)
        return Response({
            "period": f"{period_end_date:%Y-%m}",
            "posted_count": len(entries),
            "entries": [
                {"id": e.id, "entry_number": e.entry_number, "description": e.description}
                for e in entries
            ],
        })


class FixedAssetDisposeView(APIView):
    """POST /api/accounting/assets/{id}/dispose/

    Lepas/jual aset: hapus dari buku, akui untung/rugi pelepasan. Satu-satunya
    jalur resmi ke status DISPOSED -- lihat FixedAssetUpdateSerializer.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request, pk):
        asset = get_object_or_404(FixedAsset, pk=pk)
        serializer = FixedAssetDisposeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            asset = serializer.save(asset=asset, actor=request.user)
        except DjangoValidationError as exc:
            return Response({"detail": getattr(exc, "messages", [str(exc)])}, status=status.HTTP_400_BAD_REQUEST)
        return Response(FixedAssetReadSerializer(asset).data)

