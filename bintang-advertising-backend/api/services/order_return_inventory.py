"""Mutasi stok untuk retur Order yang sudah dikonfirmasi."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..product_models import Product, ProductVariant, ProductStockMovement


def _stock_items(retur):
    return retur.order.items.filter(
        product__isnull=False,
        product__lacak_inventori=True,
    ).select_related('product', 'variant')


def restore_stock_for_confirmed_return(*, retur, actor):
    """Kembalikan stok seluruh item inventori untuk satu retur yang disetujui.

    Barang yang ditandai tidak layak jual (rusak) tidak dikembalikan ke stok;
    keputusan & rincian dicatat di log aktivitas order."""
    if retur.stok_dikembalikan_pada:
        return
    _catat_keterangan_retur(retur, actor)
    if not retur.barang_layak_jual:
        return

    for item in _stock_items(retur):
        product = Product.objects.select_for_update().get(pk=item.product_id)
        variant = None
        if item.variant_id:
            variant = ProductVariant.objects.select_for_update().get(pk=item.variant_id)
        owner = variant or product
        qty = Decimal(str(item.qty or 0))
        if qty <= 0:
            continue
        stok_awal = owner.qty_stok
        owner.qty_stok = stok_awal + qty
        owner.save(update_fields=['qty_stok'])
        ProductStockMovement.objects.create(
            product=product,
            variant=variant,
            user=actor,
            tipe='pengembalian',
            qty=qty,
            stok_awal=stok_awal,
            stok_akhir=owner.qty_stok,
            catatan=f'Retur Order {retur.order_id} #{retur.id} dikonfirmasi',
            tanggal=timezone.localdate(),
        )

    retur.stok_dikembalikan_pada = timezone.now()
    retur.stok_dikembalikan_oleh = actor
    retur.save(update_fields=['stok_dikembalikan_pada', 'stok_dikembalikan_oleh', 'diperbarui_pada'])


def reverse_stock_for_unconfirmed_return(*, retur, actor):
    """Batalkan mutasi stok bila operator membatalkan post retur."""
    if not retur.stok_dikembalikan_pada:
        return

    locked = []
    for item in _stock_items(retur):
        product = Product.objects.select_for_update().get(pk=item.product_id)
        variant = ProductVariant.objects.select_for_update().get(pk=item.variant_id) if item.variant_id else None
        qty = Decimal(str(item.qty or 0))
        if qty > 0 and (variant or product).qty_stok < qty:
            raise ValidationError('Stok tidak cukup untuk membatalkan post retur ini.')
        locked.append((item, product, variant, qty))

    for item, product, variant, qty in locked:
        if qty <= 0:
            continue
        owner = variant or product
        stok_awal = owner.qty_stok
        owner.qty_stok = stok_awal - qty
        owner.save(update_fields=['qty_stok'])
        ProductStockMovement.objects.create(
            product=product,
            variant=variant,
            user=actor,
            tipe='penjualan',
            qty=qty,
            stok_awal=stok_awal,
            stok_akhir=owner.qty_stok,
            catatan=f'Pembatalan post retur Order {retur.order_id} #{retur.id}',
            tanggal=timezone.localdate(),
        )

    retur.stok_dikembalikan_pada = None
    retur.stok_dikembalikan_oleh = None
    retur.save(update_fields=['stok_dikembalikan_pada', 'stok_dikembalikan_oleh', 'diperbarui_pada'])


def _catat_keterangan_retur(retur, actor):
    from ..models import OrderActivityLog
    from .rincian_pengembalian import rincian_order, teks

    r = rincian_order(retur.order)
    produk = (f"dikembalikan ke stok: {teks(r['produk'])}" if retur.barang_layak_jual
              else f"TIDAK dikembalikan ke stok (rusak/tidak layak jual): {teks(r['produk'])}")
    ket = f"Retur #{retur.id} dikonfirmasi. Barang jadi {produk}."
    if r['bahan']:
        ket += f" Bahan produksi tidak dikembalikan (sudah terpakai): {teks(r['bahan'])}."
    OrderActivityLog.objects.create(order=retur.order, user=actor, tindakan='RETUR_STOK', keterangan=ket[:2000])
