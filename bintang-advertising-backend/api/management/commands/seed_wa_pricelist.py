"""
Management command: seed_wa_pricelist
Jalankan manual: python manage.py seed_wa_pricelist

Muat isi `#PRICELIST STAR DIGIPRINT UPDATE 1 AGUSTUS 2026.md` (harga referensi awal,
BUKAN data live Product/ProductPrice — lihat catatan di api/wa_logic.py
get_pricelist_kategori()) ke SystemConfig key `wa_pricelist_kategori` sebagai JSON per
kategori, dipakai bot WA untuk menjawab pertanyaan produk SEBELUM mengirim form order.

Sumber data di-hardcode di sini (bukan parse file .md otomatis) karena tabel pricelist
punya bentuk kolom yang beda-beda tiap kategori (per m², per lembar bertingkat, per
paket, dll.) — parser generik untuk itu lebih ribet daripada manfaatnya untuk dokumen
yang direvisi manual sesekali. Kalau pricelist.md diupdate, edit dict di bawah ini
lalu jalankan ulang command ini (aman dijalankan berkali-kali, selalu overwrite).
"""
from django.core.management.base import BaseCommand
import json


KATEGORI_PRICELIST = {
    'banner': (
        "🖼️ *BANNER / SPANDUK / MMT*\n\n"
        "*Outdoor Printing (harga per m²):*\n"
        "- Banner 240: Rp18.000/m²\n"
        "- Banner 300: Rp25.000/m²\n"
        "- Banner 340: Rp35.000/m²\n"
        "- Banner 440: Rp65.000/m²\n"
        "- Albatros / Satin-Clothbanner: Rp75.000/m²\n"
        "- Backlite 510: Rp120.000/m²\n"
        "- Luster / One Way Vision: Rp125.000/m²\n"
        "- Vinyl Glossy/Doff Frontlite, Vinyl Backlite, Transparan: Rp130.000/m²\n\n"
        "*Display Banner (sudah termasuk rangka/stand):*\n"
        "- X/Y Banner (60x160cm): Stand Only Rp55rb, Banner 280 Rp75rb, Banner 440/Albatros Rp120rb\n"
        "- Roll Banner 60x160cm: Stand Only Rp175rb, Banner 440 Rp250rb, Albatros Rp265rb\n"
        "- Roll Banner 80x200cm: Stand Only Rp200rb, Banner 440 Rp300rb, Albatros Rp325rb\n"
        "- Tripod Banner (50x75cm): Stand Only Rp180rb, 1 Sisi Rp300rb, 2 Sisi Rp350rb\n"
        "- Segitiga Banner (60x100cm) + rangka hollow galvalum: Rp300rb"
    ),
    'stiker': (
        "🏷️ *STIKER / DOCU STIKER A3+* (harga per lembar, makin banyak makin murah)\n\n"
        "- Chromo: Rp7.000 (1-25lbr) turun s.d Rp6.200 (>101lbr)\n"
        "- Kraft: Rp10.000 turun s.d Rp9.000\n"
        "- Vinyl Glossy / Vinyl Doff / Transparan: Rp15.000 turun s.d Rp12.000\n\n"
        "*Jasa Cutting Stiker* (per bentuk, tergantung ukuran potongan):\n"
        "- Kisscutting: Rp5.000-Rp10.000\n"
        "- Diecutting: Rp8.000-Rp12.000\n"
        "- Cutting meteran: Rp10/cm² (Rp50/cm² kalau bahan Scotlite)"
    ),
    'kertas_a3': (
        "📄 *DOCU KERTAS A3+* (harga per lembar, makin banyak makin murah)\n\n"
        "- HVS: Rp4.200 (1-25lbr) turun s.d Rp3.500 (>101lbr)\n"
        "- Art Paper 150: Rp5.500 turun s.d Rp4.000\n"
        "- Ivory 230/260, Linen 200/230, Aster 200, Gloria 210: Rp6.000-Rp8.000-an\n\n"
        "_Cetak bolak-balik/2 sisi = 2x harga di atas._"
    ),
    'kartu_nama': (
        "💳 *KARTU NAMA* (per box isi 100 pcs)\n\n"
        "- Ivory 260: 1 Sisi Rp35rb, 1 Sisi+Laminasi Rp45rb, 2 Sisi Rp45rb, 2 Sisi+Laminasi Rp60rb\n"
        "- Aster 200: 1 Sisi Rp37rb, 1 Sisi+Laminasi Rp47rb, 2 Sisi Rp47rb, 2 Sisi+Laminasi Rp62rb\n"
        "- Linen 230: 1 Sisi Rp40rb, 1 Sisi+Laminasi Rp55rb, 2 Sisi Rp50rb, 2 Sisi+Laminasi Rp65rb\n\n"
        "_Harga per box turun lagi kalau pesan 2-5 box atau >5 box._"
    ),
    'brosur': (
        "📰 *PAKET CETAK BROSUR / FLYER*\n\n"
        "- 100 pcs A6: mulai Rp55rb (HVS) s.d Rp80rb (Ivory)\n"
        "- 100 pcs A5: mulai Rp110rb s.d Rp150rb\n"
        "- 100 pcs A4: mulai Rp200rb s.d Rp280rb\n"
        "- 100 pcs A3: mulai Rp350rb s.d Rp500rb\n"
        "- Paket 250 & 500 pcs juga tersedia, harga per lembar makin murah.\n\n"
        "_Sebutkan jumlah, ukuran, dan bahan yang diinginkan biar dihitungkan pasti ya Kak._"
    ),
    'cetak_khusus': (
        "🎫 *PRODUK CETAK KHUSUS*\n\n"
        "- Kupon (15x5cm, sudah termasuk porporasi+numerator): Rp35.000/bundle\n"
        "- Nota (A4, 1 warna, per 1 rim): Rp150.000 — tambah porporasi Rp20rb, numerator Rp25rb, tambah warna Rp25rb\n"
        "- Kalender: 1 Tahunan mulai Rp10rb, 4 Bulanan Rp17rb, 2 Bulanan Rp29rb, Duduk Rp38rb (harga/pcs, makin banyak makin murah)\n"
        "- ID Card: 1 Sisi mulai Rp13rb, 2 Sisi mulai Rp15rb (harga/pcs, makin banyak makin murah)\n"
        "- Buku Yasin (minimal 30 buku): Soft Cover Rp14rb, Foil Cover Rp20rb, Hard Cover Rp30rb per buku\n"
        "- Finishing buku/dokumen: Amplop Rp1rb, Jilid Staples Rp10rb, Jilid Spiral Rp15rb, Hardcover A5 Rp20rb, Hardcover A4 Rp30rb"
    ),
    'merchandise': (
        "🎁 *MERCHANDISE & PROMOSI*\n\n"
        "- Mug Standard: mulai Rp25rb, Mug Love: mulai Rp28rb (makin banyak makin murah)\n"
        "- Tumbler Stainless / Jam Dinding custom: Rp65rb; Tumbler Plastik: Rp25rb-Rp30rb\n"
        "- Payung (min. 10pcs): Lipat Rp50rb, Standard Rp55rb, Jumbo Rp75rb\n"
        "- Gantungan Kunci (min. 12pcs): Rp6.500-Rp7.000\n"
        "- Pin (min. 12pcs): Rp6.000-Rp6.500\n"
        "- Lanyard: mulai Rp30rb/pcs (makin banyak makin murah)\n"
        "- Goodiebag DTF full color: Rp12rb-Rp15rb; Goodiebag sablon 1 warna (min. 24pcs): Rp5rb-Rp8rb\n"
        "- Seminar Kit (min. 20pcs): Bolpoint Rp5rb, Blocknote A6 Rp8rb"
    ),
    'kaos': (
        "👕 *KAOS / APPAREL*\n\n"
        "- Katun Combed 24S ukuran S/M/L/XL: Rp90.000\n"
        "- Katun Combed 24S ukuran XXL/XXXL: Rp95.000\n\n"
        "_Harga polos, sablon/DTF dihitung terpisah sesuai desain._"
    ),
    'acrylic': (
        "🏆 *ACRYLIC & PLAKAT*\n\n"
        "- Plakat Printing 5mm: Rp460/cm\n"
        "- Plakat Printing 3mm: Rp400/cm\n"
        "- Wall Poster Acrylic: Rp125/cm\n"
        "- Nomor Rumah Acrylic: Rp320/cm\n"
        "- Pen Acrylic / Baut Stabilo: Rp9.000/pcs"
    ),
    'cutting_finishing': (
        "✂️ *JASA CUTTING, POTONG & FINISHING LEMBARAN*\n\n"
        "- Cutting stiker (kisscutting/diecutting): Rp5.000-Rp12.000 tergantung ukuran potongan\n"
        "- Biaya potong kertas/stiker A3+: Rp300-Rp3.000 tergantung jumlah lembar\n"
        "- Laminasi panas A3+ (Glossy/Doff): Rp2.500-Rp3.000/lembar\n"
        "- Laminating press mika tebal: A3 Rp10rb, A4 Rp5rb\n"
        "- Cutting meteran: Rp10/cm² (Scotlite Rp50/cm²)"
    ),
}

DISCLAIMER = (
    "\n\n_*Catatan: harga di atas referensi awal, belum termasuk biaya desain & "
    "finishing tambahan. Rincian total akan dikonfirmasi lewat nota invoice ya Kak.*_"
)


# ── Data terstruktur (bukan cuma teks tampilan) — dipakai kalkulator pintar
# (hitung_harga_otomatis di wa_logic.py) utk bikin tabel perbandingan bahan
# BERDASARKAN ukuran/qty yang disebut pelanggan (instruksi user 2026-08-15,
# gantikan hitung_harga_otomatis versi lama yang bacanya dari ProductPrice
# LEGACY — tabel live Product tidak punya price_type='per_m2' utk banner
# sama sekali, semua tersimpan flat, jadi kalkulator lama itu sudah lama
# mati/tidak pernah ke-trigger di alur bot). `tiers` = batas ATAS tiap
# tingkatan qty (mis. [25, 50, 100] artinya 1-25 / 26-50 / 51-100 / >100 —
# elemen terakhir `harga` selalu berlaku utk "di atas batas tier terakhir").
KALKULATOR_BAHAN = {
    'banner': {
        'satuan': 'm2',
        'bahan': [
            {'nama': 'Banner 240', 'harga': 18000},
            {'nama': 'Banner 300', 'harga': 25000},
            {'nama': 'Banner 340', 'harga': 35000},
            {'nama': 'Banner 440', 'harga': 65000},
            {'nama': 'Albatros', 'harga': 75000},
            {'nama': 'Satin/Clothbanner', 'harga': 75000},
            {'nama': 'Backlite 510', 'harga': 120000},
            {'nama': 'Luster', 'harga': 125000},
            {'nama': 'One Way Vision', 'harga': 125000},
            {'nama': 'Vinyl Glossy Frontlite', 'harga': 130000},
            {'nama': 'Vinyl Doff Frontlite', 'harga': 130000},
            {'nama': 'Vinyl Backlite', 'harga': 130000},
            {'nama': 'Transparan', 'harga': 130000},
        ],
    },
    'stiker': {
        'satuan': 'lembar',
        'tiers': [25, 50, 100],
        'bahan': [
            {'nama': 'Chromo', 'harga': [7000, 6800, 6500, 6200]},
            {'nama': 'Kraft', 'harga': [10000, 9500, 9000, 9000]},
            {'nama': 'Vinyl Glossy', 'harga': [15000, 14000, 13000, 12000]},
            {'nama': 'Vinyl Doff', 'harga': [15000, 14000, 13000, 12000]},
            {'nama': 'Transparan', 'harga': [15000, 14000, 13000, 12000]},
        ],
    },
    'kertas_a3': {
        'satuan': 'lembar',
        'tiers': [25, 50, 100],
        'bahan': [
            {'nama': 'HVS', 'harga': [4200, 4000, 3700, 3500]},
            {'nama': 'Art Paper 150', 'harga': [5500, 5000, 4500, 4000]},
            {'nama': 'Ivory 230', 'harga': [6000, 5500, 5000, 4500]},
            {'nama': 'Ivory 260', 'harga': [6200, 5700, 5200, 4700]},
            {'nama': 'Linen 200', 'harga': [6500, 6200, 5900, 5600]},
            {'nama': 'Linen 230', 'harga': [8000, 7700, 7300, 7000]},
            {'nama': 'Aster 200', 'harga': [6800, 6500, 6200, 5800]},
            {'nama': 'Gloria 210', 'harga': [7000, 6800, 6500, 6200]},
        ],
    },
    'kartu_nama': {
        'satuan': 'box',
        'tiers': [1, 5],
        'bahan': [
            {'nama': 'Ivory 260 - 1 Sisi', 'harga': [35000, 33000, 30000]},
            {'nama': 'Ivory 260 - 1 Sisi + Laminasi', 'harga': [45000, 43000, 40000]},
            {'nama': 'Ivory 260 - 2 Sisi', 'harga': [45000, 43000, 40000]},
            {'nama': 'Ivory 260 - 2 Sisi + Laminasi', 'harga': [60000, 58000, 55000]},
            {'nama': 'Aster 200 - 1 Sisi', 'harga': [37000, 35000, 32000]},
            {'nama': 'Aster 200 - 1 Sisi + Laminasi', 'harga': [47000, 45000, 42000]},
            {'nama': 'Aster 200 - 2 Sisi', 'harga': [47000, 45000, 42000]},
            {'nama': 'Aster 200 - 2 Sisi + Laminasi', 'harga': [62000, 60000, 57000]},
            {'nama': 'Linen 230 - 1 Sisi', 'harga': [40000, 37000, 34000]},
            {'nama': 'Linen 230 - 1 Sisi + Laminasi', 'harga': [55000, 53000, 50000]},
            {'nama': 'Linen 230 - 2 Sisi', 'harga': [50000, 48000, 45000]},
            {'nama': 'Linen 230 - 2 Sisi + Laminasi', 'harga': [65000, 63000, 60000]},
        ],
    },
}


class Command(BaseCommand):
    help = 'Seed/perbarui SystemConfig pricelist & kalkulator dari pricelist Star Digiprint (1 Agustus 2026)'

    def handle(self, *args, **options):
        from api.models import SystemConfig

        data = {slug: teks + DISCLAIMER for slug, teks in KATEGORI_PRICELIST.items()}
        obj, created = SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': json.dumps(data, ensure_ascii=False)},
        )
        aksi = 'dibuat' if created else 'diperbarui'
        self.stdout.write(self.style.SUCCESS(
            f'SystemConfig wa_pricelist_kategori {aksi} — {len(data)} kategori.'
        ))

        obj2, created2 = SystemConfig.objects.update_or_create(
            key='wa_kalkulator_bahan',
            defaults={'value': json.dumps(KALKULATOR_BAHAN, ensure_ascii=False)},
        )
        aksi2 = 'dibuat' if created2 else 'diperbarui'
        self.stdout.write(self.style.SUCCESS(
            f'SystemConfig wa_kalkulator_bahan {aksi2} — {len(KALKULATOR_BAHAN)} kategori.'
        ))
