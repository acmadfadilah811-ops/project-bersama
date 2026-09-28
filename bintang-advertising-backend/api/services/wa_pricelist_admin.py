"""CRUD admin untuk pricelist bot WA (dipakai halaman Pengaturan > Pengaturan
Bisnis > sub-tab "Pricelist WA Bot" di frontend, permintaan user 2026-09-18).

Sumber data TETAP SystemConfig 'wa_pricelist_kategori' (teks tampilan per
kategori, dibaca AI tool daftar_kategori_produk) & 'wa_kalkulator_bahan'
(kalkulator harga per kategori, dibaca AI tool hitung_harga_pricelist) --
lihat api/services/wa_ai_tools.py & api/management/commands/seed_wa_pricelist.py
untuk skema JSON yang HARUS tetap kompatibel.

Sejak 2026-09-28 kalkulator bukan lagi milik 4 kategori tetap: kategori mana
pun boleh punya kalkulator, dibuat/diubah/dihapus dari UI. Bentuk satu entri
'wa_kalkulator_bahan':
    {'mode': 'luas'|'qty', 'satuan': str, 'tiers': [int, ...], 'bahan': [...]}
- 'luas': harga per m2 (bot minta panjang x lebar), tanpa tingkatan qty.
- 'qty' : harga per satuan bertingkat; `tiers` = batas ATAS tiap tingkatan,
  tiap bahan punya len(tiers)+1 harga (tanpa tiers = satu harga).
Entri lama tanpa 'mode' dibaca 'luas' bila satuannya m2 (banner), selain itu
'qty' (lihat mode_kalkulator).
"""
import csv
import io
import json
import re

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
MODE_KALKULATOR = ('luas', 'qty')
MAKS_TINGKATAN = 10


class PricelistAdminError(Exception):
    pass


def mode_kalkulator(data):
    """Mode kalkulator satu entri, termasuk entri lama hasil seed tanpa 'mode'."""
    mode = (data or {}).get('mode')
    if mode in MODE_KALKULATOR:
        return mode
    return 'luas' if str((data or {}).get('satuan', '')).strip().lower() in ('m2', 'm²') else 'qty'


def _load(key):
    try:
        return json.loads(SystemConfig.objects.get(key=key).value)
    except SystemConfig.DoesNotExist:
        return {}


def _load_teks():
    return _load('wa_pricelist_kategori')


def _load_kalkulator():
    return _load('wa_kalkulator_bahan')


def _load_label():
    """Label kategori buatan admin -- disimpan terpisah supaya bentuk
    'wa_pricelist_kategori' (slug -> teks) yang dibaca AI tool tetap."""
    return _load('wa_pricelist_label')


def _simpan(key, data):
    SystemConfig.objects.update_or_create(key=key, defaults={'value': json.dumps(data, ensure_ascii=False)})


def _kategori_dict(slug, teks_map, kalkulator_map, label_map):
    data = kalkulator_map.get(slug)
    entry = {
        'slug': slug,
        'label': label_map.get(slug) or KATEGORI_LABEL.get(slug, slug),
        'teks': teks_map.get(slug, ''),
        'terstruktur': bool(data),
    }
    if data:
        entry['mode'] = mode_kalkulator(data)
        entry['satuan'] = data.get('satuan', '')
        entry['tiers'] = data.get('tiers', [])
        entry['bahan'] = data.get('bahan', [])
    return entry


def get_semua_kategori():
    """Daftar kategori untuk halaman admin. Kategori bawaan yang sudah dihapus
    admin tidak dimunculkan lagi; semua bawaan hanya tampil bila pricelist
    belum pernah diisi sama sekali. Kategori lain (buatan admin / seed manual
    lama) tampil di akhir."""
    teks_map = _load_teks()
    kalkulator_map = _load_kalkulator()
    label_map = _load_label()
    ada = set(teks_map) | set(kalkulator_map)
    bawaan = [k for k in KATEGORI_ORDER if k in ada] if ada else KATEGORI_ORDER
    urutan = bawaan + sorted(k for k in ada if k not in set(KATEGORI_ORDER))
    return [_kategori_dict(slug, teks_map, kalkulator_map, label_map) for slug in urutan]


def get_satu_kategori(slug):
    teks_map = _load_teks()
    kalkulator_map = _load_kalkulator()
    if slug not in teks_map and slug not in kalkulator_map and slug not in KATEGORI_LABEL:
        raise PricelistAdminError(f"Kategori '{slug}' tidak dikenal.")
    return _kategori_dict(slug, teks_map, kalkulator_map, _load_label())


def _validasi_bahan(bahan, tiers):
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
            if isinstance(harga, list) and len(harga) == 1:
                harga = harga[0]
            try:
                harga_bersih = round(float(harga))
            except (TypeError, ValueError):
                raise PricelistAdminError(f"Baris ke-{i} ('{nama}'): harga harus angka.")
            if harga_bersih < 0:
                raise PricelistAdminError(f"Baris ke-{i} ('{nama}'): harga tidak boleh minus.")
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
            if any(h < 0 for h in harga_bersih):
                raise PricelistAdminError(f"Baris ke-{i} ('{nama}'): harga tidak boleh minus.")
        hasil.append({'nama': nama, 'harga': harga_bersih})
    return hasil


def _validasi_kalkulator(data):
    """Bersihkan & validasi konfigurasi kalkulator dari UI."""
    if not isinstance(data, dict):
        raise PricelistAdminError('Data kalkulator tidak valid.')
    mode = data.get('mode')
    if mode not in MODE_KALKULATOR:
        raise PricelistAdminError("Jenis kalkulator harus 'luas' (per m2) atau 'qty' (per jumlah).")
    if mode == 'luas':
        satuan, tiers = 'm2', []
    else:
        satuan = str(data.get('satuan') or '').strip()[:30]
        if not satuan:
            raise PricelistAdminError('Satuan kalkulator wajib diisi (mis. lembar, box, pcs).')
        try:
            tiers = [int(t) for t in (data.get('tiers') or [])]
        except (TypeError, ValueError):
            raise PricelistAdminError('Tingkatan qty harus berupa angka bulat.')
        if len(tiers) > MAKS_TINGKATAN:
            raise PricelistAdminError(f'Tingkatan qty maksimal {MAKS_TINGKATAN}.')
        if any(t <= 0 for t in tiers) or any(b <= a for a, b in zip(tiers, tiers[1:])):
            raise PricelistAdminError('Tingkatan qty harus angka positif yang terus naik, mis. 25, 50, 100.')
    return {'mode': mode, 'satuan': satuan, 'tiers': tiers, 'bahan': _validasi_bahan(data.get('bahan'), tiers)}


_BELUM_DIKIRIM = object()


@transaction.atomic
def update_kategori(slug, teks, bahan=None, kalkulator=_BELUM_DIKIRIM):
    """Simpan teks tampilan + kalkulator kategori.

    `kalkulator`: dict konfigurasi lengkap (buat/ubah kalkulator), None (hapus
    kalkulator), atau tidak dikirim. `bahan` saja (cara lama) hanya mengganti
    baris bahan kalkulator yang sudah ada, tingkatan & satuan tetap."""
    slug = (slug or '').strip()
    if not slug:
        raise PricelistAdminError('Slug kategori wajib diisi.')
    teks = (teks or '').strip()
    if not teks:
        raise PricelistAdminError('Teks tampilan tidak boleh kosong.')

    teks_map = _load_teks()
    teks_map[slug] = teks
    _simpan('wa_pricelist_kategori', teks_map)

    kalkulator_map = _load_kalkulator()
    if kalkulator is None:
        kalkulator_map.pop(slug, None)
    elif kalkulator is not _BELUM_DIKIRIM:
        kalkulator_map[slug] = _validasi_kalkulator(kalkulator)
    elif slug in kalkulator_map and bahan is not None:
        existing = kalkulator_map[slug]
        kalkulator_map[slug] = {
            **existing,
            'bahan': _validasi_bahan(bahan, existing.get('tiers', [])),
        }
    _simpan('wa_kalkulator_bahan', kalkulator_map)

    return get_satu_kategori(slug)


def _slug_dari_label(label):
    return re.sub(r'[^a-z0-9]+', '_', label.lower()).strip('_')[:50]


@transaction.atomic
def tambah_kategori(label, teks, kalkulator=None):
    """Kategori baru: teks tampilan (daftar_kategori_produk) dan, bila
    diisi, kalkulator harga (hitung_harga_pricelist)."""
    label = (label or '').strip()
    teks = (teks or '').strip()
    if not label:
        raise PricelistAdminError('Nama kategori wajib diisi.')
    if not teks:
        raise PricelistAdminError('Teks tampilan tidak boleh kosong.')
    slug = _slug_dari_label(label)
    if not slug:
        raise PricelistAdminError('Nama kategori harus mengandung huruf atau angka.')
    teks_map = _load_teks()
    kalkulator_map = _load_kalkulator()
    label_map = _load_label()
    ada = set(teks_map) | set(kalkulator_map)
    label_dipakai = {(label_map.get(s) or KATEGORI_LABEL.get(s, s)).lower() for s in ada}
    if slug in ada or label.lower() in label_dipakai:
        raise PricelistAdminError(f"Kategori '{label}' sudah ada.")

    if kalkulator is not None:
        kalkulator_map[slug] = _validasi_kalkulator(kalkulator)
        _simpan('wa_kalkulator_bahan', kalkulator_map)
    teks_map[slug] = teks
    label_map[slug] = label
    _simpan('wa_pricelist_kategori', teks_map)
    _simpan('wa_pricelist_label', label_map)
    return get_satu_kategori(slug)


@transaction.atomic
def hapus_kategori(slug):
    """Hapus kategori beserta kalkulatornya; bot tidak lagi mengenalnya."""
    teks_map = _load_teks()
    kalkulator_map = _load_kalkulator()
    if slug not in teks_map and slug not in kalkulator_map:
        raise PricelistAdminError(f"Kategori '{slug}' tidak ditemukan.")
    teks_map.pop(slug, None)
    kalkulator_map.pop(slug, None)
    label_map = _load_label()
    label_map.pop(slug, None)
    _simpan('wa_pricelist_kategori', teks_map)
    _simpan('wa_kalkulator_bahan', kalkulator_map)
    _simpan('wa_pricelist_label', label_map)


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


def _kalkulator_wajib(slug):
    data = _load_kalkulator().get(slug)
    if not data:
        raise PricelistAdminError(f"Kategori '{slug}' belum punya kalkulator harga.")
    return data


def bahan_ke_csv(slug):
    """CSV kondisi TERKINI (dobel fungsi: template kolom yang benar + data
    yang sudah ada, jadi admin edit nilainya, bukan mulai dari nol)."""
    data = _kalkulator_wajib(slug)
    kolom_harga = _kolom_harga(data.get('tiers', []))

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
    existing = _kalkulator_wajib(slug)
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

    kalkulator_map = _load_kalkulator()
    kalkulator_map[slug] = {**existing, 'bahan': _validasi_bahan(bahan, tiers)}
    _simpan('wa_kalkulator_bahan', kalkulator_map)
    return get_satu_kategori(slug)
