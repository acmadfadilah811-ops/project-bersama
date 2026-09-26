"""Pengenal produk jasa (2026-09-26, UAT Finance/Inventory).

Star Photo & Advertising menjual jasa (cetak, foto, edit, workshop, paket).
Produk/varian dengan lacak_inventori=False dianggap JASA: tidak punya stok,
tidak punya lapisan FIFO, dan biaya pembeliannya (mis. bayar vendor) masuk HPP,
bukan Persediaan. Transaksi jasa TIDAK diblokir -- sistem hanya
memperlakukannya berbeda dan memberi keterangan.
"""

from django.core.exceptions import ValidationError


def adalah_jasa(product, variant=None):
    pemilik = variant if variant is not None else product
    return pemilik is not None and not getattr(pemilik, 'lacak_inventori', True)


def pesan_tanpa_stok(product, variant=None):
    nama = product.nama + (f' - {variant.nama_varian}' if variant is not None else '')
    return (f'"{nama}" adalah produk jasa (stok tidak dilacak), jadi tidak punya stok untuk '
            'ditambah, dikurangi, atau di-opname. Biaya jasa dari vendor dicatat lewat Pembelian '
            'dan otomatis masuk HPP.')


def akun_biaya_jasa():
    """Akun debit biaya jasa pada pembelian: akun HPP penjualan di Pengaturan Akuntansi."""
    from accounting.models.settings import AccountingSettings

    s = AccountingSettings.objects.select_related('pos_cogs_expense_account').first()
    akun = s.pos_cogs_expense_account if s else None
    if akun is None:
        raise ValidationError(
            'Pembelian ini berisi item jasa, tetapi akun HPP penjualan belum diatur di Pengaturan '
            'Akuntansi. Atur akun HPP dulu agar biaya jasa bisa dicatat.'
        )
    return akun
