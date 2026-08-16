"""Aksi Order yang dipakai bareng oleh OrderViewSet (dashboard) dan bot
WhatsApp (api/views/whatsapp.py) — logic diekstrak dari OrderViewSet.batalkan()
supaya tidak ada 2 salinan logic stok/jurnal yang gampang divergen.

Catatan penting soal desain (jangan diubah tanpa alasan kuat):
- `batalkan_order()` di sini AMAN dipanggil otomatis oleh bot untuk pesanan
  yang BELUM `selesai` — user secara eksplisit mengizinkan ini diproses
  otomatis (beda dari kasus order `selesai`, lihat bawah).
- Untuk order berstatus `selesai`, JANGAN panggil endpoint/logic `retur()`
  dari bot. `retur()` memposting jurnal pembalik SEKETIKA saat record
  `PengembalianOrder` dibuat — TIDAK digerbang oleh status `Tunda` vs
  `Dikonfirmasi` (yang digerbang cuma pengembalian STOK, lihat
  PengembalianOrderViewSet.perform_update). Kalau bot ikut memanggil
  `retur()`, itu sama saja bot membuat keputusan finansial nyata (posting
  jurnal) tanpa admin — melanggar aturan "AI tidak boleh memutuskan
  refund". Untuk order selesai, bot HANYA boleh mencatat
  OrderActivityLog + notifikasi WA ke admin (lihat _proses_pesan_masuk di
  views/whatsapp.py) — admin yang memicu retur() manual dari dashboard.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from ..models import Order, OrderActivityLog


class BatalkanOrderError(Exception):
    """Order tidak bisa dibatalkan (sudah batal/sudah selesai)."""


@transaction.atomic
def batalkan_order(order, actor, alasan=""):
    """
    Batalkan `order` (harus belum berstatus 'selesai'/'batal'): ubah status,
    pulihkan stok FIFO, posting jurnal pembalik. Logic identik dengan
    OrderViewSet.batalkan() — dipanggil dengan `actor` eksplisit (bukan
    request.user) supaya bisa dipakai dari konteks non-request (webhook WA).
    """
    order = Order.objects.select_for_update().get(pk=order.pk)

    if order.status_global == 'batal':
        raise BatalkanOrderError('Pesanan sudah berstatus dibatalkan.')
    if order.status_global == 'selesai':
        raise BatalkanOrderError('Pesanan yang sudah selesai tidak dapat dibatalkan langsung. Gunakan alur Retur.')

    old_status = order.status_global
    order.status_global = 'batal'
    order._current_user = actor
    order.save()

    keterangan_log = f'Status pesanan diubah dari [{old_status}] menjadi [batal]'
    if alasan:
        keterangan_log += f'. Alasan: {alasan}'

    OrderActivityLog.objects.create(
        order=order,
        user=actor,
        tindakan='CANCEL',
        keterangan=keterangan_log,
    )

    # Pemulihan stok penuh — mutasi 'penjualan' yang tercatat lewat FK order
    # ini (lihat checkout_pos()) dibalik lewat lapisan FIFO yang sama persis
    # yang dikonsumsi, bukan asal tambah qty_stok, supaya HPP/FIFO tetap
    # akurat (M8).
    from .. import pos_settings
    from ..product_models import Product, ProductVariant, ProductStockMovement
    if pos_settings.pos_mengurangi_stok():
        original_movements = list(
            ProductStockMovement.objects.filter(order=order, tipe='penjualan').select_related('product', 'variant')
        )
        for original in original_movements:
            if not original.product.lacak_inventori:
                continue
            product = Product.objects.select_for_update().get(pk=original.product_id)
            variant = (ProductVariant.objects.select_for_update().get(pk=original.variant_id)
                       if original.variant_id else None)
            owner = variant or product
            start = owner.qty_stok
            owner.qty_stok = start + original.qty
            owner.save(update_fields=['qty_stok'])
            restored_hpp = Decimal('0')
            for consumption in original.layer_consumptions.select_related('layer').all():
                restored_hpp += consumption.qty * consumption.harga_beli
                if consumption.layer_id:
                    layer = consumption.layer
                    layer.sisa_qty += consumption.qty
                    layer.save(update_fields=['sisa_qty'])
            ProductStockMovement.objects.create(
                product=product, variant=variant, user=actor, tipe='pengembalian', qty=original.qty,
                stok_awal=start, stok_akhir=owner.qty_stok, hpp_total=restored_hpp, order=order,
                catatan=f'Pembatalan Order {order.id}', tanggal=timezone.localdate(),
            )

    # M5: jangan tangkap exception di sini — seluruh aksi ini @transaction.atomic,
    # kalau posting jurnal pembalik gagal, status Order & activity log di atas
    # harus ikut rollback juga, bukan cuma jurnalnya yang diam-diam tidak terposting.
    from accounting.services.order_posting import post_order_reversal_journal
    post_order_reversal_journal(order=order, actor=actor, description_prefix="Pembatalan Order")

    return order
