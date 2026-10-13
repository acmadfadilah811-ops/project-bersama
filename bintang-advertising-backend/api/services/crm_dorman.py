"""Pelanggan yang sudah lama tidak order, untuk follow up di CRM (2026-10-13).

CRM bertanya "siapa yang terakhir order >= N hari lalu"; Bintang menjawab dari
seluruh transaksinya (order Antrean semua kanal yang tidak batal + penjualan POS
paid), per nomor HP yang dinormalisasi -- sumber yang sama dengan laporan
penjualan, jadi tidak bergantung pada Contact CRM yang baru terisi dari kasir.
Nomor yang bukan nomor HP/WA valid (mis. ID perangkat WhatsApp) dilewati karena
tidak bisa dihubungi.
"""

from django.utils import timezone

from .crm_order import CrmOrderError
from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp

MIN_HARI, MAKS_HARI = 7, 1100
MAKS_MIN_TRANSAKSI = 100
MAKS_BARIS = 500


def _angka(nilai, nama, bawah, atas, bawaan):
    if nilai in (None, ''):
        return bawaan
    try:
        angka = int(nilai)
    except (TypeError, ValueError):
        raise CrmOrderError(f"Parameter '{nama}' harus berupa angka bulat.")
    if not bawah <= angka <= atas:
        raise CrmOrderError(f"Parameter '{nama}' harus antara {bawah} dan {atas}.")
    return angka


def _daftar_nomor(nomor_csv):
    """Nomor ternormalisasi unik dari 'a,b,c' (maks. MAKS_BARIS); None bila tidak diisi."""
    if not nomor_csv:
        return None
    hasil = []
    for x in str(nomor_csv).split(','):
        n = normalisasi_nomor_whatsapp(x)
        if n and n not in hasil:
            hasil.append(n)
    if len(hasil) > MAKS_BARIS:
        raise CrmOrderError(f'Maksimal {MAKS_BARIS} nomor per permintaan.')
    return set(hasil)


def pelanggan_dorman(hari, min_transaksi=None, nomor=None):
    """Tanpa `nomor`: pelanggan yang order terakhirnya >= `hari` hari lalu.
    Dengan `nomor` ("a,b,c"): data order terakhir nomor-nomor itu saja, tanpa ambang --
    dipakai CRM untuk memeriksa apakah pelanggan yang sedang di-follow up sudah order lagi."""
    from ..models import Order
    from ..pos_models import POSSale

    hari = _angka(hari, 'hari', MIN_HARI, MAKS_HARI, 60)
    min_transaksi = _angka(min_transaksi, 'min_transaksi', 1, MAKS_MIN_TRANSAKSI, 1)
    dicari = _daftar_nomor(nomor)

    per = {}  # nomor -> {'terakhir', 'nama', 'jumlah', 'total'}

    def catat(nomor, nama, waktu, total):
        n = normalisasi_nomor_whatsapp(nomor)
        if not n:
            return
        d = per.get(n)
        if d is None:
            d = per[n] = {'terakhir': waktu, 'nama': nama or '', 'jumlah': 0, 'total': 0}
        d['jumlah'] += 1
        d['total'] += int(total or 0)
        if waktu >= d['terakhir']:
            d['terakhir'] = waktu
            d['nama'] = nama or d['nama']

    orders = (Order.objects.exclude(status_global='batal')
              .values_list('nomor_wa', 'nama', 'waktu', 'total_harga'))
    for nomor, nama, waktu, total in orders.iterator():
        catat(nomor, nama, waktu, total)

    pos = (POSSale.objects.filter(status='paid', pelanggan__isnull=False)
           .values_list('pelanggan_id', 'pelanggan__nama', 'created_at', 'total'))
    for nomor, nama, waktu, total in pos.iterator():
        catat(nomor, nama, waktu, total)

    hari_ini = timezone.localdate()
    hasil = []
    for nomor_, d in per.items():
        terakhir = timezone.localtime(d['terakhir']).date()
        lewat = (hari_ini - terakhir).days
        cocok = nomor_ in dicari if dicari is not None else (lewat >= hari and d['jumlah'] >= min_transaksi)
        if cocok:
            hasil.append({
                'nomor': nomor_, 'nama': d['nama'], 'terakhir': terakhir.isoformat(), 'hari_sejak': lewat,
                'jumlah_transaksi': d['jumlah'], 'total_belanja': d['total'],
            })
    hasil.sort(key=lambda x: (-x['total_belanja'], x['nomor']))
    return {
        'hari': hari, 'min_transaksi': min_transaksi, 'total': len(hasil),
        'dipotong': len(hasil) > MAKS_BARIS, 'hasil': hasil[:MAKS_BARIS],
    }
