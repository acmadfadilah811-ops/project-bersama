"""
wa_logic.py — Logika Bot WhatsApp Bintang Advertising (Django)
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

# ── Menu tombol (Quick Reply Buttons) — respons sapaan pertama ────────
# WA membatasi maks. 3 tombol tanpa deskripsi, jadi "Batalkan Pesanan"
# sengaja TIDAK ikut di sini — tetap diakses lewat form/kata kunci
# (lihat cek_form_pembatalan()). ID tombol di-map balik ke '1'/'2'/'3'
# di api/views/whatsapp.py supaya routing MENU ANGKA di bawah tidak perlu
# tahu bedanya tap tombol vs ketik manual.
MENU_TOMBOL = [
    {'id': 'menu_order', 'title': '📋 Order'},
    {'id': 'menu_produk', 'title': '💰 Tanya Produk'},
    {'id': 'menu_status', 'title': '📦 Cek Status'},
]
BUTTON_ID_KE_TEKS = {
    'menu_order': '1',
    'menu_produk': '2',
    'menu_status': '3',
    'produk_order': 'mau order',
    'produk_detail': 'tanya detail katalog',
    'produk_lainnya': 'pertanyaan lainnya',
}

# Tombol kedua — muncul saat pelanggan SEBUT nama produk tapi maksudnya
# belum jelas (mau tanya harga atau langsung order). Beda dari MENU_TOMBOL
# di atas: butuh diingat produk apa yang disebut (lihat cache
# wa_last_produk_<nomor>, di-set saat tombol ini dikirim, dibaca lagi saat
# balasannya diterima di webhook).
TOMBOL_PRODUK = [
    {'id': 'produk_order', 'title': '📋 Order'},
    {'id': 'produk_detail', 'title': '🔎 Tanya Detail'},
    {'id': 'produk_lainnya', 'title': '💬 Lainnya'},
]

# Penanda internal: kalau cek_rules_awal() mengembalikan string berawalan
# salah satu penanda ini, caller (_proses_pesan_masuk) harus kirim sebagai
# tombol WA (fallback ke teks polos kalau pengiriman tombol gagal), bukan
# teks biasa. Dipilih karakter kontrol yang mustahil muncul di pesan
# pelanggan/AI asli. TOMBOL_MARKER = menu utama (3 tombol), TOMBOL_MARKER_2
# = tombol produk (2 tombol, butuh konteks nama produk dari cache).
TOMBOL_MARKER = "\x00TOMBOL_MENU\x00"
TOMBOL_MARKER_2 = "\x00TOMBOL_PRODUK\x00"


def get_business_name():
    from .models import SystemConfig
    try:
        return SystemConfig.objects.get(key='bisnis_nama').value or 'Brandy'
    except Exception as e:
        logger.warning(f"Gagal mengambil nama bisnis: {e}")
        return 'Brandy'


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
    utk state antar-pesan yang butuh diingat konteksnya: kategori produk yang
    sedang ditanya sambil menunggu jawaban status desain (`menunggu_status_desain`),
    atau data form order yang sudah diparse sambil menunggu konfirmasi 'sesuai'
    (`pending_order_form`, lihat views/whatsapp.py)."""
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
menunggu_pilihan_produk = CacheState(cache_prefix="wa_menunggu_pilihan_produk_")
menunggu_status_desain = CacheState(cache_prefix="wa_menunggu_status_desain_")
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
            "1. BATASAN RANAH (MUTLAK): Kamu HANYA boleh menjawab pertanyaan yang berkaitan langsung dengan layanan cetak, produk, info harga, status pesanan, dan informasi bisnis dari Bintang Advertising.\n"
            "Jika pelanggan bertanya tentang topik di luar bisnis ini (misal: politik, agama, tips umum, matematika, membantu tugas, gosip, resep makanan, curhat, menyapa secara umum di luar bisnis, dll.), Anda WAJIB menolak secara sopan dan mengarahkan kembali ke layanan cetak kami.\n"
            "Contoh penolakan: 'Mohon maaf ya Kak, sebagai asisten virtual Bintang Advertising, saya hanya dapat membantu terkait informasi produk, harga, pemesanan, dan layanan cetak di Bintang Advertising. Ada yang bisa saya bantu terkait kebutuhan cetak Kakak? 😊'\n\n"
            "2. JAWAB SINGKAT & LENGKAP: Jawablah dengan santai, komunikatif, dan ringkas dalam bahasa Indonesia. Jangan bertele-tele agar jawaban tidak terpotong (truncated) di WhatsApp.\n\n"
            "3. PANTANGAN UTAMA & SANGAT KRUSIAL: JANGAN PERNAH MENGARANG, MENAKSIR, ATAU MEMBUAT HARGA/DAFTAR PRODUK SENDIRI! Kamu TIDAK punya akses langsung ke database harga/produk saat ini (bukan lewat kamu). Kalau pelanggan menyebut nama produk tertentu atau menanyakan harga sebuah produk, JANGAN coba menjawab sendiri — cukup minta mereka mengetik ULANG nama produknya secara singkat dan jelas dalam satu pesan (contoh: 'harga banner', atau kalau butuh ukuran/jumlah, mis. 'banner 2x3 meter 2 lembar'), sistem kami akan otomatis balas dengan harga resmi & akurat begitu nama produknya jelas. Kalau mereka tanya produk/jasa apa saja yang tersedia, arahkan untuk ketik 'produk apa saja' atau 'katalog'. Jangan pernah bilang 'admin akan segera membantu' untuk pertanyaan harga/produk biasa — cukup arahkan cara bertanya yang tepat seperti di atas.\n"
            "Contoh: 'Untuk info harga yang paling akurat, boleh sebutkan nama produknya langsung ya Kak? Misal: \"harga banner\" atau \"banner 2x3 meter 2 lembar\" 😊'\n\n"
            "4. ALUR ORDER: Jika pelanggan menyebut ingin memesan, membuat, mencetak, atau order produk apapun, LANGSUNG kirimkan form order di bawah ini PERSIS apa adanya. JANGAN tanya detail dulu. JANGAN buat form sendiri dengan format berbeda.\n\n"
            "5. INFORMASI TOTAL BIAYA: Setiap kali Anda memberikan estimasi total biaya atau total harga pesanan kepada pelanggan, Anda WAJIB menyertakan keterangan/catatan kaki berikut di bawah nominal harga:\n"
            "'*untuk harga tersebut belum termasuk biaya desain dan finishing ya kak, untuk rincian totalnya nanti akan di konfirmasi kembali dengan mengirimkan nota invoicenya kak😊'\n\n"
            "6. INFORMASI WAKTU PENGERJAAN & HARI INI: Jika pelanggan bertanya apakah pesanan \"bisa jadi hari ini\" atau menanyakan tentang penyelesaian cepat (express), jawablah dengan ramah dan sopan bahwa estimasi pengerjaan standar adalah 1-3 hari kerja. Jelaskan bahwa untuk pengerjaan kilat/hari ini perlu dikonfirmasi terlebih dahulu ke tim produksi kami. Minta mereka menunggu sebentar karena staff/admin manusia kami akan segera memeriksa antrean mesin dan memberikan konfirmasi langsung apakah bisa diselesaikan hari ini.\n\n"
            "=== TEMPLATE FORM ORDER (gunakan PERSIS ini, jangan ubah format) ===\n"
            f"📋 *FORM ORDER - {biz_name}*\n"
            "_(Bisa isi lebih dari 1 item)_\n\n"
            "👤 *Data Pemesan*\n"
            "- Nama    : \n"
            "- No. WA  : \n\n"
            "📦 *Item 1*\n"
            "- Jenis Produk  : \n"
            "- Jumlah        : \n"
            "- Ukuran        : \n"
            "- Bahan/Material: \n"
            "- Finishing     : \n"
            "- File Desain   : sudah ada / belum ada\n"
            "- Keterangan    : \n\n"
            "📦 *Item 2 (hapus jika tidak perlu)*\n"
            "- Jenis Produk  : \n"
            "- Jumlah        : \n"
            "- Ukuran        : \n"
            "- Bahan/Material: \n"
            "- Finishing     : \n"
            "- File Desain   : sudah ada / belum ada\n"
            "- Keterangan    : \n\n"
            "⚠️ *PENTING:* Kirimkan form yang sudah diisi lengkap, dan sistem kami akan langsung mendaftarkan pesanan Kakak secara otomatis. 👇\n"
            "=== AKHIR TEMPLATE ===\n\n"
            "Saat mengirim form, awali dengan: 'Siap Kak! Silakan *copy* dan isi form berikut:'"
        )

    petunjuk_data = (
        "\n\n=== SUMBER DATA PRODUK & HARGA (WAJIB DIIKUTI) ===\n"
        "Kamu dijalankan SETELAH sistem otomatis kami mencoba menjawab pertanyaan produk/harga/order/"
        "katalog pelanggan langsung dari database asli (jadi kalau pesan ini sampai ke kamu, berarti "
        "sistem otomatis tadi belum berhasil mengenali maksud pelanggan dengan jelas). Kamu SENDIRI "
        "tidak punya angka harga atau daftar produk apa pun — jangan pernah mengarang.\n"
        "- Kalau pelanggan tanya produk/jasa apa saja yang ada: arahkan ketik 'produk apa saja' "
        "atau 'katalog'.\n"
        "- Kalau pelanggan mau order: arahkan ketik 'order' atau ikuti alur ALUR ORDER di atas "
        "(kirim form order langsung).\n"
        "- Kalau pelanggan mau cek status pesanan: minta mereka kirim ID pesanannya, contoh: "
        "'Cek ORD-2026xxxx'.\n"
        "- Untuk percakapan lain yang masih relevan dengan bisnis (basa-basi, tanya jam buka, lokasi, "
        "waktu pengerjaan, dll.) jawab sendiri secara natural sesuai informasi bisnis di atas — jangan "
        "arahkan ke keyword kalau memang bukan soal harga/produk/order.\n\n"
        "=== ATURAN ANTI-LOOP (WAJIB) ===\n"
        "JANGAN PERNAH meminta pelanggan mengulang/mengetik ulang pesan yang sama atau pesan serupa "
        "lebih dari satu kali dalam satu percakapan — kalau permintaan itu sudah gagal sekali (lihat "
        "riwayat chat), mengulanginya lagi hampir pasti akan gagal lagi juga. Kalau kamu benar-benar "
        "tidak tahu jawabannya, ragu, atau pelanggan sudah bilang sudah mengirim/mencoba sebelumnya: "
        "MINTA MAAF dengan jujur, JANGAN berjanji sistem otomatis akan berhasil kalau dicoba lagi, dan "
        "katakan admin kami akan segera membantu mengecek dan membalas chat ini langsung."
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
        footer = f"\n_Pesanan {panggilan} sudah selesai diserahterimakan. Terima kasih banyak atas kepercayaan Kakak pada Bintang Advertising! 😊_"
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


def cek_tracking(pesan, nomor, nama_pelanggan):
    p = pesan.lower().strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"

    # BUG FIX: Skip jika ini merupakan kiriman form order atau form desain agar tidak ter-intercept
    is_form_ord = (
        ('jenis produk' in p and ('no. wa' in p or 'item 1' in p or 'no wa' in p))
        or
        ('nama pemesan' in p and 'jenis produk' in p)
    )
    is_form_des = 'tulisan yang dimuat' in p or 'dominan warna' in p
    if is_form_ord or is_form_des:
        return None

    from .models import Order
    p = pesan.lower()

    # Hanya trigger jika ada keyword tracking yang SPESIFIK
    keyword_tracking = ['cek pesanan', 'cek order', 'lacak', 'tracking', 'status pesanan', 'ord-']
    if not any(k in p for k in keyword_tracking):
        return None

    match = re.search(r'(ord-[\w-]+)', p)
    if match:
        id_cari = match.group(1).upper()
        try:
            order = Order.objects.prefetch_related('items__jobs').get(id=id_cari)
            return format_tracking(order, panggilan)
        except Order.DoesNotExist:
            return (
                f"Maaf {panggilan}, pesanan *{id_cari}* tidak ditemukan. "
                f"Pastikan ID pesanan sudah benar ya Kak 🙏"
            )
    else:
        # Cari by nomor WA jika tidak ada ID spesifik
        orders = Order.objects.filter(nomor_wa=nomor).order_by('-waktu')[:3]
        if orders.exists():
            if orders.count() == 1:
                return format_tracking(orders.first(), panggilan)
            lines = [f"📋 {panggilan} punya {orders.count()} pesanan terakhir:\n"]
            for o in orders:
                item_pertama = o.items.first()
                produk = item_pertama.jenis_produk if item_pertama else 'Umum'
                jml_item = o.items.count()
                lines.append(f"• *{o.id}* — {produk}{' +lainnya' if jml_item > 1 else ''} ({o.status_global.upper()})")
            lines.append("\nKetik *Cek [ID]* untuk lihat detail, contoh: _Cek ORD-20260517-XXXX_")
            return "\n".join(lines)
        else:
            return (
                f"Maaf {panggilan}, belum ada pesanan atas nomor ini.\n"
                f"Jika sudah pernah pesan, kirimkan ID pesanannya ya.\n"
                f"Contoh: *Cek ORD-20260517-XXXX*"
            )


def proses_kirim_desain(pesan, nomor, nama_pelanggan, media_url=""):
    from .models import Order, OrderActivityLog
    p = pesan.lower().strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"

    is_kirim_desain = 'kirim desain' in p
    match = re.search(r'(ord-[\w-]+)', p)

    # 1. Jika ada media_url dan ID order terdeteksi
    if media_url and match:
        gdrive_link = media_url
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
    else:
        return None

    order_id = match.group(1).upper()
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

def get_price_for_qty(tiers, quantity):
    if not tiers:
        return 0
    import re
    for tier_key, price in tiers.items():
        key_clean = re.sub(r'(?i)[a-z\s+]+', '', tier_key).strip()
        if '-' in key_clean:
            parts = key_clean.split('-')
            try:
                low = int(parts[0])
                high = int(parts[1])
                if low <= quantity <= high:
                    return price
            except ValueError:
                pass
        elif '>' in key_clean:
            try:
                val = int(key_clean.replace('>', ''))
                if quantity > val:
                    return price
            except ValueError:
                pass
        else:
            try:
                val = int(key_clean)
                if quantity == val:
                    return price
            except ValueError:
                pass
    return list(tiers.values())[-1]


def hitung_harga_item_db(jenis_produk, bahan, qty, panjang=0.0, lebar=0.0):
    from .models import ProductPrice
    
    prod_name = jenis_produk.strip()
    material_name = bahan.strip() if bahan else ''
    
    # 1. Check if it's outdoor banner (priced by m2)
    is_outdoor = any(k in prod_name.lower() for k in ['banner', 'spanduk', 'mmt', 'baliho', 'outdoor', 'albatros', 'oneway', 'one way', 'luster'])
    
    if is_outdoor and panjang > 0 and lebar > 0:
        luas = panjang * lebar
        prod_obj = None
        if material_name:
            prod_obj = ProductPrice.objects.filter(
                kategori='print_outdoor_per_m2',
                nama_produk__icontains=material_name
            ).first()
            if not prod_obj:
                prod_obj = ProductPrice.objects.filter(
                    kategori='print_outdoor_per_m2',
                    material__icontains=material_name
                ).first()
        if not prod_obj:
            prod_obj = ProductPrice.objects.filter(
                kategori='print_outdoor_per_m2',
                nama_produk__icontains=prod_name
            ).first()
        if not prod_obj:
            prod_obj = ProductPrice.objects.filter(
                kategori='print_outdoor_per_m2',
                nama_produk__icontains='280gr'
            ).first()
            
        if prod_obj:
            return int(luas * prod_obj.harga * qty)
        return int(luas * 25000 * qty)
        
    # 2. Check for Sticker A3+
    is_sticker = any(k in prod_name.lower() for k in ['stiker', 'sticker'])
    if is_sticker:
        prod_obj = None
        if material_name:
            prod_obj = ProductPrice.objects.filter(
                kategori='sticker_a3_plus',
                nama_produk__icontains=material_name
            ).first()
        if not prod_obj:
            prod_obj = ProductPrice.objects.filter(
                kategori='sticker_a3_plus',
                nama_produk__icontains='Chromo'
            ).first()
            
        if prod_obj:
            if prod_obj.price_type == 'tiered':
                price_unit = get_price_for_qty(prod_obj.tiers, qty)
            else:
                price_unit = prod_obj.harga
            return int(price_unit * qty)
        return int(7000 * qty)
        
    # 3. Check for Kartu Nama
    is_kartu = any(k in prod_name.lower() for k in ['kartu nama', 'kartu'])
    if is_kartu:
        prod_obj = None
        sisi_name = "2 Sisi" if "2" in prod_name or "2" in material_name else "1 Sisi"
        has_laminasi = any(k in prod_name.lower() or k in material_name.lower() for k in ['laminasi', 'lam', 'glossy', 'doff'])
        search_name = sisi_name + " + Laminasi" if has_laminasi else sisi_name
        
        prod_obj = ProductPrice.objects.filter(
            kategori='kartu_nama_ivory_260',
            nama_produk__icontains=search_name
        ).first()
        
        if prod_obj:
            if prod_obj.price_type == 'tiered':
                price_unit = get_price_for_qty(prod_obj.tiers, qty)
            else:
                price_unit = prod_obj.harga
            return int(price_unit * qty)
        return int(35000 * qty)
        
    # 4. Check for Print A3+
    is_a3 = any(k in prod_name.lower() or k in material_name.lower() for k in ['a3', 'cetak a3', 'print a3'])
    if is_a3:
        prod_obj = None
        paper_types = ['AP150', 'Ivory 230', 'Ivory 260', 'HVS']
        for p_t in paper_types:
            if p_t.lower() in prod_name.lower() or p_t.lower() in material_name.lower():
                prod_obj = ProductPrice.objects.filter(
                    kategori='print_a3_plus',
                    nama_produk__icontains=p_t
                ).first()
                break
        if not prod_obj:
            prod_obj = ProductPrice.objects.filter(
                kategori='print_a3_plus',
                nama_produk__icontains='AP150'
            ).first()
            
        if prod_obj:
            if prod_obj.price_type == 'tiered':
                price_unit = get_price_for_qty(prod_obj.tiers, qty)
            else:
                price_unit = prod_obj.harga
            return int(price_unit * qty)
        return int(5500 * qty)
        
    prod_obj = ProductPrice.objects.filter(nama_produk__icontains=prod_name).first()
    if prod_obj:
        if prod_obj.price_type == 'tiered':
            price_unit = get_price_for_qty(prod_obj.tiers, qty)
        else:
            price_unit = prod_obj.harga
        return int(price_unit * qty)
        
    return 0


def _ambil_kalkulator_bahan(kategori_slug):
    """Data terstruktur per-bahan (nama+harga, opsional tiers) dari
    SystemConfig 'wa_kalkulator_bahan' (diisi `seed_wa_pricelist`, sumber
    sama dgn get_pricelist_kategori — lihat catatan di situ kenapa BUKAN
    dari Product/ProductPrice live). None kalau belum di-seed / slug tidak
    dikenal — caller wajib return None juga (jangan macet)."""
    from .models import SystemConfig
    import json
    try:
        conf = SystemConfig.objects.get(pk='wa_kalkulator_bahan')
    except SystemConfig.DoesNotExist:
        return None
    try:
        data = json.loads(conf.value)
    except (TypeError, ValueError):
        return None
    return data.get(kategori_slug)


def _harga_tier(daftar_harga, batas_tier, qty):
    """`batas_tier` = batas ATAS tiap tingkatan qty (mis. [25, 50, 100] ->
    1-25 / 26-50 / 51-100 / >100), `daftar_harga` panjangnya harus 1 lebih
    banyak dari `batas_tier` (elemen terakhir = tingkatan di atas semua
    batas)."""
    for i, batas in enumerate(batas_tier):
        if qty <= batas:
            return daftar_harga[i]
    return daftar_harga[-1]


def hitung_harga_otomatis(pesan, nama_pelanggan=""):
    import re

    p = pesan.lower().strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    
    # 1. Parse Input (Dimensions & Qty)
    protected = p
    protected = re.sub(r'\ba[3456]\+?\b', ' ', protected)
    protected = re.sub(r'\b[12]\s*sisi\b', ' ', protected)
    protected = re.sub(r'\d+\s*gr\b', ' ', protected)
    protected = re.sub(r'\d+\s*gsm\b', ' ', protected)
    # Buang angka GRADE bahan yang nempel di nama kategori (mis. "banner
    # 240", "spanduk 340") SEBELUM parsing qty — bukan quantity, itu bagian
    # nama produk (bug ditemukan user 2026-08-15: "banner 240 ukuran 3x4m"
    # kebaca qty=240 lembar alih-alih qty=1, bikin total salah total).
    protected = re.sub(r'\b(banner|spanduk|mmt|baliho)\s+\d+\b', r'\1', protected)

    dim_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:m|meter|cm)?\s*(?:x|\*|by|kali)\s*(\d+(?:[.,]\d+)?)\s*(?:m|meter|cm)?', protected)
    
    panjang = None
    lebar = None
    unit = "m"
    
    if dim_match:
        try:
            val1 = float(dim_match.group(1).replace(',', '.'))
            val2 = float(dim_match.group(2).replace(',', '.'))
            context_around = p[max(0, dim_match.start()-5):min(len(p), dim_match.end()+10)]
            if 'cm' in context_around or val1 >= 10 or val2 >= 10:
                unit = "cm"
                panjang = val1 / 100.0
                lebar = val2 / 100.0
            else:
                unit = "m"
                panjang = val1
                lebar = val2
        except Exception as e:
            logger.warning(f"Gagal mem-parse dimensi panjang/lebar dari match: {e}")

    string_for_qty = protected
    if dim_match:
        string_for_qty = protected[:dim_match.start()] + " " + protected[dim_match.end():]

    qty = 1
    qty_with_unit = re.search(r'\b(\d+)\s*(?:lbr|lembar|pcs|pc|box|buah|bks|pack|paket|set)\b', string_for_qty)
    if qty_with_unit:
        try:
            qty = int(qty_with_unit.group(1))
        except Exception as e:
            logger.warning(f"Gagal mem-parse qty_with_unit: {e}")
    else:
        qty_preceded = re.search(r'\b(?:qty|jumlah|sebanyak)\s*[:=]?\s*(\d+)\b', string_for_qty)
        if qty_preceded:
            try:
                qty = int(qty_preceded.group(1))
            except Exception as e:
                logger.warning(f"Gagal mem-parse qty_preceded: {e}")
        else:
            numbers = re.findall(r'\b(\d+)\b', string_for_qty)
            if numbers:
                try:
                    qty = int(numbers[0])
                except Exception as e:
                    logger.warning(f"Gagal mem-parse qty fallback dari angka: {e}")

    # 2. Identify Product Category
    is_banner = any(k in p for k in ['banner', 'spanduk', 'mmt', 'baliho', 'outdoor', 'albatros', 'oneway', 'one way', 'luster'])
    is_sticker = any(k in p for k in ['stiker', 'sticker', 'chromo', 'vinyl', 'hologram', 'transparan'])
    is_kartu_nama = any(k in p for k in ['kartu nama', 'kartu', 'box'])
    is_a3 = any(k in p for k in ['a3', 'brosur', 'ap150', 'ap120', 'ivory', 'hvs', 'flyer', 'poster', 'print a3'])

    is_calc_intent = any(k in p for k in ['hitung', 'kalkulasi', 'kalkulator', 'estimasi'])

    # Tentukan apakah ada spesifikasi/kuantitas khusus yang diinput — supaya
    # pelanggan yang TIDAK bilang "hitung" tapi langsung sebut ukuran/qty
    # (mis. "banner 240 ukuran 3x4m itu berapa harganya kak?") tetap dapat
    # tabel perbandingan, bukan cuma jatuh ke pencarian 1 produk generik.
    punya_spek_kalkulasi = (panjang and lebar) if is_banner else (qty > 1)

    # Hanya jalankan kalkulator otomatis jika user minta hitung (is_calc_intent) atau memberi spesifikasi (punya_spek_kalkulasi)
    if not (is_calc_intent or punya_spek_kalkulasi):
        return None

    # Jika produk tidak terdeteksi tapi ada niat kalkulasi
    if not (is_banner or is_sticker or is_kartu_nama or is_a3):
        # Sebelum asal anggap banner cuma krn ada pola ukuran "PxL", cek dulu
        # apakah pesan cocok ke kategori pricelist LAIN (mis. "plakat"/
        # "acrylic") yang cara hitungnya BEDA dari banner (per cm, bukan per
        # m2) — kalau cocok, lepas ke cek_harga_produk (sudah cek pricelist
        # statis duluan) drpd salah kasih tabel kalkulator BANNER (bug
        # ditemukan user 2026-08-15: "plakat printing ukuran 60x40cm 2 pcs"
        # dijawab pakai tabel BANNER/SPANDUK).
        if _cocok_kategori_pricelist(p):
            return None
        if panjang and lebar:
            is_banner = True
        elif is_calc_intent:
            return (
                f"Tentu {panggilan}! Silakan sebutkan produk yang ingin dihitung harganya.\n"
                f"Contoh:\n"
                f"• _hitung banner 2x3 meter 2 lembar_\n"
                f"• _hitung stiker chromo 50 lembar_\n"
                f"• _hitung kartu nama 1 sisi 3 box_"
            )
        else:
            # Bukan salah satu dari 4 kategori kalkulator, tidak ada
            # dimensi, dan bukan permintaan "hitung" eksplisit — kemungkinan
            # besar punya_spek_kalkulasi=True di atas cuma krn fallback
            # bare-number qty salah kebaca dari nomor model/grade produk
            # lain (mis. "kaos combed 240" -> qty=240), BUKAN benar-benar
            # minta kalkulasi. Lepas ke cek_harga_produk (pencarian produk
            # biasa) drpd macet minta pelanggan sebut produk yang sebenarnya
            # sudah dia sebut (bug ditemukan user 2026-08-15).
            return None

    # 3. Perform Calculations and Format Response — SELALU tampilkan tabel
    # perbandingan SEMUA bahan/grade (instruksi user 2026-08-15: biar
    # pelanggan bisa bandingkan sendiri), walau pelanggan sebut 1 grade
    # spesifik (mis. "banner 240") — data dari SystemConfig
    # wa_kalkulator_bahan (bukan ProductPrice legacy — lihat catatan
    # seed_wa_pricelist.py kenapa; tabel live Product tidak punya
    # price_type='per_m2' utk banner sama sekali).
    if is_banner:
        if not panjang or not lebar:
            if is_calc_intent:
                return (
                    f"Untuk menghitung harga *Banner/Spanduk*, mohon sertakan ukurannya ya {panggilan}.\n"
                    f"Contoh: *hitung banner 3x1 sebanyak 2 lembar*"
                )
            return None

        data = _ambil_kalkulator_bahan('banner')
        if not data:
            return None
        luas = panjang * lebar
        lines = [
            f"📋 *ESTIMASI TOTAL BIAYA - BANNER/SPANDUK*",
            f"Halo {panggilan}! Berikut rincian estimasi harganya:\n",
            f"📐 *Ukuran*: {panjang:.2f} x {lebar:.2f} meter (Luas: {luas:.2f} m²)",
            f"📦 *Jumlah*: {qty} lembar\n",
            f"💵 *Pilihan Bahan & Estimasi Harga*:"
        ]
        for b in data['bahan']:
            harga = b['harga']
            subtotal = int(round(luas * harga * qty))
            lines.append(f"• *{b['nama']}* (Rp {harga:,}/m²)".replace(',', '.'))
            lines.append(f"  └─ Total: *Rp {subtotal:,}*".replace(',', '.'))

        lines.append("\n*untuk harga tersebut belum termasuk biaya desain dan finishing ya kak, untuk rincian totalnya nanti akan di konfirmasi kembali dengan mengirimkan nota invoicenya kak😊")
        lines.append("Mau langsung order? Balas dengan ketik *Order* ya Kak! 😊")
        return "\n".join(lines)

    elif is_sticker:
        data = _ambil_kalkulator_bahan('stiker')
        if not data:
            return None
        lines = [
            f"📋 *ESTIMASI TOTAL BIAYA - STIKER A3+*",
            f"Halo {panggilan}! Berikut rincian estimasi harganya:\n",
            f"📦 *Jumlah*: {qty} lembar A3+\n",
            f"💵 *Pilihan Bahan & Estimasi Harga*:"
        ]
        for b in data['bahan']:
            harga_unit = _harga_tier(b['harga'], data['tiers'], qty)
            subtotal = int(harga_unit * qty)
            lines.append(f"• *Stiker {b['nama']}*:")
            lines.append(f"  └─ Rp {harga_unit:,}/lbr × {qty} lbr = *Rp {subtotal:,}*".replace(',', '.'))

        lines.append("\n_Semakin banyak jumlah lembaran, harga per lembar semakin murah!_")
        lines.append("*untuk harga tersebut belum termasuk biaya desain dan finishing ya kak, untuk rincian totalnya nanti akan di konfirmasi kembali dengan mengirimkan nota invoicenya kak😊")
        lines.append("Mau langsung order? Balas dengan ketik *Order* ya Kak! 😊")
        return "\n".join(lines)

    elif is_kartu_nama:
        data = _ambil_kalkulator_bahan('kartu_nama')
        if not data:
            return None
        lines = [
            f"📋 *ESTIMASI TOTAL BIAYA - KARTU NAMA*",
            f"Halo {panggilan}! Berikut rincian estimasi harganya:\n",
            f"📦 *Jumlah*: {qty} Box (1 Box = 100 lembar)\n",
            f"💵 *Pilihan Bahan & Estimasi Harga*:"
        ]
        for b in data['bahan']:
            harga_unit = _harga_tier(b['harga'], data['tiers'], qty)
            subtotal = int(harga_unit * qty)
            lines.append(f"• *{b['nama']}*:")
            lines.append(f"  └─ Rp {harga_unit:,}/box × {qty} box = *Rp {subtotal:,}*".replace(',', '.'))

        lines.append("\n*untuk harga tersebut belum termasuk biaya desain dan finishing ya kak, untuk rincian totalnya nanti akan di konfirmasi kembali dengan mengirimkan nota invoicenya kak😊")
        lines.append("Mau langsung order? Balas dengan ketik *Order* ya Kak! 😊")
        return "\n".join(lines)

    elif is_a3:
        data = _ambil_kalkulator_bahan('kertas_a3')
        if not data:
            return None
        lines = [
            f"📋 *ESTIMASI TOTAL BIAYA - PRINT A3+*",
            f"Halo {panggilan}! Berikut rincian estimasi harganya:\n",
            f"📦 *Jumlah*: {qty} lembar A3+\n",
            f"💵 *Pilihan Kertas & Estimasi Harga*:"
        ]
        for b in data['bahan']:
            harga_unit = _harga_tier(b['harga'], data['tiers'], qty)
            subtotal = int(harga_unit * qty)
            lines.append(f"• *Kertas {b['nama']}*:")
            lines.append(f"  └─ Rp {harga_unit:,}/lbr × {qty} lbr = *Rp {subtotal:,}*".replace(',', '.'))

        lines.append("\n*untuk harga tersebut belum termasuk biaya desain dan finishing ya kak, untuk rincian totalnya nanti akan di konfirmasi kembali dengan mengirimkan nota invoicenya kak😊")
        lines.append("Mau langsung order? Balas dengan ketik *Order* ya Kak! 😊")
        return "\n".join(lines)

    return None

def cek_harga(pesan, nama_pelanggan, nomor=None):
    """
    Cek apakah pelanggan menanyakan harga — jika ya, jawab dengan info harga
    NYATA dari Product (lihat cek_harga_produk). TIDAK mengirimkan form order,
    TIDAK PERNAH memakai tabel ProductPrice legacy / harga hardcode — supaya
    tidak lagi ketinggalan zaman dibanding data asli di menu Produk & Inventori.
    """
    p = pesan.lower().strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"

    # ── CEK TANYA HARI INI / CETAK CEPAT (RUSH ORDER) TERLEBIH DAHULU ─────────────
    kata_cepat = [
        'hari ini', 'langsung jadi', 'bisa ditunggu', 'express', 'kilat',
        'kapan jadi', 'selesai kapan', 'bisa jadi', 'hari ini jadi', 'langsung selesai',
        'buru-buru', 'kejar deadline', 'kapan beres', 'bisa ditunggu'
    ]
    if _cocok_kata_kunci(p, kata_cepat):
        return (
            f"Mohon maaf {panggilan}, untuk cetak cepat atau jika ingin jadi hari ini, "
            "kami perlu konfirmasi kepada staff terlebih dahulu terkait jam jadi, "
            "karena perlu melihat antrean yang sudah ada ya Kak. 🙏\n\n"
            "Boleh tahu rencana mau cetak produk apa, ukuran berapa, dan berapa banyak? "
            "Biar bisa kami tanyakan langsung ke staff produksi. 😊"
        )

    # Coba kalkulator pintar dulu (tabel perbandingan semua bahan/grade utk
    # kategori banner/stiker/kartu nama/kertas A3+ — instruksi user
    # 2026-08-15) — cuma jalan kalau pelanggan sebut ukuran/qty spesifik atau
    # eksplisit minta "hitung", lihat gate di hitung_harga_otomatis(). Kalau
    # None (bukan salah satu dari 4 kategori itu, atau tidak ada spek),
    # lanjut ke pencarian produk tunggal seperti biasa.
    jawaban_kalkulator = hitung_harga_otomatis(pesan, nama_pelanggan)
    if jawaban_kalkulator:
        return jawaban_kalkulator

    return cek_harga_produk(pesan, nama_pelanggan, nomor=nomor)


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

def get_form_order(nama_pelanggan="", jenis_produk=""):
    """`jenis_produk` (opsional) pre-fill kolom "Jenis Produk" Item 1 —
    dipakai saat pelanggan sudah sebutkan produk spesifik yang dipilih di
    tahap tanya-produk sebelum form (lihat Trigger 2 cek_rules_awal & state
    menunggu_pilihan_produk/menunggu_status_desain di views/whatsapp.py)."""
    from .models import SystemConfig
    nama_isi = nama_pelanggan if nama_pelanggan else ""
    produk_isi = jenis_produk if jenis_produk else ""
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
        f"- Bahan/Material: \n"
        f"- Finishing     : \n"
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
        if jenis_produk and "Jenis Produk  : " in template:
            # count=1: cuma isi Item 1, Item 2 dst. tetap kosong
            template = template.replace("Jenis Produk  : ", f"Jenis Produk  : {jenis_produk}", 1)
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
    cari_produk() (sumber sama dipakai cek_harga_produk/katalog). Kembalikan
    None kalau tidak match persis 1 produk — sengaja TIDAK menebak untuk
    nama ambigu/tidak dikenal, biar tidak salah blokir."""
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


# ── Pricelist statis (BUKAN data live Product/ProductPrice — lihat catatan di
# get_pricelist_kategori di bawah & management/commands/seed_wa_pricelist.py) ──
# Dipakai Trigger 2 di cek_rules_awal(): begitu pelanggan sebut niat + nama
# produk, tampilkan info kategori & harga referensi INI dulu (bukan langsung
# form order) sambil menanyakan status desain (instruksi user 2026-08-15).
PRODUK_KE_KATEGORI_PRICELIST = {
    'banner': 'banner', 'spanduk': 'banner', 'baliho': 'banner', 'mmt': 'banner',
    'x banner': 'banner', 'roll banner': 'banner', 'stand banner': 'banner',
    'tripod banner': 'banner', 'segitiga banner': 'banner',
    'stiker': 'stiker', 'sticker': 'stiker',
    'kartu nama': 'kartu_nama',
    'brosur': 'brosur', 'flyer': 'brosur',
    'buku yasin': 'cetak_khusus', 'yasin': 'cetak_khusus',
    'merchandise': 'merchandise', 'mug': 'merchandise', 'tumbler': 'merchandise',
    'payung': 'merchandise', 'gantungan kunci': 'merchandise', 'ganci': 'merchandise',
    'pin': 'merchandise', 'lanyard': 'merchandise', 'goodiebag': 'merchandise',
    'kaos': 'kaos',
    'acrylic': 'acrylic', 'plakat': 'acrylic',
    'cutting': 'cutting_finishing', 'laminasi': 'cutting_finishing',
    'kertas': 'kertas_a3', 'hvs': 'kertas_a3',
}

# Nama tampilan rapi per slug pricelist — dipakai cek_katalog_produk() utk
# daftar kategori (instruksi user 2026-08-15: pakai kategori dari
# pricelist.md, BUKAN dump ProductCategory live yang 27+ baris & campur
# kategori internal spt "Bahan Baku" yang tidak relevan buat pelanggan).
KATEGORI_PRICELIST_NAMA = {
    'banner': 'Banner / Spanduk / MMT',
    'stiker': 'Stiker / Docu Stiker A3+',
    'kertas_a3': 'Docu Kertas A3+',
    'kartu_nama': 'Kartu Nama',
    'brosur': 'Paket Cetak Brosur / Flyer',
    'cetak_khusus': 'Produk Cetak Khusus (Kupon, Nota, Kalender, ID Card, Buku Yasin)',
    'merchandise': 'Merchandise & Promosi',
    'kaos': 'Kaos / Apparel',
    'acrylic': 'Acrylic & Plakat',
    'cutting_finishing': 'Jasa Cutting, Potong & Finishing',
}


def get_pricelist_kategori(kategori_slug):
    """Ambil teks pricelist statis (SystemConfig 'wa_pricelist_kategori', diisi
    lewat `python manage.py seed_wa_pricelist` dari file
    '#PRICELIST STAR DIGIPRINT UPDATE 1 AGUSTUS 2026.md') utk 1 kategori. Sengaja
    BUKAN dari Product/ProductPrice live — angkanya beda (sudah dicek ke database
    produksi), pricelist ini cuma referensi awal, harga final tetap dikonfirmasi
    admin lewat invoice (instruksi user 2026-08-15). Kembalikan None kalau
    SystemConfig belum di-seed / slug tidak dikenal — caller WAJIB fallback ke
    form order langsung spy pelanggan tidak macet."""
    from .models import SystemConfig
    import json
    try:
        conf = SystemConfig.objects.get(pk='wa_pricelist_kategori')
    except SystemConfig.DoesNotExist:
        return None
    try:
        data = json.loads(conf.value)
    except (TypeError, ValueError):
        return None
    return data.get(kategori_slug)


def _cocok_kategori_pricelist(pesan):
    """Cari kata produk (kunci PRODUK_KE_KATEGORI_PRICELIST) yang cocok ke pesan,
    typo-tolerant lewat _cocok_kata_kunci(). Kembalikan (kata_produk, kategori_slug)
    dari kecocokan PERTAMA, atau None kalau tidak ada yang cocok.

    Ambang dinaikkan ke 0.82 (default _cocok_kata_kunci 0.75) — keputusan di
    sini menentukan KATEGORI PRODUK yang dijawab, jadi lebih berisiko drpd
    trigger kata kunci biasa. Di 0.75, kata sehari-hari umum "kalo" (mirip
    0.75 persis) salah kena kategori "kaos" (bug ditemukan user 2026-08-15:
    "kalo saya order plakat printing ukuran 60x40cm..." malah dijawab
    kategori Kaos/Apparel, bukan Acrylic/Plakat yang sebenarnya disebut).
    0.82 masih lolos typo asli spt "bnner"->banner (0.91), "setiker"->stiker
    (0.92), "plaket"->plakat (0.83)."""
    p = pesan.lower()
    for kata, slug in PRODUK_KE_KATEGORI_PRICELIST.items():
        if _cocok_kata_kunci(p, [kata], ambang=0.82):
            return (kata, slug)
    return None


def cocok_status_desain(pesan):
    """Tafsir jawaban pelanggan atas pertanyaan status file desain (dikirim
    Trigger 2 cek_rules_awal, state `menunggu_status_desain`). Kembalikan
    'sudah', 'belum', atau None kalau jawabannya tidak jelas — dicek 'belum'
    duluan supaya 'belum ada' tidak salah kena cabang 'sudah' (dua-duanya sama
    sekali tidak overlap sebenarnya, tapi urutan ini jaga-jaga)."""
    p = (pesan or '').lower().strip()
    if _cocok_kata_kunci(p, [
        'belum ada', 'belum punya', 'belum', 'blm ada', 'blm',
        'tidak ada', 'ga ada', 'gak ada', 'nggak ada', 'kosong',
    ]):
        return 'belum'
    if _cocok_kata_kunci(p, [
        'sudah ada', 'udah ada', 'sudah punya', 'udah punya',
        'sudah', 'udah', 'ada kok', 'punya',
    ]):
        return 'sudah'
    return None


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


def ekstrak_produk_pilihan(pesan, info_kategori=""):
    """Pakai AI utk ekstrak nama produk BERSIH dari jawaban pelanggan atas
    pertanyaan 'produk yang mana yang mau dipilih?' (Trigger 2
    cek_rules_awal) — pelanggan sering jawab pakai kalimat penuh (mis. 'mau
    yang banner 240 itu aja kak'), kalau dipakai mentah-mentah bakal
    mengotori kolom Jenis Produk di form order (bug ditemukan user
    2026-08-15: seluruh kalimat pelanggan ikut masuk sebagai nama produk).
    Fallback ke pesan asli (di-strip) kalau AI tidak tersedia/gagal — jangan
    sampai pelanggan macet gara-gara AI down, ini cuma pemoles nama, bukan
    keputusan yang boleh bikin alur berhenti."""
    pesan_bersih = pesan.strip()
    if not pesan_bersih:
        return pesan_bersih

    client = get_ai_client()
    if client is None:
        return pesan_bersih

    try:
        model_name = os.getenv("KOBOI_MODEL", "gemini-2.5-pro")
        konteks = f"\n\nDaftar produk yang baru ditawarkan ke pelanggan:\n{info_kategori}" if info_kategori else ""
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": (
                    "Kamu membantu mengekstrak nama produk dari jawaban pelanggan toko "
                    "percetakan. Pelanggan baru saja ditanya 'produk yang mana yang mau "
                    "dipilih' dari sebuah daftar." + konteks + "\n\n"
                    "Balas HANYA dengan nama produk yang dimaksud pelanggan, seringkas "
                    "mungkin (mis. 'Banner 240'), TANPA basa-basi/kalimat tambahan/tanda "
                    "kutip. Kalau pesan pelanggan tidak menyebut produk yang jelas, balas "
                    "dengan pesan pelanggan itu apa adanya."
                )},
                {"role": "user", "content": pesan_bersih},
            ],
            max_tokens=40, temperature=0.1, timeout=10.0,
        )
        if not response or not getattr(response, 'choices', None):
            return pesan_bersih
        hasil = (response.choices[0].message.content or '').strip().strip('"').strip("'")
        return hasil if hasil else pesan_bersih
    except Exception as e:
        logger.warning(f"Gagal ekstrak nama produk pilihan via AI, fallback ke pesan asli: {e}")
        return pesan_bersih


# Frasa multi-kata: dicocokkan via _cocok_kata_kunci biasa (tiap kata di frasa
# harus mirip ke suatu kata di pesan) -- aman dari false-positive krn perlu 2+
# kata cocok sekaligus.
_FRASA_ORDER_TANPA_PRODUK = [
    'mau order', 'saya mau order', 'oke mau order', 'ya mau order', 'iya mau order',
    'jadi order', 'lanjut order', 'gas order', 'boleh order', 'order aja', 'order saja',
    'mau pesan', 'saya mau pesan', 'pesan aja', 'pesan saja', 'jadi pesan', 'lanjut pesan',
]
# Kata konfirmasi 1 kata: SENGAJA tidak dicocokkan via _cocok_kata_kunci biasa
# (fuzzy per-kata substring akan salah kena nama produk pendek, mis. kata
# tunggal 'ya' fuzzy-match ke kata "ya" di tengah "ya yang chromo aja kak").
# Hanya dianggap "tanpa produk" kalau SELURUH pesan pendek & mirip salah satu
# kata ini (pola sama dgn `sapaan_mirip` di cek_rules_awal).
_KATA_KONFIRMASI_SAJA = [
    'oke', 'ok', 'siap', 'boleh', 'iya', 'ya', 'gas', 'lanjut', 'jadi',
    'mantap', 'sip', 'setuju', 'baik', 'yaudah', 'ya udah', 'oke kak', 'oke deh',
]


def _pesan_konfirmasi_tanpa_produk(pesan):
    """True kalau pesan cuma konfirmasi niat lanjut ('mau order', 'oke',
    'siap', dst) TANPA menyebut produk konkret -- dipakai di STEP 1c
    (menunggu_pilihan_produk, views/whatsapp.py) supaya balasan seperti
    'Okey saya mau order' tidak ketebak jadi nama produk (bug ditemukan
    user 2026-08-15 lewat log percakapan VPS: form order akhirnya kolom
    Jenis Produk keisi teks 'Okey saya mau order' apa adanya)."""
    p = pesan.lower().strip()
    if not p:
        return True
    if _cocok_kata_kunci(p, _FRASA_ORDER_TANPA_PRODUK, ambang=0.82):
        return True
    if len(p) <= 12 and any(_mirip(p, k, 0.8) for k in _KATA_KONFIRMASI_SAJA):
        return True
    return False


_KATA_KATALOG = [
    'produk apa', 'jual apa', 'cetak apa', 'bikin apa', 'ada katalog',
    'lihat katalog', 'daftar produk', 'ada apa saja', 'jenis produk',
    'apa saja yang', 'layanan apa', 'melayani apa', 'katalog produk',
]


def _format_harga_produk(product):
    """Teks harga ringkas untuk WA, sesuai price_type — TIDAK PERNAH
    menaksir: tier tanpa data valid / per_m2 (butuh ukuran) diberi
    keterangan jujur, bukan angka karangan."""
    if product.price_type == 'per_m2':
        harga = int(product.harga_jual_toko or 0)
        return f"Rp{harga:,}".replace(',', '.') + "/m² (kirim ukuran P x L untuk total harga)"
    if product.price_type == 'tier':
        tiers = product.tiers if isinstance(product.tiers, list) else []
        harga_valid = []
        for t in tiers:
            try:
                harga_valid.append(int(t.get('price')))
            except (TypeError, ValueError, AttributeError):
                continue
        if harga_valid:
            return f"mulai Rp{min(harga_valid):,}".replace(',', '.')
        return "hubungi kami untuk info harga"
    harga = int(product.harga_jual_toko or 0)
    return f"Rp{harga:,}".replace(',', '.')


def cek_katalog_produk(pesan, nama_pelanggan):
    """Daftar awal katalog — dari kategori pricelist statis (SystemConfig
    'wa_pricelist_kategori', sumber SAMA dgn Trigger 2/kalkulator), BUKAN
    dump ProductCategory live. Bug ditemukan user 2026-08-15: 'ada produk
    apa saja' balas dump 27+ kategori database yang berantakan (campur
    kategori internal spt 'Bahan Baku', nama ganda beda kapitalisasi spt
    'MERCHANDISE'/'Merchandise') — sumber itu memang bukan utk konsumsi
    pelanggan, beda dari pricelist.md yang sudah dikurasi rapi."""
    p = pesan.lower().strip()
    if not _cocok_kata_kunci(p, _KATA_KATALOG, ambang=0.78):
        return None

    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    from .models import SystemConfig
    import json
    try:
        conf = SystemConfig.objects.get(pk='wa_pricelist_kategori')
        data = json.loads(conf.value)
    except (SystemConfig.DoesNotExist, TypeError, ValueError):
        data = {}
    if not data:
        return None

    kategori_list = [KATEGORI_PRICELIST_NAMA.get(slug, slug) for slug in data.keys()]

    return (
        f"Berikut kategori produk yang tersedia {panggilan} 😊:\n\n"
        + "\n".join(f"• *{nama}*" for nama in kategori_list)
        + "\n\nMau tanya detail salah satu kategori, atau langsung sebutkan nama produknya ya Kak 🙏"
    )


_KATA_ISI_KATEGORI = [
    'apa saja', 'ada apa', 'isinya apa', 'produk apa', 'list produk',
    'daftar produk', 'ada produk apa',
]


def cek_isi_kategori(pesan, nama_pelanggan):
    """Kalau pelanggan sebut nama kategori/produk yang cocok ke pricelist
    statis — baik disebut sendirian (mis. balasan singkat setelah tap tombol
    'Tanya Detail') maupun dalam kalimat tanya eksplisit (mis. 'kategori
    banner ada apa saja') — jawab dengan info pricelist kategori itu, sumber
    SAMA dgn Trigger 2/kalkulator (instruksi user 2026-08-15; sebelumnya
    pakai ProductCategory/Product live yang datanya beda & berantakan)."""
    p = pesan.lower().strip()
    if not p:
        return None

    cocok = _cocok_kategori_pricelist(p)
    if not cocok:
        return None
    _, kategori_slug = cocok

    # Nama kategori ketemu bukan berarti otomatis "nanya isi kategori" —
    # butuh sinyal tambahan (frasa tanya eksplisit, atau pesan pendek =
    # kemungkinan besar cuma balasan sebut nama kategori) supaya tidak
    # menabrak kalimat lain yang kebetulan menyebut nama kategori (mis.
    # "mau cetak banner" sudah ditangani trigger order di atas & tidak
    # pernah sampai sini).
    ada_frasa_tanya = _cocok_kata_kunci(p, _KATA_ISI_KATEGORI, ambang=0.8)
    pesan_pendek = len(p) <= 20
    if not (ada_frasa_tanya or pesan_pendek):
        return None

    info_kategori = get_pricelist_kategori(kategori_slug)
    if not info_kategori:
        return None

    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    return (
        f"{info_kategori}\n\n"
        f"Mau tanya harga detail atau langsung order? Sebutkan nama produknya, atau ketik *order* ya {panggilan} 🙏"
    )


# ════════════════════════════════════════════════════════════════
# REKOMENDASI PRODUK — data ASLI (populer dari histori Order, harga dari
# Product). TIDAK ada "produk paling bagus kualitasnya": tidak ada data
# rating per-produk di sistem (CustomerReview cuma ulasan umum, tidak
# tertaut ke Product), jadi sengaja tidak diklaim supaya tidak mengarang.
# ════════════════════════════════════════════════════════════════

_KATA_TERLARIS = [
    'produk terlaris', 'paling laris', 'paling laku', 'paling diminati',
    'rekomendasi produk', 'produk populer', 'produk apa yang bagus',
    'produk yang bagus', 'saran produk',
]


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


def jawab_produk_terlaris(nama_pelanggan):
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    terlaris = cek_produk_terlaris()
    if not terlaris:
        return (
            f"Untuk saat ini kami belum punya cukup data histori pesanan buat rekomendasi "
            f"produk terlaris, {panggilan}. Sebutkan produk spesifik saja ya, saya bantu cek 😊"
        )
    baris = [f"{i + 1}. *{nama}* ({jumlah}x dipesan)" for i, (nama, jumlah) in enumerate(terlaris)]
    return (
        f"Produk paling sering dipesan pelanggan kami {panggilan} 😊:\n\n" + "\n".join(baris)
        + "\n\nMau tanya harga salah satunya? Sebutkan namanya ya Kak!"
    )


_BUDGET_RE = re.compile(
    r'budget|bujet',
)
_BUDGET_ANGKA_RE = re.compile(
    r'(\d+(?:[.,]\d+)?)\s*(rb|ribu|jt|juta)?', re.IGNORECASE
)


def _parse_budget(pesan):
    """Ambil angka budget dari pesan (mendukung akhiran rb/ribu/jt/juta).
    Kembalikan None kalau tidak ketemu angka — tidak pernah menebak."""
    if not _BUDGET_RE.search(pesan.lower()):
        return None
    m = _BUDGET_ANGKA_RE.search(pesan.lower())
    if not m:
        return None
    try:
        angka = float(m.group(1).replace(',', '.'))
    except ValueError:
        return None
    satuan = (m.group(2) or '').lower()
    if satuan in ('rb', 'ribu'):
        angka *= 1_000
    elif satuan in ('jt', 'juta'):
        angka *= 1_000_000
    return int(angka)


def jawab_produk_sesuai_budget(pesan, nama_pelanggan, batas=5):
    """Rekomendasi produk sesuai budget pelanggan — filter harga ASLI dari
    Product.harga_jual_toko (hanya produk price_type='flat': harga per_m2
    itu tarif per meter, bukan harga total, jadi tidak bisa dibandingkan
    langsung ke budget tanpa ukuran). Kembalikan None kalau pesan tidak
    menyebut budget dengan angka jelas."""
    budget = _parse_budget(pesan)
    if not budget:
        return None

    from .product_models import Product
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    budget_fmt = f"Rp{budget:,}".replace(',', '.')

    produk_list = list(
        Product.objects.filter(
            is_active=True, price_type='flat', harga_jual_toko__lte=budget, harga_jual_toko__gt=0,
        ).order_by('-harga_jual_toko')[:batas]
    )
    if not produk_list:
        return (
            f"Untuk budget sekitar {budget_fmt}, belum ada produk harga tetap yang pas {panggilan}. "
            "Boleh sebutkan produk spesifiknya? Beberapa produk kami hitung per ukuran, jadi bisa "
            "disesuaikan bahan/ukurannya biar sesuai budget 😊"
        )
    baris = [f"- *{p.nama}* — Rp{int(p.harga_jual_toko):,}".replace(',', '.') for p in produk_list]
    return (
        f"Untuk budget sekitar {budget_fmt} {panggilan}, ini beberapa pilihan kami 😊:\n\n"
        + "\n".join(baris)
        + "\n\nMau tanya detail salah satunya? Sebutkan namanya ya Kak!"
    )


_KATA_HARGA = ['harga', 'berapa', 'tarif', 'biaya', 'price', 'kisaran', 'rate', 'ongkos']
_KATA_BUANG_HARGA = set(_KATA_HARGA) | {
    'dong', 'ya', 'yah', 'kak', 'min', 'admin', 'ada', 'nya', 'itu', 'untuk',
    'nih', 'sih', 'gan', 'tolong', 'mau', 'tanya', 'nanya', 'donk', 'nge',
    'ukuran', 'ukurannya', 'dengan', 'itunya',
}
_DIM_RE = re.compile(
    r'(\d+(?:[.,]\d+)?)\s*(?:m|meter|cm)?\s*(?:x|\*|by|kali)\s*(\d+(?:[.,]\d+)?)\s*(?:m|meter|cm)?'
)
_QTY_RE = re.compile(r'\b(\d+)\s*(?:lbr|lembar|pcs|pc|box|buah|bks|pack|paket|set|unit)\b')


def _parse_dimensi_qty(pesan):
    """Ambil panjang/lebar (meter) & qty dari kalimat bebas kalau ada polanya
    jelas. Tidak pernah menaksir — kembalikan None kalau tidak ditemukan."""
    p = pesan.lower()
    panjang = lebar = qty = None
    m = _DIM_RE.search(p)
    if m:
        try:
            v1 = float(m.group(1).replace(',', '.'))
            v2 = float(m.group(2).replace(',', '.'))
            sekitar = p[max(0, m.start() - 5):m.end() + 10]
            if 'cm' in sekitar or v1 >= 10 or v2 >= 10:
                panjang, lebar = v1 / 100.0, v2 / 100.0
            else:
                panjang, lebar = v1, v2
        except (TypeError, ValueError):
            pass
    mq = _QTY_RE.search(p)
    if mq:
        try:
            qty = int(mq.group(1))
        except ValueError:
            pass
    return panjang, lebar, qty


def cek_harga_produk(pesan, nama_pelanggan, nomor=None):
    """Jawaban harga LANGSUNG dari Product nyata via product_pricing.hitung_harga
    (sumber yang sama dipakai kasir) — BUKAN dari tabel ProductPrice legacy /
    harga hardcode. Mencari produk yang namanya disebut pelanggan; kalau produk
    per_m2 dan ada ukuran di pesan, hitung total pastinya sekalian.

    Kalau pelanggan JELAS menanyakan harga tapi produknya tidak ketemu sama
    sekali (termasuk setelah toleransi typo di cari_produk), JANGAN balikin
    None — itu bikin pesan jatuh ke AI fallback yang biasa minta pelanggan
    mengulang pesan yang sama, dan kalau penyebabnya typo di pesan pelanggan,
    pengulangan itu gagal lagi selamanya (loop tanpa akhir, insiden nyata
    2026-08-12). Di sini kita kasih jawaban pasti + alihkan ke admin."""
    p = pesan.lower().strip()
    if not _cocok_kata_kunci(p, _KATA_HARGA, ambang=0.8):
        return None

    # Kategori yang cocok ke pricelist statis (mis. "buku yasin" -> cetak_khusus)
    # dijawab dari SANA dulu, JANGAN lanjut ke pencarian live Product DB di
    # bawah — DB bisa saja tidak punya produk itu sama sekali (mis. Buku Yasin
    # memang tidak ada sbg Product record) & fuzzy search malah nyasar ke
    # produk lain yang kebetulan mirip kata (bug ditemukan user 2026-08-15:
    # "berapa harga buku yasin" balas daftar stiker/UV/buku tahunan yang tidak
    # relevan sama sekali). Kategori yang SUDAH ditangani hitung_harga_otomatis
    # (banner/stiker/kartu_nama/kertas_a3) tetap boleh sampai sini kalau
    # kalkulator itu return None (mis. tidak sebut ukuran/qty) — pricelist
    # statis di sini jadi fallback yang lebih relevan drpd DB fuzzy juga.
    cocok_kategori = _cocok_kategori_pricelist(p)
    if cocok_kategori:
        info_kategori = get_pricelist_kategori(cocok_kategori[1])
        if info_kategori:
            panggilan_awal = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
            return (
                f"{info_kategori}\n\n"
                f"_Harga bisa berubah tergantung ukuran, bahan, dan jumlah order._\n"
                f"Mau langsung order? Balas dengan ketik *Order* ya {panggilan_awal}! 😊"
            )

    # Buang pola dimensi ("3x4m", "2 x 3") & qty ("2 lembar") dari pesan
    # SEBELUM membentuk query cari produk, baru bersihkan tanda baca & kata
    # basa-basi — BUKAN buang semua token digit mentah-mentah seperti dulu.
    # Buang-semua-digit salah membuang angka yang justru BAGIAN NAMA PRODUK
    # (mis. "Banner 240", "Banner 340"), jadi query jatuh cuma "banner" dan
    # nyangkut ke produk banner lain yang tidak dimaksud pelanggan (bug
    # ditemukan user 2026-08-15: "banner 240 ukuran 3x4m" balas info kategori
    # banner lain, bukan hitungan Banner 240 3x4m).
    p_tanpa_ukuran = _DIM_RE.sub(' ', p)
    p_tanpa_ukuran = _QTY_RE.sub(' ', p_tanpa_ukuran)
    kata_bersih = re.sub(r'[^a-z0-9\s]', ' ', p_tanpa_ukuran)
    kata_pesan = [w for w in kata_bersih.split() if w not in _KATA_BUANG_HARGA]
    kueri = ' '.join(kata_pesan).strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
    if not kueri:
        return None

    from .services.wa_ai_tools import cari_produk, hitung_harga_produk as _hitung_tool
    from .product_models import Product

    hasil = cari_produk(kueri)
    produk_list = hasil.get('produk') or []
    if not produk_list:
        _eskalasi_ke_admin(nomor, nama_pelanggan, pesan, alasan="produk yang ditanyakan tidak ditemukan")
        return (
            f"Mohon maaf {panggilan}, saya belum menemukan produk yang Kakak maksud di sistem kami. 🙏\n\n"
            f"Admin kami akan segera cek dan membalas chat ini langsung ya Kak, mohon ditunggu 😊"
        )
    panjang, lebar, qty = _parse_dimensi_qty(pesan)

    if len(produk_list) == 1:
        produk = Product.objects.filter(pk=produk_list[0]['product_id']).first()
        if produk and produk.price_type == 'per_m2' and panjang and lebar:
            hasil_hitung = _hitung_tool(product_id=produk.id, qty=qty or 1, panjang=panjang, lebar=lebar)
            if hasil_hitung.get('ok'):
                total_fmt = f"Rp{int(hasil_hitung['total']):,}".replace(',', '.')
                return (
                    f"Untuk {panggilan}, estimasi harga *{produk.nama}* "
                    f"ukuran {panjang:.2f}x{lebar:.2f}m x {qty or 1}: *{total_fmt}*\n\n"
                    "_Harga belum termasuk ongkos desain & finishing._\n"
                    "Mau lanjut pesan? Ketik *order* ya Kak 😊"
                )

    produk_by_id = {pr.id: pr for pr in Product.objects.filter(pk__in=[it['product_id'] for it in produk_list])}
    baris = []
    for item in produk_list[:5]:
        produk = produk_by_id.get(item['product_id'])
        if not produk:
            continue
        baris.append(f"• *{produk.nama}* — {_format_harga_produk(produk)}")
    if not baris:
        return None

    return (
        f"Untuk {panggilan}, ini harga yang saya temukan 😊:\n\n"
        + "\n".join(baris)
        + "\n\n_Harga bisa berubah tergantung ukuran, bahan, dan jumlah order._\n"
        "Mau pesan atau tanya detail lain? Balas aja ya Kak 🙏"
    )


def cek_rules_awal(pesan, nomor, nama_pelanggan):
    """
    Rules berbasis keyword — dieksekusi sebelum AI.
    Hanya kirim form jika pelanggan EKSPLISIT ingin order.
    Untuk tanya harga/produk → jawab INFO dulu, bukan form.
    """
    p = pesan.lower().strip()
    panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"

    if p == 'tanya detail katalog':
        return f"Kategori atau produk mana yang ingin ditanyakan detailnya, {panggilan}?"
    if p == 'pertanyaan lainnya':
        return f"Silakan tulis pertanyaan lainnya ya, {panggilan}. Saya siap membantu 😊"

    # ── SAPAAN ───────────────────────────────────────────────────
    sapaan_list = ['halo', 'p', 'ping', 'hai', 'hi', 'min', 'tes', 'test',
                   'pagi', 'siang', 'sore', 'malam', 'hei', 'permisi', 'selamat', 'assalamualaikum', 'ass']
    # Toleransi typo HANYA untuk pesan pendek (mis. "hallo") dibanding sapaan
    # yang cukup panjang (>=3 huruf) — supaya sapaan 1-2 huruf ('p', 'hi')
    # tidak jadi terlalu longgar dan salah memicu di kalimat panjang.
    sapaan_mirip = len(p) <= 10 and any(_mirip(p, s, 0.72) for s in sapaan_list if len(s) >= 3)
    if p in sapaan_list or sapaan_mirip or p.startswith('ass') or p.startswith('wass'):
        biz_name = get_business_name()
        if not nama_pelanggan:
            menunggu_nama.add(nomor)
            return (
                f"Halo Kak! Selamat datang di *{biz_name}* ⭐\n"
                "Boleh tahu nama Kakak siapa? 😊"
            )
        return TOMBOL_MARKER + (
            f"Halo {panggilan}! 👋 Selamat datang kembali di {biz_name}.\n"
            f"Ada yang bisa kami bantu? Silakan pilih ya Kak 😊"
        )

    # ── MENU ANGKA ───────────────────────────────────────────────
    if p in ['1', '2', '3']:
        if p == '1':
            form = get_form_order(nama_pelanggan)
            return f"Siap {panggilan}! Silakan *copy* dan isi form order berikut:\n\n{form}"
        elif p == '2':
            return (
                f"Mau tanya produk apa {panggilan}? Sebutkan nama produknya ya.\n\n"
                f"💡 *Kalkulator pintar*: ketik nama produk + ukuran + jumlah dalam 1 pesan, "
                f"langsung dihitungkan totalnya. Contoh: _\"banner 2x3 meter 2 lembar\"_\n"
                f"Belum yakin mau apa? Ketik *\"produk terlaris\"* atau *\"budget 200rb\"*, "
                f"saya bantu carikan yang cocok 😊"
            )
        elif p == '3':
            return (
                "Untuk cek status pesanan, kirimkan ID order kakak ya.\n"
                "Contoh: *Cek ORD-20260517-XXXX*\n\n"
                "ID order dikirimkan saat pertama kali pesan masuk. 😊"
            )

    # ── REKOMENDASI SESUAI BUDGET & PRODUK TERLARIS ───────────────
    # Dicek SEBELUM katalog umum — "produk terlaris apa" secara kebetulan
    # mengandung kata "produk"+"apa" yang juga jadi trigger katalog umum
    # (_KATA_KATALOG), jadi yang lebih spesifik menang duluan.
    jawaban_budget = jawab_produk_sesuai_budget(pesan, nama_pelanggan)
    if jawaban_budget:
        return jawaban_budget

    if _cocok_kata_kunci(p, _KATA_TERLARIS):
        return jawab_produk_terlaris(nama_pelanggan)

    # ── CEK TANYA HARI INI / CETAK CEPAT (RUSH ORDER) ─────────────
    kata_cepat = [
        'hari ini', 'langsung jadi', 'bisa ditunggu', 'express', 'kilat',
        'kapan jadi', 'selesai kapan', 'bisa jadi', 'hari ini jadi', 'langsung selesai',
        'buru-buru', 'kejar deadline', 'kapan beres', 'bisa ditunggu'
    ]
    if _cocok_kata_kunci(p, kata_cepat):
        return (
            f"Mohon maaf {panggilan}, untuk cetak cepat atau jika ingin jadi hari ini, "
            "kami perlu konfirmasi kepada staff terlebih dahulu terkait jam jadi, "
            "karena perlu melihat antrean yang sudah ada ya Kak. 🙏\n\n"
            "Boleh tahu rencana mau cetak produk apa, ukuran berapa, dan berapa banyak? "
            "Biar bisa kami tanyakan langsung ke staff produksi. 😊"
        )

    # ── MINTA FORM PEMBATALAN ─────────────────────────────────────
    # Dicek SEBELUM trigger order eksplisit di bawah — "mau batalkan
    # pesanan" typo-fuzzy-match ke "mau pesan" (kata_order_eksplisit) kalau
    # dicek belakangan, gara-gara toleransi typo _cocok_kata_kunci().
    kata_batalkan = [
        'batalkan pesanan', 'batalkan order', 'mau batalkan', 'cancel pesanan',
        'cancel order', 'batal pesanan', 'batal order', 'ingin membatalkan',
    ]
    if _cocok_kata_kunci(p, kata_batalkan):
        return f"Baik {panggilan}, silakan *copy* dan isi form berikut:\n\n{get_form_pembatalan()}"

    # ── MINTA FORM / EKSPLISIT MAU ORDER ─────────────────────────
    # Trigger 1: kata order eksplisit
    kata_order_eksplisit = [
        'mau order', 'mau pesan', 'ingin order', 'ingin pesan', 'mau buat pesanan',
        'minta form', 'kirim form', 'form order', 'mau daftar', 'daftar pesanan',
        'order sekarang', 'pesan sekarang', 'buat order', 'bikin order',
        'mau nge-order', 'mo order', 'mo pesan',
    ]
    if _cocok_kata_kunci(p, kata_order_eksplisit):
        # Kalau nama produk juga disebut di pesan yang sama (mis. "mau order
        # banner") — langsung ke alur info kategori spt Trigger 2 di bawah,
        # jangan kirim form kosong & abaikan produk yang sudah disebut.
        cocok_order = _cocok_kategori_pricelist(p)
        info_kategori_order = get_pricelist_kategori(cocok_order[1]) if cocok_order else None
        if info_kategori_order:
            menunggu_pilihan_produk.set(nomor, cocok_order[1])
            return (
                f"Kami memiliki beberapa pilihan terkait produk yang dipilih, sebagai berikut:\n\n"
                f"{info_kategori_order}\n\n"
                f"Produk yang mana yang {panggilan} mau pilih? 😊"
            )
        # Belum sebut produk apa pun — tanya dulu mau order yang mana, jangan
        # langsung kirim form kosong (instruksi user 2026-08-15: "mau order"
        # tanpa nama produk sebelumnya langsung dikirimi form, kurang sopan &
        # bikin bingung kalau baru saja nanya harga produk lain). Payload ''
        # (bukan None) supaya tetap terbaca "menunggu" oleh CacheState — STEP 1c
        # di views/whatsapp.py sudah menangani kategori kosong dgn wajar.
        menunggu_pilihan_produk.set(nomor, '')
        return (
            f"Baik {panggilan}, dengan senang hati 😊 Mau order produk yang mana ya, Kak? "
            f"Boleh sebutkan nama produknya dulu ya 🙏"
        )

    # Trigger 2: ada kata niat cetak/buat/bikin + nama produk → info kategori +
    # harga referensi dulu, BUKAN langsung form (instruksi user 2026-08-15) — sambil
    # tanya status desain, supaya bot tahu nanti kirim form order saja atau form
    # order + form desain sekaligus. Jawaban berikutnya ditangkap oleh state
    # `menunggu_status_desain` di views/whatsapp.py (webhook handler, dicek SEBELUM
    # cek_rules_awal dipanggil lagi).
    kata_niat = ['mau cetak', 'mau bikin', 'mau buat', 'pengen cetak', 'pengen bikin',
                 'butuh cetak', 'perlu cetak', 'cetak dong', 'bikin dong', 'mau print',
                 'mau ngeprint', 'butuh print', 'ingin cetak', 'ingin bikin',
                 # Pertanyaan ketersediaan ("ada cetak X ga kak?") juga dianggap
                 # niat produk — bukan cuma kalimat "mau X" (bug ditemukan user
                 # 2026-08-15: "Ada cetak buku yasin ga kak?" tidak kena trigger
                 # apapun & jatuh ke AI yang malah minta pelanggan ketik ulang).
                 'ada cetak', 'ada bikin', 'ada buat', 'ada print', 'ada jual',
                 'ada layanan', 'apa ada', 'apakah ada', 'tersedia']
    kata_produk_all = list(PRODUK_KE_KATEGORI_PRICELIST.keys()) + [
        'poster',  # belum ada kategori pricelist statis persis — tetap dikenali
    ]              # sbg nama produk spy Trigger 3 di bawah tidak menganggapnya aneh

    punya_niat  = _cocok_kata_kunci(p, kata_niat)
    punya_produk = _cocok_kata_kunci(p, kata_produk_all)

    if punya_niat and punya_produk:
        cocok = _cocok_kategori_pricelist(p)
        info_kategori = get_pricelist_kategori(cocok[1]) if cocok else None
        if info_kategori:
            # Simpan state MENUNGGU PILIHAN PRODUK dulu (bukan langsung tanya
            # status desain) — pelanggan sebutkan produk spesifik mana yang
            # dipilih dari daftar di atas, baru bot tanya status desain utk
            # produk itu (instruksi user 2026-08-15). Jawaban pelanggan
            # ditangkap state `menunggu_pilihan_produk` di views/whatsapp.py.
            menunggu_pilihan_produk.set(nomor, cocok[1])
            return (
                f"Kami memiliki beberapa pilihan terkait produk yang dipilih, sebagai berikut:\n\n"
                f"{info_kategori}\n\n"
                f"Produk yang mana yang {panggilan} mau pilih? 😊"
            )
        # Kategori tidak dikenali pricelist statis (mis. 'poster') atau SystemConfig
        # belum di-seed — tetap kirim form langsung spt sebelumnya biar tidak macet.
        form = get_form_order(nama_pelanggan)
        return f"Siap {panggilan}! Silakan *copy* dan isi form order berikut:\n\n{form}"

    # ── TANYA ISI KATEGORI TERTENTU ───────────────────────────────
    # Dicek SEBELUM katalog umum: kalau pelanggan sebut nama kategori nyata
    # (mis. balasan tombol "Tanya Detail" berupa "Banner", atau kalimat
    # "kategori stiker ada apa saja"), jawab produk NYATA di kategori itu —
    # lebih berguna daripada cuma dump semua nama kategori.
    jawaban_kategori = cek_isi_kategori(pesan, nama_pelanggan)
    if jawaban_kategori:
        return jawaban_kategori

    # ── TANYA KATALOG / PRODUK APA SAJA (semua kategori) ──────────
    # Dijawab LANGSUNG dari database di sini (bukan lewat AI) — beberapa
    # model/proxy AI (mis. gpt-5.6-luna via KoboiLLM) menolak permintaan
    # bertools sama sekali, sehingga fallback AI-nya tidak punya akses data
    # produk apa pun. Jalur rule-based ini tidak tergantung dukungan
    # tool-calling model manapun, jadi selalu bisa jawab dari katalog nyata.
    jawaban_katalog = cek_katalog_produk(pesan, nama_pelanggan)
    if jawaban_katalog:
        return jawaban_katalog

    # Trigger 3: hanya sebutkan produk TANPA tanya harga → tawarkan opsi
    # (Hanya jika pesannya sangat singkat/hanya nama produk saja, agar tidak menabrak pertanyaan kalimat lengkap/AI)
    is_short_keyword = (len(p) <= 15) or (p in [k.lower() for k in kata_produk_all])
    if punya_produk and is_short_keyword and not any(k in p for k in ['harga', 'berapa', 'tarif', 'biaya']):
        from django.core.cache import cache
        # Simpan nama produk yang disebut — dibaca lagi saat pelanggan tap
        # salah satu tombol (webhook belum tahu produk mana yang dimaksud
        # dari ID tombol saja).
        cache.set(f"wa_last_produk_{nomor}", pesan.strip(), timeout=600)
        return TOMBOL_MARKER_2 + f"Halo {panggilan}! 😊 Butuh bantuan apa untuk *{pesan.strip()}*?"

    return None


# ════════════════════════════════════════════════════════════════
# FAQ dari Database
# ════════════════════════════════════════════════════════════════

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
# AI FALLBACK
# ════════════════════════════════════════════════════════════════

def tanya_ai_finishing(nomor, nama_pelanggan=""):
    try:
        from openai import OpenAIError
    except ImportError:
        OpenAIError = Exception

    try:
        client = get_ai_client()
        if client is None:
            biz_name = get_business_name()
            return (
                f"Halo Kak! 👋 Ada yang bisa kami bantu terkait kebutuhan cetak Kakak di *{biz_name}*? 😊\n\n"
                "Kakak bisa menanyakan:\n"
                "• 🏷️ *Informasi Harga Produk* (spanduk, stiker, banner, kartu nama, brosur, dll.)\n"
                "• 📦 *Cek Status Pesanan* (ketik misal: _Cek ORD-2026xxxx_)\n"
                "• 📋 *Pemesanan Langsung* (kirim form pesanan)\n\n"
                "Silakan tanyakan apa yang Kakak butuhkan, kami siap membantu! 🙏✨"
            )

        history = get_memori_percakapan(nomor, nama_pelanggan)

        # Retry logic with exponential backoff and timeout handling.
        # TIDAK memakai tool-calling: model/proxy yang dipakai (KOBOI_MODEL)
        # bisa menolak parameter `tools` sama sekali (400 Bad Request), dan
        # data produk/harga NYATA sudah dijawab lebih dulu di jalur
        # deterministik (cek_harga_produk/cek_katalog_produk) sebelum pesan
        # sampai ke sini — lihat instruksi redirect-ke-keyword di system
        # prompt. Di sini AI cukup menjawab percakapan kontekstual biasa.
        import time

        max_retries = 3
        model_name = os.getenv("KOBOI_MODEL", "gemini-2.5-pro")
        backoff = 1.0
        response = None
        terakhir = None
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=model_name, messages=history, max_tokens=2048,
                    temperature=0.3, timeout=15.0,
                )
                break
            except Exception as e:
                logger.warning(f"AI completion attempt {attempt + 1} failed: {e}")
                terakhir = e
                if attempt < max_retries - 1:
                    time.sleep(backoff)
                    backoff *= 2.0
        if response is None:
            raise terakhir

        if not response or not hasattr(response, 'choices') or not response.choices:
            raise ValueError("No completion choices returned from AI model")

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response content returned from AI model")

        return content
    except ValueError as e:
        logger.error(f"[ERROR AI Webhook] Invalid response structure: {e}")
        return "Halo Kak! Mohon maaf, respon AI kami sedang kosong. Bisa diulangi pertanyaannya? 🙏😊"
    except OpenAIError as e:
        logger.error(f"[ERROR AI Webhook] OpenAI API error occurred: {e}", exc_info=True)
        biz_name = get_business_name()
        return (
            f"Halo Kak! Terima kasih sudah menghubungi *{biz_name}* 😊\n\n"
            "Admin kami akan segera membantu menjawab pertanyaan Kakak secara langsung. "
            "Atau Kakak bisa menanyakan harga produk, tracking pesanan (*Cek ORD-...*), atau langsung mengisi form pesanan ya Kak! 🙏✨"
        )
    except Exception as e:
        logger.error(f"[ERROR AI Webhook] Unexpected error: {e}", exc_info=True)
        biz_name = get_business_name()
        return (
            f"Halo Kak! Terima kasih sudah menghubungi *{biz_name}*. "
            "Admin kami akan segera membalas chat Kakak sebentar lagi ya... 🙏😊"
        )
