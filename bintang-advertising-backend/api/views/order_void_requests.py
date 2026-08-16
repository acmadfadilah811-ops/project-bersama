from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import OrderVoidRequest
from ..serializers import OrderVoidRequestSerializer
from ..services.order_void_otp import (
    VoidOtpError, setujui_permintaan_void, tolak_permintaan_void,
)


class OrderVoidRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/order-void-requests/               — owner/manager: semua permintaan
                                                     (filter ?status=pending&order=<id>)
                                                   — role lain: hanya permintaan miliknya sendiri
    POST /api/order-void-requests/{id}/setujui/     (owner/manager saja)
    POST /api/order-void-requests/{id}/tolak/       (owner/manager saja)

    Dipakai dua sisi: Owner Dashboard (list + setujui/tolak permintaan
    pending) dan panel void kasir (polling status permintaan miliknya
    sendiri sampai disetujui). Lihat api/services/order_void_otp.py untuk
    alur lengkapnya (instruksi user 2026-08-14: kasir tidak boleh
    membatalkan order tanpa persetujuan OTP owner).
    """
    serializer_class = OrderVoidRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            OrderVoidRequest.objects
            .select_related('order', 'diminta_oleh', 'disetujui_oleh')
            .order_by('-dibuat_pada')
        )
        user = self.request.user
        if getattr(user, 'role', '') not in ('owner', 'manager'):
            qs = qs.filter(diminta_oleh=user)
        order_id = self.request.query_params.get('order')
        if order_id:
            qs = qs.filter(order_id=order_id)
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
        except VoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderVoidRequestSerializer(void_request, context={'request': request}).data)

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
        except VoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderVoidRequestSerializer(void_request, context={'request': request}).data)
