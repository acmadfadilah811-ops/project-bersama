"""Akun Unit Bisnis (2026-10-11) -- akun pengganti & departemen per unit.

GET   /api/accounting/akun-unit-bisnis/        semua unit bisnis + pengaturan akunnya
PATCH /api/accounting/akun-unit-bisnis/{unit_id}/
      {order_sales_revenue_account, pos_sales_revenue_account, pos_cogs_expense_account,
       order_hpp_expense_account, kas_tunai_account}  (id akun atau null = pakai akun umum)
"""
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import UnitBisnis
from api.permissions import IsOwnerManagerOrSpvFinance

from ..models import Department
from ..models.unit_bisnis import AkunUnitBisnis

FIELD_AKUN = (
    "order_sales_revenue_account", "pos_sales_revenue_account", "pos_cogs_expense_account",
    "order_hpp_expense_account", "kas_tunai_account",
)


class AkunUnitBisnisSerializer(serializers.ModelSerializer):
    unit_bisnis_nama = serializers.CharField(source="unit_bisnis.nama", read_only=True)
    department_nama = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = AkunUnitBisnis
        fields = ["unit_bisnis", "unit_bisnis_nama", "department", "department_nama", *FIELD_AKUN]
        read_only_fields = ["unit_bisnis", "department"]

    def validate(self, attrs):
        for field in FIELD_AKUN:
            akun = attrs.get(field)
            if akun is not None and not akun.is_active:
                raise serializers.ValidationError({field: f"Akun {akun.code} tidak aktif."})
        return attrs


@transaction.atomic
def pastikan_konfigurasi(unit):
    """Baris Akun Unit Bisnis + Departemen bernama sama dengan unit."""
    cfg, _ = AkunUnitBisnis.objects.get_or_create(unit_bisnis=unit)
    if cfg.department_id is None:
        dept, _ = Department.objects.get_or_create(name=unit.nama[:100])
        if not AkunUnitBisnis.objects.filter(department=dept).exclude(pk=cfg.pk).exists():
            cfg.department = dept
            cfg.save(update_fields=["department"])
    return cfg


class AkunUnitBisnisListView(APIView):
    permission_classes = [IsOwnerManagerOrSpvFinance]

    def get(self, request):
        data = [AkunUnitBisnisSerializer(pastikan_konfigurasi(u)).data for u in UnitBisnis.objects.order_by("nama")]
        return Response(data)


class AkunUnitBisnisDetailView(APIView):
    permission_classes = [IsOwnerManagerOrSpvFinance]

    def patch(self, request, unit_id):
        unit = UnitBisnis.objects.filter(pk=unit_id).first()
        if not unit:
            return Response({"error": "Unit bisnis tidak ditemukan."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AkunUnitBisnisSerializer(pastikan_konfigurasi(unit), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
