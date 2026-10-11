"""Endpoint pesanan sesi foto StarFoto (2026-10-11). Logika di services/starfoto.py.

GET/POST/PATCH/DELETE /api/starfoto/paket/          master info paket foto (tulis: Owner/Manager/Admin)
GET/PATCH             /api/starfoto/pengaturan/     DP minimal, durasi, studio, tahap (tulis: Owner/Manager)
GET   /api/starfoto/pesanan/?status=menunggu_kasir  daftar pesanan foto (kasir & petugas sesi)
GET   /api/starfoto/pesanan/{id}/
POST  /api/starfoto/pesanan/{id}/usulan/            {addon_id | product_id, variant_id?, qty, catatan}
DELETE /api/starfoto/usulan/{id}/                   hapus usulan yang belum diputuskan
POST  /api/starfoto/pesanan/{id}/konfirmasi/        {usulan:[{id, setuju, alasan}], pilihan_file:[...],
                                                     catatan_file, spk:{deadline, deadline_jam}}  (kasir)
GET   /api/starfoto/sesi-saya/?tanggal=YYYY-MM-DD   sesi milik fotografer/asisten yang login
POST  /api/starfoto/sesi/{id}/mulai/  |  /selesai/
GET   /api/starfoto/jadwal/?dari=&sampai=           kalender sesi (kasir)
Pesanan dibuat lewat POST /api/orders/checkout-pos/ dengan blok `starfoto`.
"""
import datetime

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsClockedIn, IsOwnerManagerAdminOrKasir
from ..serializers_starfoto import (
    PaketFotoSerializer, PesananFotoSerializer, SesiFotoSerializer, UsulanTambahanSerializer,
)
from ..services import starfoto as svc
from ..starfoto_models import PaketFoto, PesananFoto, SesiFoto, UsulanTambahan


class _BacaSemuaTulisPengelola(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or user.role in ('owner', 'manager', 'admin')


class PaketFotoViewSet(viewsets.ModelViewSet):
    queryset = PaketFoto.objects.select_related('product', 'addon_tambah_orang').all()
    serializer_class = PaketFotoSerializer
    permission_classes = [_BacaSemuaTulisPengelola]


class PengaturanStarfotoView(APIView):
    def get_permissions(self):
        return [IsAuthenticated()]

    def get(self, request):
        return Response(svc.pengaturan())

    def patch(self, request):
        if request.user.role not in ('owner', 'manager'):
            return Response({'error': 'Hanya Owner/Manager yang dapat mengubah Pengaturan StarFoto.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(svc.simpan_pengaturan(request.data))


class PesananFotoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PesananFotoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = PesananFoto.objects.select_related(
            'order', 'paket_item__product__paket_foto',
        ).prefetch_related(
            'sesi__fotografer', 'sesi__asisten', 'usulan__addon', 'usulan__product', 'usulan__variant',
            'usulan__diusulkan_oleh', 'pilihan_file',
        )
        if user.role not in svc.ROLE_KASIR:
            qs = qs.filter(Q(sesi__fotografer=user) | Q(sesi__asisten=user)).distinct()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__in=status_param.split(','))
        return qs.exclude(order__status_global='batal')

    @action(detail=True, methods=['post'], url_path='usulan')
    def usulan(self, request, pk=None):
        self.get_object()  # 404 bila bukan petugas sesi/kasir
        usulan = svc.usulkan(pk, request.user, request.data)
        return Response(UsulanTambahanSerializer(usulan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='konfirmasi', permission_classes=[IsOwnerManagerAdminOrKasir])
    def konfirmasi(self, request, pk=None):
        get_object_or_404(PesananFoto, pk=pk)
        pesanan, jobs = svc.konfirmasi(pk, request.user, request.data)
        data = PesananFotoSerializer(self.get_queryset().get(pk=pesanan.pk)).data
        data['jobs'] = jobs
        return Response(data)


class UsulanTambahanDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        get_object_or_404(UsulanTambahan, pk=pk)
        svc.hapus_usulan(pk, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SesiSayaView(APIView):
    permission_classes = [IsAuthenticated, IsClockedIn]

    def get(self, request):
        tanggal = parse_date(request.query_params.get('tanggal') or '') or timezone.localdate()
        qs = SesiFoto.objects.select_related(
            'pesanan__order', 'pesanan__paket_item', 'fotografer', 'asisten',
        ).filter(Q(fotografer=request.user) | Q(asisten=request.user)).filter(
            Q(mulai__date=tanggal) | Q(status='berlangsung'),
        ).exclude(pesanan__order__status_global='batal')
        return Response(SesiFotoSerializer(qs, many=True).data)


class SesiAksiView(APIView):
    permission_classes = [IsAuthenticated, IsClockedIn]

    def post(self, request, pk, aksi):
        get_object_or_404(SesiFoto, pk=pk)
        if aksi == 'mulai':
            sesi = svc.mulai_sesi(pk, request.user)
        elif aksi == 'selesai':
            sesi = svc.selesai_sesi(pk, request.user)
        else:
            return Response({'error': 'Aksi tidak dikenal.'}, status=status.HTTP_404_NOT_FOUND)
        sesi.refresh_from_db()
        return Response(SesiFotoSerializer(sesi).data)


class JadwalSesiView(APIView):
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def get(self, request):
        dari = parse_date(request.query_params.get('dari') or '') or timezone.localdate()
        sampai = parse_date(request.query_params.get('sampai') or '') or dari + datetime.timedelta(days=6)
        if (sampai - dari).days > 62:
            return Response({'error': 'Rentang jadwal maksimal 62 hari.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SesiFotoSerializer(svc.jadwal(dari, sampai), many=True).data)
