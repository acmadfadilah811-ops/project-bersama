from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import OrderReturnRequest
from ..serializers import OrderReturnRequestSerializer
from ..services.order_return_otp import (
    ReturnOtpError, setujui_permintaan_return, tolak_permintaan_return,
)


class OrderReturnRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/order-return-requests/               — owner/manager: semua permintaan
                                                       (filter ?status=pending&order=<id>)
                                                     — role lain: hanya permintaan miliknya sendiri
    POST /api/order-return-requests/{id}/setujui/     (owner/manager saja)
    POST /api/order-return-requests/{id}/tolak/       (owner/manager saja)

    Padanan persis OrderVoidRequestViewSet, tapi untuk KONFIRMASI retur
    (bukan pengajuan retur itu sendiri -- itu tetap bebas lewat
    /orders/{id}/retur/ status='Tunda', tanpa OTP). Dipakai dua sisi: Owner
    Dashboard (list + setujui/tolak) dan panel retur kasir (polling status
    miliknya sendiri sampai disetujui). Lihat
    api/services/order_return_otp.py untuk alur lengkapnya (2026-09-18).
    """
    serializer_class = OrderReturnRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            OrderReturnRequest.objects
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
            raise PermissionDenied('Hanya Owner atau Manager yang dapat menyetujui/menolak permintaan konfirmasi retur.')

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def setujui(self, request, pk=None):
        self._ensure_approver()
        return_request = self.get_object()
        try:
            return_request = setujui_permintaan_return(return_request=return_request, approver=request.user)
        except ReturnOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderReturnRequestSerializer(return_request, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def tolak(self, request, pk=None):
        self._ensure_approver()
        return_request = self.get_object()
        alasan_tolak = str(request.data.get('alasan_tolak') or request.data.get('alasan') or '').strip()
        try:
            return_request = tolak_permintaan_return(
                return_request=return_request, approver=request.user, alasan_tolak=alasan_tolak,
            )
        except ReturnOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderReturnRequestSerializer(return_request, context={'request': request}).data)
