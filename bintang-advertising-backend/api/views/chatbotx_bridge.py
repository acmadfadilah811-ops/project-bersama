"""Jembatan ChatbotX -> Bintang: endpoint server-ke-server yang membungkus
9 tool AI WA bot yang sudah ada & teruji di services/wa_ai_tools.py (dipanggil
AI agent WA sekarang lewat tool-calling KoboiLLM), supaya ChatbotX (dashboard
chatbot terpisah, dalam proses migrasi -- lihat
dashboard-ai-customer-service-marketing.md & rancangan migrasi 2026-09-15)
bisa memanggil LOGIC BISNIS YANG SAMA lewat flow "callApi"-nya sendiri,
tanpa menulis ulang kalkulasi harga/validasi/pembuatan order dari nol.

Satu endpoint generik (bukan 9 endpoint terpisah) yang meneruskan ke
jalankan_tool() -- dispatcher yang sudah ada, sudah membela dirinya sendiri
dari prompt injection (context server selalu menang atas argumen yang
"disodorkan" AI, lihat docstring jalankan_tool). Endpoint ini HANYA
meneruskan; tidak menduplikasi logic keamanan itu.

Fail-closed (pola sama dengan hr_bridge.py/EvolutionWebhookView): kalau
CHATBOTX_BRIDGE_API_KEY tidak diisi di env, endpoint ini menolak SEMUA
request.

PENTING soal `context`: ChatbotX WAJIB mengisi `context.nomor` dari nomor
WhatsApp kontak yang tersimpan di Contact record-nya sendiri (data yang
sudah diverifikasi lewat koneksi channel WA, bukan dari teks bebas yang AI
"kutip" dari isi chat) -- itulah yang membuat defense di jalankan_tool()
berarti. Kalau ChatbotX mengisi context dari teks pesan mentah, defense-nya
percuma.
"""
import logging
import os

from django.utils.crypto import constant_time_compare
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from ..services.wa_ai_tools import TOOL_SCHEMAS, jalankan_tool

logger = logging.getLogger(__name__)

# Hanya tool yang memang dipaparkan ke AI (TOOL_SCHEMAS) -- BUKAN semua
# TOOL_FUNCTIONS di wa_ai_tools.py. Ada 2 fungsi di situ (cari_produk,
# hitung_harga_produk -- Product DB) yang SENGAJA tidak boleh dipanggil
# AI/eksternal lagi (lihat catatan di kepala wa_ai_tools.py: banyak produk
# nama mirip tapi harga beda total, insiden nyata 2026-09-10). Endpoint ini
# mewarisi pembatasan yang sama, bukan cuma percaya nama fungsi yang dikirim
# client.
NAMA_TOOL_DIIZINKAN = {t['function']['name'] for t in TOOL_SCHEMAS}

# Field yang tidak perlu (atau tidak pantas) muncul di ringkasan teks --
# 'ok' murni sinyal internal, sisanya metadata struktural yang sudah
# terwakili isinya lewat field lain yang lebih bermakna.
_FIELD_DIABAIKAN_DI_RINGKASAN = {'ok', 'field_kurang'}


def _ringkas_nilai(nilai, indent=0):
    """Ubah nilai JSON APA PUN (dict/list/scalar) jadi teks Indonesia yang
    siap dikirim ke pelanggan -- dipakai supaya template balasan di flow
    ChatbotX bisa seragam pakai SATU placeholder {{ringkasan}} utk kesembilan
    tool, walau bentuk hasilnya beda-beda (dict, list of dict, list of str,
    string biasa). Tidak berusaha "cantik" secara sempurna utk tiap tool --
    cukup terbaca & tidak pernah gagal/crash untuk struktur apa pun."""
    prefix = '  ' * indent
    if nilai is None:
        return ''
    if isinstance(nilai, bool):
        return 'Ya' if nilai else 'Tidak'
    if isinstance(nilai, (int, float)):
        if isinstance(nilai, float) and nilai == int(nilai):
            nilai = int(nilai)
        # Format ribuan gaya Indonesia (titik) -- sebagian besar angka di
        # sini adalah Rupiah, dan walau bukan Rupiah (mis. qty), format ini
        # tetap terbaca wajar.
        return f"{nilai:,}".replace(',', '.')
    if isinstance(nilai, str):
        return nilai
    if isinstance(nilai, dict):
        baris = []
        for k, v in nilai.items():
            if k in _FIELD_DIABAIKAN_DI_RINGKASAN:
                continue
            sub = _ringkas_nilai(v, indent + 1)
            if not sub:
                continue
            label = k.replace('_', ' ').capitalize()
            if isinstance(v, (dict, list)) and sub.count('\n') > 0:
                baris.append(f"{prefix}{label}:\n{sub}")
            else:
                baris.append(f"{prefix}{label}: {sub}")
        return '\n'.join(baris)
    if isinstance(nilai, list):
        if not nilai:
            return ''
        bagian = []
        for item in nilai:
            sub = _ringkas_nilai(item, indent)
            if not sub:
                continue
            if isinstance(item, dict):
                bagian.append(sub)
            else:
                bagian.append(f"{prefix}- {sub}")
        pemisah = '\n' if any(isinstance(i, dict) for i in nilai) else '\n'
        return pemisah.join(bagian)
    return str(nilai)


def _tambahkan_ringkasan(hasil):
    """Sisipkan hasil['ringkasan'] -- teks siap-kirim ke pelanggan -- ke
    respons tool apa pun, sukses maupun gagal. Dipakai flow ChatbotX (lihat
    apps/worker seed-wa-bot-tools.ts): SATU placeholder {{ringkasan}} di
    setiap step sendText, alih-alih 9 template berbeda per tool yang harus
    tahu bentuk JSON masing-masing tool secara spesifik."""
    if not isinstance(hasil, dict):
        return hasil
    if not hasil.get('ok'):
        hasil['ringkasan'] = str(hasil.get('error') or 'Terjadi kesalahan.')
        return hasil
    # Field paling umum berisi teks yang SUDAH diformat rapi oleh
    # wa_ai_tools.py sendiri (mis. cek_status_pesanan.status_text,
    # buat_pesanan.rekap) -- pakai apa adanya kalau ada, jangan diringkas
    # ulang (meringkas ulang teks yang sudah rapi bisa merusak formatnya).
    for field_siap_pakai in ('status_text', 'rekap', 'template', 'jawaban'):
        if hasil.get(field_siap_pakai):
            hasil['ringkasan'] = str(hasil[field_siap_pakai])
            return hasil
    hasil['ringkasan'] = _ringkas_nilai(hasil) or 'Baik, sudah saya proses.'
    return hasil


def _cek_bridge_api_key(request):
    """Return None kalau valid, atau Response 401/500 kalau tidak.
    Fail-closed: key WAJIB dikonfigurasi di server, bukan opsional."""
    expected = os.getenv("CHATBOTX_BRIDGE_API_KEY")
    if not expected:
        logger.error("CHATBOTX_BRIDGE_API_KEY belum dikonfigurasi. Endpoint ChatbotX bridge ditutup.")
        return Response(
            {'error': 'ChatbotX bridge API belum dikonfigurasi di server.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    diberikan = request.headers.get('X-Api-Key', '') or ''
    if not diberikan or not constant_time_compare(diberikan, expected):
        logger.warning("ChatbotX bridge API: X-Api-Key tidak valid.")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
    return None


class ChatbotXBridgeThrottle(AnonRateThrottle):
    """Lebih longgar dari HR bridge (30/min) -- endpoint ini dipanggil tiap
    giliran chat WA yang butuh tool, bisa cukup sering saat trafik ramai."""
    scope = 'chatbotx_bridge'
    rate = '120/min'


class ChatbotXToolCallView(APIView):
    """POST /api/bridge/chatbotx-tool/

    Body: {
      "tool": "hitung_harga_pricelist",
      "arguments": {"kategori": "banner", "qty": 5, "panjang": 2, "lebar": 1},
      "context": {"nomor": "6281234567890", "nama_pelanggan": "Budi"}
    }

    Response: apa pun yang dikembalikan tool-nya (selalu dict dgn key 'ok').
    Status HTTP 200 kalau ok:true, 422 kalau ok:false (kegagalan BISNIS --
    mis. kategori tidak dikenal, qty <= 0, field_kurang) -- BUKAN 200 utk
    keduanya seperti desain awal endpoint ini. Alasan: ChatbotX's flow
    builder membedakan jalur "success"/"error" dari sebuah callApi step
    LEWAT STATUS HTTP semata (lihat externalRequest() di
    apps/worker/.../tool-handler.ts ChatbotX -- `statusCode >= 400` =>
    error), bukan dari isi body -- kalau endpoint ini selalu balas 200,
    flow ChatbotX tidak akan pernah mengambil jalur "gagal" walau tool-nya
    sendiri bilang ok:false, dan pelanggan bisa menerima balasan sukses yang
    salah. 400/401/500 tetap khusus utk kesalahan PERMINTAAN itu sendiri
    (tool tak dikenal, bentuk field salah, auth gagal) -- bukan kegagalan
    tool.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ChatbotXBridgeThrottle]

    def post(self, request, *args, **kwargs):
        auth_error = _cek_bridge_api_key(request)
        if auth_error:
            return auth_error

        nama_tool = str(request.data.get('tool') or '').strip()
        if nama_tool not in NAMA_TOOL_DIIZINKAN:
            return Response(
                {
                    'ok': False,
                    'error': f"Tool '{nama_tool}' tidak dikenal/tidak diizinkan.",
                    'tool_tersedia': sorted(NAMA_TOOL_DIIZINKAN),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        argumen = request.data.get('arguments')
        if argumen is None:
            argumen = {}
        if isinstance(argumen, str):
            # ChatbotX's AIFunction.dataCollect hanya bisa mengumpulkan
            # atribut string datar (tidak ada tipe array/object di sana) --
            # utk tool yang butuh struktur nested (mis. buat_pesanan.items),
            # AI dituntun (lewat purpose) mengumpulkan JSON terenkode
            # sebagai SATU field string, lalu diurai di sini. String kosong/
            # whitespace dianggap "tidak ada argumen", bukan error parse.
            teks = argumen.strip()
            if not teks:
                argumen = {}
            else:
                try:
                    import json
                    argumen = json.loads(teks)
                except (ValueError, TypeError):
                    return Response(
                        {'ok': False, 'error': "'arguments' berupa teks tapi bukan JSON yang valid."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        if not isinstance(argumen, dict):
            return Response({'ok': False, 'error': "'arguments' harus berupa object (atau teks JSON yang mengurai jadi object)."}, status=status.HTTP_400_BAD_REQUEST)

        konteks = request.data.get('context')
        if konteks is None:
            konteks = {}
        if not isinstance(konteks, dict):
            return Response({'ok': False, 'error': "'context' harus berupa object."}, status=status.HTTP_400_BAD_REQUEST)

        hasil = jalankan_tool(nama_tool, argumen, konteks=konteks)
        hasil = _tambahkan_ringkasan(hasil)
        status_http = status.HTTP_200_OK if hasil.get('ok') else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response(hasil, status=status_http)


class ChatbotXToolSchemasView(APIView):
    """GET /api/bridge/chatbotx-tool-schemas/

    Kembalikan TOOL_SCHEMAS (definisi 9 tool: nama, deskripsi, parameter)
    apa adanya -- dipakai SEKALI di awal setup ChatbotX (bikin 9 AIFunction),
    bukan tiap chat, supaya deskripsi/parameter di ChatbotX selalu sinkron
    dengan definisi asli di Bintang tanpa copy-paste manual yang gampang
    ketinggalan zaman kalau TOOL_SCHEMAS diubah lagi nanti.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ChatbotXBridgeThrottle]

    def get(self, request, *args, **kwargs):
        auth_error = _cek_bridge_api_key(request)
        if auth_error:
            return auth_error
        return Response({'tools': TOOL_SCHEMAS}, status=status.HTTP_200_OK)
