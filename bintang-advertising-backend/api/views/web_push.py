"""Endpoint langganan Web Push (2026-10-21).

GET    /api/push/kunci-publik/   -> {"kunci": "<VAPID public key base64url>"}
POST   /api/push/langganan/      {endpoint, keys: {p256dh, auth}}   simpan perangkat ini
DELETE /api/push/langganan/      {endpoint}                         hapus perangkat ini
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.web_push import kunci_publik
from ..webpush_models import LanggananPush


class KunciPublikPushView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'kunci': kunci_publik()})


class LanggananPushView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = str(request.data.get('endpoint') or '').strip()
        keys = request.data.get('keys') or {}
        p256dh, auth = str(keys.get('p256dh') or ''), str(keys.get('auth') or '')
        if not endpoint.startswith('https://') or not p256dh or not auth:
            return Response({'error': 'Data langganan notifikasi tidak lengkap.'}, status=400)
        LanggananPush.objects.update_or_create(endpoint=endpoint, defaults={
            'user': request.user, 'p256dh': p256dh[:255], 'auth': auth[:255],
            'user_agent': str(request.META.get('HTTP_USER_AGENT') or '')[:255],
        })
        return Response({'detail': 'Notifikasi aktif di perangkat ini.'}, status=201)

    def delete(self, request):
        endpoint = str(request.data.get('endpoint') or '').strip()
        LanggananPush.objects.filter(endpoint=endpoint, user=request.user).delete()
        return Response(status=204)
