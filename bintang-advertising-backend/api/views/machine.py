"""Penggunaan Mesin -- Master Mesin, Log Penggunaan, Riwayat Maintenance
(lihat api/machine_models.py untuk konteks lengkap fitur ini)."""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS

from ..models import Mesin, PenggunaanMesin, MaintenanceMesin
from ..serializers import (
    MesinSerializer, PenggunaanMesinSerializer, MaintenanceMesinSerializer,
)
from ..permissions import IsOwnerManagerAdminOrReadOnly


class IsOwnerManagerAdminOrOwnEntryReadCreate(BasePermission):
    """Log Penggunaan Mesin: siapa pun yang login boleh mencatat (staff di
    lini produksi adalah yang paling sering mengisi ini), tapi ubah/hapus
    entri hanya boleh oleh Owner/Manager/Admin atau operator yang membuat
    entri itu sendiri (mis. salah input, langsung dikoreksi)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if getattr(request.user, 'role', '') in ['owner', 'manager', 'admin']:
            return True
        return obj.operator_id == request.user.id


class MesinViewSet(viewsets.ModelViewSet):
    queryset = Mesin.objects.select_related('divisi').all()
    serializer_class = MesinSerializer
    permission_classes = [IsAuthenticated, IsOwnerManagerAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        tipe = self.request.query_params.get('tipe')
        if tipe:
            queryset = queryset.filter(tipe=tipe)
        aktif = self.request.query_params.get('is_active')
        if aktif is not None:
            queryset = queryset.filter(is_active=aktif in ('true', '1', 'True'))
        return queryset


class PenggunaanMesinViewSet(viewsets.ModelViewSet):
    queryset = PenggunaanMesin.objects.select_related('mesin', 'operator', 'job').all()
    serializer_class = PenggunaanMesinSerializer
    permission_classes = [IsOwnerManagerAdminOrOwnEntryReadCreate]

    def get_queryset(self):
        queryset = super().get_queryset()
        mesin_id = self.request.query_params.get('mesin')
        if mesin_id:
            queryset = queryset.filter(mesin_id=mesin_id)
        job_id = self.request.query_params.get('job')
        if job_id:
            queryset = queryset.filter(job_id=job_id)
        tanggal_mulai = self.request.query_params.get('tanggal_mulai')
        tanggal_akhir = self.request.query_params.get('tanggal_akhir')
        if tanggal_mulai:
            queryset = queryset.filter(waktu__date__gte=tanggal_mulai)
        if tanggal_akhir:
            queryset = queryset.filter(waktu__date__lte=tanggal_akhir)
        return queryset


class MaintenanceMesinViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceMesin.objects.select_related('mesin', 'dicatat_oleh').all()
    serializer_class = MaintenanceMesinSerializer
    permission_classes = [IsAuthenticated, IsOwnerManagerAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        mesin_id = self.request.query_params.get('mesin')
        if mesin_id:
            queryset = queryset.filter(mesin_id=mesin_id)
        return queryset
