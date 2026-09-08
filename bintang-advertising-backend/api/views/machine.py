"""Penggunaan Mesin -- Master Mesin, Log Penggunaan, Riwayat Maintenance
(lihat api/machine_models.py untuk konteks lengkap fitur ini)."""
from django.db.models import Count, Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from rest_framework.response import Response

from ..models import Mesin, PenggunaanMesin, MaintenanceMesin
from ..serializers import (
    MesinSerializer, PenggunaanMesinSerializer, MaintenanceMesinSerializer,
)
from ..permissions import IsOwnerManagerAdminOrReadOnly, IsOwnerOrManager


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
        # ?operator= -- filter per staff, dasar tab "Log Penggunaan Mesin"
        # Owner/Manager (bisa lihat & pertanggungjawabkan per orang) dan juga
        # dipakai laporan riwayat pekerjaan staff sendiri (fitur 2026-09-09).
        operator_id = self.request.query_params.get('operator')
        if operator_id:
            queryset = queryset.filter(operator_id=operator_id)
        tanggal_mulai = self.request.query_params.get('tanggal_mulai')
        tanggal_akhir = self.request.query_params.get('tanggal_akhir')
        if tanggal_mulai:
            queryset = queryset.filter(waktu__date__gte=tanggal_mulai)
        if tanggal_akhir:
            queryset = queryset.filter(waktu__date__lte=tanggal_akhir)
        return queryset

    @action(detail=False, methods=['get'], url_path='ringkasan-staff', permission_classes=[IsOwnerOrManager])
    def ringkasan_staff(self, request):
        """GET /penggunaan-mesin/ringkasan-staff/?mesin=&tanggal_mulai=&tanggal_akhir=

        Total pemakaian per staff (operator) dalam rentang tanggal -- dasar
        panel "Ringkasan per Staff" di Penggunaan Mesin (Owner/Manager),
        supaya totalnya akurat dari SELURUH data yang match filter, bukan
        cuma dijumlah dari 1 halaman tabel yang mungkin terpotong paginasi.
        """
        queryset = self.get_queryset().exclude(operator__isnull=True)
        rows = (
            queryset
            .values('operator_id', 'operator__username', 'operator__first_name', 'operator__last_name')
            .annotate(
                total_lembar_color=Sum('lembar_color'),
                total_lembar_mono=Sum('lembar_mono'),
                total_meter=Sum('panjang_bahan_meter'),
                jumlah_entri=Count('id'),
            )
            .order_by('operator__username')
        )
        result = [
            {
                'operator_id': row['operator_id'],
                'operator_nama': (
                    f"{row['operator__first_name']} {row['operator__last_name']}".strip()
                    or row['operator__username']
                ),
                'total_klik': (row['total_lembar_color'] or 0) + (row['total_lembar_mono'] or 0),
                'total_lembar_color': row['total_lembar_color'] or 0,
                'total_lembar_mono': row['total_lembar_mono'] or 0,
                'total_meter': float(row['total_meter'] or 0),
                'jumlah_entri': row['jumlah_entri'],
            }
            for row in rows
        ]
        return Response(result)


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
