"""Halaman Nota Human Error: tanggungan staff atas reorder (2026-09-28).

Staff melihat nota miliknya sendiri; owner/manager/admin & finance melihat
semua staff (untuk ditinjau akhir bulan) dan menandai tanggungan potong gaji
yang sudah dipotong di slip gaji HR.
"""
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..reorder_models import TanggunganReorder

PENINJAU = ('owner', 'manager', 'admin', 'admin_finance', 'spv_finance')


def _nama(user):
    if not user:
        return None
    return f'{user.first_name} {user.last_name}'.strip() or user.username


def _bulan(nilai):
    try:
        tahun, bulan = (int(x) for x in str(nilai).split('-'))
        return date(tahun, bulan, 1)
    except (TypeError, ValueError):
        return None


def _baris(t):
    order = t.order
    return {
        'id': t.id,
        'order_id': order.id,
        'order_asal_id': order.reorder_dari_id,
        'pelanggan': order.nama,
        'item': [f'{it.qty}x {it.jenis_produk}' for it in order.items.all()],
        'staff_id': t.staff_id,
        'staff_nama': _nama(t.staff),
        'nominal': t.nominal,
        'metode': t.metode,
        'metode_label': t.get_metode_display(),
        'status': t.status,
        'status_label': t.get_status_display(),
        'alasan': t.alasan,
        'dibuat': t.dibuat,
        'dibuat_oleh_nama': _nama(t.dibuat_oleh),
        'ditandai_dipotong_oleh_nama': _nama(t.ditandai_dipotong_oleh),
        'ditandai_dipotong_pada': t.ditandai_dipotong_pada,
    }


class NotaHumanErrorView(APIView):
    """GET /api/nota-human-error/?bulan=YYYY-MM&staff_id=&status="""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (TanggunganReorder.objects
              .select_related('order', 'staff', 'dibuat_oleh', 'ditandai_dipotong_oleh')
              .prefetch_related('order__items'))
        peninjau = request.user.role in PENINJAU
        if peninjau:
            staff_id = request.query_params.get('staff_id')
            if staff_id:
                qs = qs.filter(staff_id=staff_id)
        else:
            qs = qs.filter(staff=request.user)

        awal = _bulan(request.query_params.get('bulan'))
        if awal:
            akhir = date(awal.year + (awal.month == 12), awal.month % 12 + 1, 1)
            qs = qs.filter(dibuat__date__gte=awal, dibuat__date__lt=akhir)
        status_filter = request.query_params.get('status')
        if status_filter in TanggunganReorder.Status.values:
            qs = qs.filter(status=status_filter)

        daftar = list(qs)
        total = {s: Decimal('0') for s in TanggunganReorder.Status.values}
        for t in daftar:
            total[t.status] += t.nominal
        return Response({
            'peninjau': peninjau,
            'ringkasan': {
                'jumlah': len(daftar),
                'total': sum(total.values(), Decimal('0')),
                'lunas_tunai': total[TanggunganReorder.Status.LUNAS],
                'menunggu_potong_gaji': total[TanggunganReorder.Status.MENUNGGU_POTONG],
                'sudah_dipotong_gaji': total[TanggunganReorder.Status.SUDAH_DIPOTONG],
            },
            'hasil': [_baris(t) for t in daftar],
        })


class NotaHumanErrorTandaiDipotongView(APIView):
    """POST /api/nota-human-error/<id>/tandai-dipotong/ -- tanggungan potong gaji
    sudah dipotong di slip gaji HR. Pencatatan akuntansinya lewat Posting Gaji
    (komponen potongan jenis Piutang karyawan); tombol ini hanya status."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in PENINJAU:
            return Response({'error': 'Hanya owner, manager, atau finance yang boleh menandai.'},
                            status=status.HTTP_403_FORBIDDEN)
        with transaction.atomic():
            t = TanggunganReorder.objects.select_for_update().filter(pk=pk).first()
            if not t:
                return Response({'error': 'Nota tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
            if t.status != TanggunganReorder.Status.MENUNGGU_POTONG:
                return Response({'error': 'Hanya nota potong gaji yang masih menunggu yang bisa ditandai.'},
                                status=status.HTTP_400_BAD_REQUEST)
            t.status = TanggunganReorder.Status.SUDAH_DIPOTONG
            t.ditandai_dipotong_oleh = request.user
            t.ditandai_dipotong_pada = timezone.now()
            t.save(update_fields=['status', 'ditandai_dipotong_oleh', 'ditandai_dipotong_pada'])
        return Response(_baris(t))
