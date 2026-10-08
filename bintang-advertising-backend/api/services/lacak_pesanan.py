"""ID lacak pesanan (2026-10-08).

ID lacak = ID yang sama dengan bot WA: ID pesanan `ORD-...` untuk Order dan
nomor transaksi `POS-...` untuk transaksi kasir yang punya SPK produksi.
Pelanggan mengirim ID itu ke WhatsApp toko dan bot membalas status pesanan.

- Pesanan dari terminal kasir: ID ikut di resi/invoice DP WhatsApp.
- Pesanan dari staff: ID dikirim lewat WhatsApp setelah kasir memverifikasi
  pembayaran (sekali per pesanan, dicatat di OrderActivityLog).
"""
import logging
import re

from django.db import transaction

logger = logging.getLogger(__name__)

POLA_ID = re.compile(r'\b((?:ord|pos)-[a-z0-9-]+)', re.IGNORECASE)
TINDAKAN_KIRIM_ID = 'KIRIM_ID_LACAK_WA'


def cari_id(teks):
    """ID lacak pertama di dalam teks (huruf besar), atau None."""
    m = POLA_ID.search(teks or '')
    return m.group(1).upper().rstrip('-') if m else None


def _nomor_cocok(a, b):
    a, b = re.sub(r'\D', '', a or ''), re.sub(r'\D', '', b or '')
    return bool(a and b) and a[-9:] == b[-9:]


def _status_pos(sale, jobs):
    if sale.status == 'void':
        return 'batal', 'Dibatalkan'
    if sale.diambil_pada:
        return 'selesai', 'Selesai Seluruhnya'
    aktif = [j for j in jobs if j.status_pekerjaan != 'batal']
    if aktif and all(j.status_pekerjaan == 'selesai' for j in aktif):
        return 'ready', 'Siap Diambil / Selesai Produksi'
    if any(j.status_pekerjaan != 'antrean' or j.pic_staff_id for j in aktif):
        return 'proses', 'Dalam Proses Produksi'
    return 'antrean', 'Menunggu Diproses'


def format_tracking_pos(sale, panggilan='Kak'):
    """Teks status untuk transaksi kasir, sepadan dengan wa_logic.format_tracking."""
    from ..wa_logic import STATUS_LABEL, get_business_name

    items = list(sale.items.prefetch_related('jobs__tahap').all())
    jobs = [j for it in items for j in it.jobs.all()]
    kunci, label = _status_pos(sale, jobs)
    nama = getattr(sale.pelanggan, 'nama', '') or '-'
    lines = [
        f"📦 *STATUS PESANAN ({sale.nomor})*",
        f"👤 *Pemesan*: {nama}",
        f"📋 *Status*: {label}",
        "",
        f"🛒 *{len(items)} Item Pesanan:*",
    ]
    for i, item in enumerate(items, 1):
        lines.append(f"\n  *{i}. {item.nama_snapshot}* (qty: {(item.uom_qty or item.qty).normalize()})")
        job = max((j for j in item.jobs.all() if j.status_pekerjaan != 'batal'), key=lambda j: j.id, default=None)
        if job:
            emoji, deskripsi = STATUS_LABEL.get(job.status_pekerjaan, ('🔄', job.get_status_pekerjaan_display()))
            lines.append(f"     {emoji} {deskripsi}")
            if job.tahap:
                lines.append(f"     📍 Tahap: {job.tahap.nama}")
        else:
            lines.append("     ✅ Langsung diserahkan (tanpa produksi)")
    footer = {
        'batal': "Transaksi ini telah dibatalkan. Silakan hubungi kami jika ada pertanyaan. 🙏",
        'selesai': f"Pesanan {panggilan} sudah diserahterimakan. Terima kasih atas kepercayaan Kakak pada {get_business_name()}! 😊",
        'ready': f"Pesanan {panggilan} sudah selesai diproduksi dan siap diambil! 🎉",
        'proses': f"Pesanan {panggilan} sedang dikerjakan tim kami. Kami kabari begitu siap! 🔧",
        'antrean': f"Pesanan {panggilan} sudah masuk antrean produksi. Mohon ditunggu ya! 🙏",
    }[kunci]
    lines.append(f"\n_{footer}_")
    return "\n".join(lines)


def status_dari_id(id_lacak, nomor_pengirim=None, panggilan='Kak'):
    """Teks status untuk ID ORD-/POS-, atau pesan 'tidak ditemukan'.

    Harga per item hanya ditampilkan bila nomor pengirim = nomor pemesan.
    """
    from ..models import Order
    from ..pos_models import POSSale
    from ..wa_logic import format_tracking

    id_lacak = (id_lacak or '').strip().upper()
    if id_lacak.startswith('POS-'):
        sale = POSSale.objects.select_related('pelanggan').filter(nomor__iexact=id_lacak).exclude(status='hold').first()
        if sale and sale.items.filter(jobs__isnull=False).exists():
            return format_tracking_pos(sale, panggilan)
    else:
        order = Order.objects.prefetch_related('items__jobs__tahap__divisi').filter(id__iexact=id_lacak).first()
        if order:
            return format_tracking(order, panggilan, tampil_harga=_nomor_cocok(nomor_pengirim, order.nomor_wa))
    return f"Maaf {panggilan}, ID pesanan *{id_lacak}* tidak ditemukan. Mohon periksa kembali ya Kak 🙏"


def baris_id_lacak(id_lacak):
    """Kalimat ID lacak untuk caption resi/invoice WhatsApp."""
    return f"ID PESANAN: {id_lacak} — simpan & kirim ID ini ke WhatsApp kami untuk cek status pesanan."


def kirim_id_lacak_whatsapp(order_id):
    """Kirim ID lacak pesanan staff ke pelanggan (sekali per pesanan)."""
    from ..models import Order, OrderActivityLog
    from ..whatsapp_client import whatsapp_client
    from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp
    from .resi_digital import url_resi

    order = Order.objects.filter(pk=order_id).first()
    if not order or OrderActivityLog.objects.filter(order=order, tindakan=TINDAKAN_KIRIM_ID).exists():
        return {'ok': True, 'status': 'skipped'}
    nomor = normalisasi_nomor_whatsapp(order.nomor_wa)
    if not nomor:
        return {'ok': False, 'status': 'skipped', 'reason': 'invalid_number'}
    panggilan = f"Kak {order.nama}" if order.nama else "Kak"
    teks = (
        f"Terima kasih {panggilan}! Pembayaran pesanan Kakak sudah kami verifikasi ✅\n\n"
        f"🎫 *ID PESANAN: {order.id}*\n"
        f"_Simpan ID ini untuk melacak status pesanan Kakak._ "
        f"Cukup kirim ID ini ke WhatsApp kami kapan saja untuk cek progres.\n\n"
        f"🧾 Struk online: {url_resi('order', order.id)}"
    )
    try:
        hasil = whatsapp_client.send_text_message(nomor, teks)
    except Exception:
        logger.exception('Kirim ID lacak WhatsApp gagal untuk order_id=%s.', order_id)
        hasil = None
    if hasil:
        OrderActivityLog.objects.create(
            order=order, user=None, tindakan=TINDAKAN_KIRIM_ID,
            keterangan=f'ID lacak pesanan terkirim ke WhatsApp {nomor}.',
        )
        return {'ok': True, 'status': 'sent'}
    return {'ok': False, 'status': 'failed'}


def jadwalkan_id_lacak_staff(order):
    """Pesanan dari staff yang sudah dibayar: kirim ID lacak setelah commit."""
    if order.sumber != 'staff' or (order.dp_dibayar or 0) <= 0 or order.status_global == 'batal':
        return
    order_id = order.id
    transaction.on_commit(lambda: kirim_id_lacak_whatsapp(order_id))
