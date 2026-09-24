"""Potong stok untuk OrderItem yang dibuat/diedit lewat /order-items/ (Buat
Order staff/spv/kordiv, Buat Order kasir, Antrean WA).

Diekstrak dari api/serializers.py (2026-09-24, R3 extract-not-extend) sekaligus
ditambah dukungan item PAKET: sebelumnya item paket lewat /order-items/ tidak
pernah memotong stok komponennya -- hanya checkout_pos() (DP kasir) yang
melakukannya (checkout_pos menandai `stok_dikurangi=True` utk item paket supaya
tidak dipotong dobel kalau item itu diedit lewat /order-items/).
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .. import pos_settings, stock_fifo
from ..product_models import Product, ProductStockMovement, ProductVariant


def potong_stok_order_item(item, user):
    """Potong stok (M8: lewat FIFO service resmi, bukan langsung qty_stok) saat
    sebuah OrderItem BARU PERTAMA KALI tertaut ke Product langsung, atau ke
    Paket (komponen paket dipotong satu per satu).

    Sebelum diperbaiki: order yang dibuat lewat form WA atau lewat endpoint
    /order-items/ generik TIDAK PERNAH memotong stok sama sekali — hanya order
    dari checkout_pos() (alur DP kasir) yang memotongnya. Fungsi ini menutup
    celah itu di satu tempat yang dipakai bersama oleh create() dan update()
    serializer OrderItem.

    `stok_dikurangi` jadi penanda idempoten: begitu True, tidak pernah dipotong
    ulang di sini lagi (mencegah dobel potong kalau item yang sama diedit lagi).
    Perubahan qty/produk SETELAH pemotongan pertama SENGAJA tidak ikut
    menyesuaikan stok otomatis di sini — rekonsiliasi delta yang aman perlu
    desain terpisah; batasan ini didokumentasikan, bukan dilewatkan diam-diam.
    """
    if item.stok_dikurangi:
        return
    if item.paket_id:
        _potong_komponen_paket(item, user)
    elif item.product_id:
        _potong_produk_langsung(item, user)


def _potong_produk_langsung(item, user):
    if not pos_settings.pos_mengurangi_stok():
        return

    with transaction.atomic():
        product = Product.objects.select_for_update().get(pk=item.product_id)
        if not product.lacak_inventori:
            return
        variant = (ProductVariant.objects.select_for_update().get(pk=item.variant_id)
                   if item.variant_id else None)
        owner = variant or product
        qty = Decimal(str(item.qty or 0))
        if qty <= 0:
            return
        if qty > Decimal(str(owner.qty_stok or 0)):
            raise ValidationError({'error': f"Stok '{owner}' tidak mencukupi untuk item ini."})
        start = owner.qty_stok
        owner.qty_stok = start - qty
        owner.save(update_fields=['qty_stok'])
        movement = ProductStockMovement.objects.create(
            product=product, variant=variant, user=user, tipe='penjualan',
            qty=qty, stok_awal=start, stok_akhir=owner.qty_stok, order=item.order,
            catatan=f'Order {item.order_id} — {item.jenis_produk}', tanggal=timezone.localdate(),
        )
        stock_fifo.consume_layers(product, variant, qty, movement=movement)
        item.stok_dikurangi = True
        item.save(update_fields=['stok_dikurangi'])


def _potong_komponen_paket(item, user):
    """Paket tidak punya stok sendiri — mutasi dihitung dari komponen master
    paket (qty item x qty komponen), sama seperti checkout_pos()/create_sale().
    Semua komponen divalidasi DULU sebelum ada yang dipotong (atomic: gagal di
    satu komponen = tidak ada yang berubah)."""
    if not pos_settings.pos_mengurangi_stok():
        return
    qty_paket = Decimal(str(item.qty or 0))
    if qty_paket <= 0:
        return

    paket = item.paket
    with transaction.atomic():
        requested = {}
        owners = {}
        for komponen in paket.items.all():
            product = Product.objects.select_for_update().get(pk=komponen.product_id)
            variant = None
            if komponen.variant_id:
                variant = ProductVariant.objects.select_for_update().filter(
                    pk=komponen.variant_id, product=product,
                ).first()
                if not variant:
                    raise ValidationError({'error': f"Komponen varian paket '{paket.nama}' tidak valid."})
            key = (product.id, variant.id if variant else None)
            requested[key] = requested.get(key, Decimal('0')) + qty_paket * Decimal(str(komponen.qty))
            owners[key] = (product, variant)

        for key, total in requested.items():
            product, variant = owners[key]
            owner = variant or product
            if product.lacak_inventori and total > Decimal(str(owner.qty_stok or 0)):
                raise ValidationError({'error': f"Stok '{owner}' tidak mencukupi untuk paket '{paket.nama}'."})

        dipotong = False
        tanggal = timezone.localdate()
        for key, total in requested.items():
            product, variant = owners[key]
            if not product.lacak_inventori:
                continue
            owner = variant or product
            start = owner.qty_stok
            owner.qty_stok = start - total
            owner.save(update_fields=['qty_stok'])
            movement = ProductStockMovement.objects.create(
                product=product, variant=variant, user=user, tipe='penjualan',
                qty=total, stok_awal=start, stok_akhir=owner.qty_stok, order=item.order,
                catatan=f'Order {item.order_id} — Paket {paket.nama}', tanggal=tanggal,
            )
            stock_fifo.consume_layers(product, variant, total, movement=movement)
            dipotong = True

        if dipotong:
            item.stok_dikurangi = True
            item.save(update_fields=['stok_dikurangi'])
