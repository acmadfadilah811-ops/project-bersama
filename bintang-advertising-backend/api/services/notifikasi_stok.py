"""Buat/tutup notifikasi stok minimum (2026-09-26, UAT INV-06).

Dipanggil sinyal post_save Product & InventoryItem (notifikasi_stok_models.py).
Gagal di sini tidak boleh menggagalkan transaksi stok -- hanya dicatat di log.
"""

import logging
from decimal import Decimal

from django.db import IntegrityError, transaction

logger = logging.getLogger(__name__)

PERAN_PENERIMA = {'owner', 'manager', 'admin', 'spv_finance', 'admin_finance'}


def _sinkron(jenis, ref_id, nama, satuan, stok, minimum):
    from ..notifikasi_stok_models import NotifikasiStok

    stok, minimum = Decimal(str(stok or 0)), Decimal(str(minimum or 0))
    aktif = NotifikasiStok.objects.filter(jenis=jenis, ref_id=ref_id, aktif=True)
    if minimum <= 0 or stok >= minimum:
        aktif.update(aktif=False, stok=stok)
        return
    ada = aktif.first()
    if ada:
        if ada.stok != stok:
            NotifikasiStok.objects.filter(pk=ada.pk).update(stok=stok)
        return
    try:
        with transaction.atomic():
            NotifikasiStok.objects.create(jenis=jenis, ref_id=ref_id, nama=nama, satuan=satuan or '',
                                          stok=stok, minimum=minimum)
    except IntegrityError:
        pass  # notifikasi aktif sudah dibuat proses lain


def periksa_produk(product):
    try:
        if not product.lacak_inventori:
            _sinkron('produk', str(product.pk), product.nama, product.satuan, 0, 0)
            return
        _sinkron('produk', str(product.pk), product.nama, product.satuan, product.qty_stok, product.stok_minimum)
    except Exception:  # noqa: BLE001 -- notifikasi tidak boleh menggagalkan mutasi stok
        logger.exception('Gagal memeriksa stok minimum produk %s', product.pk)


def periksa_bahan(item):
    try:
        _sinkron('bahan', str(item.pk), item.nama, item.satuan, item.stok, item.min_stok)
    except Exception:  # noqa: BLE001
        logger.exception('Gagal memeriksa stok minimum bahan %s', item.pk)


def bentuk(n, user_id):
    angka = lambda d: f'{d.normalize():f}'  # noqa: E731
    return {
        'id': n.id,
        'jenis': 'stok_minimum',
        'judul': f'Stok menipis: {n.nama}',
        'pesan': (f'Sisa {angka(n.stok)} {n.satuan}, di bawah minimum {angka(n.minimum)} {n.satuan}.'
                  if n.aktif else f'Sudah diisi ulang (minimum {angka(n.minimum)} {n.satuan}).').replace('  ', ' '),
        'tautan': '/product-inventory' if n.jenis == 'produk' else '/inventory',
        'aktif': n.aktif,
        'dibuat': n.dibuat.isoformat(),
        'dibaca': user_id in {u.id for u in n.dibaca_oleh.all()},
    }
