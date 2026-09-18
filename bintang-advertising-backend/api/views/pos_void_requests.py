from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..pos_models import POSVoidRequest
from ..pos_serializers import POSVoidRequestSerializer
from ..services.pos_void_otp import (
    PosVoidOtpError, setujui_kordiv_void, setujui_permintaan_void,
    tolak_kordiv_void, tolak_permintaan_void,
)

# Final approver (tahap 2 / OTP) -- juga boleh lewati tahap Kordiv sama
# sekali (shortcut dari status 'pending' langsung), lihat
# setujui_permintaan_void()/tolak_permintaan_void().
ROLE_FINAL_APPROVER = ('owner', 'manager', 'spv')


class POSVoidRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/pos-void-requests/                    — owner/manager/spv/kordiv: semua permintaan
                                                        (filter ?status=pending&sale=<id>)
                                                      — role lain: hanya permintaan miliknya sendiri
    POST /api/pos-void-requests/{id}/setujui-kordiv/  (kordiv saja -- tahap 1, pending -> menunggu_spv)
    POST /api/pos-void-requests/{id}/tolak-kordiv/    (kordiv saja -- tahap 1, pending -> ditolak)
    POST /api/pos-void-requests/{id}/setujui/         (owner/manager/spv -- tahap 2/final, generate OTP)
    POST /api/pos-void-requests/{id}/tolak/           (owner/manager/spv -- tahap 2/final)

    Padanan `OrderVoidRequestViewSet` untuk transaksi POS Lunas — dipakai
    tiga sisi: Papan Kerja Kordiv (triase tahap 1), Owner/SPV Dashboard
    (approval final tahap 2) dan panel void kasir (polling status
    permintaan miliknya sendiri sampai disetujui). Alur 2 tahap
    (Kordiv -> SPV/owner/manager) ditambahkan 2026-09-18 -- sebelumnya
    langsung 1 tahap ke owner/manager saja. Lihat
    api/services/pos_void_otp.py untuk detail state machine-nya.
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
        # Kordiv tidak pernah jadi diminta_oleh (mereka approver, bukan
        # pengaju) -- ikut disamakan dengan owner/manager/spv supaya lihat
        # semua permintaan, bukan cuma "miliknya sendiri" (yang selalu kosong).
        if getattr(user, 'role', '') not in ('owner', 'manager', 'spv', 'kordiv'):
            qs = qs.filter(diminta_oleh=user)
        sale_id = self.request.query_params.get('sale')
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def _ensure_kordiv_approver(self):
        if getattr(self.request.user, 'role', '') != 'kordiv':
            raise PermissionDenied('Hanya Koordinator Divisi yang dapat memproses tahap ini.')

    def _ensure_final_approver(self):
        if getattr(self.request.user, 'role', '') not in ROLE_FINAL_APPROVER:
            raise PermissionDenied('Hanya Owner, Manager, atau SPV yang dapat menyetujui/menolak permintaan void.')

    @action(detail=True, methods=['post'], url_path='setujui-kordiv')
    @transaction.atomic
    def setujui_kordiv(self, request, pk=None):
        self._ensure_kordiv_approver()
        void_request = self.get_object()
        try:
            void_request = setujui_kordiv_void(void_request=void_request, approver=request.user)
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(POSVoidRequestSerializer(void_request, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='tolak-kordiv')
    @transaction.atomic
    def tolak_kordiv(self, request, pk=None):
        self._ensure_kordiv_approver()
        void_request = self.get_object()
        alasan_tolak = str(request.data.get('alasan_tolak') or request.data.get('alasan') or '').strip()
        try:
            void_request = tolak_kordiv_void(
                void_request=void_request, approver=request.user, alasan_tolak=alasan_tolak,
            )
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(POSVoidRequestSerializer(void_request, context={'request': request}).data)

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
