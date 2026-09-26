"""Laporan penjualan & pertumbuhan pelanggan untuk CRM (2026-09-26, UAT SLS-01/02).

Definisi omzet SAMA dengan Dashboard Eksekutif (executive_dashboard._pendapatan)
agar bisa dicek silang: penjualan POS berstatus paid + order Antrean yang tidak
batal, keduanya menurut tanggal transaksi. Kolom "dibayar" memisahkan uang yang
sudah diterima dari piutang.

Pelanggan dihitung per nomor HP yang dinormalisasi (08.../62.../+62 dianggap
sama). Pelanggan "baru" = transaksi pertamanya (sepanjang data) jatuh di dalam
periode; "kembali" = aktif di periode dan sudah pernah bertransaksi sebelumnya.
"""

from collections import defaultdict

from django.utils import timezone

from .crm_order import CrmOrderError, _tanggal
from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp

MAKS_HARI = 1100


def _bulan(dt):
    return timezone.localtime(dt).strftime('%Y-%m')


def laporan_penjualan(mulai, selesai):
    from ..customer_models import Customer
    from ..models import Order
    from ..pos_models import POSSale

    mulai, selesai = _tanggal(mulai, 'mulai'), _tanggal(selesai, 'selesai')
    if mulai > selesai:
        raise CrmOrderError('Tanggal mulai harus sebelum tanggal selesai.')
    if (selesai - mulai).days > MAKS_HARI:
        raise CrmOrderError('Periode laporan maksimal 3 tahun.')

    kanal = defaultdict(lambda: {'transaksi': 0, 'omzet': 0, 'dibayar': 0})
    per_bulan = defaultdict(lambda: {'transaksi': 0, 'omzet': 0, 'pelanggan_baru': 0})
    pertama = {}          # nomor -> waktu transaksi pertama (sampai akhir periode)
    aktif = set()

    def catat_pelanggan(nomor, waktu, dalam_periode):
        n = normalisasi_nomor_whatsapp(nomor)
        if not n:
            return
        if n not in pertama or waktu < pertama[n]:
            pertama[n] = waktu
        if dalam_periode:
            aktif.add(n)

    labels = dict(Order._meta.get_field('sumber').choices)
    orders = (Order.objects.filter(waktu__date__lte=selesai).exclude(status_global='batal')
              .values_list('nomor_wa', 'waktu', 'sumber', 'total_harga', 'dp_dibayar'))
    for nomor, waktu, sumber, total, dibayar in orders.iterator():
        dalam = timezone.localtime(waktu).date() >= mulai
        catat_pelanggan(nomor, waktu, dalam)
        if dalam:
            k = kanal[labels.get(sumber, sumber)]
            k['transaksi'] += 1
            k['omzet'] += int(total or 0)
            k['dibayar'] += min(int(dibayar or 0), int(total or 0))
            b = per_bulan[_bulan(waktu)]
            b['transaksi'] += 1
            b['omzet'] += int(total or 0)

    pos = (POSSale.objects.filter(status='paid', created_at__date__lte=selesai)
           .values_list('pelanggan_id', 'created_at', 'total'))
    for nomor, waktu, total in pos.iterator():
        dalam = timezone.localtime(waktu).date() >= mulai
        if nomor:
            catat_pelanggan(nomor, waktu, dalam)
        if dalam:
            k = kanal['Kasir (POS)']
            k['transaksi'] += 1
            k['omzet'] += int(total or 0)
            k['dibayar'] += int(total or 0)
            b = per_bulan[_bulan(waktu)]
            b['transaksi'] += 1
            b['omzet'] += int(total or 0)

    baru = {n for n in aktif if timezone.localtime(pertama[n]).date() >= mulai}
    for n in baru:
        per_bulan[_bulan(pertama[n])]['pelanggan_baru'] += 1

    omzet = sum(k['omzet'] for k in kanal.values())
    dibayar = sum(k['dibayar'] for k in kanal.values())
    return {
        'mulai': mulai.isoformat(), 'selesai': selesai.isoformat(),
        'ringkasan': {
            'transaksi': sum(k['transaksi'] for k in kanal.values()),
            'omzet': omzet, 'dibayar': dibayar, 'belum_dibayar': omzet - dibayar,
            'pelanggan_aktif': len(aktif), 'pelanggan_baru': len(baru), 'pelanggan_kembali': len(aktif - baru),
            'pelanggan_terdaftar_baru': Customer.objects.filter(
                created_at__date__gte=mulai, created_at__date__lte=selesai).count(),
            'pelanggan_terdaftar_total': Customer.objects.filter(created_at__date__lte=selesai).count(),
        },
        'per_kanal': sorted(({'kanal': n, **v} for n, v in kanal.items()), key=lambda x: -x['omzet']),
        'per_bulan': [{'bulan': b, **per_bulan[b]} for b in sorted(per_bulan)],
    }
