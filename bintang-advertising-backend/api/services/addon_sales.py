"""Addon terpilih per baris item penjualan — satu pintu resmi dipakai kedua
sumber transaksi kasir (POS Sale & Order DP) supaya validasi harga dan
pengurangan stok tautan addon tidak bercabang (F2/M8). Harga SELALU dihitung
ulang dari Addon.harga di server — payload klien hanya membawa addon_id (M6).
"""

from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError

from .. import stock_fifo
from ..product_models import Addon, Product, ProductVariant, ProductStockMovement, SaleItemAddon


def resolve_addons(addon_specs, product, *, default_qty=1):
    """Validasi addon terpilih & berlaku untuk `product`, kembalikan daftar
    `(addon, qty)`. Item tanpa product (custom/paket) belum didukung pada
    tahap ini — ditolak eksplisit.

    `addon_specs` menerima dua bentuk (kompatibel mundur untuk checkout_pos()
    yang masih kirim daftar ID polos, qty-nya mengikuti qty item induk):
      - list ID polos: [1, 2]                      -> qty = default_qty
      - list dict per-addon: [{"id": 1, "qty": 2}]  -> qty per addon sendiri
    """
    addon_specs = addon_specs or []
    qty_by_id = {}
    for spec in addon_specs:
        if isinstance(spec, dict):
            aid = spec.get('id')
            qty = spec.get('qty', default_qty)
        else:
            aid = spec
            qty = default_qty
        if aid in (None, ''):
            continue
        try:
            aid = int(aid)
            qty = Decimal(str(qty if qty not in (None, '') else default_qty))
        except (TypeError, ValueError, InvalidOperation):
            raise ValidationError({'error': f'Addon/qty tidak valid: {spec!r}'})
        if qty <= 0:
            raise ValidationError({'error': f'Qty addon id={aid} harus lebih dari nol.'})
        qty_by_id[aid] = qty

    if not qty_by_id:
        return []
    if not product:
        raise ValidationError({'error': 'Addon hanya berlaku untuk item katalog produk, bukan item kustom/paket.'})

    addons = list(
        Addon.objects.filter(pk__in=qty_by_id.keys(), is_active=True)
        .prefetch_related('applies_to', 'applies_to_categories')
    )
    found_ids = {a.id for a in addons}
    missing = set(qty_by_id.keys()) - found_ids
    if missing:
        raise ValidationError({'error': f'Addon tidak ditemukan atau nonaktif: {sorted(missing)}'})

    for addon in addons:
        # Addon tanpa applies_to/applies_to_categories = berlaku umum (tidak dibatasi).
        scoped = addon.applies_to.exists() or addon.applies_to_categories.exists()
        applies = (
            not scoped
            or addon.applies_to.filter(pk=product.pk).exists()
            or (product.kategori_id and addon.applies_to_categories.filter(pk=product.kategori_id).exists())
        )
        if not applies:
            raise ValidationError({'error': f"Addon '{addon.nama}' tidak berlaku untuk produk '{product.nama}'."})
    return [(addon, qty_by_id[addon.id]) for addon in addons]


def apply_addons(*, addons, user, tanggal, pos_sale_item=None, order_item=None,
                  pos_sale=None, order=None, deduct_stock=True):
    """Simpan SaleItemAddon per addon terpilih, kurangi stok linked_product
    (kalau ada & dilacak, dan `deduct_stock` true — mengikuti gate yang sama
    dengan item induknya, mis. transaksi POS 'hold' belum memotong stok sama
    sekali) lewat FIFO resmi. Kembalikan total biaya addon (Decimal) untuk
    ditambahkan ke line_total item induk.

    `addons` adalah daftar `(addon, qty)` dari resolve_addons() — qty per
    addon sekarang independen dari qty item induk (sebelumnya selalu disamakan)."""
    total = Decimal('0')
    for addon, qty_dec in addons:
        harga = Decimal(str(addon.harga or 0))
        subtotal = harga * qty_dec
        SaleItemAddon.objects.create(
            pos_sale_item=pos_sale_item, order_item=order_item, addon=addon,
            nama_snapshot=addon.nama, harga_snapshot=harga, qty=qty_dec, subtotal=subtotal,
        )
        total += subtotal

        if deduct_stock and addon.linked_product_id:
            product = Product.objects.select_for_update().get(pk=addon.linked_product_id)
            if not product.lacak_inventori:
                continue
            variant = (
                ProductVariant.objects.select_for_update().get(pk=addon.linked_variant_id)
                if addon.linked_variant_id else None
            )
            consume_qty = Decimal(str(addon.linked_qty or 0)) * qty_dec
            if consume_qty <= 0:
                continue
            owner = variant or product
            if consume_qty > Decimal(str(owner.qty_stok or 0)):
                raise ValidationError({'error': f"Stok bahan addon '{addon.nama}' ('{owner}') tidak mencukupi."})
            start = owner.qty_stok
            owner.qty_stok = start - consume_qty
            owner.save(update_fields=['qty_stok'])
            movement = ProductStockMovement.objects.create(
                product=product, variant=variant, user=user, tipe='penjualan', qty=consume_qty,
                stok_awal=start, stok_akhir=owner.qty_stok, pos_sale=pos_sale, order=order,
                catatan=f"Addon '{addon.nama}'", tanggal=tanggal,
            )
            stock_fifo.consume_layers(product, variant, consume_qty, movement=movement)
    return total
