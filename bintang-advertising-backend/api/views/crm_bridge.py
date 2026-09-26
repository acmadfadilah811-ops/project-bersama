"""Jembatan CRM -> Bintang untuk order dari Sales (2026-09-26).

Server-ke-server, dipanggil backend CRM (bukan browser). Auth: X-Api-Key =
CRM_BRIDGE_API_KEY (kunci bersama yang sama dengan arah Bintang -> CRM),
fail-closed bila belum dikonfigurasi. Aturan bisnis: services/crm_order.py.

- GET  /api/bridge/crm/produk/?q=      cari katalog produk aktif (maks 20)
- POST /api/bridge/crm/order/          buat order draft dari CRM (idempoten per `kunci`)
- GET  /api/bridge/crm/order-status/   ?order_ids=a,b | ?crm_opportunity_id= | ?crm_user_id=
"""

import logging
import os

from django.utils.crypto import constant_time_compare
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from ..services import crm_order as svc

logger = logging.getLogger(__name__)


class CrmBridgeThrottle(AnonRateThrottle):
    scope = 'crm_bridge'
    rate = '120/min'


def _cek_kunci(request):
    expected = os.getenv('CRM_BRIDGE_API_KEY')
    if not expected:
        logger.error('CRM_BRIDGE_API_KEY belum dikonfigurasi. Jembatan CRM -> Bintang ditutup.')
        return Response({'error': 'Jembatan CRM belum dikonfigurasi di server.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    diberikan = request.headers.get('X-Api-Key', '') or ''
    if not diberikan or not constant_time_compare(diberikan, expected):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
    return None


class _Dasar(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [CrmBridgeThrottle]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self._auth_error = _cek_kunci(request)

    def handle_exception(self, exc):
        if isinstance(exc, svc.CrmOrderError):
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return super().handle_exception(exc)


class CrmProdukView(_Dasar):
    def get(self, request):
        if self._auth_error:
            return self._auth_error
        return Response({'hasil': svc.cari_produk(request.query_params.get('q'))})


class CrmOrderView(_Dasar):
    def post(self, request):
        if self._auth_error:
            return self._auth_error
        asal, baru = svc.buat_order(request.data)
        data = {**svc.bentuk_order(asal.order), 'sales_nama': asal.sales_nama, 'baru': baru}
        return Response(data, status=status.HTTP_201_CREATED if baru else status.HTTP_200_OK)


class CrmOrderStatusView(_Dasar):
    def get(self, request):
        if self._auth_error:
            return self._auth_error
        q = request.query_params
        ids = [x.strip() for x in (q.get('order_ids') or '').split(',') if x.strip()]
        opp = svc._int_atau_none(q.get('crm_opportunity_id'))
        user = svc._int_atau_none(q.get('crm_user_id'))
        if not (ids or opp or user):
            return Response({'error': 'Isi order_ids, crm_opportunity_id, atau crm_user_id.'}, status=400)
        return Response({'hasil': svc.status_order(ids, opp, user)})
