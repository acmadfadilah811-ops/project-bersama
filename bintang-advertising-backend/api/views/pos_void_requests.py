from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..pos_models import POSVoidRequest
from ..pos_serializers import POSVoidRequestSerializer
from ..services.pos_void_otp import (
    PosVoidOtpError, setujui_permintaan_void, tolak_permintaan_void,
)


class POSVoidRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/pos-void-requests/               — owner/manager: semua permintaan
                                                   (filter ?status=pending&sale=<id>)
                                                 — role lain: hanya permintaan miliknya sendiri
    POST /api/pos-void-requests/{id}/setujui/     (owner/manager saja)
    POST /api/pos-void-requests/{id}/tolak/       (owner/manager saja)

    Padanan `OrderVoidRequestViewSet` untuk transaksi POS Lunas — dipakai
    dua sisi: Owner Dashboard (list + setujui/tolak permintaan pending) dan
    panel void kasir (polling status permintaan miliknya sendiri sampai
    disetujui). Lihat api/services/pos_void_otp.py untuk alur lengkapnya.
    """
    serializer_class = POSVoidRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            POSVoidRequest.objects
            .select_related('sale', 'diminta_oleh', 'disetujui_oleh')
            .order_by('-dibuat_pada')
        )
        user = self.request.user
        if getattr(user, 'role', '') not in ('owner', 'manager'):
            qs = qs.filter(diminta_oleh=user)
        sale_id = self.request.query_params.get('sale')
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def _ensure_approver(self):
        if getattr(self.request.user, 'role', '') not in ('owner', 'manager'):
            raise PermissionDenied('Hanya Owner atau Manager yang dapat menyetujui/menolak permintaan void.')

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def setujui(self, request, pk=None):
        self._ensure_approver()
        void_request = self.get_object()
        try:
            void_request = setujui_permintaan_void(void_request=void_request, approver=request.user)
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(POSVoidRequestSerializer(void_request, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def tolak(self, request, pk=None):
        self._ensure_approver()
        void_request = self.get_object()
        alasan_tolak = str(request.data.get('alasan_tolak') or request.data.get('alasan') or '').strip()
        try:
            void_request = tolak_permintaan_void(
                void_request=void_request, approver=request.user, alasan_tolak=alasan_tolak,
            )
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(POSVoidRequestSerializer(void_request, context={'request': request}).data)
