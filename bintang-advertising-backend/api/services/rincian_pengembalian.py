"""Rincian stok saat void/retur/batal (2026-09-26, instruksi user).

Menjawab "apa yang kembali ke stok dan apa yang tidak" sebelum petugas
mengonfirmasi, dan menjadi dasar keterangan di riwayat:
- produk: barang jadi yang stoknya dilacak (dikembalikan ke stok, kecuali
  retur yang ditandai rusak/tidak layak dijual);
- bahan: bahan resep/produksi yang sudah dipotong (void POS: dikembalikan bila
  belum dicetak/dibuat; order yang sudah diproduksi: tidak dikembalikan karena
  bahannya sudah terpakai, mis. banner yang sudah dicetak).
"""

from collections import OrderedDict
from decimal import Decimal


def _gabung(baris):
    hasil = OrderedDict()
    for nama, qty, satuan in baris:
        kunci = (nama, satuan)
        hasil[kunci] = hasil.get(kunci, Decimal('0')) + Decimal(str(qty))
    return [{'nama': n, 'qty': float(q), 'satuan': s or ''} for (n, s), q in hasil.items() if q]


def _bahan_dari_riwayat(qs):
    return _gabung((r.item.nama, -r.delta, r.item.satuan) for r in qs.filter(delta__lt=0).select_related('item'))


def rincian_pos(sale):
    from ..models import RestockHistory

    produk = _gabung(
        (it.product.nama + (f' - {it.variant.nama_varian}' if it.variant_id else ''), it.qty, it.product.satuan)
        for it in sale.items.select_related('product', 'variant')
        if it.product and it.product.lacak_inventori
    )
    bahan = _bahan_dari_riwayat(RestockHistory.objects.filter(
        keterangan__startswith=f"Pemakaian BoM otomatis | POS {sale.nomor} - Produk #"))
    return {'produk': produk, 'bahan': bahan}


def rincian_order(order):
    from ..models import JobBoard, RestockHistory

    produk = _gabung(
        (it.product.nama + (f' - {it.variant.nama_varian}' if it.variant_id else ''), it.qty, it.product.satuan)
        for it in order.items.select_related('product', 'variant')
        if it.product_id and it.product.lacak_inventori
    )
    job_ids = list(JobBoard.objects.filter(order_item__order=order).values_list('id', flat=True))
    bahan = []
    if job_ids:
        pola = '|'.join(str(i) for i in job_ids)
        bahan = _bahan_dari_riwayat(RestockHistory.objects.filter(keterangan__regex=rf"Job #({pola})( |$)"))
    return {'produk': produk, 'bahan': bahan}


def teks(daftar):
    return ', '.join(f"{d['nama']} {d['qty']:g} {d['satuan']}".strip() for d in daftar) or '-'
