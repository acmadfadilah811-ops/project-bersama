"""Tool/function calling untuk AI bot WA — memberi AI akses baca ke katalog
produk/paket/varian NYATA di Product & Inventori, menggantikan teks katalog
hardcode dan tabel `ProductPrice` legacy. Harga SELALU dihitung lewat
`hitung_harga_produk` (baca `Product.price_type`/`tiers` langsung) — AI tidak
pernah diberi wewenang menghitung/menaksir harga sendiri (sama seperti M6 di
alur kasir: server yang menghitung, bukan klien/AI).
"""

import difflib
import logging
import re

from django.db.models import Q

from .product_pricing import hitung_harga as _hitung_harga_produk, HargaProdukError

logger = logging.getLogger(__name__)

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "cari_produk",
            "description": (
                "Cari produk, paket, atau jasa cetak yang tersedia di Bintang Advertising "
                "berdasarkan kata kunci (nama produk atau kategori). Gunakan ini setiap kali "
                "pelanggan bertanya produk/jasa apa saja yang tersedia, atau menyebut nama "
                "produk tertentu. JANGAN PERNAH mengarang nama atau daftar produk sendiri — "
                "selalu panggil tool ini dulu."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kata_kunci": {
                        "type": "string",
                        "description": "Kata kunci pencarian, mis. 'banner' atau 'kartu nama'. Kosongkan untuk daftar umum.",
                    },
                },
                "required": [],
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


def cari_produk(kata_kunci=''):
    from ..product_models import Product, ProductPackage

    kata_kunci = (kata_kunci or '').strip()
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


TOOL_FUNCTIONS = {
    'cari_produk': cari_produk,
    'hitung_harga_produk': hitung_harga_produk,
}


def jalankan_tool(nama_tool, argumen):
    fn = TOOL_FUNCTIONS.get(nama_tool)
    if fn is None:
        return {'ok': False, 'error': f"Tool '{nama_tool}' tidak dikenal."}
    try:
        return fn(**(argumen or {}))
    except TypeError as e:
        logger.warning(f"Argumen tool '{nama_tool}' tidak valid: {e}")
        return {'ok': False, 'error': 'Argumen tidak valid.'}
    except Exception:
        logger.exception(f"Tool '{nama_tool}' gagal dieksekusi")
        return {'ok': False, 'error': 'Terjadi kesalahan internal saat memproses permintaan ini.'}
