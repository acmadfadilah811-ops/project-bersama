"""Porsi diskon & PPN pada retur pembelian (2026-09-24).

Retur mengembalikan sebagian barang dari pembelian asal yang ber-diskon/PPN.
Porsi diskon & PPN retur dihitung proporsional dari NILAI BARANG YANG DIRETUR
terhadap subtotal pembelian asal (pakai harga beli di pembelian asal), dan
kumulatif antar retur parsial supaya total seluruh retur tepat sama dengan
diskon/PPN asal (tidak lebih, tidak sisa pembulatan).
"""
from decimal import Decimal, ROUND_HALF_UP

ZERO = Decimal('0')
SATU = Decimal('1')


def _rupiah(v):
    return Decimal(v).quantize(SATU, rounding=ROUND_HALF_UP)


def _nilai_barang(retur, harga_asal):
    """Nilai kotor barang retur pada harga beli pembelian asal (fallback: harga
    yang tertulis di item retur)."""
    total = ZERO
    for it in retur.items.all():
        harga = harga_asal.get((it.product_id, it.variant_id), it.harga_beli)
        total += Decimal(it.qty) * Decimal(harga)
    return total


def faktor_biaya_bersih(purchase):
    """Pengali harga beli -> biaya bersih per unit setelah diskon dokumen.
    Pembelian biasa: dari diskonnya sendiri. Retur: dari diskon pembelian asal
    (dipakai bila retur ditukar barang baru, supaya persediaan tidak membengkak
    sebesar diskon). Tanpa diskon = 1."""
    sumber = purchase.retur_ref if (purchase.is_retur and purchase.retur_ref_id) else purchase
    ring = sumber.hitung_ringkasan()
    if ring['subtotal'] <= 0 or ring['diskon'] <= 0:
        return SATU
    return (ring['subtotal'] - ring['diskon']) / ring['subtotal']


def hitung_bagian_retur(retur):
    """Porsi (diskon, pajak) dari pembelian asal yang ikut dikembalikan oleh
    dokumen retur ini. Mengembalikan {'diskon': Decimal, 'pajak': Decimal}."""
    nol = {'diskon': ZERO, 'pajak': ZERO}
    sumber = retur.retur_ref
    if not (retur.is_retur and sumber):
        return nol
    ring = sumber.hitung_ringkasan()
    if ring['subtotal'] <= 0 or (ring['diskon'] <= 0 and ring['pajak'] <= 0):
        return nol

    harga_asal = {}
    for it in sumber.items.all():
        harga_asal.setdefault((it.product_id, it.variant_id), it.harga_beli)

    rasio_ini = _nilai_barang(retur, harga_asal) / ring['subtotal']
    rasio_sebelum = ZERO
    for lain in sumber.returns.filter(is_retur=True, status='selesai').exclude(pk=retur.pk):
        rasio_sebelum += _nilai_barang(lain, harga_asal) / ring['subtotal']
    rasio_sebelum = min(rasio_sebelum, SATU)
    rasio_sesudah = min(rasio_sebelum + rasio_ini, SATU)

    def porsi(nilai):
        return _rupiah(nilai * rasio_sesudah) - _rupiah(nilai * rasio_sebelum)

    return {'diskon': porsi(ring['diskon']), 'pajak': porsi(ring['pajak'])}
