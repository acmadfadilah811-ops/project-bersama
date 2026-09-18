"""Endpoint admin prompt & tools bot WA AI -- lihat
api/services/wa_bot_config_admin.py. Owner/Manager only (mengubah
perilaku AI ke SEMUA pelanggan), sama seperti wa_pricelist.py."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsStrictOwnerOrManager
from ..services import wa_bot_config_admin as svc


class WaBotPromptView(APIView):
    """GET/PATCH /api/wa-bot-config/prompt/"""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        return Response({'prompt': svc.get_prompt()})

    def patch(self, request):
        try:
            nilai = svc.update_prompt(request.data.get('prompt'))
            return Response({'prompt': nilai})
        except svc.WaBotConfigError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WaBotToolsListView(APIView):
    """GET /api/wa-bot-config/tools/"""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        return Response({'tools': svc.get_semua_tools()})


class WaBotToolDetailView(APIView):
    """PATCH /api/wa-bot-config/tools/<nama>/ -- body {aktif, deskripsi}"""
    permission_classes = [IsStrictOwnerOrManager]

    def patch(self, request, nama):
        try:
            data = svc.update_tool(nama, request.data.get('aktif', True), request.data.get('deskripsi'))
            return Response(data)
        except svc.WaBotConfigError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WaBotAiCredentialsView(APIView):
    """GET/PATCH /api/wa-bot-config/ai-credentials/ -- api key (masked di
    GET) + base URL + model KoboiLLM."""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        return Response(svc.get_ai_credentials())

    def patch(self, request):
        data = svc.update_ai_credentials(
            api_key=request.data.get('api_key'),
            base_url=request.data.get('base_url'),
            model=request.data.get('model'),
        )
        return Response(data)


class WaBotAiTestConnectionView(APIView):
    """POST /api/wa-bot-config/ai-credentials/test/ -- body {api_key?,
    base_url?, model?} (kosong = pakai yang sudah tersimpan/env), balas
    hasil panggilan chat completion nyata (bukan cuma cek field terisi)."""
    permission_classes = [IsStrictOwnerOrManager]

    def post(self, request):
        hasil = svc.test_ai_connection(
            api_key=request.data.get('api_key'),
            base_url=request.data.get('base_url'),
            model=request.data.get('model'),
        )
        return Response(hasil)
