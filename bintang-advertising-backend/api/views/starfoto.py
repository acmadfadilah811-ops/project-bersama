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

from ..models import TahapProses
from ..permissions import IsClockedIn, IsOwnerManagerAdminOrKasir
from ..serializers_starfoto import (
    PaketFotoSerializer, PesananFotoSerializer, SesiFotoSerializer, UsulanTambahanSerializer,
)
from ..services import starfoto as svc
from ..dinas_models import DinasLuar
from ..starfoto_models import PaketFoto, PesananFoto, SesiFoto, UsulanTambahan
from .dinas_luar import IsClockedInAtauDinasLuar


class _BacaSemuaTulisPengelola(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or user.role in ('owner', 'manager', 'admin')


class PaketFotoViewSet(viewsets.ModelViewSet):
    queryset = PaketFoto.objects.select_related('product__kategori', 'addon_tambah_orang').all()
    serializer_class = PaketFotoSerializer
    permission_classes = [_BacaSemuaTulisPengelola]


class PengaturanStarfotoView(APIView):
    def get_permissions(self):
        return [IsAuthenticated()]

    def get(self, request):
        data = svc.pengaturan()
        data['kantong_berikutnya'] = svc.kantong_berikutnya()
        # Untuk tampilan: menu Sesi Foto hanya untuk anggota divisi tahap Sesi/Asisten
        # atau SPV/Kordiv yang membawahi divisi itu.
        data['divisi_sesi_ids'] = sorted(set(
            TahapProses.objects.filter(pk__in=[data['tahap_sesi_id'], data['tahap_asisten_id']])
            .values_list('divisi_id', flat=True)
        ))
        user = request.user
        divisi_edit = TahapProses.objects.filter(pk=data['tahap_edit_id']).values_list('divisi_id', flat=True).first()
        if user.role in ('spv', 'kordiv'):
            from ..permissions import get_subordinate_divisi_ids
            bawahan = set(get_subordinate_divisi_ids(user))
            data['menu_sesi_foto'] = bool(set(data['divisi_sesi_ids']) & bawahan)
            data['menu_edit_foto'] = divisi_edit in bawahan
        else:
            data['menu_sesi_foto'] = user.role == 'staff' and user.divisi_id in data['divisi_sesi_ids']
            data['menu_edit_foto'] = user.role == 'staff' and divisi_edit is not None and user.divisi_id == divisi_edit
        return Response(data)

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
            'usulan__diusulkan_oleh', 'pilihan_file', 'pratinjau__pilihan_file',
        )
        if user.role not in svc.ROLE_KASIR:
            qs = qs.filter(Q(sesi__fotografer=user) | Q(sesi__asisten=user)).distinct()
        order_param = self.request.query_params.get('order')
        if order_param:
            qs = qs.filter(order_id=order_param)
        approval_param = self.request.query_params.get('approval')
        if approval_param:
            qs = qs.filter(approval_status__in=approval_param.split(','))
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
    permission_classes = [IsAuthenticated, IsClockedInAtauDinasLuar]

    def get(self, request):
        hari_ini = timezone.localdate()
        if request.query_params.get('mendatang'):
            # Semua sesi hari ini + sesi terjadwal 30 hari ke depan (2026-10-12),
            # supaya fotografer melihat jadwalnya tanpa memilih tanggal satu per satu.
            rentang = (Q(mulai__date=hari_ini) | Q(
                mulai__date__gt=hari_ini, mulai__date__lte=hari_ini + datetime.timedelta(days=30),
                status__in=['terjadwal', 'berlangsung'],
            ))
        else:
            tanggal = parse_date(request.query_params.get('tanggal') or '') or hari_ini
            rentang = Q(mulai__date=tanggal)
        qs = SesiFoto.objects.select_related(
            'pesanan__order', 'pesanan__paket_item', 'fotografer', 'asisten',
        ).filter(Q(fotografer=request.user) | Q(asisten=request.user)).filter(
            rentang | Q(status='berlangsung'),
        ).exclude(pesanan__order__status_global='batal').order_by('mulai')
        data = SesiFotoSerializer(qs, many=True).data
        # Status dinas luar milik user per sesi outdoor (untuk tombol Mulai/Selesai Dinas).
        dinas = {d.sesi_id: d for d in DinasLuar.objects.filter(staff=request.user, sesi__in=[s.id for s in qs])}
        per_id = {s.id: s for s in qs}
        for baris in data:
            d = dinas.get(baris['id'])
            baris['dinas_saya'] = {'id': d.id, 'status': d.status} if d else None
            # Insentif SPK sesi milik user (2026-10-15).
            baris['insentif'] = svc.insentif_sesi(per_id[baris['id']], user=request.user)
        return Response(data)


class SesiAksiView(APIView):
    permission_classes = [IsAuthenticated, IsClockedInAtauDinasLuar]

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


class AntreanSesiView(APIView):
    """GET  /api/starfoto/antrean-sesi/                    sesi yang belum punya fotografer/asisten
    POST /api/starfoto/antrean-sesi/{pesanan_id}/klaim/ {peran: fotografer|asisten}
    Klaim global: fotografer divisi mana pun mengambil sesi dan jadi PIC SPK-nya."""
    permission_classes = [IsAuthenticated, IsClockedIn]

    def get(self, request):
        data = []
        for sesi, peran in svc.antrean_sesi(request.user):
            baris = SesiFotoSerializer(sesi).data
            baris['peran'] = peran
            baris['insentif'] = svc.insentif_sesi(sesi, peran=peran)
            data.append(baris)
        return Response(data)

    def post(self, request, pesanan_id):
        get_object_or_404(PesananFoto, pk=pesanan_id)
        pesanan = svc.klaim(pesanan_id, request.user, str(request.data.get('peran') or 'fotografer'))
        sesi = pesanan.sesi.select_related('pesanan__order', 'pesanan__paket_item', 'fotografer', 'asisten')
        return Response(SesiFotoSerializer(sesi, many=True).data)
