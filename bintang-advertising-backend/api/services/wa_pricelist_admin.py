"""CRUD admin untuk pricelist bot WA (dipakai halaman Pengaturan > Pengaturan
Bisnis > sub-tab "Pricelist WA Bot" di frontend, permintaan user 2026-09-18).

Sumber data TETAP SystemConfig 'wa_pricelist_kategori' (teks tampilan per
kategori, dibaca AI tool daftar_kategori_produk) & 'wa_kalkulator_bahan'
(data terstruktur 4 kategori, dibaca AI tool hitung_harga_pricelist) --
lihat api/services/wa_ai_tools.py & api/management/commands/seed_wa_pricelist.py
untuk skema JSON persis yang HARUS tetap kompatibel (jangan ubah bentuknya
di sini tanpa menyesuaikan wa_ai_tools.py juga).

Sebelum modul ini ada, satu-satunya cara update pricelist adalah edit dict
Python di seed_wa_pricelist.py lalu jalankan ulang command-nya -- modul ini
memindahkan itu ke UI (form per kategori + import/export CSV utk kategori
yang datanya terstruktur/tabular), TANPA mengubah cara AI tool membaca data
(SystemConfig key & bentuk JSON-nya persis sama).
"""
import csv
import io
import json

from django.db import transaction

from ..models import SystemConfig

KATEGORI_LABEL = {
    'banner': 'Banner / Spanduk / MMT',
    'stiker': 'Stiker / Docu Stiker A3+',
    'kertas_a3': 'Docu Kertas A3+',
    'kartu_nama': 'Kartu Nama',
    'brosur': 'Paket Cetak Brosur / Flyer',
    'cetak_khusus': 'Produk Cetak Khusus',
    'merchandise': 'Merchandise & Promosi',
    'kaos': 'Kaos / Apparel',
    'acrylic': 'Acrylic & Plakat',
    'cutting_finishing': 'Jasa Cutting, Potong & Finishing',
}
# Urutan tampilan di UI -- sama dengan urutan KATEGORI_PRICELIST di
# seed_wa_pricelist.py supaya tidak membingungkan saat dibandingkan.
KATEGORI_ORDER = list(KATEGORI_LABEL.keys())
# 4 kategori yang punya data terstruktur (wa_kalkulator_bahan) selain teks
# tampilan -- selebihnya HANYA teks bebas (SATU-SATUNYA sumber datanya).
TERSTRUKTUR_SLUGS = {'banner', 'stiker', 'kertas_a3', 'kartu_nama'}


class PricelistAdminError(Exception):
    pass


def _load_teks():
    try:
        return json.loads(SystemConfig.objects.get(key='wa_pricelist_kategori').value)
    except SystemConfig.DoesNotExist:
        return {}


def _load_kalkulator():
    try:
        return json.loads(SystemConfig.objects.get(key='wa_kalkulator_bahan').value)
    except SystemConfig.DoesNotExist:
        return {}


def _kategori_dict(slug, teks_map, kalkulator_map):
    terstruktur = slug in TERSTRUKTUR_SLUGS
    entry = {
        'slug': slug,
        'label': KATEGORI_LABEL.get(slug, slug),
        'teks': teks_map.get(slug, ''),
        'terstruktur': terstruktur,
    }
    if terstruktur:
        data = kalkulator_map.get(slug) or {'satuan': '', 'tiers': [], 'bahan': []}
        entry['satuan'] = data.get('satuan', '')
        entry['tiers'] = data.get('tiers', [])
        entry['bahan'] = data.get('bahan', [])
    return entry


def get_semua_kategori():
    """Daftar semua kategori (urutan tetap) + data teks & (kalau ada)
    terstruktur -- dipakai GET list halaman admin."""
    teks_map = _load_teks()
    kalkulator_map = _load_kalkulator()
    # Kategori di SystemConfig tapi tidak ada di KATEGORI_LABEL (mis. hasil
    # seed manual lama) tetap ditampilkan di akhir, bukan hilang diam-diam.
    dikenal = set(KATEGORI_ORDER)
    urutan = KATEGORI_ORDER + sorted(k for k in teks_map if k not in dikenal)
    return [_kategori_dict(slug, teks_map, kalkulator_map) for slug in urutan]


def get_satu_kategori(slug):
    teks_map = _load_teks()
    kalkulator_map = _load_kalkulator()
    if slug not in teks_map and slug not in kalkulator_map and slug not in KATEGORI_LABEL:
        raise PricelistAdminError(f"Kategori '{slug}' tidak dikenal.")
    return _kategori_dict(slug, teks_map, kalkulator_map)


def _validasi_bahan(slug, bahan, tiers):
    if not isinstance(bahan, list) or not bahan:
        raise PricelistAdminError('Daftar bahan tidak boleh kosong.')
    jumlah_harga_diharapkan = len(tiers) + 1 if tiers else None
    hasil = []
    for i, b in enumerate(bahan, start=1):
        nama = str(b.get('nama', '')).strip()
        if not nama:
            raise PricelistAdminError(f'Baris ke-{i}: nama bahan wajib diisi.')
        harga = b.get('harga')
        if jumlah_harga_diharapkan is None:
            try:
                harga_bersih = round(float(harga))
            except (TypeError, ValueError):
                raise PricelistAdminError(f"Baris ke-{i} ('{nama}'): harga harus angka.")
        else:
            if not isinstance(harga, list) or len(harga) != jumlah_harga_diharapkan:
                raise PricelistAdminError(
                    f"Baris ke-{i} ('{nama}'): butuh {jumlah_harga_diharapkan} nilai harga "
                    f"(sesuai {len(tiers)} tingkatan qty), dapat {len(harga) if isinstance(harga, list) else 0}."
                )
            try:
                harga_bersih = [round(float(h)) for h in harga]
            except (TypeError, ValueError):
                raise PricelistAdminError(f"Baris ke-{i} ('{nama}'): semua harga harus angka.")
        hasil.append({'nama': nama, 'harga': harga_bersih})
    return hasil


@transaction.atomic
def update_kategori(slug, teks, bahan=None):
    """Simpan teks tampilan (semua kategori) + bahan terstruktur (kalau
    kategori ini termasuk TERSTRUKTUR_SLUGS). `bahan` diabaikan utk
    kategori non-terstruktur. Tier/satuan TIDAK bisa diubah lewat sini
    (struktural, ditentukan seed_wa_pricelist.py) -- hanya nama & harga
    tiap baris bahan."""
    slug = (slug or '').strip()
    if not slug:
        raise PricelistAdminError('Slug kategori wajib diisi.')
    teks = (teks or '').strip()
    if not teks:
        raise PricelistAdminError('Teks tampilan tidak boleh kosong.')

    teks_map = _load_teks()
    teks_map[slug] = teks
    SystemConfig.objects.update_or_create(
        key='wa_pricelist_kategori', defaults={'value': json.dumps(teks_map, ensure_ascii=False)},
    )

    if slug in TERSTRUKTUR_SLUGS:
        kalkulator_map = _load_kalkulator()
        existing = kalkulator_map.get(slug) or {}
        tiers = existing.get('tiers', [])
        bahan_bersih = _validasi_bahan(slug, bahan, tiers)
        kalkulator_map[slug] = {
            'satuan': existing.get('satuan', ''),
            'tiers': tiers,
            'bahan': bahan_bersih,
        }
        SystemConfig.objects.update_or_create(
            key='wa_kalkulator_bahan', defaults={'value': json.dumps(kalkulator_map, ensure_ascii=False)},
        )

    return get_satu_kategori(slug)


def _kolom_harga(tiers):
    """Nama kolom CSV utk tiap tingkatan harga, mis. tiers=[25,50,100] ->
    ['harga_1-25', 'harga_26-50', 'harga_51-100', 'harga_101+']. Kosong
    (banner, tanpa tier) -> ['harga']."""
    if not tiers:
        return ['harga']
    kolom = []
    bawah = 1
    for batas in tiers:
        kolom.append(f'harga_{bawah}-{batas}')
        bawah = batas + 1
    kolom.append(f'harga_{bawah}+')
    return kolom


def bahan_ke_csv(slug):
    """CSV kondisi TERKINI (dobel fungsi: template kolom yang benar + data
    yang sudah ada, jadi admin edit nilainya, bukan mulai dari nol)."""
    if slug not in TERSTRUKTUR_SLUGS:
        raise PricelistAdminError(f"Kategori '{slug}' tidak punya data terstruktur utk diekspor.")
    kalkulator_map = _load_kalkulator()
    data = kalkulator_map.get(slug) or {}
    tiers = data.get('tiers', [])
    kolom_harga = _kolom_harga(tiers)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['nama', *kolom_harga])
    for b in data.get('bahan', []):
        harga = b.get('harga')
        baris_harga = harga if isinstance(harga, list) else [harga]
        writer.writerow([b.get('nama', ''), *baris_harga])
    return buf.getvalue()


def csv_ke_bahan(slug, file_obj):
    """Parse CSV upload (header row wajib: nama + N kolom harga sesuai
    jumlah tier kategori ini) jadi list bahan, lalu SIMPAN (replace total
    baris bahan kategori ini, teks tampilan tidak disentuh)."""
    if slug not in TERSTRUKTUR_SLUGS:
        raise PricelistAdminError(f"Kategori '{slug}' tidak punya data terstruktur utk diimpor.")

    kalkulator_map = _load_kalkulator()
    existing = kalkulator_map.get(slug) or {}
    tiers = existing.get('tiers', [])
    kolom_diharapkan = ['nama', *_kolom_harga(tiers)]

    try:
        teks_mentah = file_obj.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        raise PricelistAdminError('File harus berupa CSV teks UTF-8.')

    reader = csv.reader(io.StringIO(teks_mentah))
    try:
        header = next(reader)
    except StopIteration:
        raise PricelistAdminError('File CSV kosong.')
    header_bersih = [h.strip().lower() for h in header]
    if header_bersih != kolom_diharapkan:
        raise PricelistAdminError(
            f'Header CSV tidak sesuai. Diharapkan: {", ".join(kolom_diharapkan)}. '
            f'Unduh template terbaru dulu kalau tier harga sudah berubah.'
        )

    jumlah_harga = len(kolom_diharapkan) - 1
    bahan = []
    for i, baris in enumerate(reader, start=2):
        if not baris or not any(sel.strip() for sel in baris):
            continue
        if len(baris) != len(kolom_diharapkan):
            raise PricelistAdminError(f'Baris {i}: jumlah kolom tidak sesuai header.')
        nama = baris[0].strip()
        harga_kolom = baris[1:]
        harga = harga_kolom[0] if jumlah_harga == 1 else list(harga_kolom)
        bahan.append({'nama': nama, 'harga': harga})

    bahan_bersih = _validasi_bahan(slug, bahan, tiers)
    kalkulator_map[slug] = {
        'satuan': existing.get('satuan', ''),
        'tiers': tiers,
        'bahan': bahan_bersih,
    }
    SystemConfig.objects.update_or_create(
        key='wa_kalkulator_bahan', defaults={'value': json.dumps(kalkulator_map, ensure_ascii=False)},
    )
    return get_satu_kategori(slug)
