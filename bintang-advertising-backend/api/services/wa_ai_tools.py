"""Tool/function calling untuk AI bot WA — memberi AI akses baca ke katalog
produk/paket/varian NYATA di Product & Inventori, menggantikan teks katalog
hardcode dan tabel `ProductPrice` legacy. Harga SELALU dihitung lewat
`hitung_harga_produk` (baca `Product.price_type`/`tiers` langsung) — AI tidak
pernah diberi wewenang menghitung/menaksir harga sendiri (sama seperti M6 di
alur kasir: server yang menghitung, bukan klien/AI).

Pengecualian penting: untuk pertanyaan JELAJAH KATALOG UMUM ("ada produk apa
saja") jawabannya BUKAN dump `Product` DB (itu terlalu global -- tabel yang
sama juga menyimpan Bahan Baku/item internal yang tidak layak ditampilkan ke
pelanggan, bug nyata ditemukan user 2026-08-15 lalu diperbaiki, dan
ditemukan LAGI oleh user 2026-09-10 setelah rebuild AI agent tidak sengaja
menghidupkan lagi jalur ini lewat `cari_produk('')`). Untuk itu pakai
`daftar_kategori_produk` -- sumbernya `SystemConfig['wa_pricelist_kategori']`,
pricelist resmi yang di-maintain terpisah (lihat management/commands/
seed_wa_pricelist.py & `#PRICELIST STAR DIGIPRINT...md`), bukan Product DB.
"""

import difflib
import json
import logging
import re

from django.db.models import Q

from .product_pricing import hitung_harga as _hitung_harga_produk, HargaProdukError

logger = logging.getLogger(__name__)

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "daftar_kategori_produk",
            "description": (
                "Daftar kategori produk & harga REFERENSI resmi dari pricelist toko. WAJIB "
                "dipakai untuk pertanyaan JELAJAH UMUM ('ada produk apa saja', 'jual apa aja', "
                "minta lihat katalog) -- JANGAN PERNAH pakai cari_produk untuk kasus ini (itu "
                "database internal operasional, terlalu global & ada item non-produk-jual seperti "
                "bahan baku yang tidak relevan ditampilkan ke pelanggan). Panggil TANPA parameter "
                "dulu untuk lihat daftar semua kategori, lalu panggil LAGI dengan parameter "
                "`kategori` (salah satu slug dari hasil pertama) untuk detail harga kategori itu."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kategori": {
                        "type": "string",
                        "description": "Slug kategori dari hasil panggilan tanpa parameter sebelumnya, mis. 'banner'. Kosongkan untuk lihat daftar semua kategori dulu.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cari_produk",
            "description": (
                "Cari SATU produk/paket spesifik yang NAMANYA sudah disebut pelanggan (mis. "
                "'banner 240', 'kartu nama ivory'), biasanya sebagai langkah SEBELUM "
                "hitung_harga_produk atau buat_pesanan. JANGAN PERNAH panggil dengan kata_kunci "
                "kosong untuk pertanyaan umum 'ada produk apa saja' -- pakai daftar_kategori_produk "
                "untuk itu. JANGAN PERNAH mengarang nama produk sendiri, selalu panggil tool ini dulu."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kata_kunci": {
                        "type": "string",
                        "description": "Nama/kata kunci produk spesifik yang disebut pelanggan, mis. 'banner' atau 'kartu nama'. WAJIB diisi -- jangan kosongkan.",
                    },
                },
                "required": ["kata_kunci"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "hitung_harga_produk",
            "description": (
                "Hitung harga resmi satu produk berdasarkan product_id (dari hasil cari_produk), "
                "qty, dan opsional panjang/lebar dalam meter (WAJIB diisi untuk produk yang "
                "dihitung per meter persegi — cek field 'price_type' dari cari_produk). WAJIB "
                "dipakai setiap kali memberi angka harga ke pelanggan — JANGAN PERNAH menghitung "
                "atau menaksir harga sendiri."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "ID produk dari hasil cari_produk."},
                    "qty": {"type": "number", "description": "Jumlah/qty yang dipesan.", "default": 1},
                    "panjang": {"type": "number", "description": "Panjang dalam meter (khusus produk per meter persegi)."},
                    "lebar": {"type": "number", "description": "Lebar dalam meter (khusus produk per meter persegi)."},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cek_status_pesanan",
            "description": (
                "Cek status pesanan pelanggan. Isi nomor_order kalau pelanggan sebut ID pesanan "
                "(format ORD-...). Kosongkan nomor_order untuk cari pesanan TERBARU milik pelanggan "
                "yang sedang chat ini secara otomatis (sistem tahu nomor WA-nya sendiri)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "nomor_order": {"type": "string", "description": "ID pesanan, mis. 'ORD-20260910-XXXX'. Kosongkan kalau pelanggan tidak menyebutnya."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "produk_terlaris",
            "description": "Daftar produk paling sering dipesan pelanggan lain (data riwayat order asli) — pakai untuk rekomendasi kalau pelanggan belum tahu mau pesan apa.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "produk_sesuai_budget",
            "description": (
                "Cari produk dengan harga TETAP (bukan per meter persegi) yang muat di budget "
                "pelanggan. Pakai kalau pelanggan sebut nominal budget tanpa nama produk spesifik."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "budget": {"type": "number", "description": "Nominal budget dalam Rupiah, mis. 200000 untuk 'budget 200rb'."},
                },
                "required": ["budget"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cek_faq",
            "description": "Cari jawaban dari daftar FAQ resmi toko (jam buka, lokasi, kebijakan umum, dll) sebelum menjawab dari pengetahuan umum.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pertanyaan": {"type": "string", "description": "Pertanyaan pelanggan apa adanya."},
                },
                "required": ["pertanyaan"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ambil_template_form_order",
            "description": (
                "Ambil TEMPLATE resmi form order untuk dikirim ke pelanggan yang siap order. "
                "WAJIB relay hasilnya PERSIS APA ADANYA ke pelanggan (jangan diketik ulang/diubah "
                "formatnya) — pelanggan akan copy-isi-kirim balik form ini."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "jenis_produk": {"type": "string", "description": "Nama produk yang sudah diketahui, buat pre-isi kolom. Kosongkan kalau belum tahu."},
                    "bahan": {"type": "string", "description": "Bahan yang sudah disebut pelanggan, kalau ada."},
                    "finishing": {"type": "string", "description": "Finishing yang sudah disebut pelanggan, kalau ada."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buat_pesanan",
            "description": (
                "Buat draft pesanan dari data yang sudah dikumpulkan lewat percakapan (nama produk, "
                "jumlah, ukuran, bahan, finishing untuk tiap item). SELALU validasi dulu Bahan & "
                "Finishing kalau produknya butuh -- kalau tool ini balas field_kurang, minta "
                "pelanggan lengkapi dulu, JANGAN coba panggil lagi sebelum datanya lengkap. Kalau "
                "berhasil, tool ini akan balas REKAP -- sampaikan rekap itu ke pelanggan APA ADANYA "
                "dan minta konfirmasi 'sesuai' sebelum pesanan benar-benar tersimpan (pelanggan balas "
                "'sesuai' langsung ditangani sistem, BUKAN tugas kamu lagi)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "jenis_produk": {"type": "string"},
                                "qty": {"type": "integer", "description": "Jumlah, wajib > 0."},
                                "panjang": {"type": "number", "description": "Panjang dalam meter, khusus produk per m2."},
                                "lebar": {"type": "number", "description": "Lebar dalam meter, khusus produk per m2."},
                                "bahan": {"type": "string"},
                                "finishing": {"type": "string"},
                                "keterangan": {"type": "string"},
                                "file_desain_sudah_ada": {"type": "boolean", "description": "true kalau pelanggan bilang sudah punya file desain."},
                            },
                            "required": ["jenis_produk", "qty"],
                        },
                    },
                },
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "eskalasi_admin",
            "description": (
                "Teruskan permintaan pelanggan ke admin/manager manusia -- pakai ini untuk hal di "
                "luar wewenangmu: komplain, retur/pembatalan pesanan yang sudah selesai, permintaan "
                "diskon khusus, atau kalau kamu benar-benar tidak yakin jawabannya setelah coba tools "
                "lain. JANGAN pernah menjanjikan sesuatu yang bukan wewenangmu (refund, diskon, dll)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "alasan": {"type": "string", "description": "Ringkasan singkat kenapa perlu eskalasi ke admin."},
                },
                "required": ["alasan"],
            },
        },
    },
]


def _serialize_produk(p):
    if p.price_type == 'per_m2':
        catatan = 'Harga per meter persegi — panggil hitung_harga_produk dengan panjang & lebar (meter).'
    elif p.price_type == 'tier':
        catatan = 'Harga bertingkat sesuai qty — panggil hitung_harga_produk dengan qty pelanggan.'
    else:
        catatan = 'Harga flat per satuan.'
    return {
        'product_id': p.id,
        'nama': p.nama,
        'kategori': p.kategori.nama if p.kategori_id else None,
        'deskripsi': (p.deskripsi or '')[:300],
        'satuan': p.satuan,
        'price_type': p.price_type,
        'catatan_harga': catatan,
    }


def _serialize_paket(pk):
    return {
        'nama': pk.nama,
        'tipe': 'paket',
        'deskripsi': (pk.deskripsi or '')[:300],
        'harga': float(pk.harga_jual_offline or 0),
    }


def _cari_produk_typo_toleran(kata_kunci, ambang=0.78, batas_produk=15, batas_paket=10):
    """Fallback saat pencarian exact (`icontains`) tidak menemukan apa pun —
    toleransi typo umum pelanggan WA (mis. 'benner' -> 'banner') lewat
    kemiripan string per-kata, sama gaya dengan `_mirip`/`_cocok_kata_kunci`
    di wa_logic.py. Tidak mengarang data, cuma memperluas pencocokan nama
    yang sudah nyata di database."""
    from ..product_models import Product, ProductPackage

    kata_list = [w for w in re.split(r'\s+', kata_kunci.lower()) if len(w) >= 3]
    if not kata_list:
        return [], []

    def cocok(nama):
        nama_kata = re.split(r'\s+', nama.lower())
        return any(
            difflib.SequenceMatcher(None, kw, nw).ratio() >= ambang
            for kw in kata_list for nw in nama_kata
        )

    produk_cocok = []
    for p in Product.objects.filter(is_active=True).select_related('kategori'):
        if cocok(p.nama):
            produk_cocok.append(p)
            if len(produk_cocok) >= batas_produk:
                break

    paket_cocok = []
    for pk in ProductPackage.objects.filter(publikasi=True):
        if cocok(pk.nama):
            paket_cocok.append(pk)
            if len(paket_cocok) >= batas_paket:
                break

    return produk_cocok, paket_cocok


def daftar_kategori_produk(kategori=None):
    """Sumber jelajah katalog UMUM untuk pelanggan -- pricelist resmi
    (SystemConfig 'wa_pricelist_kategori', diisi management command
    seed_wa_pricelist dari file pricelist resmi), BUKAN dump Product DB.
    Product DB itu tabel operasional internal (ada Bahan Baku dkk, tidak
    dikurasi untuk konsumsi pelanggan) -- bug nyata ditemukan user
    2026-08-15, lalu ketemu LAGI 2026-09-10 setelah cari_produk('') tanpa
    sengaja jadi jalur browse katalog di rebuild AI agent."""
    from ..models import SystemConfig

    try:
        data = json.loads(SystemConfig.objects.get(key='wa_pricelist_kategori').value)
    except SystemConfig.DoesNotExist:
        data = None
    if not data:
        return {'ok': False, 'error': 'Daftar kategori produk belum tersedia, langsung eskalasi_admin saja.'}

    kategori = (kategori or '').strip()
    if not kategori:
        return {
            'ok': True,
            'kategori_tersedia': list(data.keys()),
            'catatan': 'Panggil lagi tool ini dgn parameter kategori (salah satu slug di atas) utk detail harga.',
        }

    detail = data.get(kategori)
    if detail is None:
        return {'ok': False, 'error': f"Kategori '{kategori}' tidak dikenal.", 'kategori_tersedia': list(data.keys())}
    return {'ok': True, 'kategori': kategori, 'detail': detail}


def cari_produk(kata_kunci=''):
    from ..product_models import Product, ProductPackage

    kata_kunci = (kata_kunci or '').strip()
    if not kata_kunci:
        return {
            'ok': True, 'produk': [], 'paket': [],
            'catatan': (
                'kata_kunci kosong -- tool ini bukan untuk jelajah katalog umum. Untuk '
                "pertanyaan 'ada produk apa saja' pakai tool daftar_kategori_produk."
            ),
        }
    produk_qs = Product.objects.filter(is_active=True).select_related('kategori')
    paket_qs = ProductPackage.objects.filter(publikasi=True)
    if kata_kunci:
        produk_qs = produk_qs.filter(Q(nama__icontains=kata_kunci) | Q(kategori__nama__icontains=kata_kunci))
        paket_qs = paket_qs.filter(nama__icontains=kata_kunci)

    produk_list = list(produk_qs[:15])
    paket_list = list(paket_qs[:10])

    if kata_kunci and not produk_list and not paket_list:
        produk_list, paket_list = _cari_produk_typo_toleran(kata_kunci)

    produk = [_serialize_produk(p) for p in produk_list]
    paket = [_serialize_paket(pk) for pk in paket_list]

    if not produk and not paket:
        return {'ok': True, 'produk': [], 'paket': [], 'catatan': 'Tidak ada produk yang cocok dengan kata kunci ini.'}
    return {'ok': True, 'produk': produk, 'paket': paket}


def hitung_harga_produk(product_id=None, qty=1, panjang=None, lebar=None):
    from ..product_models import Product

    try:
        product = Product.objects.get(pk=product_id, is_active=True)
    except (Product.DoesNotExist, ValueError, TypeError):
        return {'ok': False, 'error': 'Produk tidak ditemukan.'}

    try:
        hasil = _hitung_harga_produk(product, qty=qty, panjang=panjang, lebar=lebar)
    except HargaProdukError as e:
        return {'ok': False, 'error': str(e)}

    hasil['ok'] = True
    hasil['produk'] = product.nama
    return hasil


def cek_status_pesanan(nomor_order=None, nomor=None):
    """`nomor` (nomor WA pengirim) SENGAJA tidak ada di TOOL_SCHEMAS --
    diinjeksi otomatis oleh jalankan_tool() dari konteks percakapan asli,
    BUKAN parameter yang bisa diisi AI/pelanggan (keamanan: cegah pelanggan
    "minta" AI mengecek nomor WA orang lain lewat prompt injection)."""
    from ..models import Order
    from ..wa_logic import format_tracking

    if nomor_order:
        order_id = str(nomor_order).strip().upper()
        try:
            order = Order.objects.prefetch_related('items__jobs').get(id=order_id)
            return {'ok': True, 'status_text': format_tracking(order)}
        except Order.DoesNotExist:
            return {'ok': False, 'error': f"Pesanan {order_id} tidak ditemukan."}

    orders = Order.objects.filter(nomor_wa=nomor).order_by('-waktu')[:3] if nomor else []
    if not orders:
        return {'ok': False, 'error': 'Belum ada pesanan tersimpan atas nomor ini.'}
    if len(orders) == 1:
        return {'ok': True, 'status_text': format_tracking(orders[0])}
    return {
        'ok': True,
        'catatan': 'Ada beberapa pesanan, minta pelanggan sebutkan ID spesifik kalau mau detail salah satu.',
        'daftar_pesanan': [
            {'id': o.id, 'produk': (o.items.first().jenis_produk if o.items.exists() else 'Umum'), 'status': o.status_global}
            for o in orders
        ],
    }


def produk_terlaris():
    from ..wa_logic import cek_produk_terlaris
    hasil = cek_produk_terlaris()
    if not hasil:
        return {'ok': True, 'produk_terlaris': [], 'catatan': 'Belum ada cukup data histori pesanan.'}
    return {'ok': True, 'produk_terlaris': [{'nama': nama, 'jumlah_dipesan': jumlah} for nama, jumlah in hasil]}


def produk_sesuai_budget(budget=None):
    from ..product_models import Product
    try:
        budget = float(budget)
    except (TypeError, ValueError):
        return {'ok': False, 'error': 'Budget harus berupa angka.'}
    if budget <= 0:
        return {'ok': False, 'error': 'Budget harus lebih dari nol.'}

    produk_list = list(
        Product.objects.filter(
            is_active=True, price_type='flat', harga_jual_toko__lte=budget, harga_jual_toko__gt=0,
        ).order_by('-harga_jual_toko')[:5]
    )
    if not produk_list:
        return {
            'ok': True, 'produk': [],
            'catatan': (
                'Tidak ada produk harga tetap yang muat di budget ini. Banyak produk kami dihitung '
                'per ukuran (per m2) jadi bisa disesuaikan -- tanyakan produk spesifiknya ke pelanggan.'
            ),
        }
    return {
        'ok': True,
        'produk': [{'product_id': p.id, 'nama': p.nama, 'harga': float(p.harga_jual_toko)} for p in produk_list],
    }


def cek_faq(pertanyaan=None):
    from ..wa_logic import cek_database_faq
    hasil = cek_database_faq(pertanyaan or '', '')
    if hasil is None:
        return {'ok': True, 'jawaban': None, 'catatan': 'Tidak ada FAQ yang cocok, jawab dari informasi bisnis di system prompt kalau relevan.'}
    return {'ok': True, 'jawaban': hasil}


def ambil_template_form_order(jenis_produk='', bahan='', finishing=''):
    from ..wa_logic import get_form_order
    return {'ok': True, 'template': get_form_order(jenis_produk=jenis_produk, bahan=bahan, finishing=finishing)}


def buat_pesanan(items=None, nomor=None, nama_pelanggan=None):
    """`nomor`/`nama_pelanggan` diinjeksi dari konteks (lihat catatan di
    cek_status_pesanan) -- BUKAN parameter yang AI/pelanggan bisa atur.

    Validasi Bahan/Finishing WAJIB terjadi di sini, PALING AWAL, SEBELUM
    apa pun lain (instruksi user 2026-09-10: gerbang konfirmasi harus
    setelah validasi ini, bukan sebaliknya -- pernah ada insiden lolos
    validasi krn urutan kebalik di alur interaktif lama). Kalau lolos,
    draft disimpan ke wa_logic.pending_order_form -- CacheState yang SAMA
    dipakai jalur form-teks manual (views/whatsapp.py Step 2 "Konfirmasi
    'sesuai'"), jadi konfirmasi pelanggan berikutnya otomatis tertangkap
    logic yang SUDAH ADA & teruji, tidak perlu tool 'konfirmasi' terpisah."""
    from ..wa_logic import cek_bahan_finishing_kurang, format_pesan_field_kurang, pending_order_form

    if not items:
        return {'ok': False, 'error': 'Belum ada item pesanan.'}
    if not nomor:
        return {'ok': False, 'error': 'Nomor pelanggan tidak diketahui, tidak bisa membuat pesanan.'}

    field_kurang_list = []
    items_bersih = []
    for i, item in enumerate(items, start=1):
        jenis_produk = str(item.get('jenis_produk') or '').strip()
        qty = item.get('qty')
        if not jenis_produk:
            return {'ok': False, 'error': f"Item ke-{i}: jenis_produk wajib diisi."}
        if not isinstance(qty, int) or qty <= 0:
            return {'ok': False, 'error': f"Item ke-{i} ({jenis_produk}): qty wajib angka bulat > 0."}

        bahan = str(item.get('bahan') or '')
        finishing = str(item.get('finishing') or '')
        kurang = cek_bahan_finishing_kurang(jenis_produk, bahan, finishing)
        if kurang:
            field_kurang_list.append((i, jenis_produk, kurang))

        items_bersih.append({
            'jenis_produk': jenis_produk,
            'qty': qty,
            'panjang': float(item.get('panjang') or 0),
            'lebar': float(item.get('lebar') or 0),
            'bahan': bahan,
            'finishing': finishing,
            'keterangan': str(item.get('keterangan') or ''),
            'file_desain_belum': not bool(item.get('file_desain_sudah_ada')),
        })

    if field_kurang_list:
        # BERHENTI DI SINI -- tidak ada state disimpan, tidak ada rekap dibuat.
        return {'ok': False, 'field_kurang': True, 'error': format_pesan_field_kurang(field_kurang_list)}

    pending_order_form.set(nomor, {
        'nomor': nomor,
        'nama_kontak': nama_pelanggan or '',
        'nama_order': nama_pelanggan or '',
        'raw_detail': '(dibuat via AI agent tools)',
        'items': items_bersih,
        'is_desain_ready': any(not it['file_desain_belum'] for it in items_bersih),
    })

    baris = []
    for i, it in enumerate(items_bersih, start=1):
        baris.append(f"*Item {i}: {it['jenis_produk']}*")
        baris.append(f"- Jumlah: {it['qty']}")
        if it['panjang'] and it['lebar']:
            baris.append(f"- Ukuran: {it['panjang']:.1f}x{it['lebar']:.1f}m")
        if it['bahan']:
            baris.append(f"- Bahan/Material: {it['bahan']}")
        if it['finishing']:
            baris.append(f"- Finishing: {it['finishing']}")
        baris.append(f"- File Desain: {'belum ada' if it['file_desain_belum'] else 'sudah ada'}")
    rekap = "\n".join(baris)
    return {
        'ok': True,
        'rekap': rekap,
        'instruksi': "Sampaikan rekap ini ke pelanggan APA ADANYA, lalu minta konfirmasi dgn kata 'sesuai' kalau semua sudah benar.",
    }


def eskalasi_admin(alasan=None, nomor=None, nama_pelanggan=None, pesan_asli=None):
    from ..wa_logic import _eskalasi_ke_admin
    _eskalasi_ke_admin(nomor, nama_pelanggan, pesan_asli, alasan or 'Eskalasi dari AI agent')
    return {'ok': True, 'catatan': 'Admin sudah diberi tahu. Sampaikan ke pelanggan bahwa admin akan segera membantu.'}


TOOL_FUNCTIONS = {
    'daftar_kategori_produk': daftar_kategori_produk,
    'cari_produk': cari_produk,
    'hitung_harga_produk': hitung_harga_produk,
    'cek_status_pesanan': cek_status_pesanan,
    'produk_terlaris': produk_terlaris,
    'produk_sesuai_budget': produk_sesuai_budget,
    'cek_faq': cek_faq,
    'ambil_template_form_order': ambil_template_form_order,
    'buat_pesanan': buat_pesanan,
    'eskalasi_admin': eskalasi_admin,
}


def jalankan_tool(nama_tool, argumen, konteks=None):
    """`konteks` (nomor, nama_pelanggan, pesan_asli) = data TERPERCAYA dari
    webhook, bukan dari AI -- diinjeksi ke tool yang mendeklarasikan kwarg
    itu (cek nama parameter via inspect), dan SELALU MENANG kalau AI juga
    somehow menyertakan key yang sama (defense in depth thd prompt
    injection: pelanggan tidak bisa menyuruh AI "atas nama nomor lain")."""
    import inspect

    fn = TOOL_FUNCTIONS.get(nama_tool)
    if fn is None:
        return {'ok': False, 'error': f"Tool '{nama_tool}' tidak dikenal."}
    kwargs = dict(argumen or {})
    if konteks:
        diterima = set(inspect.signature(fn).parameters)
        for k, v in konteks.items():
            if k in diterima:
                kwargs[k] = v
    try:
        return fn(**kwargs)
    except TypeError as e:
        logger.warning(f"Argumen tool '{nama_tool}' tidak valid: {e}")
        return {'ok': False, 'error': 'Argumen tidak valid.'}
    except Exception:
        logger.exception(f"Tool '{nama_tool}' gagal dieksekusi")
        return {'ok': False, 'error': 'Terjadi kesalahan internal saat memproses permintaan ini.'}
