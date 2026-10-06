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
