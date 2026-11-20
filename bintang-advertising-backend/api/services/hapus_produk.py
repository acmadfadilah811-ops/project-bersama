"""Aturan hapus produk/varian (audit akuntansi 2026-10-06).

Menghapus produk ikut menghapus (CASCADE) lapisan stok FIFO, riwayat pergerakan
stok, dan riwayat pemakaian lapisan (dasar HPP) -- TANPA jurnal pembalik. Akibatnya
nilai stok hilang dari data stok tetapi tetap tercatat di akun Persediaan buku
besar (ditemukan: 11 produk uji terhapus meninggalkan Rp 9.880.000 di 11400 dan
Tutup Buku pasti ditolak).

Karena itu, berlaku tanpa memandang setelan Pengaturan POS:
- produk/varian yang masih punya stok tidak boleh dihapus -- kosongkan dulu lewat
  Stok Keluar/Opname supaya nilainya ikut dijurnal;
- produk/varian yang sudah punya riwayat stok atau transaksi tidak boleh dihapus
  (jejak audit & HPP), cukup dinonaktifkan (MST-10).
"""
from decimal import Decimal


def alasan_tolak_hapus(product, variant=None):
    """Teks alasan penolakan, atau None bila boleh dihapus."""
    from ..pos_models import POSSaleItem
    from ..product_models import ProductStockMovement, StockLayer, StockLayerConsumption

    nama = f"{product.nama} ({variant.nama_varian})" if variant else product.nama
    filt = {'product': product}
    if variant is not None:
        filt['variant'] = variant

    qty = Decimal(str((variant.qty_stok if variant is not None else product.qty_stok) or 0))
    sisa_lapisan = StockLayer.objects.filter(sisa_qty__gt=0, **filt).exists()
    if qty > 0 or sisa_lapisan:
        return (
            f"'{nama}' masih memiliki stok {qty:g}. Kosongkan dulu lewat Stok Keluar atau "
            "Stok Opname supaya nilai Persediaan ikut dijurnal, lalu nonaktifkan produk."
        )

    punya_riwayat = (
        ProductStockMovement.objects.filter(**filt).exists()
        or StockLayerConsumption.objects.filter(**filt).exists()
        or StockLayer.objects.filter(**filt).exists()
        or POSSaleItem.objects.filter(**filt).exists()
    )
    if punya_riwayat:
        return (
            f"'{nama}' sudah punya riwayat stok atau transaksi, jadi tidak bisa dihapus "
            "(riwayat dan dasar HPP harus tetap utuh). Nonaktifkan lewat Ubah ketersediaan."
        )
    return None


def alasan_tolak_hapus_bersih(product):
    """Hapus bersih (2026-10-20) hanya untuk produk yang riwayatnya cuma saldo awal
    (mis. hasil impor) dan belum pernah dipakai transaksi. Teks alasan, atau None."""
    from ..models import OrderItem
    from ..pos_models import POSSaleItem
    from ..product_models import ProductStockMovement, StockLayerConsumption

    if POSSaleItem.objects.filter(product=product).exists() or OrderItem.objects.filter(product=product).exists():
        return (
            f"'{product.nama}' sudah dipakai di transaksi penjualan/pesanan, jadi tidak bisa dihapus. "
            "Nonaktifkan lewat Ubah ketersediaan."
        )
    if StockLayerConsumption.objects.filter(product=product).exists():
        return f"Stok '{product.nama}' sudah pernah terpakai, jadi tidak bisa dihapus. Nonaktifkan saja."
    if ProductStockMovement.objects.filter(product=product).exclude(tipe='saldo_awal').exists():
        return (
            f"'{product.nama}' punya riwayat stok masuk/keluar/opname, jadi tidak bisa dihapus. "
            "Nonaktifkan lewat Ubah ketersediaan."
        )
    return None


def hapus_bersih(product, actor=None):
    """Hapus produk beserta saldo awal stoknya. Jurnal saldo awal TIDAK dihapus, tetapi
    dibalik (jurnal pembalik tanggal hari ini) supaya Persediaan & Saldo Awal di buku
    besar ikut berkurang dan jejak audit tetap utuh. Return ringkasan dict."""
    from django.db import transaction
    from django.db.models import ProtectedError
    from django.utils import timezone
    from rest_framework.exceptions import ValidationError

    from accounting.models import JournalAuditLog, JournalEntry
    from accounting.services.journal import create_journal_entry

    from ..product_models import ProductStockMovement

    if alasan_tolak_hapus(product) is None:
        nama = product.nama
        try:
            product.delete()
        except ProtectedError:
            raise ValidationError({'error': f"'{nama}' masih dipakai data lain, jadi tidak bisa dihapus. Nonaktifkan saja."})
        return {'nama': nama, 'jurnal_dibalik': 0}

    alasan = alasan_tolak_hapus_bersih(product)
    if alasan:
        raise ValidationError({'error': alasan})

    with transaction.atomic():
        movement_ids = list(
            ProductStockMovement.objects.filter(product=product, tipe='saldo_awal').values_list('id', flat=True)
        )
        originals = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.OPENING_BALANCE, source_id__in=movement_ids,
            status=JournalEntry.Status.POSTED, description__startswith='Saldo awal stok:',
        ).prefetch_related('lines__account')
        dibalik = 0
        for original in originals:
            if JournalEntry.objects.filter(reversed_entry=original, status=JournalEntry.Status.POSTED).exists():
                continue
            keterangan = f'Pembalikan {original.entry_number}: produk dihapus ({product.nama})'
            reversal = create_journal_entry(
                date=timezone.localdate(),
                lines=[
                    {'account': line.account, 'debit': line.kredit, 'kredit': line.debit, 'description': keterangan}
                    for line in original.lines.all()
                ],
                description=keterangan,
                source_type=JournalEntry.SourceType.OPENING_BALANCE,
                source_id=None,
                created_by=actor,
            )
            reversal.reversed_entry = original
            reversal.save(update_fields=['reversed_entry'])
            JournalAuditLog.objects.create(
                journal_entry=reversal, action=JournalAuditLog.Action.REVERSED, actor=actor,
                note=f'Saldo awal stok dibalik karena produk dihapus: {product.nama}',
            )
            dibalik += 1
        nama = product.nama
        try:
            product.delete()
        except ProtectedError:
            raise ValidationError({'error': f"'{nama}' masih dipakai data lain, jadi tidak bisa dihapus. Nonaktifkan saja."})
    return {'nama': nama, 'jurnal_dibalik': dibalik}
