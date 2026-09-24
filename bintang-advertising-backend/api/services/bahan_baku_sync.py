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


def cerminkan_mutasi_ke_bahan_baku(movement):
    if getattr(movement, '_lewati_cermin_bahan', False) or movement.variant_id:
        return
    delta = Decimal(movement.stok_akhir) - Decimal(movement.stok_awal)
    if delta == ZERO:
        return
    if not InventoryItem.objects.filter(product_id=movement.product_id).exists():
        return

    with transaction.atomic():
        for item in InventoryItem.objects.select_for_update().filter(product_id=movement.product_id):
            stok_awal = float(item.stok)
            stok_akhir = max(0.0, round(stok_awal + float(delta), 4))
            RestockHistory.objects.create(
                item=item, user=movement.user, delta=round(stok_akhir - stok_awal, 4),
                stok_awal=stok_awal, stok_akhir=stok_akhir,
                keterangan=f"Sinkron stok produk sumber | {movement.get_tipe_display()} #{movement.id}",
            )
            item.stok = stok_akhir
            item.save(update_fields=['stok'])
