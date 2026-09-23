"""Laporan Produksi untuk SPV: target & kendala operasional (input manual,
LaporanTargetProduksiViewSet) + ringkasan data produksi nyata dari JobBoard
(RingkasanProduksiSpvView, read-only). Instruksi user 2026-09-23.

Owner/Manager melihat semua divisi tanpa dibatasi; SPV dibatasi ke divisi
tim bawahannya sendiri (get_subordinate_user_ids), sama seperti pola
scoping JobBoardViewSet/ringkasan-tim yang sudah ada.
"""
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..laporan_produksi_models import LaporanTargetProduksi
from ..laporan_produksi_serializers import LaporanTargetProduksiSerializer
from ..models import JobBoard
from ..permissions import IsSpvOrOwnerManager, get_subordinate_divisi_ids, get_subordinate_user_ids


def _scoped_laporan_qs(user, params):
    """Queryset LaporanTargetProduksi + filter query param -- dipakai
    ViewSet DAN export, supaya keduanya selalu menampilkan baris yang
    sama persis (tidak boleh menyimpang)."""
    qs = LaporanTargetProduksi.objects.select_related('dibuat_oleh', 'divisi').order_by('-tanggal_mulai', '-id')
    if user.role == 'spv':
        divisi_ids = get_subordinate_divisi_ids(user)
        qs = qs.filter(Q(dibuat_oleh=user) | Q(divisi_id__in=divisi_ids))

    divisi_param = params.get('divisi')
    if divisi_param:
        qs = qs.filter(divisi_id=divisi_param)
    periode_param = params.get('periode_tipe')
    if periode_param:
        qs = qs.filter(periode_tipe=periode_param)
    tanggal_dari = parse_date(params.get('tanggal_dari') or '')
    tanggal_sampai = parse_date(params.get('tanggal_sampai') or '')
    if tanggal_dari:
        qs = qs.filter(tanggal_selesai__gte=tanggal_dari)
    if tanggal_sampai:
        qs = qs.filter(tanggal_mulai__lte=tanggal_sampai)
    return qs


class LaporanTargetProduksiViewSet(viewsets.ModelViewSet):
    """
    GET    /api/laporan-produksi/target/            — owner/manager: semua; SPV: milik sendiri + divisi tim bawahannya
    POST   /api/laporan-produksi/target/             — owner/manager/SPV
    PATCH  /api/laporan-produksi/target/{id}/        — pembuat laporan atau owner/manager
    DELETE /api/laporan-produksi/target/{id}/        — pembuat laporan atau owner/manager
    """
    serializer_class = LaporanTargetProduksiSerializer
    permission_classes = [IsAuthenticated, IsSpvOrOwnerManager]

    def get_queryset(self):
        return _scoped_laporan_qs(self.request.user, self.request.query_params)

    def perform_create(self, serializer):
        user = self.request.user
        divisi = serializer.validated_data.get('divisi')
        if user.role == 'spv' and divisi is not None:
            if divisi.id not in get_subordinate_divisi_ids(user):
                raise PermissionDenied('Anda hanya dapat membuat laporan untuk divisi tim Anda sendiri.')
        serializer.save(dibuat_oleh=user)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if user.role == 'spv' and instance.dibuat_oleh_id != user.id:
            raise PermissionDenied('Anda hanya dapat mengubah laporan yang Anda buat sendiri.')
        divisi = serializer.validated_data.get('divisi', instance.divisi)
        if user.role == 'spv' and divisi is not None:
            if divisi.id not in get_subordinate_divisi_ids(user):
                raise PermissionDenied('Anda hanya dapat membuat laporan untuk divisi tim Anda sendiri.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'spv' and instance.dibuat_oleh_id != user.id:
            raise PermissionDenied('Anda hanya dapat menghapus laporan yang Anda buat sendiri.')
        instance.delete()


class RingkasanProduksiSpvView(APIView):
    """GET /api/laporan-produksi/ringkasan/?tanggal_dari=YYYY-MM-DD&tanggal_sampai=YYYY-MM-DD
    Data produksi NYATA (bukan input manual) langsung dari JobBoard, dipakai
    sisi "Laporan Produksi Harian" -- default rentang hari ini kalau tidak
    diisi. Definisi "selesai" identik dengan StaffPerformanceReportView/
    ringkasan_tim/ExportJobsView (status_pekerjaan='selesai' + waktu_selesai
    dalam rentang) supaya selalu cocok dengan modul produksi.
    """
    permission_classes = [IsAuthenticated, IsSpvOrOwnerManager]

    def get(self, request):
        tanggal_dari = parse_date(request.query_params.get('tanggal_dari') or '')
        tanggal_sampai = parse_date(request.query_params.get('tanggal_sampai') or '')
        if not tanggal_dari or not tanggal_sampai:
            today = timezone.localdate()
            tanggal_dari = tanggal_sampai = today
        if tanggal_dari > tanggal_sampai:
            raise ValidationError({'error': 'tanggal_dari tidak boleh setelah tanggal_sampai.'})

        user = request.user
        scope_pic_ids = None
        if user.role == 'spv':
            scope_pic_ids = get_subordinate_user_ids(user)

        selesai_qs = JobBoard.objects.filter(
            status_pekerjaan='selesai',
            waktu_selesai__date__gte=tanggal_dari,
            waktu_selesai__date__lte=tanggal_sampai,
        )
        gagal_qs = JobBoard.objects.filter(
            status_pekerjaan__in=('gagal', 'batal'),
            waktu_selesai__date__gte=tanggal_dari,
            waktu_selesai__date__lte=tanggal_sampai,
        )
        kendala_qs = JobBoard.objects.filter(status_pekerjaan='kendala')
        if scope_pic_ids is not None:
            selesai_qs = selesai_qs.filter(pic_staff_id__in=scope_pic_ids)
            gagal_qs = gagal_qs.filter(pic_staff_id__in=scope_pic_ids)
            kendala_qs = kendala_qs.filter(pic_staff_id__in=scope_pic_ids)

        per_divisi = list(
            selesai_qs.values('tahap__divisi_id', 'tahap__divisi__nama')
            .annotate(jumlah_selesai=Count('id'))
            .order_by('-jumlah_selesai')
        )

        return Response({
            'tanggal_dari': tanggal_dari,
            'tanggal_sampai': tanggal_sampai,
            'jumlah_selesai': selesai_qs.count(),
            'jumlah_gagal_batal': gagal_qs.count(),
            'jumlah_kendala_aktif': kendala_qs.count(),
            'per_divisi': [
                {
                    'divisi_id': row['tahap__divisi_id'],
                    'divisi_nama': row['tahap__divisi__nama'] or 'Tanpa Divisi',
                    'jumlah_selesai': row['jumlah_selesai'],
                }
                for row in per_divisi
            ],
        })


class ExportLaporanProduksiView(APIView):
    """GET /api/export/laporan-produksi/?tanggal_dari=&tanggal_sampai=&divisi=&periode_tipe=
    Export laporan target & kendala operasional ke Excel -- baris & scoping
    IDENTIK dengan LaporanTargetProduksiViewSet (lihat _scoped_laporan_qs),
    kolom aktual/capaian dihitung ulang server-side (bukan disalin dari
    field tersimpan), sama seperti tampilan di UI.
    """
    permission_classes = [IsAuthenticated, IsSpvOrOwnerManager]

    def get(self, request):
        import openpyxl

        qs = _scoped_laporan_qs(request.user, request.query_params)
        serializer = LaporanTargetProduksiSerializer(qs, many=True, context={'request': request})

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = (
            f'attachment; filename="laporan_produksi_{timezone.now().strftime("%Y%m%d_%H%M")}.xlsx"'
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Laporan Produksi'
        ws.append([
            'Divisi', 'Periode', 'Tanggal Mulai', 'Tanggal Selesai', 'Target Selesai',
            'Aktual Selesai', 'Capaian (%)', 'Kendala Operasional', 'Catatan',
            'Dibuat Oleh', 'Dibuat Pada',
        ])
        for row in serializer.data:
            ws.append([
                row['divisi_nama'], row['periode_tipe'], str(row['tanggal_mulai']), str(row['tanggal_selesai']),
                row['target_selesai'], row['jumlah_selesai_aktual'], row['capaian_persen'],
                row['kendala_operasional'], row['catatan'], row['dibuat_oleh_nama'] or '-',
                str(row['dibuat_pada']),
            ])
        wb.save(response)
        return response
