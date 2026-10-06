"""Struk online (e-receipt) + survei kepuasan (2026-10-06), padanan e-receipt Olsera.

Tautan publik: {ERP_PUBLIC_URL}/resi/<token>. Token = django.core.signing (salt
khusus) berisi jenis & id transaksi -- tidak bisa ditebak/diubah tanpa SECRET_KEY,
jadi id berurutan tidak terbuka. Data yang ditampilkan dibatasi untuk pelanggan:
nomor WA disamarkan, tanpa harga beli/HPP/data internal.
"""
import os
from decimal import Decimal

from django.core import signing
from django.db import transaction

SALT = 'resi-digital-v1'
DEFAULT_PUBLIC_URL = 'https://app.starphotoadvertising.com'


class TokenTidakValid(Exception):
    pass


class SurveiSudahDiisi(Exception):
    pass


def buat_token(jenis, pk):
    return signing.dumps({'j': jenis, 'id': str(pk)}, salt=SALT, compress=True)


def baca_token(token):
    try:
        data = signing.loads(token, salt=SALT)
    except signing.BadSignature as exc:
        raise TokenTidakValid() from exc
    if data.get('j') not in ('pos', 'order') or not data.get('id'):
        raise TokenTidakValid()
    return data['j'], data['id']


def url_resi(jenis, pk):
    dasar = os.getenv('ERP_PUBLIC_URL', DEFAULT_PUBLIC_URL).rstrip('/')
    return f'{dasar}/resi/{buat_token(jenis, pk)}'


def ambil_transaksi(token):
    """(jenis, objek) atau TokenTidakValid bila token salah / transaksi tidak ada."""
    from ..models import Order
    from ..pos_models import POSSale

    jenis, pk = baca_token(token)
    if jenis == 'pos':
        obj = POSSale.objects.filter(pk=pk).exclude(status='hold').first()
    else:
        obj = Order.objects.filter(pk=pk).first()
    if obj is None:
        raise TokenTidakValid()
    return jenis, obj


def _samarkan(nomor):
    nomor = str(nomor or '')
    return (nomor[:4] + '*' * max(0, len(nomor) - 7) + nomor[-3:]) if len(nomor) > 7 else nomor


def _nama_user(user):
    if not user:
        return ''
    return (user.get_full_name() or user.username) if hasattr(user, 'get_full_name') else str(user)


def _info_toko():
    from ..models import SystemConfig
    from .pos_receipt_whatsapp import _info_bisnis_resi

    info = _info_bisnis_resi()
    tambahan = dict(SystemConfig.objects.filter(key__in=['bisnis_logo_url', 'pos_resi_catatan']).values_list('key', 'value'))
    info['logo_url'] = tambahan.get('bisnis_logo_url') or ''
    info['catatan_kaki'] = tambahan.get('pos_resi_catatan') or 'Terima kasih atas kunjungan Anda'
    return info


def _angka(x):
    return int(Decimal(str(x or 0)).quantize(Decimal('1')))


def data_resi_pos(sale):
    from .pos_receipt_whatsapp import hitung_total_diskon_resi

    pelanggan = sale.pelanggan
    items = [
        {
            'nama': it.nama_snapshot, 'qty': str((it.uom_qty or it.qty).normalize()),
            'satuan': it.uom_kode or '', 'harga': _angka(it.harga_snapshot), 'subtotal': _angka(it.subtotal),
            'catatan': it.catatan or '',
        }
        for it in sale.items.all()
    ]
    return {
        'jenis': 'pos',
        'nomor': sale.nomor,
        'waktu': sale.created_at.isoformat(),
        'status': 'batal' if sale.status == 'void' else 'lunas',
        'kasir': _nama_user(sale.kasir),
        'dilayani_oleh': _nama_user(getattr(sale, 'dilayani_oleh', None)),
        'pelanggan': {'nama': getattr(pelanggan, 'nama', '') or '', 'nomor_wa': _samarkan(getattr(pelanggan, 'nomor_wa', ''))},
        'items': items,
        'subtotal': _angka(sale.subtotal),
        'diskon': _angka(hitung_total_diskon_resi(sale)),
        'pajak': _angka(sale.pajak),
        'total': _angka(sale.total),
        'dibayar': _angka(sale.dibayar),
        'kembalian': _angka(sale.kembalian),
        'sisa_tagihan': 0,
        'pembayaran': [{'waktu': sale.created_at.isoformat(), 'metode': sale.metode_bayar, 'jumlah': _angka(sale.dibayar)}],
    }


def data_resi_order(order):
    items = [
        {
            'nama': it.jenis_produk + (f' {it.panjang:g}x{it.lebar:g} m' if (it.panjang and it.lebar) else ''),
            'qty': str(it.qty), 'satuan': '', 'harga': _angka(it.harga_jual / it.qty) if it.qty else _angka(it.harga_jual),
            'subtotal': _angka(it.harga_jual), 'catatan': it.keterangan_detail or '',
        }
        for it in order.items.all()
    ]
    subtotal = sum(i['subtotal'] for i in items)
    if order.status_global == 'batal':
        status = 'batal'
    elif order.sisa_tagihan <= 0 and order.total_harga > 0:
        status = 'lunas'
    else:
        status = 'belum_lunas'
    return {
        'jenis': 'order',
        'nomor': order.id,
        'waktu': order.waktu.isoformat(),
        'status': status,
        'status_pesanan': order.get_status_global_display(),
        'kasir': '',
        'dilayani_oleh': '',
        'pelanggan': {'nama': order.nama or '', 'nomor_wa': _samarkan(order.nomor_wa)},
        'items': items,
        'subtotal': subtotal,
        'diskon': max(0, subtotal - _angka(order.total_harga)),
        'pajak': 0,
        'total': _angka(order.total_harga),
        'dibayar': _angka(order.dp_dibayar),
        'kembalian': 0,
        'sisa_tagihan': _angka(order.sisa_tagihan),
        'pembayaran': [
            {'waktu': p.dibuat_pada.isoformat(), 'metode': p.metode_pembayaran, 'jumlah': p.jumlah, 'dp': p.is_dp}
            for p in order.payments.order_by('dibuat_pada')
        ],
    }


def data_resi(token):
    from ..survei_models import AspekSurvei

    from ..survei_models import SurveiKepuasan

    jenis, obj = ambil_transaksi(token)
    data = data_resi_pos(obj) if jenis == 'pos' else data_resi_order(obj)
    survei = SurveiKepuasan.objects.filter(**({'pos_sale': obj} if jenis == 'pos' else {'order': obj})).first()
    data['toko'] = _info_toko()
    data['survei'] = {
        'sudah_diisi': survei is not None,
        'bisa_diisi': survei is None and data['status'] != 'batal',
        'aspek': [{'id': a.id, 'nama': a.nama} for a in AspekSurvei.objects.filter(aktif=True)],
        'nilai': [{'aspek': n.aspek.nama, 'nilai': n.nilai} for n in survei.nilai.select_related('aspek')] if survei else [],
        'catatan': survei.catatan if survei else '',
    }
    return data


def simpan_survei(token, nilai_per_aspek, catatan=''):
    """nilai_per_aspek: {aspek_id: 1..5} untuk SEMUA aspek aktif. Sekali per transaksi."""
    from ..survei_models import AspekSurvei, NilaiSurvei, SurveiKepuasan

    jenis, obj = ambil_transaksi(token)
    aktif = list(AspekSurvei.objects.filter(aktif=True))
    nilai = {}
    for a in aktif:
        try:
            n = int(nilai_per_aspek.get(str(a.id), nilai_per_aspek.get(a.id)))
        except (TypeError, ValueError):
            raise ValueError(f"Nilai untuk '{a.nama}' wajib diisi (1-5).")
        if not 1 <= n <= 5:
            raise ValueError(f"Nilai untuk '{a.nama}' harus 1-5.")
        nilai[a] = n
    if not nilai:
        raise ValueError('Belum ada aspek survei yang aktif.')

    if jenis == 'pos':
        nama, nomor = getattr(obj.pelanggan, 'nama', '') or '', getattr(obj.pelanggan, 'nomor_wa', '') or ''
        if obj.status == 'void':
            raise ValueError('Transaksi ini sudah dibatalkan.')
    else:
        nama, nomor = obj.nama or '', obj.nomor_wa or ''
        if obj.status_global == 'batal':
            raise ValueError('Pesanan ini sudah dibatalkan.')

    with transaction.atomic():
        filt = {'pos_sale': obj} if jenis == 'pos' else {'order': obj}
        if SurveiKepuasan.objects.select_for_update().filter(**filt).exists():
            raise SurveiSudahDiisi()
        rata = (Decimal(sum(nilai.values())) / len(nilai)).quantize(Decimal('0.01'))
        survei = SurveiKepuasan.objects.create(
            **filt, nama_pelanggan=nama[:255], nomor_wa=nomor[:20],
            catatan=str(catatan or '')[:1000], rata_rata=rata,
        )
        NilaiSurvei.objects.bulk_create([NilaiSurvei(survei=survei, aspek=a, nilai=n) for a, n in nilai.items()])
    return survei
