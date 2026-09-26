"""Notifikasi keuangan untuk SPV Finance, Owner, Manager (2026-09-25)."""

from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.permissions import BasePermission, IsAuthenticated

from ..models import NotifikasiKeuangan


class BolehLihatNotifikasiKeuangan(BasePermission):
    """Owner, Manager, SPV Finance, Admin Finance (Admin Finance membayar gaji, tahap 4)."""

    def has_permission(self, request, view):
        return (getattr(request.user, "role", "") or "").lower() in {
            "owner", "manager", "spv_finance", "admin_finance"}


def _bentuk(n, user_id):
    return {
        "id": n.id,
        "jenis": n.jenis,
        "judul": n.judul,
        "pesan": n.pesan,
        "tautan": n.tautan,
        "dibuat": n.dibuat.isoformat(),
        "dibaca": user_id in {u.id for u in n.dibaca_oleh.all()},
    }


class NotifikasiKeuanganListView(APIView):
    """GET /api/accounting/notifikasi/ -- 30 terbaru + jumlah belum dibaca."""

    permission_classes = [IsAuthenticated, BolehLihatNotifikasiKeuangan]

    def get(self, request):
        qs = NotifikasiKeuangan.objects.prefetch_related("dibaca_oleh")
        belum = qs.exclude(dibaca_oleh=request.user).count()
        return Response({
            "belum_dibaca": belum,
            "hasil": [_bentuk(n, request.user.id) for n in qs[:30]],
        })


class NotifikasiKeuanganBacaView(APIView):
    """POST /api/accounting/notifikasi/baca/ {ids: [..]} atau {semua: true}."""

    permission_classes = [IsAuthenticated, BolehLihatNotifikasiKeuangan]

    def post(self, request):
        qs = NotifikasiKeuangan.objects.all()
        if not request.data.get("semua"):
            try:
                ids = [int(x) for x in (request.data.get("ids") or [])]
            except (TypeError, ValueError):
                return Response({"error": "ids tidak valid."}, status=400)
            qs = qs.filter(id__in=ids)
        for n in qs.exclude(dibaca_oleh=request.user):
            n.dibaca_oleh.add(request.user)
        return Response({"ok": True})
