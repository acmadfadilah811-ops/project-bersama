from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..pos_models import POSVoidRequest
from ..pos_serializers import POSVoidRequestSerializer
from ..services.pos_void_otp import PosVoidOtpError, setujui_permintaan_void, tolak_permintaan_void

# Final approver (tahap OTP). Kordiv DIHAPUS dari alur ini 2026-09-23
# (instruksi user: void request langsung ke SPV Finance saja) -- lihat
# docstring POSVoidRequest (api/pos_models.py) untuk riwayatnya.
ROLE_FINAL_APPROVER = ('owner', 'manager', 'spv', 'spv_finance')


class POSVoidRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/pos-void-requests/            — owner/manager/spv/spv_finance: semua permintaan
                                                (filter ?status=pending&sale=<id>, status boleh
                                                daftar dipisah koma mis. "pending,menunggu_spv")
                                              — role lain: hanya permintaan miliknya sendiri
    POST /api/pos-void-requests/{id}/setujui/ (owner/manager/spv/spv_finance -- generate OTP)
    POST /api/pos-void-requests/{id}/tolak/   (owner/manager/spv/spv_finance)

    Padanan `OrderVoidRequestViewSet` untuk transaksi POS Lunas — dipakai
    Owner/SPV/SPV Finance Dashboard (approval) dan panel void kasir
    (polling status permintaan miliknya sendiri sampai disetujui). Sempat
    2 tahap (Kordiv -> SPV/owner/manager, 2026-09-18), tahap Kordiv
    dihapus 2026-09-23 -- lihat api/services/pos_void_otp.py untuk detail
    state machine-nya.
    """
    serializer_class = POSVoidRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            POSVoidRequest.objects
            .select_related('sale', 'diminta_oleh', 'disetujui_oleh', 'disetujui_kordiv_oleh')
            .order_by('-dibuat_pada')
        )
        user = self.request.user
        if getattr(user, 'role', '') not in ('owner', 'manager', 'spv', 'spv_finance'):
            qs = qs.filter(diminta_oleh=user)
        sale_id = self.request.query_params.get('sale')
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            status_list = [s.strip() for s in status_param.split(',') if s.strip()]
            if status_list:
                qs = qs.filter(status__in=status_list)
        return qs

    def _ensure_final_approver(self):
        if getattr(self.request.user, 'role', '') not in ROLE_FINAL_APPROVER:
            raise PermissionDenied('Hanya Owner, Manager, SPV, atau SPV Finance yang dapat menyetujui/menolak permintaan void.')

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def setujui(self, request, pk=None):
        self._ensure_final_approver()
        void_request = self.get_object()
        try:
            void_request = setujui_permintaan_void(void_request=void_request, approver=request.user)
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(POSVoidRequestSerializer(void_request, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def tolak(self, request, pk=None):
        self._ensure_final_approver()
        void_request = self.get_object()
        alasan_tolak = str(request.data.get('alasan_tolak') or request.data.get('alasan') or '').strip()
        try:
            void_request = tolak_permintaan_void(
                void_request=void_request, approver=request.user, alasan_tolak=alasan_tolak,
            )
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(POSVoidRequestSerializer(void_request, context={'request': request}).data)
