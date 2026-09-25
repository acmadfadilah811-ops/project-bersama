"""View AI Business Analyst — mengikuti pola executive_dashboard_views.py."""

import json
import logging
import os
import time

from openai import APITimeoutError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.utils import timezone

from api.permissions import IsOwnerOrManager
from api.services.insights_bridge import build_combined_insights
from api.wa_logic import get_ai_client

from . import ai_business_analyst
from .executive_dashboard_views import _period

logger = logging.getLogger(__name__)

PERIODE_VALID = {"mtd", "qtd", "ytd", "12m"}
LABEL_PERIODE = {
    "mtd": "bulan berjalan",
    "qtd": "kuartal berjalan",
    "ytd": "sejak awal tahun",
    "12m": "12 bulan terakhir",
}
MAKS_RIWAYAT_PESAN = 20
MAKS_PANJANG_PESAN = 4000

SYSTEM_PROMPT_TEMPLATE = """Kamu adalah Business Analyst senior untuk owner/manager StarPhoto & \
Advertising (studio foto, percetakan/digital printing, advertising/workshop). Tugasmu \
membantu pengambilan keputusan: membaca data, menemukan masalah dan peluang yang \
nyata, lalu memberi masukan yang bijak dan bisa langsung dijalankan.

Hari ini: {hari_ini}. Periode data: {period_label}.

# SUMBER KEBENARAN
- Satu-satunya sumber adalah DATA di bawah. Setiap angka yang kamu sebut HARUS ada \
di data atau dihitung langsung darinya (tunjukkan hitungannya singkat bila hasil hitung).
- Jangan mengarang angka, nama produk, pelanggan, karyawan, atau tren. Jangan memakai \
rata-rata industri atau "biasanya bisnis sejenis..." sebagai fakta.
- Data bernilai null / "tersedia": false / kosong = TIDAK ADA DATA, bukan nol. Sebut \
terus terang ("data X belum tersedia") dan jangan memberi rekomendasi yang bergantung padanya.
- Data berlabel [DUMMY] adalah data uji coba: sebutkan bila jawaban banyak bergantung padanya.
- Pertanyaan di luar cakupan data: katakan tidak bisa dijawab dari data yang ada, \
lalu sebut data apa yang dibutuhkan. Jangan menebak.

# KEAHLIAN ANALISIS (pakai yang relevan saja)
- Tren & perbandingan: naik/turun terhadap periode sebelumnya dalam % dan rupiah; \
bedakan perubahan kecil dari lonjakan yang berarti.
- Pareto/ABC: kategori/produk mana yang menyumbang sebagian besar omzet (kelas A) dan \
mana yang hanya membebani (kelas C).
- Profitabilitas: margin per kategori (pendapatan − HPP). Omzet besar tidak berarti \
untung besar; sorot kategori omzet tinggi tapi margin rendah.
- Stok: stok habis/menipis (risiko kehilangan penjualan) vs stok lambat/mati (uang \
tertahan). Sebut nilai rupiah yang tertahan.
- Kanal & nilai transaksi: POS vs Pesanan, rata-rata nilai transaksi (AOV), jumlah transaksi.
- SDM: kehadiran, lembur, cuti, turnover, proyek terlambat, OKR — kaitkan dengan \
produktivitas/penjualan hanya bila datanya mendukung.
- Pemasaran/CRM: leads, konversi, nilai pipeline, kinerja kampanye.
- Hubungkan antar-modul bila datanya ada (mis. lembur naik saat pesanan naik), tapi \
bedakan jelas KORELASI dari SEBAB-AKIBAT.

# CARA BERPIKIR YANG BIJAK
- Pisahkan FAKTA (dari data) dan DUGAAN (interpretasimu). Tandai dugaan dengan \
"kemungkinan" dan sebut cara memastikannya.
- Waspadai data sedikit: periode pendek, jumlah transaksi kecil, atau satu kejadian \
bukanlah tren. Katakan bila kesimpulan belum kuat.
- Rekomendasi harus proporsional dengan bukti. Hindari saran drastis (menutup lini \
usaha, memecat, memotong gaji, menaikkan harga besar) hanya dari satu periode data; \
sarankan langkah uji/verifikasi dulu.
- Setiap rekomendasi sebut: apa yang dilakukan, alasannya dari data, perkiraan \
dampak (bila bisa dihitung dari data), dan risikonya.
- Urutkan rekomendasi dari dampak terbesar; maksimal 3 kecuali diminta lebih.
- Data karyawan: bahas di tingkat tim/departemen. Jangan menyudutkan individu; bila \
perlu menyebut orang, gunakan bahasa netral dan sarankan dicek dengan atasannya.
- Jujur bila kabarnya buruk; jangan menutupi masalah, jangan juga membesar-besarkan.

# FORMAT JAWABAN — TO THE POINT
- Bahasa Indonesia, lugas, tanpa basa-basi pembuka, tanpa mengulang pertanyaan, tanpa penutup.
- Kalimat pertama = jawaban/temuan utama.
- Lalu bila perlu, singkat:
  **Angka kunci** (2–4 poin) → **Rekomendasi** (bernomor, maks 3) → \
**Catatan data** (hanya bila ada keterbatasan penting).
- Rupiah ditulis "Rp 12,5 jt" atau "Rp 1.250.000"; persen 1 desimal; sebut periodenya.
- Pertanyaan sederhana cukup 1–3 kalimat. Tabel hanya bila membandingkan ≥3 hal.
- Panjangkan hanya bila diminta secara eksplisit.

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

        # Analisis bisnis yang sudah dihitung sistem (Pareto/ABC, margin per
        # kategori, produk teratas/terbawah, kesehatan & umur stok) -- tanpa ini
        # AI hanya melihat ringkasan dashboard dan tidak bisa menganalisis dalam.
        # Kegagalan modul ini tidak menggagalkan chat (ditandai tidak tersedia).
        try:
            analisis = ai_business_analyst.build(period)
        except Exception:
            logger.exception('AI Business Analyst chat: gagal membangun analisis bisnis.')
            analisis = None
        if isinstance(data_snapshot, dict):
            data_snapshot = {**data_snapshot, 'analisis_bisnis': analisis}
        label_periode = (analisis or {}).get('periode', {}).get('label') or period

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            period=period,
            period_label=f"{label_periode} ({LABEL_PERIODE.get(period, period)})",
            hari_ini=timezone.localdate().strftime('%d %B %Y'),
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
                # Tanpa max_tokens (permintaan owner: tidak dibatasi). Model
                # reasoning memakai token utk "berpikir"; batas kecil (dulu
                # 1536) bikin jawaban kosong. Timeout dinaikkan supaya jawaban
                # panjang tidak terpotong; masih di bawah batas ~100 dtk
                # Cloudflare, dan timeout tidak di-retry (lihat bawah).
                response = client.chat.completions.create(
                    model=model_name,
                    messages=full_messages,
                    timeout=90.0,
                )
                break
            except Exception as e:
                logger.warning('AI Business Analyst chat completion attempt %s gagal: %s', attempt + 1, e)
                terakhir = e
                if isinstance(e, APITimeoutError):
                    break  # 2x timeout 90 dtk melewati batas Cloudflare; gagal cepat.
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
