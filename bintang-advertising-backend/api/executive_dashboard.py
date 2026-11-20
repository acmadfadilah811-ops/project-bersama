"""Agregasi dashboard eksekutif.

Prinsip modul ini: HANYA menyajikan angka yang benar-benar terhitung dari data
yang ada. Metrik yang butuh buku besar (laba bersih, saldo kas, rasio lancar/
cepat) sengaja TIDAK disajikan, bukan ditaksir dengan persentase tetap — angka
karangan pada dashboard manajemen lebih berbahaya daripada angka yang absen.
Daftar yang belum tersedia dikembalikan lewat `unavailable` supaya UI bisa
menjelaskannya ke pengguna.

Berbeda dari api/views/dashboard.py yang bersifat operasional harian, modul ini
memberi ringkasan lintas periode untuk manajemen.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDay, TruncHour, TruncMonth
from django.utils import timezone

from .models import Order, UnitBisnis
from .pos_models import POSSale, POSSaleItem
from .product_models import Product, ProductStockMovement, StockProductionDocument

ZERO = Decimal('0')

# Metrik yang sengaja tidak ditampilkan, beserta alasannya. Ditampilkan apa
# adanya di UI supaya manajemen tahu apa yang BELUM tercakup.
UNAVAILABLE = [
    {'label': 'Laba bersih', 'reason': 'Butuh beban operasional dari buku besar; jurnal akuntansi belum aktif.'},
    {'label': 'Kas & bank', 'reason': 'Butuh saldo akun kas dari buku besar.'},
    {'label': 'Rasio lancar & cepat', 'reason': 'Butuh neraca lengkap (aset & liabilitas lancar).'},
]


# Rentang yang bisa digeser (2026-11-10): Harian/Mingguan/Bulanan/Tahunan + panah
# periode sebelumnya, seperti prototipe dashboard. Kode lama (mtd/qtd/ytd/12m)
# tetap diterima supaya tautan & ekspor lama tidak rusak.
MODE_RENTANG = ('harian', 'mingguan', 'bulanan', 'tahunan')
PERIODE_LAMA = ('mtd', 'qtd', 'ytd', '12m')
PERIODE_VALID = frozenset(MODE_RENTANG + PERIODE_LAMA)
GESER_MIN = -3650

BULAN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
                 'September', 'Oktober', 'November', 'Desember']
HARI3 = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']


def baca_geser(nilai):
    """Geseran periode dari query string: 0 = periode berjalan, -1 = sebelumnya. Masa depan tidak ada."""
    try:
        geser = int(nilai or 0)
    except (TypeError, ValueError):
        return 0
    return max(GESER_MIN, min(0, geser))


def rentang(mode, geser=0, hari_ini=None):
    """[mulai, akhir] satu periode PENUH (inklusif) untuk mode + geseran. Minggu = Senin s.d. Minggu."""
    hari_ini = hari_ini or timezone.localdate()
    if mode == 'harian':
        hari = hari_ini + timedelta(days=geser)
        return hari, hari
    if mode == 'mingguan':
        senin = hari_ini - timedelta(days=hari_ini.weekday()) + timedelta(weeks=geser)
        return senin, senin + timedelta(days=6)
    if mode == 'bulanan':
        indeks = hari_ini.year * 12 + hari_ini.month - 1 + geser
        tahun, bulan = divmod(indeks, 12)
        bulan += 1
        return date(tahun, bulan, 1), date(tahun, bulan, calendar.monthrange(tahun, bulan)[1])
    tahun = hari_ini.year + geser
    return date(tahun, 1, 1), date(tahun, 12, 31)


def _tgl(d):
    return f'{d.day} {BULAN3[d.month - 1]} {d.year}'


def label_rentang(mode, mulai, akhir_penuh):
    if mode == 'harian':
        return f'{HARI3[mulai.weekday()]}, {_tgl(mulai)}'
    if mode == 'bulanan':
        return f'{BULAN_PANJANG[mulai.month - 1]} {mulai.year}'
    if mode == 'tahunan':
        return str(mulai.year)
    return f'{_tgl(mulai)} – {_tgl(akhir_penuh)}'


def info_periode(period, geser=0, hari_ini=None):
    """Periode berjalan (dipotong di hari ini) + pembanding sepanjang hari yang sama.

    Pembanding mode geser = periode sebelumnya, dipotong sepanjang periode berjalan
    (mis. 1-10 Nov dibandingkan 1-10 Okt), supaya persen naik/turun adil.
    """
    hari_ini = hari_ini or timezone.localdate()
    if period not in MODE_RENTANG:
        mulai, akhir, sebelum_mulai, sebelum_akhir = _periode(period, hari_ini)
        return {
            'mode': period, 'geser': 0, 'mulai': mulai, 'akhir': akhir, 'akhir_penuh': akhir,
            'sebelum_mulai': sebelum_mulai, 'sebelum_akhir': sebelum_akhir,
            'sebelum_akhir_penuh': sebelum_akhir,
            'label': f'{_tgl(mulai)} – {_tgl(akhir)}',
        }
    geser = baca_geser(geser)
    mulai, akhir_penuh = rentang(period, geser, hari_ini)
    akhir = min(akhir_penuh, hari_ini)
    sebelum_mulai, sebelum_akhir_penuh = rentang(period, geser - 1, hari_ini)
    sebelum_akhir = min(sebelum_akhir_penuh, sebelum_mulai + (akhir - mulai))
    return {
        'mode': period, 'geser': geser, 'mulai': mulai, 'akhir': akhir, 'akhir_penuh': akhir_penuh,
        'sebelum_mulai': sebelum_mulai, 'sebelum_akhir': sebelum_akhir,
        'sebelum_akhir_penuh': sebelum_akhir_penuh,
        'label': label_rentang(period, mulai, akhir_penuh),
    }


def _periode(period, hari_ini=None):
    """Rentang periode berjalan + rentang pembanding dengan panjang yang sama."""
    hari_ini = hari_ini or timezone.localdate()
    if period == 'mtd':
        mulai = hari_ini.replace(day=1)
    elif period == 'qtd':
        mulai = date(hari_ini.year, ((hari_ini.month - 1) // 3) * 3 + 1, 1)
    elif period == '12m':
        mulai = hari_ini - timedelta(days=364)
    else:  # ytd
        mulai = date(hari_ini.year, 1, 1)

    panjang = (hari_ini - mulai).days + 1
    sebelum_akhir = mulai - timedelta(days=1)
    return mulai, hari_ini, sebelum_akhir - timedelta(days=panjang - 1), sebelum_akhir


def _pendapatan(mulai, akhir):
    """Pendapatan = POS lunas + order, keduanya dalam rentang tanggal."""
    pos = POSSale.objects.filter(
        status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir
    ).aggregate(v=Sum('total'))['v'] or ZERO
    order = Order.objects.filter(
        waktu__date__gte=mulai, waktu__date__lte=akhir
    ).exclude(status_global='batal').aggregate(v=Sum('total_harga'))['v'] or ZERO
    return pos + order


def _pendapatan_per_ember(mode, mulai, akhir):
    """{indeks ember: pendapatan} -- definisi sama dengan _pendapatan.

    Ember: jam (harian), hari sejak `mulai` (mingguan/bulanan), bulan 0-11 (tahunan)."""
    trunc = {'harian': TruncHour, 'tahunan': TruncMonth}.get(mode, TruncDay)

    def indeks(waktu):
        waktu = timezone.localtime(waktu) if timezone.is_aware(waktu) else waktu
        if mode == 'harian':
            return waktu.hour
        if mode == 'tahunan':
            return waktu.month - 1
        return (waktu.date() - mulai).days

    hasil = {}
    sumber = (
        (POSSale.objects.filter(status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir),
         'created_at', 'total'),
        (Order.objects.filter(waktu__date__gte=mulai, waktu__date__lte=akhir).exclude(status_global='batal'),
         'waktu', 'total_harga'),
    )
    for qs, kolom_waktu, kolom_total in sumber:
        for r in qs.annotate(e=trunc(kolom_waktu)).values('e').annotate(v=Sum(kolom_total)).order_by():
            if r['e'] is None:
                continue
            i = indeks(r['e'])
            hasil[i] = hasil.get(i, ZERO) + (r['v'] or ZERO)
    return hasil


def seri_penjualan(p, sekarang=None):
    """Titik grafik periode berjalan vs periode sebelumnya (periode penuh, bukan dipotong).

    Ember setelah waktu sekarang bernilai None supaya garis berhenti di "sekarang",
    bukan jatuh ke nol seolah tidak ada penjualan."""
    mode = p['mode']
    sekarang = timezone.localtime(sekarang or timezone.now())
    if mode == 'harian':
        label = [f'{j:02d}:00' for j in range(24)]
    elif mode == 'mingguan':
        label = HARI3[:]
    elif mode == 'tahunan':
        label = BULAN3[:]
    else:
        panjang = max((p['akhir_penuh'] - p['mulai']).days, (p['sebelum_akhir_penuh'] - p['sebelum_mulai']).days) + 1
        label = [str(i + 1) for i in range(panjang)]

    def isi(mulai, akhir_penuh, potong):
        ember = _pendapatan_per_ember(mode, mulai, akhir_penuh)
        nilai = [float(ember.get(i, ZERO)) for i in range(len(label))]
        if mode in ('mingguan', 'bulanan'):
            # Hari di luar periode ini (mis. tgl 31 untuk bulan 30 hari) tidak digambar.
            ada = (akhir_penuh - mulai).days + 1
            nilai = [v if i < ada else None for i, v in enumerate(nilai)]
        if potong is not None:
            nilai = [v if i <= potong else None for i, v in enumerate(nilai)]
        return nilai

    potong = None
    if p['mulai'] <= sekarang.date() <= p['akhir_penuh']:
        potong = {
            'harian': sekarang.hour,
            'tahunan': sekarang.month - 1,
        }.get(mode, (sekarang.date() - p['mulai']).days)
    return {
        'label': label,
        'sekarang': isi(p['mulai'], p['akhir_penuh'], potong),
        'sebelumnya': isi(p['sebelum_mulai'], p['sebelum_akhir_penuh'], None),
    }


def ringkasan_penjualan(mode='harian', geser=0, hari_ini=None):
    """Ringkasan penjualan dashboard operasional (owner/manager) untuk satu rentang.

    Total = POS lunas + pesanan tidak batal (definisi sama dengan KPI Pendapatan).
    Belum dibayar = sisa tagihan pesanan pada rentang itu; terbayar = total - belum dibayar.
    """
    p = info_periode(mode, geser, hari_ini)
    mulai, akhir = p['mulai'], p['akhir']
    pos = POSSale.objects.filter(status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir)
    pos_agg = pos.aggregate(v=Sum('total'), n=Count('pk'))
    order = Order.objects.filter(waktu__date__gte=mulai, waktu__date__lte=akhir).exclude(status_global='batal')
    order_agg = order.aggregate(v=Sum('total_harga'), sisa=Sum('sisa_tagihan'), n=Count('pk'))

    total = (pos_agg['v'] or ZERO) + (order_agg['v'] or ZERO)
    belum = Decimal(order_agg['sisa'] or 0)
    jumlah_transaksi = (pos_agg['n'] or 0) + (order_agg['n'] or 0)
    total_lalu = _pendapatan(p['sebelum_mulai'], p['sebelum_akhir'])

    # Akumulasi dari awal bulan s.d. akhir rentang, dan proyeksi sebulan penuh dengan laju yang sama.
    awal_bulan = akhir.replace(day=1)
    akumulasi = _pendapatan(awal_bulan, akhir)
    hari_bulan = calendar.monthrange(akhir.year, akhir.month)[1]
    hari_jalan = (akhir - awal_bulan).days + 1
    proyeksi = akumulasi / hari_jalan * hari_bulan if hari_jalan else ZERO

    return {
        'periode': {
            'mode': p['mode'], 'geser': p['geser'], 'label': p['label'],
            'mulai': mulai.isoformat(), 'akhir': akhir.isoformat(),
            'bisa_maju': p['geser'] < 0,
        },
        'total': float(total),
        'delta': _delta(total, total_lalu),
        'total_lalu': float(total_lalu),
        'terbayar': float(max(ZERO, total - belum)),
        'belum_dibayar': float(belum),
        'jumlah_order': order_agg['n'] or 0,
        'jumlah_pos': pos_agg['n'] or 0,
        'rata_rata': float(total / jumlah_transaksi) if jumlah_transaksi else 0.0,
        'akumulasi_bulan': float(akumulasi),
        'proyeksi_bulan': float(round(proyeksi)),
        'seri': seri_penjualan(p),
    }


def _pendapatan_per_unit(mulai, akhir):
    """{unit_bisnis_id|None: (pendapatan, jumlah transaksi)} -- definisi sama dengan _pendapatan."""
    hasil = {}

    def tambah(qs, kolom_total):
        for r in qs.values('unit_bisnis_id').annotate(v=Sum(kolom_total), n=Count('pk')).order_by():
            nilai, jumlah = hasil.get(r['unit_bisnis_id'], (ZERO, 0))
            hasil[r['unit_bisnis_id']] = (nilai + (r['v'] or ZERO), jumlah + r['n'])

    tambah(POSSale.objects.filter(status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir), 'total')
    tambah(Order.objects.filter(waktu__date__gte=mulai, waktu__date__lte=akhir).exclude(status_global='batal'), 'total_harga')
    return hasil


def _per_unit(mulai, akhir, sebelum_mulai, sebelum_akhir):
    """Pendapatan per unit bisnis + pembanding periode lalu + porsi dari total."""
    sekarang = _pendapatan_per_unit(mulai, akhir)
    lalu = _pendapatan_per_unit(sebelum_mulai, sebelum_akhir)
    total = sum((v for v, _ in sekarang.values()), ZERO)
    nama = dict(UnitBisnis.objects.values_list('id', 'nama'))
    unit_ids = list(UnitBisnis.objects.filter(is_active=True).order_by('nama').values_list('id', flat=True))
    if None in sekarang or None in lalu:
        unit_ids.append(None)  # transaksi yang belum bertanda unit
    rows = []
    for uid in unit_ids:
        nilai, jumlah = sekarang.get(uid, (ZERO, 0))
        rows.append({
            'id': uid,
            'nama': nama.get(uid) if uid else None,
            'pendapatan': float(nilai),
            'transaksi': jumlah,
            'porsi': round(float(nilai / total * 100), 1) if total else 0,
            'delta': _delta(nilai, lalu.get(uid, (ZERO, 0))[0]),
        })
    return rows


def _hpp(mulai, akhir):
    """HPP nyata dari lapisan FIFO yang dikonsumsi (bukan taksiran).

    Pengembalian barang mengurangi HPP, karena stoknya kembali masuk.
    """
    keluar = ProductStockMovement.objects.filter(
        tipe='penjualan', created_at__date__gte=mulai, created_at__date__lte=akhir
    ).aggregate(v=Sum('hpp_total'))['v'] or ZERO
    kembali = ProductStockMovement.objects.filter(
        tipe='pengembalian', created_at__date__gte=mulai, created_at__date__lte=akhir
    ).aggregate(v=Sum('hpp_total'))['v'] or ZERO
    return keluar - kembali


def _delta(sekarang, sebelum):
    """Perubahan persen. None bila tidak ada pembanding — UI menyembunyikannya."""
    if not sebelum:
        return None
    return round(float((sekarang - sebelum) / abs(sebelum) * 100), 1)


def _tren(mulai, akhir):
    """Tren bulanan pendapatan POS dan HPP nyata."""
    pendapatan = {
        row['bulan'].date(): row['v'] or ZERO
        for row in POSSale.objects.filter(
            status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir
        ).annotate(bulan=TruncMonth('created_at')).values('bulan').annotate(v=Sum('total'))
    }
    hpp = {
        row['bulan'].date(): row['v'] or ZERO
        for row in ProductStockMovement.objects.filter(
            tipe='penjualan', created_at__date__gte=mulai, created_at__date__lte=akhir
        ).annotate(bulan=TruncMonth('created_at')).values('bulan').annotate(v=Sum('hpp_total'))
    }
    hasil = []
    for bulan in sorted(set(pendapatan) | set(hpp)):
        nilai = pendapatan.get(bulan, ZERO)
        modal = hpp.get(bulan, ZERO)
        hasil.append({
            'periode': bulan.strftime('%b %Y'),
            'pendapatan': float(nilai),
            'hpp': float(modal),
            'laba_kotor': float(nilai - modal),
        })
    return hasil


def _produk_terlaris(mulai, akhir, batas=5):
    rows = POSSaleItem.objects.filter(
        sale__status='paid', sale__created_at__date__gte=mulai, sale__created_at__date__lte=akhir
    ).values('nama_snapshot').annotate(
        qty=Sum('qty'), nilai=Sum('subtotal')
    ).order_by('-nilai')[:batas]
    return [
        {'nama': r['nama_snapshot'], 'qty': float(r['qty'] or 0), 'nilai': float(r['nilai'] or 0)}
        for r in rows
    ]


def _stok():
    aktif = Product.objects.filter(is_active=True)
    dilacak = aktif.filter(lacak_inventori=True)
    habis = dilacak.filter(qty_stok__lte=0).count()
    menipis = dilacak.filter(qty_stok__gt=0, qty_stok__lte=F('stok_minimum')).count()
    total = dilacak.count()
    nilai = aktif.aggregate(v=Sum(ExpressionWrapper(
        F('qty_stok') * F('harga_beli'), output_field=DecimalField(max_digits=20, decimal_places=2)
    )))['v'] or ZERO
    return {
        'nilai_persediaan': float(nilai),
        'total_dilacak': total,
        'habis': habis,
        'menipis': menipis,
        'sehat': max(0, total - habis - menipis),
    }


def build(period='ytd', geser=0):
    p = info_periode(period, geser)
    mulai, akhir, sebelum_mulai, sebelum_akhir = p['mulai'], p['akhir'], p['sebelum_mulai'], p['sebelum_akhir']
    # Tren bulanan rentang geser selalu 12 bulan s.d. akhir rentang (satu batang untuk
    # "hari ini" tidak berguna); kode lama tetap memakai rentang periodenya sendiri.
    if period in MODE_RENTANG:
        indeks = akhir.year * 12 + akhir.month - 1 - 11
        awal_tren = date(indeks // 12, indeks % 12 + 1, 1)
    else:
        awal_tren = mulai

    pendapatan = _pendapatan(mulai, akhir)
    hpp = _hpp(mulai, akhir)
    pendapatan_lalu = _pendapatan(sebelum_mulai, sebelum_akhir)
    hpp_lalu = _hpp(sebelum_mulai, sebelum_akhir)

    transaksi = POSSale.objects.filter(
        status='paid', created_at__date__gte=mulai, created_at__date__lte=akhir
    ).count()
    # Piutang bersifat posisi (bukan periode): seluruh sisa tagihan yang belum lunas.
    piutang = Order.objects.filter(sisa_tagihan__gt=0).aggregate(v=Sum('sisa_tagihan'))['v'] or ZERO
    stok = _stok()

    produksi_total = StockProductionDocument.objects.filter(tanggal__range=(mulai, akhir)).count()
    produksi_selesai = StockProductionDocument.objects.filter(
        tanggal__range=(mulai, akhir), status='selesai'
    ).count()

    return {
        'generated_at': timezone.now().isoformat(),
        'periode': {
            'kode': period,
            'geser': p['geser'],
            'bisa_maju': p['geser'] < 0,
            'mulai': mulai.isoformat(),
            'akhir': akhir.isoformat(),
            'label': p['label'],
            'pembanding': f'{_tgl(sebelum_mulai)} – {_tgl(sebelum_akhir)}',
        },
        'kpi': [
            {'key': 'pendapatan', 'label': 'Pendapatan', 'value': float(pendapatan),
             'delta': _delta(pendapatan, pendapatan_lalu)},
            {'key': 'hpp', 'label': 'HPP (FIFO)', 'value': float(hpp),
             'delta': _delta(hpp, hpp_lalu)},
            {'key': 'laba_kotor', 'label': 'Laba Kotor', 'value': float(pendapatan - hpp),
             'delta': _delta(pendapatan - hpp, pendapatan_lalu - hpp_lalu)},
            {'key': 'piutang', 'label': 'Piutang Berjalan', 'value': float(piutang), 'delta': None},
            {'key': 'persediaan', 'label': 'Nilai Persediaan', 'value': stok['nilai_persediaan'],
             'delta': None},
            {'key': 'transaksi', 'label': 'Transaksi POS', 'value': transaksi, 'delta': None,
             'format': 'angka'},
        ],
        'per_unit': _per_unit(mulai, akhir, sebelum_mulai, sebelum_akhir),
        'tren': _tren(awal_tren, akhir),
        'seri': seri_penjualan(p) if period in MODE_RENTANG else None,
        'produk_terlaris': _produk_terlaris(mulai, akhir),
        'stok': stok,
        'produksi': {'total': produksi_total, 'selesai': produksi_selesai},
        'unavailable': UNAVAILABLE,
    }
