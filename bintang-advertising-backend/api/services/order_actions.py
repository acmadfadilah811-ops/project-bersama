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
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from ..models import Contact, JobBoard, Order, OrderActivityLog, OrderItem, TahapProses


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


class SelesaikanOrderError(Exception):
    """Order tidak bisa diselesaikan (sudah selesai/sudah batal)."""


@transaction.atomic
def selesaikan_order(order, actor):
    """
    Selesaikan `order` (harus belum berstatus 'selesai'/'batal'): ubah status,
    posting jurnal HPP bahan baku. Logic diekstrak dari OrderViewSet.selesaikan()
    (T-204) supaya jalur lain — mis. import_status_csv() — memakai satu-satunya
    sumber kebenaran ini, bukan menyalin ulang status_global secara mentah
    (yang akan melewatkan jurnal HPP; bug ditemukan & diperbaiki 2026-09-05).
    """
    order = Order.objects.select_for_update().get(pk=order.pk)

    if order.status_global == 'selesai':
        raise SelesaikanOrderError('Pesanan sudah berstatus selesai.')
    if order.status_global == 'batal':
        raise SelesaikanOrderError('Pesanan yang sudah dibatalkan tidak dapat diselesaikan.')

    old_status = order.status_global
    order.status_global = 'selesai'
    order._current_user = actor
    order.save()

    # Order boleh diselesaikan walau belum lunas (keputusan user 2026-09-08:
    # produksi/pengiriman sering kelar duluan, tagihan menyusul) -- tapi
    # sisa tagihan WAJIB tercatat jelas di log supaya tetap tertagih, bukan
    # hilang begitu saja begitu status berubah jadi "Selesai".
    keterangan = f'Status pesanan diubah dari [{old_status}] menjadi [selesai]'
    if order.sisa_tagihan and order.sisa_tagihan > 0:
        keterangan += f'. PERHATIAN: masih ada sisa tagihan Rp{order.sisa_tagihan:,} yang belum dibayar.'

    complete_log = OrderActivityLog.objects.create(
        order=order,
        user=actor,
        tindakan='COMPLETE',
        keterangan=keterangan,
    )

    # Accrual basis (keputusan finance 2026-09-09): Piutang Usaha + Pendapatan
    # PENUH diakui begitu order selesai (barang/jasa sudah diserahkan) --
    # bukan lagi bertahap saat DP/pelunasan diterima. Gating internal (akun
    # belum diatur) mengembalikan None dengan aman, tidak melempar.
    from accounting.services.order_posting import post_order_revenue_recognition_journal
    post_order_revenue_recognition_journal(order=order, actor=actor, activity_log=complete_log)

    # T-204: HPP bahan baku (JobBoard) diposting saat order selesai. Gating
    # internal (akun belum diatur/HPP nol) mengembalikan None dengan aman,
    # tidak melempar — konsisten pola fail-open task lain di file ini.
    from accounting.services.order_posting import post_order_material_hpp_journal
    post_order_material_hpp_journal(order=order, actor=actor, activity_log=complete_log)

    return order


def buat_order_dari_items(nomor_wa, nama_kontak, nama_order, items, raw_detail='', sumber='wa'):
    """Buat Order + OrderItem + JobBoard tahap awal dari data yang SUDAH
    tervalidasi/terstruktur (2026-09-10) -- diekstrak dari
    BaseWhatsAppWebhookView._buat_order_dari_data() di views/whatsapp.py
    supaya bot WA (parsing teks form) DAN sumber lain (mis. n8n/agent luar
    lewat api/views/external_bot.py) sama-sama lewat SATU logic pembuatan
    order, tidak ada salinan kedua yang bisa divergen.

    `items`: list of dict, tiap dict WAJIB punya key: jenis_produk (str),
    qty (int > 0). Opsional: panjang, lebar (float, default 0), bahan,
    finishing, keterangan (str, default ''), detail_json (list, default
    dari bahan/finishing/ukuran kalau ada), gdrive_link (str, default ''),
    file_desain_belum (bool, default False).

    Status awal SELALU 'draft' + harga_jual=0 -- harga & konfirmasi akhir
    tetap tanggung jawab staff/kasir (bot/agent luar TIDAK PERNAH menentukan
    harga final), sama seperti alur WA yang sudah ada.

    Return (order_id, order) -- order_id dipakai bot/API buat balasan ke
    pelanggan, `order` (instance) buat caller yang butuh field lain.
    """
    if not items:
        raise ValueError("items tidak boleh kosong.")

    with transaction.atomic():
        contact, _ = Contact.objects.get_or_create(
            nomor_wa=nomor_wa, defaults={'nama': nama_kontak}
        )
        existing_orders = Order.objects.filter(nomor_wa=nomor_wa)
        contact.total_order = existing_orders.count() + 1
        contact.total_spent = sum(
            item.harga_jual
            for o in existing_orders.prefetch_related('items')
            for item in o.items.all()
        )
        contact.last_order = timezone.localdate()
        contact.save()

        order_id = f"ORD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        order = Order.objects.create(
            id=order_id,
            nomor_wa=contact.nomor_wa,
            nama=nama_order or nama_kontak or '-',
            status_global='draft',
            sumber=sumber,
            catatan_pelanggan=raw_detail,
        )

        for item_data in items:
            jenis_produk = str(item_data.get('jenis_produk') or 'Umum').strip() or 'Umum'
            qty = int(item_data.get('qty') or 0)
            if qty <= 0:
                raise ValueError(f"Jumlah item '{jenis_produk}' harus lebih dari nol.")

            bahan = str(item_data.get('bahan') or '')
            finishing = str(item_data.get('finishing') or '')
            ukuran = item_data.get('ukuran') or ''
            detail_json = item_data.get('detail_json')
            if detail_json is None:
                detail_json = []
                if ukuran: detail_json.append({"key": "Ukuran", "value": ukuran})
                if finishing: detail_json.append({"key": "Finishing", "value": finishing})
                if bahan: detail_json.append({"key": "Bahan", "value": bahan})

            order_item = OrderItem.objects.create(
                order=order,
                jenis_produk=jenis_produk,
                qty=qty,
                panjang=float(item_data.get('panjang') or 0),
                lebar=float(item_data.get('lebar') or 0),
                bahan=bahan,
                harga_jual=0,
                detail=detail_json,
                keterangan_detail=str(item_data.get('keterangan') or ''),
                gdrive_customer_link=str(item_data.get('gdrive_link') or ''),
            )

            file_desain_belum = bool(item_data.get('file_desain_belum'))
            if file_desain_belum:
                tahap_awal = TahapProses.objects.filter(nama__icontains='desain').order_by('urutan').first()
            else:
                tahap_awal = TahapProses.objects.order_by('urutan').first()
            if tahap_awal:
                JobBoard.objects.create(
                    order_item=order_item,
                    tahap=tahap_awal,
                    status_pekerjaan='antrean',
                )

    return order_id, order

    return order
