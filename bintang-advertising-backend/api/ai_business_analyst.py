"""Agregasi AI Business Analyst — dashboard analisis bisnis untuk owner/manager.

Sama seperti executive_dashboard.py: HANYA menyajikan angka yang benar-benar
terhitung dari data nyata. Modul yang belum dibangun ditandai eksplisit lewat
`tersedia: False` + alasan, bukan diisi data karangan.

Reuse `_periode`/`_delta`/`_tren` dari executive_dashboard.py — jangan duplikat
logika periode/tren (lihat Aturan Engineering F2/U5).
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Max, Q, Sum
from django.utils import timezone

from . import executive_dashboard as ed
from .models import Order
from .pos_models import POSSale, POSSaleItem
from .product_models import Product, ProductStockMovement

ZERO = Decimal('0')
TANPA_KATEGORI = 'Tanpa Kategori'

# Produk tracked dengan stok > 0 tapi tidak terjual dalam N hari ini dianggap
# "lambat/mati" — ambang dipilih moderat untuk bisnis percetakan (siklus order
# custom cenderung lebih panjang dari retail harian).
AGING_HARI = 60


def _kelas_abc(kumulatif_persen):
    if kumulatif_persen <= 80:
        return 'A'
    if kumulatif_persen <= 95:
        return 'B'
    return 'C'


def _kategori_penjualan(mulai, akhir):
    """Pendapatan & qty per kategori produk, dari item POS lunas — diurutkan turun.

    Order (pesanan) belum dipecah per produk di sini (lihat catatan di build()).
    """
    rows = POSSaleItem.objects.filter(
        sale__status='paid', sale__created_at__date__gte=mulai, sale__created_at__date__lte=akhir,
    ).values('product__kategori__nama').annotate(nilai=Sum('subtotal'), qty=Sum('qty')).order_by('-nilai')
    return [
        {
            'kategori': row['product__kategori__nama'] or TANPA_KATEGORI,
            'nilai': float(row['nilai'] or 0),
            'qty': float(row['qty'] or 0),
        }
        for row in rows
    ]


def _abc_kategori(kategori_rows):
    """Klasifikasi ABC/Pareto: A = kontributor 80% pertama, B = s/d 95%, C = sisanya.

    Kelas ditentukan dari kumulatif SEBELUM baris ini ditambahkan — supaya
    kategori dominan tunggal (mis. satu kategori = 90% omzet) tetap masuk
    kelas A, bukan tergeser ke B hanya karena kontribusinya sendiri melewati
    ambang 80%.
    """
    total = sum(r['nilai'] for r in kategori_rows)
    hasil = []
    kumulatif_sebelum = 0.0
    for r in kategori_rows:
        persen = (r['nilai'] / total * 100) if total else 0.0
        kumulatif_sesudah = min(kumulatif_sebelum + persen, 100.0)
        hasil.append({
            'kategori': r['kategori'],
            'nilai': r['nilai'],
            'persen': round(persen, 1),
            'kumulatif': round(kumulatif_sesudah, 1),
            'kelas': _kelas_abc(kumulatif_sebelum),
        })
        kumulatif_sebelum = kumulatif_sesudah
    return hasil


def _produk_ranking(mulai, akhir, batas=20):
    """Top & bottom N produk (nilai penjualan POS) pada periode berjalan.

    Skala ~1600 SKU: hanya produk yang benar-benar terjual pada periode ini
    yang masuk daftar bawah — produk yang tidak pernah terjual sama sekali
    adalah pertanyaan stok (domain `stok`), bukan "produk terburuk".
    """
    rows = POSSaleItem.objects.filter(
        sale__status='paid', sale__created_at__date__gte=mulai, sale__created_at__date__lte=akhir,
    ).values('nama_snapshot', 'product__kategori__nama').annotate(qty=Sum('qty'), nilai=Sum('subtotal'))
    daftar = [
        {
            'nama': row['nama_snapshot'],
            'kategori': row['product__kategori__nama'] or TANPA_KATEGORI,
            'qty': float(row['qty'] or 0),
            'nilai': float(row['nilai'] or 0),
        }
        for row in rows
    ]
    daftar.sort(key=lambda x: x['nilai'], reverse=True)
    top = daftar[:batas]
    bottom = list(reversed(daftar[-batas:])) if len(daftar) > batas else list(reversed(daftar))
    return top, bottom


def _channel_aov(mulai, akhir):
    """Perbandingan kanal POS vs Order, plus rata-rata nilai transaksi (AOV) tiap kanal."""
    pos_qs = POSSale.objects.filter(status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir)
    pos_total = pos_qs.aggregate(v=Sum('total'))['v'] or ZERO
    pos_count = pos_qs.count()

    order_qs = Order.objects.filter(
        waktu__date__gte=mulai, waktu__date__lte=akhir
    ).exclude(status_global='batal')
    order_total = order_qs.aggregate(v=Sum('total_harga'))['v'] or ZERO
    order_count = order_qs.count()

    return {
        'pos': {
            'nilai': float(pos_total), 'transaksi': pos_count,
            'aov': float(pos_total / pos_count) if pos_count else 0.0,
        },
        'order': {
            'nilai': float(order_total), 'transaksi': order_count,
            'aov': float(order_total / order_count) if order_count else 0.0,
        },
    }


def _kategori_hpp(mulai, akhir):
    """HPP nyata (FIFO) per kategori, dari mutasi stok tipe 'penjualan'."""
    rows = ProductStockMovement.objects.filter(
        tipe='penjualan', created_at__date__gte=mulai, created_at__date__lte=akhir,
    ).values('product__kategori__nama').annotate(v=Sum('hpp_total'))
    return {(row['product__kategori__nama'] or TANPA_KATEGORI): float(row['v'] or 0) for row in rows}


def _margin_kategori(kategori_penjualan_rows, hpp_map):
    hasil = []
    for r in kategori_penjualan_rows:
        hpp = hpp_map.get(r['kategori'], 0.0)
        margin = r['nilai'] - hpp
        margin_persen = round(margin / r['nilai'] * 100, 1) if r['nilai'] else None
        hasil.append({
            'kategori': r['kategori'], 'pendapatan': r['nilai'], 'hpp': hpp,
            'margin': margin, 'margin_persen': margin_persen,
        })
    hasil.sort(key=lambda x: x['margin'], reverse=True)
    return hasil


def _stok_kategori():
    """Kesehatan stok per kategori: habis/menipis/sehat + nilai stok lambat/mati.

    "Lambat/mati" = tracked, qty > 0, tidak ada mutasi 'penjualan' dalam
    AGING_HARI hari terakhir (termasuk yang belum pernah terjual sama sekali).
    """
    cutoff = timezone.localdate() - timedelta(days=AGING_HARI)
    produk = Product.objects.filter(is_active=True, lacak_inventori=True).select_related('kategori').annotate(
        terakhir_terjual=Max('stock_movements__created_at', filter=Q(stock_movements__tipe='penjualan')),
    )

    per_kategori = {}
    for p in produk.iterator():
        nama_kat = p.kategori.nama if p.kategori else TANPA_KATEGORI
        slot = per_kategori.setdefault(nama_kat, {
            'kategori': nama_kat, 'nilai_persediaan': 0.0, 'jumlah_produk': 0,
            'habis': 0, 'menipis': 0, 'sehat': 0,
            'nilai_stok_lambat': 0.0, 'jumlah_stok_lambat': 0,
        })
        nilai = float((p.qty_stok or ZERO) * (p.harga_beli or ZERO))
        slot['nilai_persediaan'] += nilai
        slot['jumlah_produk'] += 1
        if p.qty_stok <= 0:
            slot['habis'] += 1
        elif p.qty_stok <= p.stok_minimum:
            slot['menipis'] += 1
        else:
            slot['sehat'] += 1

        lambat = p.qty_stok > 0 and (p.terakhir_terjual is None or p.terakhir_terjual.date() < cutoff)
        if lambat:
            slot['nilai_stok_lambat'] += nilai
            slot['jumlah_stok_lambat'] += 1

    hasil = list(per_kategori.values())
    hasil.sort(key=lambda x: x['nilai_stok_lambat'], reverse=True)
    return hasil


BELUM_DIBANGUN = {
    'pelanggan': 'Pareto pelanggan, segmen, retensi, dan umur piutang — fase berikutnya.',
    'keuangan': 'Akan reuse laporan Arus Kas & Neraca yang sudah ada di Akuntansi Internal, bukan hitung ulang.',
    'produksi': 'Lead time dan beban kerja Job Board/SPK — fase berikutnya.',
    'anomali': 'Deteksi lonjakan biaya, penurunan margin mendadak, dan lonjakan void/retur — fase berikutnya.',
    'resep_bom': 'Biaya resep dari BillOfMaterials/BoMItem dan ketergantungan bahan baku — fase berikutnya.',
    'varian': 'Performa varian dalam satu produk induk — fase berikutnya.',
    'tingkatan_harga': 'Efektivitas tingkatan harga (price_type=tier) per rentang qty — fase berikutnya.',
}


def build(period='ytd'):
    mulai, akhir, _sebelum_mulai, _sebelum_akhir = ed._periode(period)

    kategori_penjualan = _kategori_penjualan(mulai, akhir)
    hpp_map = _kategori_hpp(mulai, akhir)
    top_produk, bottom_produk = _produk_ranking(mulai, akhir)

    modul = {
        'penjualan_produk': {
            'tersedia': True,
            'tren': ed._tren(mulai, akhir),
            'abc_kategori': _abc_kategori(kategori_penjualan),
            'top_produk': top_produk,
            'bottom_produk': bottom_produk,
            'channel': _channel_aov(mulai, akhir),
            'catatan': (
                'Rincian per produk/kategori berdasarkan penjualan POS. Nilai kanal '
                'Pesanan (Order) sudah masuk di "channel", tapi belum dipecah per produk.'
            ),
        },
        'profitabilitas': {
            'tersedia': True,
            'margin_kategori': _margin_kategori(kategori_penjualan, hpp_map),
        },
        'stok': {
            'tersedia': True,
            'kategori': _stok_kategori(),
            'ambang_hari_lambat': AGING_HARI,
        },
    }
    for kunci, alasan in BELUM_DIBANGUN.items():
        modul[kunci] = {'tersedia': False, 'alasan': alasan}

    return {
        'generated_at': timezone.now().isoformat(),
        'periode': {
            'kode': period,
            'mulai': mulai.isoformat(),
            'akhir': akhir.isoformat(),
            'label': f'{mulai:%d %b %Y} – {akhir:%d %b %Y}',
        },
        'modul': modul,
    }
