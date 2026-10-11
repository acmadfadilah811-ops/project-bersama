"""Endpoint dinas luar staff (2026-10-11). Logika di services/dinas_luar.py.

GET  /api/starfoto/dinas-luar/?dari=&sampai=&staff=   rekap (staff: miliknya, SPV/Kordiv: bawahan, owner: semua)
GET  /api/starfoto/dinas-luar/aktif/                  {aktif: dinas berjalan milik user | null}
POST /api/starfoto/dinas-luar/mulai/                  multipart {sesi_id? | tujuan, alamat?, lat, lng, akurasi?, foto}
POST /api/starfoto/dinas-luar/{id}/selesai/           multipart {lat, lng, akurasi?, foto}
"""
import datetime

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..dinas_models import DinasLuar
from ..permissions import IsClockedIn
from ..serializers_starfoto import DinasLuarSerializer
from ..services import dinas_luar as svc


class IsClockedInAtauDinasLuar(BasePermission):
    """Papan sesi foto: sudah absen masuk, ATAU sedang dinas / punya sesi
    outdoor hari ini (berangkat langsung ke lokasi, tidak absen di kantor)."""
    message = IsClockedIn.message

    def has_permission(self, request, view):
        cek = IsClockedIn()
        if cek.has_permission(request, view):
            return True
        self.message = cek.message
        return svc.punya_akses_dinas(request.user)


class DinasLuarListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dari = parse_date(request.query_params.get('dari') or '') or timezone.localdate() - datetime.timedelta(days=6)
        sampai = parse_date(request.query_params.get('sampai') or '') or timezone.localdate()
        if (sampai - dari).days > 92:
            return Response({'error': 'Rentang rekap maksimal 92 hari.'}, status=status.HTTP_400_BAD_REQUEST)
        qs = svc.daftar(request.user, dari, sampai, request.query_params.get('staff'))
        return Response(DinasLuarSerializer(qs, many=True, context={'request': request}).data)


class DinasLuarAktifView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dinas = DinasLuar.objects.filter(staff=request.user, status='berjalan').select_related('sesi__pesanan__order').first()
        return Response({'aktif': DinasLuarSerializer(dinas, context={'request': request}).data if dinas else None})


class DinasLuarMulaiView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        dinas = svc.mulai(request.user, request.data, request.FILES)
        return Response(DinasLuarSerializer(dinas, context={'request': request}).data, status=status.HTTP_201_CREATED)


class DinasLuarSelesaiView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        dinas = svc.selesai(request.user, pk, request.data, request.FILES)
        return Response(DinasLuarSerializer(dinas, context={'request': request}).data)
