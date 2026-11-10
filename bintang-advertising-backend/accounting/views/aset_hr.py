"""Akuntansi > Daftar Aset: antrean "Aset dari HR" dan Proyeksi Penyusutan (2026-11-10)."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerManagerOrSpvFinance

from ..models import AsetHRMasuk
from ..serializers.assets import FixedAssetCreateSerializer, FixedAssetReadSerializer
from ..services import aset_hr as svc
from ..services.depreciation import proyeksi_penyusutan


class AsetHRMasukSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    harga_total = serializers.SerializerMethodField()
    kode_aset_akuntansi = serializers.CharField(source="fixed_asset.asset_code", read_only=True, default=None)
    usulan = serializers.SerializerMethodField()

    class Meta:
        model = AsetHRMasuk
        fields = [
            "id", "hr_asset_id", "kode", "nama", "kategori", "tanggal_beli", "harga", "jumlah", "harga_total",
            "pemegang", "status_hr", "keterangan", "status", "status_label", "alasan_tolak", "perlu_ditinjau",
            "fixed_asset", "kode_aset_akuntansi", "usulan", "diterima_pada", "diperbarui_pada",
        ]

    def get_harga_total(self, obj):
        return obj.harga * obj.jumlah

    def get_usulan(self, obj):
        return svc.usulan_isian(obj) if obj.status == AsetHRMasuk.Status.MENUNGGU else None


class AsetHRMasukListView(APIView):
    """GET /api/accounting/assets/dari-hr/?status=menunggu|diproses|ditolak|ditarik|tinjau"""

    permission_classes = [IsOwnerManagerOrSpvFinance]

    def get(self, request):
        qs = AsetHRMasuk.objects.select_related("fixed_asset")
        pilihan = request.query_params.get("status") or "menunggu"
        if pilihan == "tinjau":
            qs = qs.filter(perlu_ditinjau=True)
        elif pilihan in AsetHRMasuk.Status.values:
            qs = qs.filter(status=pilihan)
        jumlah = {
            "menunggu": AsetHRMasuk.objects.filter(status=AsetHRMasuk.Status.MENUNGGU).count(),
            "tinjau": AsetHRMasuk.objects.filter(perlu_ditinjau=True).count(),
        }
        return Response({"jumlah": jumlah, "hasil": AsetHRMasukSerializer(qs[:300], many=True).data})


class AsetHRMasukProsesView(APIView):
    """POST /api/accounting/assets/dari-hr/<id>/proses/ -- body sama dengan tambah aset tetap."""

    permission_classes = [IsOwnerManagerOrSpvFinance]

    def post(self, request, pk):
        masuk = get_object_or_404(AsetHRMasuk, pk=pk)
        serializer = FixedAssetCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            aset = svc.proses(masuk, serializer.validated_data, request.user)
        except DjangoValidationError as exc:
            return Response({"detail": getattr(exc, "messages", [str(exc)])}, status=status.HTTP_400_BAD_REQUEST)
        return Response(FixedAssetReadSerializer(aset).data, status=status.HTTP_201_CREATED)


class AsetHRMasukTolakView(APIView):
    """POST /api/accounting/assets/dari-hr/<id>/tolak/ {"alasan"} -- bukan aset tetap."""

    permission_classes = [IsOwnerManagerOrSpvFinance]

    def post(self, request, pk):
        masuk = get_object_or_404(AsetHRMasuk, pk=pk)
        try:
            masuk = svc.tolak(masuk, request.data.get("alasan"))
        except DjangoValidationError as exc:
            return Response({"detail": getattr(exc, "messages", [str(exc)])}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AsetHRMasukSerializer(masuk).data)


class AsetHRMasukSelesaiTinjauView(APIView):
    """POST /api/accounting/assets/dari-hr/<id>/selesai-tinjau/ -- tanda tinjau dihapus."""

    permission_classes = [IsOwnerManagerOrSpvFinance]

    def post(self, request, pk):
        masuk = get_object_or_404(AsetHRMasuk, pk=pk)
        masuk.perlu_ditinjau = False
        masuk.save(update_fields=["perlu_ditinjau", "diperbarui_pada"])
        return Response(AsetHRMasukSerializer(masuk).data)


class ProyeksiPenyusutanView(APIView):
    """GET /api/accounting/assets/proyeksi/?bulan=12 -- estimasi beban penyusutan ke depan."""

    permission_classes = [IsOwnerManagerOrSpvFinance]

    def get(self, request):
        try:
            bulan = int(request.query_params.get("bulan") or 12)
        except ValueError:
            bulan = 12
        return Response(proyeksi_penyusutan(bulan=max(1, min(bulan, 60))))
