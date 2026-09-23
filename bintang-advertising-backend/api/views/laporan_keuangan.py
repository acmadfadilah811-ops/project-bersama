"""Laporan Kerja Harian Admin Finance & SPV Finance: target & kendala
operasional (input manual, LaporanTargetKeuanganViewSet) + ringkasan data
keuangan nyata dari CashTransaction/Purchase (RingkasanKeuanganFinanceView,
read-only). Instruksi user 2026-09-24, pola sama dengan Laporan Produksi
(api/views/laporan_produksi.py) tapi lingkup keuangan (tanpa divisi).

Hierarki (keputusan user): Admin Finance = eksekutor, hanya melihat &
mengelola laporannya sendiri. SPV Finance = pengawas, melihat laporan
miliknya sendiri DITAMBAH seluruh laporan Admin Finance (tapi tidak bisa
mengubah/menghapus milik orang lain). Owner/Manager melihat semua.
"""
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..finance_models import CashTransaction
from ..laporan_keuangan_models import LaporanTargetKeuangan
from ..laporan_keuangan_serializers import LaporanTargetKeuanganSerializer
from ..permissions import IsFinanceRoleOrOwnerManager
from ..product_models import Purchase


def _scoped_laporan_qs(user, params):
    """Queryset LaporanTargetKeuangan + filter query param -- dipakai
    ViewSet DAN export, supaya keduanya selalu menampilkan baris yang
    sama persis (tidak boleh menyimpang)."""
    qs = LaporanTargetKeuangan.objects.select_related('dibuat_oleh').order_by('-tanggal_mulai', '-id')
    if user.role == 'admin_finance':
        qs = qs.filter(dibuat_oleh=user)
    elif user.role == 'spv_finance':
        qs = qs.filter(Q(dibuat_oleh=user) | Q(dibuat_oleh__role='admin_finance'))

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


class LaporanTargetKeuanganViewSet(viewsets.ModelViewSet):
    """
    GET    /api/laporan-keuangan/target/       — owner/manager: semua; SPV Finance: milik sendiri + semua Admin Finance; Admin Finance: milik sendiri
    POST   /api/laporan-keuangan/target/       — owner/manager/Admin Finance/SPV Finance
    PATCH  /api/laporan-keuangan/target/{id}/  — pembuat laporan atau owner/manager
    DELETE /api/laporan-keuangan/target/{id}/  — pembuat laporan atau owner/manager
    """
    serializer_class = LaporanTargetKeuanganSerializer
    permission_classes = [IsAuthenticated, IsFinanceRoleOrOwnerManager]

    def get_queryset(self):
        return _scoped_laporan_qs(self.request.user, self.request.query_params)

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if user.role in ('admin_finance', 'spv_finance') and instance.dibuat_oleh_id != user.id:
            raise PermissionDenied('Anda hanya dapat mengubah laporan yang Anda buat sendiri.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role in ('admin_finance', 'spv_finance') and instance.dibuat_oleh_id != user.id:
            raise PermissionDenied('Anda hanya dapat menghapus laporan yang Anda buat sendiri.')
        instance.delete()


class RingkasanKeuanganFinanceView(APIView):
    """GET /api/laporan-keuangan/ringkasan/?tanggal_dari=YYYY-MM-DD&tanggal_sampai=YYYY-MM-DD
    Data keuangan NYATA (bukan input manual): jumlah CashTransaction yang
    diverifikasi Admin Finance + jumlah Purchase yang dibuat, dalam
    rentang. Default rentang hari ini kalau tidak diisi. Admin Finance
    hanya melihat kerjanya sendiri; SPV Finance/Owner/Manager melihat
    seluruh tim Admin Finance (pengawasan)."""
    permission_classes = [IsAuthenticated, IsFinanceRoleOrOwnerManager]

    def get(self, request):
        tanggal_dari = parse_date(request.query_params.get('tanggal_dari') or '')
        tanggal_sampai = parse_date(request.query_params.get('tanggal_sampai') or '')
        if not tanggal_dari or not tanggal_sampai:
            today = timezone.localdate()
            tanggal_dari = tanggal_sampai = today
        if tanggal_dari > tanggal_sampai:
            raise ValidationError({'error': 'tanggal_dari tidak boleh setelah tanggal_sampai.'})

        user = request.user
        verifikasi_qs = CashTransaction.objects.filter(
            diverifikasi_admin_finance_pada__date__gte=tanggal_dari,
            diverifikasi_admin_finance_pada__date__lte=tanggal_sampai,
        )
        pengadaan_qs = Purchase.objects.filter(tanggal__gte=tanggal_dari, tanggal__lte=tanggal_sampai)
        if user.role == 'admin_finance':
            verifikasi_qs = verifikasi_qs.filter(diverifikasi_admin_finance_oleh=user)
            pengadaan_qs = pengadaan_qs.filter(dibuat_oleh=user)
        else:
            # SPV Finance/Owner/Manager: pengawasan seluruh tim Admin Finance.
            verifikasi_qs = verifikasi_qs.filter(diverifikasi_admin_finance_oleh__role='admin_finance')
            pengadaan_qs = pengadaan_qs.filter(dibuat_oleh__role='admin_finance')

        return Response({
            'tanggal_dari': tanggal_dari,
            'tanggal_sampai': tanggal_sampai,
            'jumlah_transaksi_diverifikasi': verifikasi_qs.count(),
            'jumlah_pengadaan_dibuat': pengadaan_qs.count(),
        })


class ExportLaporanKeuanganView(APIView):
    """GET /api/export/laporan-keuangan/?tanggal_dari=&tanggal_sampai=&periode_tipe=
    Export laporan target & kendala operasional keuangan ke Excel -- baris
    & scoping IDENTIK dengan LaporanTargetKeuanganViewSet (lihat
    _scoped_laporan_qs), kolom aktual/capaian dihitung ulang server-side."""
    permission_classes = [IsAuthenticated, IsFinanceRoleOrOwnerManager]

    def get(self, request):
        import openpyxl

        qs = _scoped_laporan_qs(request.user, request.query_params)
        serializer = LaporanTargetKeuanganSerializer(qs, many=True, context={'request': request})

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = (
            f'attachment; filename="laporan_kerja_keuangan_{timezone.now().strftime("%Y%m%d_%H%M")}.xlsx"'
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Laporan Kerja Keuangan'
        ws.append([
            'Periode', 'Tanggal Mulai', 'Tanggal Selesai', 'Target Transaksi',
            'Aktual', 'Capaian (%)', 'Kendala Operasional', 'Catatan',
            'Dibuat Oleh', 'Dibuat Pada',
        ])
        for row in serializer.data:
            ws.append([
                row['periode_tipe'], str(row['tanggal_mulai']), str(row['tanggal_selesai']),
                row['target_transaksi'], row['jumlah_transaksi_aktual'], row['capaian_persen'],
                row['kendala_operasional'], row['catatan'], row['dibuat_oleh_nama'] or '-',
                str(row['dibuat_pada']),
            ])
        wb.save(response)
        return response
