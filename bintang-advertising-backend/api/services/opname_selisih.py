"""Nilai selisih Stok Opname berdasarkan HARGA BELI (2026-09-24, instruksi user).

Nilai selisih = (stok aktual - stok sistem) x harga beli. Setelah dokumen
diposting, harga beli yang dipakai adalah snapshot (`harga_beli_snapshot`) supaya
angka historis tidak berubah ketika harga beli produk diperbarui kemudian.

Produk yang sama boleh muncul di beberapa baris (rak berbeda); stok aktualnya
dijumlah per (produk, varian) lalu dibandingkan dengan stok sistem SEKALI --
sama dengan cara posting menimpa qty_stok -- jadi ringkasan per produk di sini
adalah angka yang benar (selisih per baris hanya indikatif).
"""
from decimal import Decimal

ZERO = Decimal('0')


def harga_beli_owner(product, variant=None):
    """Harga beli varian bila terisi, jika tidak harga beli produk."""
    if variant is not None and variant.harga_beli:
        return Decimal(variant.harga_beli)
    return Decimal(product.harga_beli or 0)


def ringkas_dokumen(document):
    groups = {}
    for item in document.items.all():
        key = (item.product_id, item.variant_id)
        grup = groups.get(key)
        if grup is None:
            grup = groups[key] = {
                'product': item.product, 'variant': item.variant,
                'stok_sistem': Decimal(item.stok_sistem),
                'stok_aktual': ZERO, 'harga_snapshot': item.harga_beli_snapshot,
            }
        grup['stok_aktual'] += Decimal(item.stok_aktual)

    baris = []
    total_surplus = ZERO
    total_defisit = ZERO
    jumlah_selisih = 0
    for grup in groups.values():
        harga = (
            Decimal(grup['harga_snapshot']) if grup['harga_snapshot'] is not None
            else harga_beli_owner(grup['product'], grup['variant'])
        )
        selisih = grup['stok_aktual'] - grup['stok_sistem']
        nilai = selisih * harga
        if selisih > 0:
            total_surplus += nilai
        elif selisih < 0:
            total_defisit += -nilai
        if selisih != 0:
            jumlah_selisih += 1
        nama = grup['product'].nama
        if grup['variant'] is not None:
            nama = f"{nama} ({grup['variant'].nama_varian})"
        baris.append({
            'product': grup['product'].id,
            'variant': grup['variant'].id if grup['variant'] is not None else None,
            'nama': nama,
            'sku': grup['product'].sku,
            'satuan': grup['product'].satuan,
            'stok_sistem': grup['stok_sistem'],
            'stok_aktual': grup['stok_aktual'],
            'selisih': selisih,
            'harga_beli': harga,
            'nilai_selisih': nilai,
        })
    return {
        'baris': baris,
        'total_surplus': total_surplus,
        'total_defisit': total_defisit,
        'total_selisih': total_surplus - total_defisit,
        'jumlah_produk_selisih': jumlah_selisih,
    }
