"""API untuk agent/bot EKSTERNAL (n8n, AI Agent, dsb) yang bukan Evolution API
langsung -- otak percakapan boleh ada di luar Django (n8n, Chatwoot Agent Bot,
dll), tapi DATA PRODUK/HARGA/ORDER tetap lewat sini supaya selalu sinkron
dengan sumber asli (bukan salinan terpisah yang gampang basi -- instruksi
user 2026-09-10, lihat diskusi arsitektur n8n + ai-agent-chatbot).

Fail-closed by design (sama pola dengan EvolutionWebhookView): kalau
EXTERNAL_BOT_API_KEY tidak diisi di env, endpoint ini menolak SEMUA request.
"""
import logging
import os

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from django.utils.crypto import constant_time_compare

from ..services.wa_ai_tools import jalankan_tool
from ..services.order_actions import buat_order_dari_items
from ..wa_logic import cek_bahan_finishing_kurang, format_pesan_field_kurang

logger = logging.getLogger(__name__)


class _ExternalBotThrottle(AnonRateThrottle):
    """Rate limit longgar tapi ada -- endpoint ini dipanggil per giliran
    percakapan (bukan per keystroke), jadi tidak perlu seketat login."""
    rate = '120/min'


class _BaseExternalBotView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [_ExternalBotThrottle]

    def _cek_api_key(self, request):
        """Return None kalau valid, atau Response 401/500 kalau tidak.
        Fail-closed: key WAJIB dikonfigurasi di server, bukan opsional."""
        expected = os.getenv("EXTERNAL_BOT_API_KEY")
        if not expected:
            logger.error("EXTERNAL_BOT_API_KEY belum dikonfigurasi. Endpoint external-bot ditutup.")
            return Response({'error': 'External bot API belum dikonfigurasi di server.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        diberikan = request.headers.get('X-Api-Key', '') or ''
        if not diberikan or not constant_time_compare(diberikan, expected):
            logger.warning("External bot API: X-Api-Key tidak valid.")
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
        return None


class ExternalBotToolView(_BaseExternalBotView):
    """POST {tool: "cari_produk"|"hitung_harga_produk", args: {...}}

    Membungkus wa_ai_tools.jalankan_tool() -- dispatcher yang SAMA dipakai
    (kalau dipakai) tool-calling internal, jadi hasil pencarian/harga selalu
    identik dengan yang dilihat bot WA produksi, TIDAK ADA logic kedua yang
    bisa berbeda angka."""

    def post(self, request, *args, **kwargs):
        auth_error = self._cek_api_key(request)
        if auth_error:
            return auth_error

        nama_tool = str(request.data.get('tool') or '').strip()
        argumen = request.data.get('args') or {}
        if not nama_tool:
            return Response({'error': "Field 'tool' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(argumen, dict):
            return Response({'error': "Field 'args' harus berupa object."}, status=status.HTTP_400_BAD_REQUEST)

        hasil = jalankan_tool(nama_tool, argumen)
        return Response(hasil, status=status.HTTP_200_OK)


class ExternalBotBuatOrderView(_BaseExternalBotView):
    """POST bikin Order 'draft' dari data yang SUDAH terstruktur & tervalidasi
    di sisi caller (n8n/agent) -- endpoint ini TETAP validasi ulang field
    Bahan/Finishing wajib (cek_bahan_finishing_kurang, sama persis dgn yang
    dipakai jalur form WA) supaya tidak ada jalur order yang lolos tanpa
    validasi cuma karena datang dari sumber lain.

    Body:
    {
      "nomor_wa": "628...", "nama_kontak": "...", "nama_order": "...",
      "raw_detail": "... (opsional, teks asli percakapan/form)",
      "items": [
        {"jenis_produk": "...", "qty": 2, "ukuran": "2x3", "bahan": "...",
         "finishing": "...", "keterangan": "...", "file_desain_belum": true}
      ]
    }

    Harga TIDAK ditentukan di sini (selalu 0, status 'draft') -- sama seperti
    order dari WA, staff/kasir yang menetapkan harga final. Agent/bot LUAR
    TIDAK PERNAH memutuskan harga atau membuat order 'selesai' langsung.
    """

    def post(self, request, *args, **kwargs):
        auth_error = self._cek_api_key(request)
        if auth_error:
            return auth_error

        nomor_wa = str(request.data.get('nomor_wa') or '').strip()
        nama_kontak = str(request.data.get('nama_kontak') or '').strip()
        nama_order = str(request.data.get('nama_order') or '').strip() or nama_kontak
        raw_detail = str(request.data.get('raw_detail') or '')
        items = request.data.get('items')

        if not nomor_wa:
            return Response({'error': "Field 'nomor_wa' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(items, list) or not items:
            return Response({'error': "Field 'items' wajib diisi (list, minimal 1 item)."}, status=status.HTTP_400_BAD_REQUEST)

        field_kurang_list = []
        for i, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                return Response({'error': f"Item ke-{i} harus berupa object."}, status=status.HTTP_400_BAD_REQUEST)
            jenis_produk = str(item.get('jenis_produk') or '').strip()
            qty = item.get('qty')
            if not jenis_produk:
                return Response({'error': f"Item ke-{i}: 'jenis_produk' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
            if not isinstance(qty, int) or qty <= 0:
                return Response({'error': f"Item ke-{i}: 'qty' wajib angka bulat > 0."}, status=status.HTTP_400_BAD_REQUEST)

            kurang = cek_bahan_finishing_kurang(jenis_produk, item.get('bahan'), item.get('finishing'))
            if kurang:
                field_kurang_list.append((i, jenis_produk, kurang))

        if field_kurang_list:
            return Response(
                {'error': format_pesan_field_kurang(field_kurang_list), 'field_kurang': True},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order_id, _order = buat_order_dari_items(
                nomor_wa=nomor_wa,
                nama_kontak=nama_kontak,
                nama_order=nama_order,
                items=items,
                raw_detail=raw_detail,
                sumber='agent',
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'ok': True, 'order_id': order_id}, status=status.HTTP_201_CREATED)
