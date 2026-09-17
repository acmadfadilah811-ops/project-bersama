"""View AI Business Analyst — mengikuti pola executive_dashboard_views.py."""

import json
import logging
import os
import time

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager
from api.services.insights_bridge import build_combined_insights
from api.wa_logic import get_ai_client

from . import ai_business_analyst
from .executive_dashboard_views import _period

logger = logging.getLogger(__name__)

PERIODE_VALID = {"mtd", "qtd", "ytd", "12m"}
MAKS_RIWAYAT_PESAN = 20
MAKS_PANJANG_PESAN = 4000

SYSTEM_PROMPT_TEMPLATE = """Kamu adalah AI Business Consultant untuk owner/manager StarPhoto & Advertising \
-- bukan sekadar menjawab pertanyaan, tapi membantu pengambilan keputusan bisnis: \
identifikasi masalah/peluang dari data, dan berikan rekomendasi/solusi konkret \
yang bisa langsung ditindaklanjuti (mis. produk mana yang perlu di-diskon/stop, \
kategori mana yang perlu ditambah stok, tren mana yang perlu diwaspadai).

Setiap rekomendasi/kesimpulan WAJIB berpijak HANYA pada data snapshot di bawah \
ini -- JANGAN mengarang angka yang tidak ada di data, dan JANGAN kasih saran \
generik yang tidak nyambung ke data yang tersedia.

Kalau sebagian data bernilai null/tidak tersedia (mis. HR atau CRM sedang \
tidak bisa diakses), katakan secara eksplisit bahwa data itu tidak tersedia \
saat ini -- jangan menebak atau berasumsi datanya nol, dan jangan kasih \
rekomendasi yang bergantung pada data yang hilang itu.

Jawab dalam Bahasa Indonesia, ringkas dan actionable, gunakan format markdown \
(heading/list/table) kalau membantu keterbacaan.

Data snapshot (periode: {period}):
```json
{data}
```
"""


class AiBusinessAnalystView(APIView):
    """GET /api/ai-business-analyst/?period=mtd|qtd|ytd|12m

    Dashboard analisis bisnis lintas modul (penjualan, profitabilitas, stok,
    dst) — dibatasi owner/manager, sama seperti Dashboard Eksekutif.
    """

    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    def get(self, request):
        period, error = _period(request)
        if error:
            return error
        return Response(ai_business_analyst.build(period))


def _validasi_messages(raw_messages):
    """Balikin (messages_bersih, error_response). Terima list of
    {role: 'user'|'assistant', content: str}, dipotong ke MAKS_RIWAYAT_PESAN
    pesan terakhir supaya prompt tidak membengkak tanpa batas."""
    if not isinstance(raw_messages, list) or not raw_messages:
        return None, Response(
            {'error': "'messages' wajib berupa list non-kosong."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    bersih = []
    for pesan in raw_messages[-MAKS_RIWAYAT_PESAN:]:
        if not isinstance(pesan, dict):
            return None, Response(
                {'error': "Setiap item 'messages' harus berupa object {role, content}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role = pesan.get('role')
        content = pesan.get('content')
        if role not in ('user', 'assistant') or not isinstance(content, str) or not content.strip():
            return None, Response(
                {'error': "Setiap pesan wajib punya role 'user'/'assistant' dan content teks non-kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        bersih.append({'role': role, 'content': content[:MAKS_PANJANG_PESAN]})

    if bersih[-1]['role'] != 'user':
        return None, Response(
            {'error': "Pesan terakhir harus dari role 'user'."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return bersih, None


class AiBusinessAnalystChatView(APIView):
    """POST /api/ai-business-analyst/chat/

    Body: {"messages": [{"role": "user"|"assistant", "content": "..."}], "period": "mtd"}

    Konteks yang dikasih ke AI adalah snapshot data yang SAMA dengan yang
    dipakai Dashboard Insight Owner (Bintang+HR+CRM, lihat
    api/services/insights_bridge.py) -- bukan tool-calling real-time
    (instruksi eksplisit: cukup jawab dari data dashboard yang sudah ada).

    Response: {"reply": "..."} kalau sukses, atau {"error": "..."} dengan
    status HTTP yang sesuai kalau gagal.
    """

    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_chat'

    def post(self, request):
        period = request.data.get('period', 'ytd')
        if period not in PERIODE_VALID:
            period = 'ytd'

        messages, error = _validasi_messages(request.data.get('messages'))
        if error:
            return error

        client = get_ai_client()
        if client is None:
            return Response(
                {'error': 'AI belum dikonfigurasi (KOBOI_API_KEY kosong). Hubungi admin.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            data_snapshot = build_combined_insights(period)
        except Exception:
            logger.exception('AI Business Analyst chat: gagal membangun data snapshot.')
            return Response(
                {'error': 'Gagal mengambil data dashboard untuk konteks AI.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            period=period,
            data=json.dumps(data_snapshot, ensure_ascii=False, default=str),
        )
        model_name = os.getenv('AI_BUSINESS_ANALYST_MODEL') or os.getenv('KOBOI_MODEL', 'gemini-2.5-pro')

        full_messages = [{'role': 'system', 'content': system_prompt}, *messages]

        max_retries = 2
        backoff = 1.0
        response = None
        terakhir = None
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=full_messages,
                    max_tokens=1536,
                    timeout=20.0,
                )
                break
            except Exception as e:
                logger.warning('AI Business Analyst chat completion attempt %s gagal: %s', attempt + 1, e)
                terakhir = e
                if attempt < max_retries - 1:
                    time.sleep(backoff)
                    backoff *= 2.0

        if response is None:
            return Response(
                {'error': f'Koneksi ke AI gagal setelah retry: {terakhir}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        if not getattr(response, 'choices', None) or not response.choices[0].message.content:
            return Response(
                {'error': 'AI tidak memberikan jawaban. Coba lagi.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'reply': response.choices[0].message.content})
