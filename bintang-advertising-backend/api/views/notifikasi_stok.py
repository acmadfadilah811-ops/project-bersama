"""Notifikasi stok minimum untuk Owner, Manager, Admin, SPV/Admin Finance (2026-09-26)."""

from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..notifikasi_stok_models import NotifikasiStok
from ..services.notifikasi_stok import PERAN_PENERIMA, bentuk


class BolehLihatNotifikasiStok(BasePermission):
    def has_permission(self, request, view):
        return (getattr(request.user, 'role', '') or '').lower() in PERAN_PENERIMA


class NotifikasiStokListView(APIView):
    """GET /api/notifikasi-stok/ -- 30 terbaru + jumlah belum dibaca (hanya yang masih aktif)."""

    permission_classes = [IsAuthenticated, BolehLihatNotifikasiStok]

    def get(self, request):
        qs = NotifikasiStok.objects.prefetch_related('dibaca_oleh')
        return Response({
            'belum_dibaca': qs.filter(aktif=True).exclude(dibaca_oleh=request.user).count(),
            'hasil': [bentuk(n, request.user.id) for n in qs[:30]],
        })


class NotifikasiStokBacaView(APIView):
    """POST /api/notifikasi-stok/baca/ {ids: [..]} atau {semua: true}."""

    permission_classes = [IsAuthenticated, BolehLihatNotifikasiStok]

    def post(self, request):
        qs = NotifikasiStok.objects.all()
        if not request.data.get('semua'):
            try:
                ids = [int(x) for x in (request.data.get('ids') or [])]
            except (TypeError, ValueError):
                return Response({'error': 'ids tidak valid.'}, status=400)
            qs = qs.filter(id__in=ids)
        for n in qs.exclude(dibaca_oleh=request.user):
            n.dibaca_oleh.add(request.user)
        return Response({'ok': True})
