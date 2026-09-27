"""Selaraskan stok Bahan Baku (InventoryItem) dengan stok Product sumbernya
(2026-09-24, instruksi user).

Bahan resep dipilih dari katalog Produk lalu dicerminkan jadi InventoryItem
(`InventoryItem.product`); cek kecukupan bahan di kasir/produksi membaca
`InventoryItem.stok`, sedangkan menu Produk/Stok/Opname mengubah
`Product.qty_stok`. Tanpa penyelarasan, hasil opname / stok masuk pembelian /
retur / penjualan langsung produk sumber tidak pernah sampai ke stok bahan.

Semua mutasi stok produk tercatat sebagai ProductStockMovement (M8), jadi satu
titik di sini cukup: selisih `stok_akhir - stok_awal` mutasi ditambahkan ke stok
bahan tertaut dan dicatat di riwayat Bahan Baku (RestockHistory). Sengaja
memakai SELISIH, bukan menimpa angka mutlak, supaya restock langsung lewat menu
Bahan Baku tidak hilang tertimpa.

Dikecualikan: mutasi 'pemakaian resep' (kurangi_stok_produk_sumber) -- stok bahan
sudah dipotong oleh alur pemakaian itu sendiri; ditandai `_lewati_cermin_bahan`.
"""
from decimal import Decimal

from django.db import transaction

from ..models import InventoryItem, RestockHistory

ZERO = Decimal('0')


def _sumber(movement):
    """Nama sumber mutasi yang bisa dicocokkan user di menu Stok / Pembelian.

    Dulu hanya `#<id mutasi>`, yang mirip nomor dokumen padahal bukan
    (2026-09-27): user mengira stok masuk manual adalah pembelian."""
    teks = movement.get_tipe_display()
    dok = (movement.stock_in_document or movement.stock_out_document
           or movement.stock_production_document or movement.stock_opname_document)
    if dok is not None and dok.nomor:
        teks = f"{teks} {dok.nomor}"
        purchase = getattr(dok, 'purchase', None)
        teks += f" (Pembelian {purchase.nomor})" if purchase is not None else ""
        if purchase is None and movement.stock_in_document_id:
            teks += " (manual)"
    elif movement.order_id:
        teks = f"{teks} Order {movement.order_id}"
    elif movement.pos_sale_id:
        teks = f"{teks} POS #{movement.pos_sale_id}"
    return teks


def cerminkan_mutasi_ke_bahan_baku(movement):
    if getattr(movement, '_lewati_cermin_bahan', False):
        return
    delta = Decimal(movement.stok_akhir) - Decimal(movement.stok_awal)
    if delta == ZERO:
        return
    # Bahan dari varian hanya ikut mutasi varian itu; bahan dari produk tanpa
    # varian hanya ikut mutasi level produk (2026-09-26).
    tertaut = InventoryItem.objects.filter(product_id=movement.product_id, variant_id=movement.variant_id)
    if not tertaut.exists():
        return

    with transaction.atomic():
        for item in tertaut.select_for_update():
            stok_awal = float(item.stok)
            stok_akhir = max(0.0, round(stok_awal + float(delta), 4))
            RestockHistory.objects.create(
                item=item, user=movement.user, delta=round(stok_akhir - stok_awal, 4),
                stok_awal=stok_awal, stok_akhir=stok_akhir,
                keterangan=f"Sinkron stok produk sumber | {_sumber(movement)}",
            )
            item.stok = stok_akhir
            item.save(update_fields=['stok'])
