"""
wa_logic.py — Logika Bot WhatsApp StarPhoto & Advertising (Django)
Sistem baru: order masuk → tunggu konfirmasi staff

Alur percakapan:
  Sapaan → Tanya nama (kalau baru)
  Tanya produk/katalog → Info produk (TANPA langsung kirim form)
  Tanya harga → Jawab harga detail (TANPA form)
  Eksplisit mau order → Kirim form (1 form bisa banyak item)
  Kirim form + DATA SUDAH SESUAI → Simpan & konfirmasi
  Cek status → Tracking multi-item
  Lainnya → AI Fallback
"""

import os
import re
import difflib
import logging

logger = logging.getLogger(__name__)

# ── Peta ID tombol WA lama -> teks polos ────────────────────────────
# Bot tidak lagi PERNAH mengirim tombol (lihat wa_ai_tools.py, semua
# balasan sekarang teks dari AI agent) — tapi kalau pelanggan masih punya
# tombol lama dari sesi sebelum rebuild ini tersisa di HP-nya & sempat
# tap, mapping ini tetap dipertahankan supaya tap itu tidak nyasar,
# cukup diterjemahkan jadi pesan teks biasa & diproses lewat AI agent.
BUTTON_ID_KE_TEKS = {
    'menu_order': '1',
    'menu_produk': '2',
    'menu_status': '3',
    'produk_order': 'mau order',
    'produk_detail': 'tanya detail katalog',
    'produk_lainnya': 'pertanyaan lainnya',
}


def get_business_name():
    from .models import SystemConfig
    try:
        return SystemConfig.objects.get(key='bisnis_nama').value or 'StarPhoto & Advertising'
    except Exception as e:
        logger.warning(f"Gagal mengambil nama bisnis: {e}")
        return 'StarPhoto & Advertising'


# ── AI Client (KoboiLLM — OpenAI-compatible) ──────────────────────────
def get_ai_client():
    from openai import OpenAI
    api_key = os.getenv("KOBOI_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
    if not api_key:
        return None
    base_url = os.getenv("KOBOI_BASE_URL", "https://api.koboillm.com/v1")
    if "koboillm" in base_url.lower() and not api_key.startswith("sk-"):
        api_key = f"sk-{api_key}"
    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=15.0  # Prevent hanging connection indefinitely
    )

# Logging is configured at the top of the file

# ── State in cache (production-ready & shared across processes) ───────
class CacheSet:
    def __init__(self, cache_prefix="wa_menunggu_nama_"):
        self.prefix = cache_prefix
        
    def __contains__(self, item):
        from django.core.cache import cache
        return cache.get(f"{self.prefix}{item}", False)
        
    def add(self, item):
        from django.core.cache import cache
        cache.set(f"{self.prefix}{item}", True, timeout=3600) # 1 jam timeout
        
    def discard(self, item):
        from django.core.cache import cache
        cache.delete(f"{self.prefix}{item}")


class CacheState:
    """Sama seperti CacheSet, tapi simpan payload (bukan cuma boolean) — dipakai
    utk state antar-pesan yang butuh diingat konteksnya: data form order yang
    sudah diparse sambil menunggu konfirmasi 'sesuai' (`pending_order_form`,
    lihat views/whatsapp.py)."""
    def __init__(self, cache_prefix, timeout=1800):
        self.prefix = cache_prefix
        self.timeout = timeout

    def get(self, item):
        from django.core.cache import cache
        return cache.get(f"{self.prefix}{item}")

    def set(self, item, value):
        from django.core.cache import cache
        cache.set(f"{self.prefix}{item}", value, timeout=self.timeout)

    def discard(self, item):
        from django.core.cache import cache
        cache.delete(f"{self.prefix}{item}")

    def __contains__(self, item):
        return self.get(item) is not None


menunggu_nama = CacheSet()
pending_order_form = CacheState(cache_prefix="wa_pending_order_form_")


def ekstrak_nama_dari_pesan(pesan):
    """
    Ekstrak nama bersih dari kalimat jawaban pelanggan.
    Contoh:
      "Halo nama saya Budi Santoso" → "Budi Santoso"
      "saya fadil" → "Fadil"
      "panggil saja ani" → "Ani"
      "asisten bintang" → "Asisten Bintang" (tetap diambil kalau tidak ada kata sapa)
    Batas maksimal 30 karakter.
    """
    import re
    p = pesan.strip()

    # Buang kata-kata sapaan & pengantar
    prefiks = [
        r'^halo[,\s]+', r'^hai[,\s]+', r'^hi[,\s]+', r'^hey[,\s]+',
        r'^nama\s+saya\s+', r'^nama\s+aku\s+', r'^nama\s+ku\s+',
        r'^saya\s+', r'^aku\s+', r'^gue\s+', r'^gw\s+',
        r'^panggil\s+saja\s+', r'^panggil\s+aja\s+',
        r'^biasa\s+dipanggil\s+', r'^dipanggil\s+',
        r'^ini\s+', r'^dengan\s+',
        # Buang sapaan di awal lalu nama
        r'^(?:halo|hai|hi|hey)[,\s]+(?:nama\s+(?:saya|aku)\s+)?',
        r'^(?:nama\s+)?(?:saya|aku)\s+(?:adalah\s+|ialah\s+)?',
    ]

    hasil = p
    for pola in prefiks:
        hasil = re.sub(pola, '', hasil, flags=re.IGNORECASE).strip()

    # Ambil hanya bagian pertama (sebelum tanda baca atau keterangan tambahan)
    hasil = re.split(r'[,\.!\?\(\)]', hasil)[0].strip()

    # Judul/gelar di akhir (Pak, Bu, dll.) - biarkan saja
    # Batasi panjang nama
    if len(hasil) > 30:
        # Ambil max 3 kata pertama
        kata = hasil.split()
        hasil = ' '.join(kata[:3])

    # Capitalize tiap kata
    hasil = hasil.title() if hasil else pesan.strip()[:30].title()

    return hasil if len(hasil) >= 2 else pesan.strip()[:30].title()


# ════════════════════════════════════════════════════════════════
# SYSTEM PROMPT & MEMORI
# ════════════════════════════════════════════════════════════════

def get_system_prompt(nama_pelanggan=""):
    from .models import SystemConfig

    try:
        conf = SystemConfig.objects.get(pk="system_prompt")
        template_ai = conf.value
    except SystemConfig.DoesNotExist:
        biz_name = get_business_name()
        template_ai = (
            f"Kamu adalah asisten virtual {biz_name} yang sangat ramah, sopan, dan profesional.\n"
            f"Saat ini kamu sedang melayani pelanggan bernama {nama_pelanggan or 'Kakak'}.\n\n"
            "=== INFORMASI BISNIS ===\n"
            f"- Nama Bisnis: {biz_name}\n"
            "- Alamat: Sokawera\n"
            "- Jam Operasional: Senin - Sabtu, pukul 08:00 - 17:00 WIB (Hari Minggu dan hari libur nasional tutup).\n"
            "- Waktu Pengerjaan Cetak: Standar pengerjaan berkisar antara 1 s.d 3 hari kerja tergantung jenis produk dan kepadatan antrean produksi.\n\n"
            "=== ATURAN WAJIB & BATASAN RANAH ===\n"
            f"1. BATASAN RANAH (MUTLAK): Kamu HANYA boleh menjawab pertanyaan yang berkaitan langsung dengan layanan cetak, produk, info harga, status pesanan, dan informasi bisnis dari {biz_name}.\n"
            "Jika pelanggan bertanya tentang topik di luar bisnis ini (misal: politik, agama, tips umum, matematika, membantu tugas, gosip, resep makanan, curhat, dll.), Anda WAJIB menolak secara sopan dan mengarahkan kembali ke layanan cetak kami.\n"
            f"Contoh penolakan: 'Mohon maaf ya Kak, sebagai asisten virtual {biz_name}, saya hanya dapat membantu terkait informasi produk, harga, pemesanan, dan layanan cetak di {biz_name}. Ada yang bisa saya bantu terkait kebutuhan cetak Kakak? 😊'\n"
            "PENGECUALIAN PENTING: SAPAAN (mis. 'halo', 'hai', 'hay', 'pagi', 'siang', 'sore', "
            "'malam', 'assalamualaikum', 'permisi', dll., dalam bentuk/ejaan apa pun) BUKAN topik "
            "di luar bisnis -- itu cuma pembuka percakapan yang wajar. JANGAN PERNAH menolak/"
            "redirect sapaan polos seperti ini. Balas hangat & natural (boleh sebut nama pelanggan "
            "kalau tahu), lalu tanya ada yang bisa dibantu terkait cetak -- BUKAN pesan penolakan di "
            "atas (bug produksi nyata: pelanggan yang cuma bilang 'malam' atau 'hay' sempat salah "
            "dibalas pesan penolakan tsb).\n\n"
            "2. JAWAB SINGKAT & LENGKAP: Jawablah dengan santai, komunikatif, dan ringkas dalam bahasa Indonesia. Jangan bertele-tele agar jawaban tidak terpotong (truncated) di WhatsApp.\n\n"
            "3. INFORMASI TOTAL BIAYA: Setiap kali kamu memberikan estimasi total biaya atau total harga pesanan kepada pelanggan, kamu WAJIB menyertakan keterangan/catatan kaki berikut di bawah nominal harga:\n"
            "'*untuk harga tersebut belum termasuk biaya desain dan finishing ya kak, untuk rincian totalnya nanti akan di konfirmasi kembali dengan mengirimkan nota invoicenya kak😊'\n\n"
            "4. INFORMASI WAKTU PENGERJAAN & HARI INI: Jika pelanggan bertanya apakah pesanan \"bisa jadi hari ini\" atau menanyakan tentang penyelesaian cepat (express), jawablah dengan ramah dan sopan bahwa estimasi pengerjaan standar adalah 1-3 hari kerja. Jelaskan bahwa untuk pengerjaan kilat/hari ini perlu dikonfirmasi terlebih dahulu ke tim produksi kami. Minta mereka menunggu sebentar karena staff/admin manusia kami akan segera memeriksa antrean mesin dan memberikan konfirmasi langsung apakah bisa diselesaikan hari ini."
        )

    petunjuk_data = (
        "\n\n=== KAMU PUNYA TOOLS, WAJIB DIPAKAI (SANGAT KRUSIAL) ===\n"
        "Kamu terhubung langsung ke sistem asli toko lewat tools -- JANGAN PERNAH MENGARANG, "
        "MENAKSIR, ATAU MENGINGAT-INGAT harga/nama produk/status pesanan dari percakapan sebelumnya. "
        "Selalu panggil tool yang sesuai, bahkan kalau kamu 'merasa' sudah tahu jawabannya:\n"
        "- SEMUA pertanyaan produk & harga (baik jelajah umum 'ada produk apa aja' MAUPUN produk "
        "spesifik yang sudah disebut namanya, mis. 'banner 240', 'stiker cromo') -> panggil "
        "daftar_kategori_produk. Panggil TANPA parameter dulu kalau belum tahu kategorinya, lalu "
        "panggil lagi dgn parameter kategori utk detail harga referensi.\n"
        "- Pelanggan sebut qty/ukuran spesifik & minta tahu TOTAL harganya, utk kategori banner/"
        "stiker/kertas_a3/kartu_nama -> panggil hitung_harga_pricelist (kalkulator resmi dari "
        "pricelist) SETELAH tahu kategorinya dari daftar_kategori_produk. Kategori LAIN cukup pakai "
        "harga referensi dari daftar_kategori_produk apa adanya (biasanya sudah per-pcs/per-paket, "
        "tinggal dikalikan qty kalau perlu -- TETAP jangan mengarang harga per-satuan sendiri, "
        "ambil angkanya PERSIS dari teks pricelist).\n"
        "- JANGAN PERNAH sebut angka harga dari sumber lain selain daftar_kategori_produk/"
        "hitung_harga_pricelist (mis. dari 'ingatan' produk serupa) -- pricelist adalah SATU-SATUNYA "
        "acuan harga resmi ke pelanggan sekarang.\n"
        "- Pelanggan belum tahu mau pesan apa -> tawarkan produk_terlaris atau (kalau dia sebut "
        "nominal budget) produk_sesuai_budget.\n"
        "- Pelanggan tanya status pesanan -> cek_status_pesanan (kosongkan nomor_order kalau dia "
        "tidak sebut ID, sistem otomatis cari pesanan terbaru miliknya).\n"
        "- Pertanyaan umum ttg bisnis (jam buka, lokasi, kebijakan) -> cek cek_faq dulu sebelum "
        "jawab dari informasi di atas.\n"
        "- Pelanggan SIAP ORDER dan kamu SUDAH tahu semua datanya lewat percakapan (jenis produk, "
        "qty, ukuran kalau perlu, bahan, finishing) -> LANGSUNG panggil buat_pesanan, JANGAN minta "
        "pelanggan isi form kalau datanya sudah lengkap di tangan kamu. Tool ini akan menolak & "
        "kasih tahu kalau ada field wajib (Bahan/Finishing) yang masih kurang -- sampaikan pesan itu "
        "APA ADANYA ke pelanggan. Kalau tool berhasil, dia akan balas REKAP -- sampaikan rekap itu "
        "APA ADANYA dan minta pelanggan balas 'sesuai' untuk konfirmasi (sistem yang urus setelah "
        "itu, bukan tugasmu lagi).\n"
        "- Pelanggan mau order tapi datanya belum lengkap/dia lebih suka isi form sendiri (mis. order "
        "banyak item sekaligus) -> panggil ambil_template_form_order dan relay hasilnya PERSIS APA "
        "ADANYA (jangan diketik ulang).\n"
        "- Komplain, minta retur/pembatalan pesanan yang sudah selesai, minta diskon khusus, atau hal "
        "lain di luar wewenangmu -> panggil eskalasi_admin, lalu beri tahu pelanggan admin akan "
        "segera membantu. JANGAN pernah menjanjikan refund/diskon sendiri.\n"
        "- Boleh tawarkan rekomendasi/upselling produk terkait secara wajar (mis. selesai bahas "
        "banner, tawarkan X-banner/stand) -- singkat, jangan memaksa, jangan diulang kalau sudah "
        "ditolak.\n\n"
        "=== ATURAN ANTI-LOOP (WAJIB) ===\n"
        "JANGAN PERNAH meminta pelanggan mengulang/mengetik ulang pesan yang sama atau pesan serupa "
        "lebih dari satu kali dalam satu percakapan — kalau permintaan itu sudah gagal sekali (lihat "
        "riwayat chat), mengulanginya lagi hampir pasti akan gagal lagi juga. Kalau kamu benar-benar "
        "tidak tahu jawabannya, ragu, atau pelanggan sudah bilang sudah mengirim/mencoba sebelumnya: "
        "MINTA MAAF dengan jujur, JANGAN berjanji sistem otomatis akan berhasil kalau dicoba lagi, dan "
        "panggil eskalasi_admin."
    )
    return f"{template_ai}{petunjuk_data}"


def get_memori_percakapan(nomor, nama_pelanggan=""):
    from django.core.cache import cache
    cache_key = f"wa_memori_{nomor}"
    history = cache.get(cache_key)
    if not history or not isinstance(history, list) or len(history) == 0:
        history = [{"role": "system", "content": get_system_prompt(nama_pelanggan)}]
    else:
        history[0] = {"role": "system", "content": get_system_prompt(nama_pelanggan)}
    return history


def simpan_ke_memori(nomor, role, konten, nama_pelanggan=""):
    from django.core.cache import cache
    cache_key = f"wa_memori_{nomor}"
    history = get_memori_percakapan(nomor, nama_pelanggan)
    history.append({"role": role, "content": konten})
    if len(history) > 11:
        history = [history[0]] + history[-10:]
    cache.set(cache_key, history, timeout=86400) # Simpan 24 jam


# ════════════════════════════════════════════════════════════════
# TRACKING PESANAN
# ════════════════════════════════════════════════════════════════

STATUS_LABEL = {
    'antrean':    ('⏳', 'Dalam antrean, segera diproses tim kami'),
    'dikerjakan': ('🔧', 'Sedang dikerjakan oleh tim produksi'),
    'selesai':    ('✅', 'Selesai diproduksi'),
    'gagal':      ('❌', 'Terdapat kendala — mohon hubungi admin'),
}


def format_tracking(order, panggilan="Kak"):
    status_map = {
        'draft': 'Draft Penawaran',
        'quotation': 'Kirim Penawaran',
        'review': 'Menunggu Review Manager',
        'desain': 'Proses Desain',
        'proses': 'Dalam Proses Produksi',
        'ready': 'Siap Diambil / Selesai Produksi',
        'selesai': 'Selesai Seluruhnya',
        'batal': 'Dibatalkan / Cancel',
    }
    status_display = status_map.get(order.status_global, order.status_global.upper())

    lines = [
        f"📦 *STATUS PESANAN ({order.id})*",
        f"👤 *Pemesan*: {order.nama or '-'}",
        f"📋 *Status*: {status_display}",
        "",
    ]

    items = order.items.prefetch_related('jobs').all()
    if not items.exists():
        lines.append("_Belum ada item dalam pesanan ini._")
    else:
        lines.append(f"🛒 *{items.count()} Item Pesanan:*")
        for i, item in enumerate(items, 1):
            lines.append(f"\n  *{i}. {item.jenis_produk}* (qty: {item.qty})")
            latest_job = item.jobs.order_by('-id').first()
            if latest_job:
                emoji, deskripsi = STATUS_LABEL.get(
                    latest_job.status_pekerjaan,
                    ('🔄', latest_job.status_pekerjaan)
                )
                lines.append(f"     {emoji} {deskripsi}")
                if latest_job.tahap:
                    lines.append(f"     📍 Tahap: {latest_job.tahap.nama}")
            else:
                lines.append("     ⏳ Menunggu diproses")

            if item.harga_jual and item.harga_jual > 0:
                lines.append(f"     💰 Harga: Rp {item.harga_jual:,}".replace(',', '.'))

    # Tentukan footer dinamis berdasarkan status_global dan status job riil
    status = order.status_global
    has_desain_job = False
    has_proses_job = False

    for item in items:
        for job in item.jobs.all():
            if job.tahap:
                tahap_lower = job.tahap.nama.lower()
                divisi_lower = job.tahap.divisi.nama.lower() if job.tahap.divisi else ''
                if 'desain' in tahap_lower or 'design' in tahap_lower or 'desain' in divisi_lower or 'design' in divisi_lower:
                    has_desain_job = True
                if 'cetak' in tahap_lower or 'print' in tahap_lower or 'proses' in tahap_lower or 'produksi' in tahap_lower or 'cetak' in divisi_lower or 'print' in divisi_lower or 'produksi' in divisi_lower:
                    has_proses_job = True

    if status == 'batal':
        footer = f"\n_Pesanan ini telah dibatalkan. Silakan hubungi kami jika ada pertanyaan. 🙏_"
    elif status == 'selesai':
        footer = f"\n_Pesanan {panggilan} sudah selesai diserahterimakan. Terima kasih banyak atas kepercayaan Kakak pada {get_business_name()}! 😊_"
    elif status == 'ready':
        footer = f"\n_Pesanan {panggilan} sudah selesai diproduksi dan siap diambil/dikirim! Silakan hubungi admin untuk pengambilan ya Kak! 🎉_"
    elif status == 'proses' or has_proses_job:
        footer = f"\n_Pesanan {panggilan} sedang diproduksi di workshop kami. Kami akan mengabari Kakak begitu pesanan siap! 🔧_"
    elif status == 'desain' or has_desain_job:
        footer = f"\n_Pesanan {panggilan} saat ini sedang dalam tahap pembuatan desain oleh desainer kami. Mohon ditunggu ya! 🎨_"
    elif status in ('draft', 'review', 'quotation'):
        footer = f"\n_Pesanan sudah kami catat {panggilan}. Tim kami sedang memverifikasi rincian pesanan Kakak. Mohon ditunggu ya! 🙏_"
    else:
        footer = f"\n_Pesanan sudah kami catat {panggilan}. Tim kami akan segera menghubungi Kakak. Mohon ditunggu ya! 🙏_"

    lines.append(footer)
    return "\n".join(lines)


def proses_kirim_desain(pesan, nomor, nama_pelanggan, media_url=""):
    from .models import Order, OrderActivityLog
    p = pesan.lower().strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"

    is_kirim_desain = 'kirim desain' in p
    match = re.search(r'(ord-[\w-]+)', p)
    order_id = None

    # 1. Jika ada media_url dan ID order terdeteksi
    if media_url and match:
        gdrive_link = media_url
        order_id = match.group(1).upper()
    # 2. Jika ada keyword kirim desain
    elif is_kirim_desain:
        if not match:
            return (
                f"Mohon sertakan ID Pesanan Kakak untuk mengirim desain susulan.\n"
                f"Format: *Kirim Desain [ID Pesanan] [Link Google Drive]*\n"
                f"Contoh: *Kirim Desain ORD-20260606-XXXX https://drive.google.com/...*"
            )

        url_match = re.search(r'(https?://[^\s]+)', pesan)
        if not url_match and media_url:
            gdrive_link = media_url
        elif url_match:
            gdrive_link = url_match.group(1)
        else:
            return (
                f"Silakan sertakan link file desain Kakak (misal: link Google Drive atau Dropbox).\n"
                f"Contoh: *Kirim Desain {match.group(1).upper()} https://drive.google.com/...*"
            )
        order_id = match.group(1).upper()
    # 3. (2026-09-10) File/gambar dikirim TANPA ID pesanan di teks/caption --
    # kasus SANGAT UMUM (pelanggan kirim foto/dokumen polos tanpa keterangan
    # apa pun). Sebelumnya TIDAK PERNAH terdeteksi sama sekali: guard pesan
    # kosong di views/whatsapp.py men-skip total pesan tanpa caption sebelum
    # sempat sampai ke fungsi ini, dan sekalipun ada caption tanpa ID
    # pesanan, cabang di atas jatuh ke None diam-diam (bug ditemukan user).
    # Sekarang: cari pesanan aktif milik nomor ini -- auto-tautkan kalau cuma
    # 1, minta pelanggan pilih kalau >1, minta ID manual kalau tidak ada.
    elif media_url:
        orders_aktif = list(
            Order.objects.filter(nomor_wa=nomor)
            .exclude(status_global__in=['selesai', 'batal'])
            .order_by('-waktu')[:5]
        )
        if not orders_aktif:
            return (
                f"File sudah kami terima {panggilan} 🙏, tapi kami belum menemukan pesanan "
                f"aktif atas nomor ini. Boleh sebutkan ID Pesanannya ya Kak? "
                f"Contoh: *ORD-20260606-XXXX*"
            )
        if len(orders_aktif) > 1:
            daftar = "\n".join(f"- {o.id}" for o in orders_aktif)
            return (
                f"File sudah kami terima {panggilan} 🙏 Kakak punya beberapa pesanan aktif, "
                f"boleh sebutkan mau dikaitkan ke pesanan yang mana?\n\n{daftar}"
            )
        gdrive_link = media_url
        order_id = orders_aktif[0].id
    else:
        return None

    try:
        order = Order.objects.get(id__iexact=order_id)
    except Order.DoesNotExist:
        return f"Maaf {panggilan}, ID pesanan *{order_id}* tidak ditemukan. Mohon periksa kembali ya Kak 🙏"

    # Validasi nomor WA
    cleaned_input = ''.join(filter(str.isdigit, nomor))
    cleaned_db = ''.join(filter(str.isdigit, order.nomor_wa))
    if cleaned_input[-9:] != cleaned_db[-9:]:
        return f"Maaf {panggilan}, nomor WhatsApp ini tidak cocok dengan data pemesan ID *{order_id}*."

    # Simpan ke order items
    items = order.items.all()
    if not items.exists():
        return f"Belum ada item produk di pesanan *{order_id}*."

    updated = False
    for item in items:
        if not item.gdrive_customer_link or items.count() == 1:
            item.gdrive_customer_link = gdrive_link
            item.desain_susulan = True
            item.save()
            updated = True

    if not updated:
        first_item = items.first()
        first_item.gdrive_customer_link = gdrive_link
        first_item.desain_susulan = True
        first_item.save()

    # Catat di OrderActivityLog
    OrderActivityLog.objects.create(
        order=order,
        user=None,
        tindakan="SUBMIT_DESIGN_SUSULAN",
        keterangan=f"Pelanggan mengirim file desain susulan via WA: {gdrive_link}"
    )

    return (
        f"Terima kasih {panggilan}! Link desain untuk pesanan *{order_id}* berhasil kami simpan. ✅\n\n"
        f"Tim desain kami akan segera meninjau dan memproses pesanan Kakak. Mohon ditunggu ya! 😊"
    )


# ════════════════════════════════════════════════════════════════
# INFO HARGA & KALKULATOR PINTAR
# ════════════════════════════════════════════════════════════════

def _eskalasi_ke_admin(nomor, nama_pelanggan, pesan_asli, alasan):
    """Kirim notifikasi WA ke admin/manager saat bot tidak punya data pasti
    untuk jawab pelanggan — supaya ada manusia yang tahu & bisa follow up.
    TIDAK mematikan bot (`Contact.handover_to_staff` sengaja tidak disentuh
    di sini — instruksi eksplisit user: bot harus tetap aktif membalas
    pesan berikutnya, notifikasi ini cuma informasi tambahan buat admin,
    bukan serah-terima percakapan). Tidak melempar exception ke pemanggil —
    kegagalan notifikasi tidak boleh menggagalkan balasan ke pelanggan."""
    if not nomor:
        return
    try:
        from .models import CustomUser
        manager_user = CustomUser.objects.filter(role__in=['manager', 'owner'], is_active=True).first()
        if manager_user and manager_user.no_hp:
            mgr_wa = manager_user.no_hp.replace('+', '').replace(' ', '').replace('-', '')
            from .whatsapp_client import whatsapp_client
            whatsapp_client.send_text_message(
                mgr_wa,
                f"🔔 *Bot WA butuh bantuan admin* ({alasan})\n"
                f"Pelanggan {nama_pelanggan or 'Kak'} ({nomor}) tanya:\n"
                f"\"{(pesan_asli or '')[:200]}\"\n\n"
                f"Bot tidak menemukan jawaban pasti untuk ini (bot tetap aktif balas pesan lain), mohon dicek ya."
            )
    except Exception as e:
        logger.error(f"Gagal kirim notifikasi eskalasi admin untuk {nomor}: {e}")


# ════════════════════════════════════════════════════════════════
# FORM ORDER — Dikirim hanya jika pelanggan eksplisit mau order
# ════════════════════════════════════════════════════════════════

def get_form_order(nama_pelanggan="", jenis_produk="", bahan="", finishing=""):
    """`jenis_produk` (opsional) pre-fill kolom "Jenis Produk" Item 1 —
    dipakai saat pelanggan sudah sebutkan produk spesifik yang dipilih
    (dipanggil AI agent lewat tool `ambil_template_form_order`, lihat
    services/wa_ai_tools.py). `bahan`/`finishing` (opsional) pre-fill kolom yang sama kalau caller
    sudah tahu nilainya -- default kosong, pelanggan isi sendiri; validasi
    kolom wajib dilakukan saat form disubmit balik (lihat
    cek_bahan_finishing_kurang/format_pesan_field_kurang), BUKAN lewat
    tanya-interaktif sebelum form (sempat dicoba 2026-09-09, dibatalkan
    hari yang sama krn jawaban bebas pelanggan berupa pertanyaan balik
    malah kepakai mentah2 jadi isi field)."""
    from .models import SystemConfig
    nama_isi = nama_pelanggan if nama_pelanggan else ""
    produk_isi = jenis_produk if jenis_produk else ""
    bahan_isi = bahan if bahan else ""
    finishing_isi = finishing if finishing else ""
    biz_name = get_business_name()
    default_template = (
        f"📋 *FORM ORDER - {biz_name}*\n"
        f"_(Bisa isi lebih dari 1 item, copy baris Item 2 dst. jika perlu)_\n\n"
        f"👤 *Data Pemesan*\n"
        f"- Nama    : {nama_isi}\n"
        f"- No. WA  : \n\n"
        f"📦 *Item 1*\n"
        f"- Jenis Produk  : {produk_isi}\n"
        f"- Jumlah        : \n"
        f"- Ukuran        : \n"
        f"- Bahan/Material: {bahan_isi}\n"
        f"- Finishing     : {finishing_isi}\n"
        f"- File Desain   : *sudah ada* / *belum ada*\n"
        f"- Keterangan    : \n\n"
        f"📦 *Item 2 (isi jika ada, hapus jika tidak perlu)*\n"
        f"- Jenis Produk  : \n"
        f"- Jumlah        : \n"
        f"- Ukuran        : \n"
        f"- Bahan/Material: \n"
        f"- Finishing     : \n"
        f"- File Desain   : *sudah ada* / *belum ada*\n"
        f"- Keterangan    : \n\n"
        f"_ℹ️ Kolom yang tidak relevan isi dengan -*_\n"
        f"_Tambah *Item 3*, *Item 4*, dst. jika ada lebih banyak pesanan._"
    )
    try:
        conf = SystemConfig.objects.get(pk="form_order_template")
        template = conf.value
        if nama_pelanggan and "Nama    : " in template:
            template = template.replace("Nama    : ", f"Nama    : {nama_pelanggan}")
        # count=1 di semua replace di bawah: cuma isi Item 1, Item 2 dst. tetap kosong
        if jenis_produk and "Jenis Produk  : " in template:
            template = template.replace("Jenis Produk  : ", f"Jenis Produk  : {jenis_produk}", 1)
        if bahan and "Bahan/Material: " in template:
            template = template.replace("Bahan/Material: ", f"Bahan/Material: {bahan}", 1)
        if finishing and "Finishing     : " in template:
            template = template.replace("Finishing     : ", f"Finishing     : {finishing}", 1)
        return template
    except SystemConfig.DoesNotExist:
        return default_template


FORM_PEMBATALAN_PENANDA = ('id pesanan', 'alasan pembatalan')


def get_form_pembatalan():
    return (
        "📋 *FORM PEMBATALAN PESANAN*\n"
        "- ID Pesanan: \n"
        "- Alasan Pembatalan: \n\n"
        "⚠️ Isi lengkap dan kirim kembali ya Kak."
    )


def _ambil_field_pembatalan(teks, label):
    pattern = rf'{re.escape(label)}[ \t]*[:=][ \t]*(.*?)(?=\r?\n|$)'
    m = re.search(pattern, teks, re.IGNORECASE)
    if m:
        return m.group(1).strip().strip('*_')
    return ''


def proses_form_pembatalan(detail, nama_pelanggan):
    """
    Parse & proses form pembatalan. Kembalikan (balasan_ke_pelanggan,
    teks_notifikasi_admin_atau_None).

    Order BELUM 'selesai': diproses OTOMATIS lewat batalkan_order() —
    user secara eksplisit mengizinkan ini (beda dari kasus 'selesai').
    Order 'selesai': TIDAK PERNAH diproses bot — cuma dicatat
    OrderActivityLog + admin dinotifikasi, admin yang memutuskan lewat
    alur Retur manual di dashboard (lihat catatan di services/order_actions.py
    kenapa retur() tidak boleh dipanggil langsung dari bot).
    """
    from .models import Order, OrderActivityLog, CustomUser

    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    order_id = _ambil_field_pembatalan(detail, 'ID Pesanan').upper()
    alasan = _ambil_field_pembatalan(detail, 'Alasan Pembatalan')

    if not order_id:
        return (f"Mohon isi ID Pesanan-nya ya {panggilan}, contoh: ORD-20260101-ABCD 🙏", None)

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return (f"Maaf {panggilan}, pesanan dengan ID *{order_id}* tidak ditemukan.", None)

    if order.status_global == 'batal':
        return (f"Pesanan *{order_id}* sudah berstatus dibatalkan sebelumnya, {panggilan}.", None)

    if order.status_global == 'selesai':
        OrderActivityLog.objects.create(
            order=order, user=None, tindakan='REFUND_REQUEST',
            keterangan=f'[Diajukan via WhatsApp oleh pelanggan] Alasan: {alasan or "-"}',
        )
        admin_notify = (
            f"🔔 *Permintaan refund via WhatsApp*\n"
            f"Pesanan *{order_id}* (status: Selesai) — {panggilan} minta dibatalkan/refund.\n"
            f"Alasan: {alasan or '-'}\n\n"
            f"Mohon ditinjau & diproses manual lewat menu Retur."
        )
        return (
            f"Pesanan *{order_id}* sudah berstatus Selesai, jadi permintaan ini kami teruskan "
            f"ke admin untuk ditinjau & dikonfirmasi manual ya {panggilan} 🙏",
            admin_notify,
        )

    # Belum selesai — boleh diproses otomatis.
    from .services.order_actions import batalkan_order, BatalkanOrderError
    actor = CustomUser.objects.filter(role__in=['manager', 'owner'], is_active=True).first()
    if not actor:
        return (
            f"Maaf {panggilan}, permintaan belum bisa diproses otomatis saat ini. "
            f"Mohon hubungi kami langsung ya 🙏",
            None,
        )
    alasan_log = f"[Diajukan via WhatsApp] {alasan}" if alasan else "[Diajukan via WhatsApp]"
    try:
        batalkan_order(order, actor=actor, alasan=alasan_log)
    except BatalkanOrderError as e:
        return (f"Maaf {panggilan}, pesanan *{order_id}* tidak bisa dibatalkan: {e}", None)

    return (
        f"Pesanan *{order_id}* sudah kami batalkan, {panggilan}. Kalau ada pembayaran yang sudah "
        f"masuk, tim kami akan menghubungi untuk proses selanjutnya 🙏",
        None,
    )


# ════════════════════════════════════════════════════════════════
# HELPER FORM ORDER — Bahan/Material & Finishing (hanya utk produk
# yang benar-benar butuh, dicocokkan ke Product asli — tidak menebak)
# ════════════════════════════════════════════════════════════════

def _cocokkan_produk_tunggal(jenis_produk):
    """Cocokkan teks 'Jenis Produk' dari form ke satu Product nyata via
    cari_produk() -- HANYA utk validasi Bahan/Finishing (butuh_bahan/
    butuh_finishing), BUKAN utk kutip harga ke pelanggan (lihat catatan di
    kepala wa_ai_tools.py kenapa Product DB tidak lagi dipakai utk itu).
    Kembalikan None kalau tidak match persis 1 produk — sengaja TIDAK
    menebak untuk nama ambigu/tidak dikenal, biar tidak salah blokir."""
    if not jenis_produk or jenis_produk.strip().lower() == 'umum':
        return None
    from .services.wa_ai_tools import cari_produk
    from .product_models import Product

    hasil = cari_produk(jenis_produk)
    produk_list = hasil.get('produk') or []
    if len(produk_list) != 1:
        return None
    return Product.objects.filter(pk=produk_list[0]['product_id']).first()


def cek_bahan_finishing_kurang(jenis_produk, bahan, finishing):
    """Field apa saja (Bahan/Material, Finishing) yang wajib diisi tapi
    kosong, KHUSUS untuk produk yang match ke katalog nyata & memang butuh
    field itu (Product.butuh_bahan/butuh_finishing). Produk yang tidak
    match/tidak dikenal tidak pernah diblokir. Kembalikan list nama field
    kosong (list kosong = aman)."""
    produk = _cocokkan_produk_tunggal(jenis_produk)
    if not produk:
        return []
    kurang = []
    if produk.butuh_bahan and not (bahan or '').strip():
        kurang.append('Bahan/Material')
    if produk.butuh_finishing and not (finishing or '').strip():
        kurang.append('Finishing')
    return kurang


def cek_bahan_terlaris(jenis_produk, batas=3):
    """Bahan yang paling sering dipakai pelanggan lain untuk jenis produk
    yang sama — data ASLI dari OrderItem.bahan, bukan taksiran. Kembalikan
    list nama bahan (kosong kalau belum ada histori)."""
    from django.db.models import Count
    from .models import OrderItem

    if not jenis_produk or not jenis_produk.strip():
        return []
    rows = (
        OrderItem.objects
        .filter(jenis_produk__iexact=jenis_produk.strip())
        .exclude(bahan__isnull=True).exclude(bahan__exact='')
        .values('bahan')
        .annotate(n=Count('id'))
        .order_by('-n')[:batas]
    )
    return [r['bahan'] for r in rows]


def cek_finishing_terlaris(jenis_produk, batas=3):
    """Finishing yang paling sering dipilih pelanggan lain untuk jenis produk yang
    sama — data ASLI, sama semangat dengan cek_bahan_terlaris(). Beda dari bahan,
    Finishing TIDAK tersimpan sebagai kolom OrderItem terpisah, tapi di dalam
    OrderItem.detail (JSON) — dipakai _ambil_finishing() yang sama dengan yang
    dipakai invoice WA (lihat services/order_invoice_whatsapp.py), jadi diekstrak
    per-item (dibatasi 200 item terakhir) bukan lewat .values()/.annotate() DB."""
    from collections import Counter
    from .models import OrderItem
    from .services.order_invoice_whatsapp import _ambil_finishing

    if not jenis_produk or not jenis_produk.strip():
        return []
    items = (
        OrderItem.objects
        .filter(jenis_produk__iexact=jenis_produk.strip())
        .exclude(detail__isnull=True)
        .order_by('-id')[:200]
    )
    counter = Counter(nilai for item in items if (nilai := _ambil_finishing(item)))
    return [nilai for nilai, _ in counter.most_common(batas)]


def format_pesan_field_kurang(daftar_kurang):
    """`daftar_kurang` = list of (nomor_item, jenis_produk, [field, ...]).
    Gabungkan jadi satu pesan ramah, sertakan saran bahan/finishing terlaris kalau
    field itu termasuk yang kosong & ada histori datanya."""
    baris = []
    for nomor, jenis_produk, fields in daftar_kurang:
        baris.append(f"- Item {nomor} ({jenis_produk}): {', '.join(fields)} belum diisi.")
        if 'Bahan/Material' in fields:
            terlaris = cek_bahan_terlaris(jenis_produk)
            if terlaris:
                baris.append(f"  💡 Bahan yang paling sering dipakai pelanggan lain: {', '.join(terlaris)}.")
        if 'Finishing' in fields:
            finishing_terlaris = cek_finishing_terlaris(jenis_produk)
            if finishing_terlaris:
                baris.append(f"  💡 Finishing yang paling sering dipilih pelanggan lain: {', '.join(finishing_terlaris)}.")
    return (
        "Ada kolom yang belum diisi lengkap Kak, tolong dicek ya:\n"
        + "\n".join(baris)
    )


# ════════════════════════════════════════════════════════════════
# ATURAN AWAL — Lebih cerdas, tidak langsung kirim form
# ════════════════════════════════════════════════════════════════

def _mirip(a, b, ambang=0.8):
    """Kemiripan string longgar (typo-tolerant), tanpa dependency baru
    (pakai difflib bawaan). Dipakai deteksi kata kunci rule-based supaya
    pesan pelanggan yang typo (mis. 'bnner', 'pesen') tetap kena aturan
    yang benar — bukan cuma mengandalkan AI menebak maksudnya."""
    return difflib.SequenceMatcher(None, a, b).ratio() >= ambang


def _cocok_kata_kunci(pesan, daftar_kata_kunci, ambang=0.75):
    """True kalau salah satu frasa cocok persis (substring, jalur cepat)
    ATAU mirip-typo dengan kata di pesan (per kata untuk frasa 1 kata,
    seluruh kata frasa untuk frasa multi-kata)."""
    kata_pesan = pesan.split()
    for kk in daftar_kata_kunci:
        if kk in pesan:
            return True
        kk_kata = kk.split()
        if len(kk_kata) == 1:
            if any(_mirip(w, kk, ambang) for w in kata_pesan):
                return True
        elif all(any(_mirip(w, kkw, ambang) for w in kata_pesan) for kkw in kk_kata):
            return True
    return False


def cocok_konfirmasi_sesuai(pesan):
    """True kalau pesan pelanggan adalah konfirmasi 'sesuai' atas rekap form
    order (gerbang sebelum Order benar-benar dibuat, lihat pending_order_form).
    Dicek negasi dulu ("belum sesuai", "tidak sesuai") supaya pelanggan yang
    mau KOREKSI rekap tidak salah kena gerbang konfirmasi — 'sesuai' polos
    adalah substring dari frasa-frasa itu juga."""
    p = (pesan or '').lower().strip()
    if _cocok_kata_kunci(p, ['belum sesuai', 'tidak sesuai', 'kurang sesuai', 'gak sesuai', 'ga sesuai', 'blm sesuai']):
        return False
    return _cocok_kata_kunci(p, [
        'sesuai', 'data sudah sesuai', 'sudah sesuai', 'oke sesuai',
        'benar sesuai', 'udah sesuai', 'ya sesuai', 'sip sesuai',
    ])


def cek_produk_terlaris(batas=5):
    """Produk paling banyak dipesan — dihitung dari OrderItem (order yang
    tidak dibatalkan). Kembalikan list (nama, jumlah_dipesan)."""
    from django.db.models import Count
    from .models import OrderItem

    rows = (
        OrderItem.objects
        .exclude(order__status_global='batal')
        .exclude(jenis_produk__iexact='Umum')
        .values('jenis_produk')
        .annotate(n=Count('id'))
        .order_by('-n')[:batas]
    )
    return [(r['jenis_produk'], r['n']) for r in rows]


def cek_database_faq(pesan, nama_pelanggan):
    from .models import FAQ
    faqs = FAQ.objects.all()
    if not faqs.exists():
        return None
    db_faq = {f.pertanyaan: f.jawaban for f in faqs}
    mirip = difflib.get_close_matches(pesan.lower().strip(), list(db_faq.keys()), n=1, cutoff=0.8)
    if mirip:
        jawaban = db_faq[mirip[0]]
        if nama_pelanggan:
            jawaban = (jawaban
                       .replace("Kak!", f"Kak {nama_pelanggan}!")
                       .replace("Kak.", f"Kak {nama_pelanggan}."))
        return jawaban
    return None


# ════════════════════════════════════════════════════════════════
# AI AGENT (tool-calling) — SATU-SATUNYA otak bot (2026-09-10)
# ════════════════════════════════════════════════════════════════
#
# Ganti total arsitektur "AI klasifikasi kategori -> Python rute ke handler"
# (dipakai sepanjang sesi 2026-09-09) jadi "AI sendiri bertindak lewat
# tools" -- instruksi eksplisit user: keyword/klasifikasi lama dihapus,
# AI dikasih tools (api/services/wa_ai_tools.py) & memutuskan sendiri kapan
# pakai yang mana. Dikonfirmasi via tes nyata (2026-09-10): model produksi
# (openai/gpt-5.4-mini via KoboiLLM) MENDUKUNG PENUH tool-calling -- catatan
# lama "proxy bisa menolak parameter tools" SUDAH TIDAK BERLAKU.
#
# TIDAK ADA LAGI jaring pengaman keyword di baliknya (instruksi eksplisit
# user) -- kalau AI/tools gagal total, balas sopan + eskalasi ke admin,
# TITIK. Lihat _fallback_keras() di bawah.

MAKS_PUTARAN_TOOL = 5


def _fallback_keras(nomor, nama_pelanggan, pesan_asli, alasan):
    """Satu-satunya jalur kegagalan sekarang (instruksi eksplisit user
    2026-09-10) -- tidak ada lagi rute balik ke keyword/rules lama. Selalu
    beri tahu admin supaya ada manusia yang follow up."""
    logger.error(f"[AI_AGENT_GAGAL] {alasan} (nomor={nomor})")
    _eskalasi_ke_admin(nomor, nama_pelanggan, pesan_asli, alasan=alasan)
    return "Mohon maaf Kak, sistem kami sedang sibuk 🙏 Admin kami akan segera membantu."


def proses_dengan_ai_agent(nomor, nama_pelanggan="", pesan_asli=""):
    """Loop AI Agent + tool-calling. `pesan_asli` dipakai HANYA untuk
    konteks fallback/eskalasi kalau AI gagal total -- histori percakapan
    yang dipakai sbg input AI tetap dari get_memori_percakapan (pesan
    pelanggan saat ini sudah tersimpan di situ oleh caller sebelum fungsi
    ini dipanggil)."""
    import json
    import time

    from .services.wa_ai_tools import TOOL_SCHEMAS, jalankan_tool

    client = get_ai_client()
    if client is None:
        return _fallback_keras(nomor, nama_pelanggan, pesan_asli, alasan="KOBOI_API_KEY tidak dikonfigurasi")

    model_name = os.getenv("KOBOI_MODEL", "gemini-2.5-pro")
    konteks_tool = {"nomor": nomor, "nama_pelanggan": nama_pelanggan, "pesan_asli": pesan_asli}
    messages = list(get_memori_percakapan(nomor, nama_pelanggan))

    for putaran in range(MAKS_PUTARAN_TOOL):
        max_retries = 3
        backoff = 1.0
        response = None
        terakhir = None
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=model_name, messages=messages, tools=TOOL_SCHEMAS,
                    tool_choice="auto", max_tokens=2048, temperature=0.3, timeout=15.0,
                )
                break
            except Exception as e:
                logger.warning(f"AI completion attempt {attempt + 1} (putaran {putaran}) gagal: {e}")
                terakhir = e
                if attempt < max_retries - 1:
                    time.sleep(backoff)
                    backoff *= 2.0
        if response is None:
            return _fallback_keras(nomor, nama_pelanggan, pesan_asli, alasan=f"Koneksi AI gagal setelah retry: {terakhir}")
        if not getattr(response, 'choices', None):
            return _fallback_keras(nomor, nama_pelanggan, pesan_asli, alasan="Respons AI tanpa choices")

        msg = response.choices[0].message
        if not msg.tool_calls:
            if msg.content:
                return msg.content
            return _fallback_keras(nomor, nama_pelanggan, pesan_asli, alasan="Respons AI kosong (tanpa tool_calls maupun content)")

        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            try:
                argumen = json.loads(tc.function.arguments or "{}")
            except (TypeError, ValueError):
                argumen = {}
            hasil = jalankan_tool(tc.function.name, argumen, konteks=konteks_tool)
            messages.append({
                "role": "tool", "tool_call_id": tc.id,
                "content": json.dumps(hasil, ensure_ascii=False, default=str),
            })

    return _fallback_keras(
        nomor, nama_pelanggan, pesan_asli,
        alasan=f"Lolos {MAKS_PUTARAN_TOOL} putaran tool-calling tanpa jawaban final",
    )
