"""Pengiriman invoice DP Order melalui WhatsApp setelah transaksi disimpan."""

import base64
import io
import logging

from django.db import transaction

from ..models import Order, OrderActivityLog
from ..whatsapp_client import whatsapp_client
from .pos_receipt_whatsapp import format_waktu_dokumen, normalisasi_nomor_whatsapp


logger = logging.getLogger(__name__)


def _format_nominal(nominal):
    return f"Rp{int(nominal or 0):,.0f}".replace(',', '.')


def _format_qty(qty):
    return format(qty, 'f').rstrip('0').rstrip('.') if hasattr(qty, 'as_tuple') else str(qty)


def _detail_item(item):
    detail = item.detail or []
    if isinstance(detail, list):
        return next((entry for entry in detail if isinstance(entry, dict)), {})
    return detail if isinstance(detail, dict) else {}


def _ambil_finishing(item):
    """`item.detail` punya DUA bentuk tergantung asal order — form WA lama
    (list `{"key": "Finishing", "value": ...}`) atau checkout POS kasir
    (satu dict `{"finishing": ..., ...}`, lihat views/orders.py checkout_pos).
    Dulu Finishing yang pelanggan isi tidak pernah ikut tercetak di invoice
    walau sudah tersimpan (bug ditemukan & diperbaiki 2026-08-12)."""
    detail = item.detail or []
    if not isinstance(detail, list):
        return ''
    for entry in detail:
        if not isinstance(entry, dict):
            continue
        if str(entry.get('key', '')).strip().lower() == 'finishing':
            nilai = str(entry.get('value') or '').strip()
            if nilai and nilai.lower() not in ('-', 'belum ada', 'polosan'):
                return nilai
        nilai = str(entry.get('finishing') or '').strip()
        if nilai and nilai.lower() not in ('-', 'polosan'):
            return nilai
    return ''


def _to_int(value):
    try:
        return int(round(float(value or 0)))
    except (TypeError, ValueError):
        return 0


def hitung_ringkasan_invoice_dp(order):
    """Hitung nominal invoice dari snapshot item, termasuk diskon item lama/baru."""
    total_setelah_diskon_item = sum(_to_int(item.harga_jual) for item in order.items.all())
    diskon_item = 0
    for item in order.items.all():
        detail = _detail_item(item)
        final_line_total = _to_int(item.harga_jual)
        persisted_discount = _to_int(detail.get('diskon_nominal'))
        if persisted_discount > 0:
            diskon_item += persisted_discount
            continue

        # Order yang sudah dibuat sebelum snapshot nominal tersedia tetap bisa
        # menampilkan diskon dari metadata kalkulator yang lama.
        configured_discount = _to_int(detail.get('diskon'))
        if configured_discount <= 0:
            continue
        if detail.get('tipe_diskon') == 'nominal':
            diskon_item += configured_discount * max(1, _to_int(item.qty))
        elif 0 < configured_discount < 100:
            before_discount = round(final_line_total / (1 - (configured_discount / 100)))
            diskon_item += max(0, before_discount - final_line_total)

    diskon_nota = max(0, total_setelah_diskon_item - _to_int(order.total_harga))
    return {
        'subtotal_item': total_setelah_diskon_item + diskon_item,
        'diskon_item': diskon_item,
        'diskon_nota': diskon_nota,
        'diskon_total': diskon_item + diskon_nota,
    }


def _label_item_invoice(item):
    """Nama item beserta identitas yang dapat dipakai pelanggan untuk tracking."""
    identifiers = [f'ID item pesanan: {item.id}']
    if item.product_id:
        identifiers.append(f'ID produk: {item.product_id}')
    elif item.paket_id:
        identifiers.append(f'ID paket: {item.paket_id}')
    return f"{item.jenis_produk}<br/><font size=7>{' | '.join(identifiers)}</font>"


def _format_ukuran(item):
    """P x L dalam meter, format sama seperti kolom Ukuran di dokumen cetak
    (Invoice A4 / Surat Perintah Kerja) yang sudah dipakai kasir/produksi —
    supaya invoice WA memakai field yang sama, bukan format baru."""
    panjang = float(item.panjang or 0)
    lebar = float(item.lebar or 0)
    if panjang > 0 and lebar > 0:
        return f'{panjang:g} x {lebar:g} m'
    return '-'


_BULAN_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]


def _tanggal_panjang(value):
    from django.utils import timezone
    local = timezone.localtime(value)
    return f'{local.day} {_BULAN_ID[local.month - 1]} {local.year}'


def _info_bisnis():
    """Nama/alamat/telepon/deskripsi bisnis dari SystemConfig (Pengaturan
    Toko), dengan default yang sama dengan yang dipakai layar cetak Invoice
    A4/SPK di frontend (GlobalListPanel.jsx) supaya invoice WA konsisten
    dengan dokumen yang sudah dicetak kasir/produksi."""
    from ..models import SystemConfig
    keys = ['bisnis_nama', 'bisnis_alamat', 'bisnis_no_telepon', 'bisnis_deskripsi']
    values = {row.key: row.value for row in SystemConfig.objects.filter(key__in=keys)}
    return {
        'nama': values.get('bisnis_nama') or 'Bintang Advertising',
        'alamat': values.get('bisnis_alamat') or 'Jl. Produksi No. 123, Kota',
        'telepon': values.get('bisnis_no_telepon') or '0812-3456-7890',
        'deskripsi': values.get('bisnis_deskripsi') or '',
    }


def susun_invoice_dp_pdf(order):
    """Bangun PDF invoice A4 dari nilai Order yang sudah dipersist.

    Layout sengaja disamakan dengan "Preview Invoice A4" di papan kerja
    produksi (GlobalListPanel.jsx: header INVOICE + identitas bisnis, blok
    DITAGIHKAN KEPADA / TANGGAL INVOICE, tabel NO/DESKRIPSI/UKURAN/QTY/TOTAL,
    kotak Subtotal-Diskon-TOTAL-DP-SISA TAGIHAN, dan blok tanda tangan) — atas
    instruksi eksplisit user 2026-08-10 supaya tidak ada format dokumen baru
    yang terpisah dari yang sudah dicetak kasir/produksi. Judul selalu
    "INVOICE" mengikuti referensi; DP vs pesanan penuh dibedakan lewat nama
    file pengiriman, bukan judul dokumen.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    biz = _info_bisnis()
    usable_width = 210 * mm - 36 * mm  # A4 - margin kiri/kanan 18mm

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    dark = colors.HexColor('#0f172a')
    slate600 = colors.HexColor('#475569')
    slate500 = colors.HexColor('#64748b')
    slate400 = colors.HexColor('#94a3b8')
    slate200 = colors.HexColor('#e2e8f0')
    slate100 = colors.HexColor('#f1f5f9')
    emerald = colors.HexColor('#059669')
    red = colors.HexColor('#dc2626')

    title_big = ParagraphStyle('InvBig', fontName='Helvetica-Bold', fontSize=22, textColor=dark, leading=24)
    id_small = ParagraphStyle('InvIdSmall', fontName='Helvetica', fontSize=9, textColor=slate500)
    right_title = ParagraphStyle('InvRightTitle', fontName='Helvetica-Bold', fontSize=11, textColor=dark, alignment=2)
    right_sub_bold = ParagraphStyle('InvRightSubBold', fontName='Helvetica-Bold', fontSize=8, textColor=slate500, alignment=2)
    right_sub = ParagraphStyle('InvRightSub', fontName='Helvetica', fontSize=8, textColor=slate500, alignment=2)

    label_style = ParagraphStyle('InvLabel', fontName='Helvetica-Bold', fontSize=8, textColor=slate400)
    label_style_r = ParagraphStyle('InvLabelR', parent=label_style, alignment=2)
    value_style = ParagraphStyle('InvValue', fontName='Helvetica-Bold', fontSize=12, textColor=dark)
    value_style_r = ParagraphStyle('InvValueR', parent=value_style, alignment=2)
    sub_style = ParagraphStyle('InvSub', fontName='Helvetica', fontSize=9, textColor=slate600)
    sub_style_r = ParagraphStyle('InvSubR', parent=sub_style, alignment=2)
    note_style = ParagraphStyle('InvNote', fontName='Helvetica-Oblique', fontSize=8, textColor=slate500)

    th_style = ParagraphStyle('InvTh', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#334155'))
    th_style_c = ParagraphStyle('InvThC', parent=th_style, alignment=1)
    th_style_r = ParagraphStyle('InvThR', parent=th_style, alignment=2)
    cell_style = ParagraphStyle('InvCell', fontName='Helvetica', fontSize=9, textColor=dark, leading=11)
    cell_bold = ParagraphStyle('InvCellBold', parent=cell_style, fontName='Helvetica-Bold')
    cell_small = ParagraphStyle('InvCellSmall', fontName='Helvetica', fontSize=7, textColor=slate500, leading=9)
    cell_c = ParagraphStyle('InvCellC', parent=cell_style, alignment=1)
    cell_bold_r = ParagraphStyle('InvCellBoldR', parent=cell_bold, alignment=2)

    elements = []

    # --- Header: judul besar kiri, identitas bisnis kanan ---
    header_left = [Paragraph('INVOICE', title_big), Paragraph(f'#{order.id}', id_small)]
    header_right = [
        Paragraph(f'INVOICE - {order.nama.upper()} - #{order.id}', right_title),
        Paragraph(biz['nama'], right_sub_bold),
        Paragraph(biz['alamat'], right_sub),
        Paragraph(f"WA: {biz['telepon']}", right_sub),
    ]
    header_table = Table([[header_left, header_right]], colWidths=[usable_width * 0.5, usable_width * 0.5])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width='100%', thickness=1.3, color=dark))
    elements.append(Spacer(1, 6 * mm))

    # --- Ditagihkan kepada / Tanggal invoice ---
    info_left = [
        Paragraph('DITAGIHKAN KEPADA:', label_style),
        Paragraph(order.nama, value_style),
        Paragraph(order.nomor_wa, sub_style),
    ]
    info_right = [
        Paragraph('TANGGAL INVOICE:', label_style_r),
        Paragraph(_tanggal_panjang(order.waktu), value_style_r),
        Paragraph(f'Pembayaran: {(order.metode_pembayaran or "Tunai").title()}', sub_style_r),
    ]
    info_table = Table([[info_left, info_right]], colWidths=[usable_width * 0.5, usable_width * 0.5])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(info_table)

    # Pesanan yang seluruh itemnya sudah selesai diproduksi (status_global
    # 'ready', ditandai otomatis di views/jobs.py) diberi banner mencolok
    # supaya pelanggan tahu dari faktur itu sendiri bahwa pesanan sudah bisa
    # diambil — bukan cuma status internal yang cuma kasir yang lihat
    # (instruksi user 2026-08-13).
    if order.status_global == 'ready':
        elements.append(Spacer(1, 4 * mm))
        siap_style = ParagraphStyle(
            'InvSiapDiambil', fontName='Helvetica-Bold', fontSize=10,
            textColor=colors.white, alignment=1,
        )
        siap_table = Table(
            [[Paragraph('✔ PESANAN SUDAH SELESAI DIPRODUKSI — SIAP DIAMBIL', siap_style)]],
            colWidths=[usable_width],
        )
        siap_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), emerald),
            ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(siap_table)

    # Order yang dibuat langsung di kasir/toko (bukan dari bot WA) ditandai
    # eksplisit, memakai No. Pesanan yang sama sebagai ID tracking — sesuai
    # instruksi eksplisit user 2026-08-10.
    if order.sumber != 'wa':
        elements.append(Spacer(1, 3 * mm))
        elements.append(Paragraph(
            f'Dibuat langsung di Kasir/Toko — ID Tracking: {order.id}', note_style,
        ))
    elements.append(Spacer(1, 6 * mm))

    # --- Tabel item ---
    item_rows = [[
        Paragraph('NO', th_style_c), Paragraph('DESKRIPSI PRODUK', th_style),
        Paragraph('UKURAN', th_style_c), Paragraph('QTY', th_style_c), Paragraph('TOTAL', th_style_r),
    ]]
    for idx, item in enumerate(order.items.all(), start=1):
        desc_parts = [
            f'<b>{item.jenis_produk}</b>',
            f'<font size=7 color="#64748b">Bahan: {item.bahan or "-"}</font>',
        ]
        finishing = _ambil_finishing(item)
        if finishing:
            desc_parts.append(f'<font size=7 color="#64748b">Finishing: {finishing}</font>')
        identifiers = [f'ID item: {item.id}']
        if item.product_id:
            identifiers.append(f'ID produk: {item.product_id}')
        elif item.paket_id:
            identifiers.append(f'ID paket: {item.paket_id}')
        desc_parts.append(f'<font size=7 color="#94a3b8">{" | ".join(identifiers)}</font>')
        if item.keterangan_detail:
            desc_parts.append(f'<font size=7 color="#94a3b8"><i>{item.keterangan_detail}</i></font>')
        item_rows.append([
            Paragraph(str(idx), cell_c),
            Paragraph('<br/>'.join(desc_parts), cell_style),
            Paragraph(_format_ukuran(item), cell_c),
            Paragraph(_format_qty(item.qty), cell_c),
            Paragraph(_format_nominal(item.harga_jual), cell_bold_r),
        ])
    col_no = 10 * mm
    col_ukuran = 24 * mm
    col_qty = 14 * mm
    col_total = 34 * mm
    col_desc = usable_width - col_no - col_ukuran - col_qty - col_total
    item_table = Table(item_rows, colWidths=[col_no, col_desc, col_ukuran, col_qty, col_total], repeatRows=1)
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), slate100),
        ('LINEABOVE', (0, 0), (-1, 0), 0.75, slate200),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, colors.HexColor('#cbd5e1')),
        ('LINEBELOW', (0, 1), (-1, -1), 0.5, slate200),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 8 * mm))

    # --- Kotak total, rata kanan ---
    ringkasan = hitung_ringkasan_invoice_dp(order)
    subtotal = ringkasan['subtotal_item']
    diskon_total = ringkasan['diskon_total']
    diskon_persen = round(diskon_total / subtotal * 100) if subtotal else 0
    sisa = order.sisa_tagihan
    sisa_style = ParagraphStyle(
        'InvSisaVal', fontName='Helvetica-Bold', fontSize=12,
        textColor=emerald if sisa <= 0 else red, alignment=2,
    )
    total_val_style = ParagraphStyle('InvTotalVal', parent=cell_bold_r, fontSize=12)

    totals_body = [
        [Paragraph('Subtotal', sub_style), Paragraph(_format_nominal(subtotal), sub_style_r)],
        [Paragraph(f'Diskon ({diskon_persen}%)', sub_style), Paragraph(f'- {_format_nominal(diskon_total)}', sub_style_r)],
        [Paragraph('TOTAL', cell_bold), Paragraph(_format_nominal(order.total_harga), total_val_style)],
        [Paragraph('DP Dibayar', sub_style), Paragraph(_format_nominal(order.dp_dibayar), sub_style_r)],
        [Paragraph('SISA TAGIHAN', cell_bold), Paragraph('LUNAS' if sisa <= 0 else _format_nominal(sisa), sisa_style)],
    ]
    if order.jatuh_tempo:
        totals_body.append([
            Paragraph('Jatuh Tempo', sub_style),
            Paragraph(order.jatuh_tempo.strftime('%d-%m-%Y'), sub_style_r),
        ])
    totals_table = Table(totals_body, colWidths=[45 * mm, 45 * mm])
    last_row = len(totals_body) - 1
    totals_style = [
        ('LINEABOVE', (0, 2), (-1, 2), 0.75, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 2), (-1, 2), 5),
        ('BACKGROUND', (0, 4), (-1, 4), slate100),
        ('TOPPADDING', (0, 4), (-1, 4), 6), ('BOTTOMPADDING', (0, 4), (-1, 4), 6),
        ('LEFTPADDING', (0, 4), (-1, 4), 5), ('RIGHTPADDING', (0, 4), (-1, 4), 5),
        ('TOPPADDING', (0, 0), (-1, 1), 3), ('BOTTOMPADDING', (0, 0), (-1, 1), 3),
        ('BOTTOMPADDING', (0, 3), (-1, 3), 6),
    ]
    if last_row == 5:
        totals_style.append(('TOPPADDING', (0, 5), (-1, 5), 5))
    totals_table.setStyle(TableStyle(totals_style))
    totals_wrapper = Table([[None, totals_table]], colWidths=[usable_width - 90 * mm, 90 * mm])
    totals_wrapper.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(totals_wrapper)
    elements.append(Spacer(1, 12 * mm))

    if order.catatan_pelanggan:
        elements.append(Paragraph(f'Catatan: {order.catatan_pelanggan}', cell_small))
        elements.append(Spacer(1, 6 * mm))

    # --- Metode pembayaran + tanda tangan ---
    metode_text = biz['deskripsi'] or f"Transfer BCA: 1234567890 a/n {biz['nama']}"
    payment_block = [
        Paragraph('Metode Pembayaran:', ParagraphStyle('InvPayLabel', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#334155'))),
        Paragraph(metode_text, sub_style),
    ]
    sign_label_style = ParagraphStyle('InvSignLabel', fontName='Helvetica-Bold', fontSize=9, textColor=dark, alignment=1)
    sign_caption_style = ParagraphStyle('InvSignCaption', fontName='Helvetica', fontSize=8, textColor=slate500, alignment=1)

    def _tanda_tangan(caption, label):
        return [
            Paragraph(caption, sign_caption_style),
            Spacer(1, 10 * mm),
            HRFlowable(width='90%', thickness=0.75, color=colors.HexColor('#94a3b8'), hAlign='CENTER'),
            Paragraph(label, sign_label_style),
        ]

    footer_table = Table(
        [[payment_block, _tanda_tangan('Tanda Terima,', 'Pelanggan'), _tanda_tangan('Hormat Kami,', 'Finance Dept.')]],
        colWidths=[usable_width * 0.4, usable_width * 0.3, usable_width * 0.3],
    )
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(footer_table)

    doc.build(elements)
    return buffer.getvalue()


def _catat_hasil(order, tindakan, keterangan):
    OrderActivityLog.objects.create(
        order=order,
        user=None,
        tindakan=tindakan,
        keterangan=keterangan,
    )


def kirim_invoice_dp_whatsapp(*, order_id, otomatis=False):
    """Kirim invoice DP tanpa menggagalkan Order, jurnal, atau SPK yang sudah sah."""
    with transaction.atomic():
        order = (Order.objects.select_for_update()
                 .prefetch_related('items')
                 .get(pk=order_id))
        if order.dp_dibayar <= 0 or order.sisa_tagihan <= 0:
            return {'ok': False, 'status': 'skipped', 'reason': 'not_dp_order'}

        if otomatis and OrderActivityLog.objects.filter(
            order=order,
            tindakan='KIRIM_INVOICE_DP_WA',
            keterangan__startswith='Invoice DP otomatis terkirim',
        ).exists():
            return {'ok': True, 'status': 'sent', 'duplicate': True}

        destination = normalisasi_nomor_whatsapp(order.nomor_wa)
        if not destination:
            _catat_hasil(
                order,
                'GAGAL_KIRIM_INVOICE_DP_WA',
                'Invoice DP otomatis tidak dikirim: nomor WhatsApp pelanggan tidak valid.',
            )
            return {'ok': False, 'status': 'skipped', 'reason': 'invalid_number'}

        invoice_pdf = susun_invoice_dp_pdf(order)
        nomor_invoice = order.id

    try:
        result = whatsapp_client.send_media_message(
            destination,
            base64.b64encode(invoice_pdf).decode('ascii'),
            'document',
            'application/pdf',
            f'Invoice-DP-{nomor_invoice}.pdf',
            caption=f'Invoice DP {nomor_invoice}',
        )
    except Exception:
        logger.exception('Pengiriman invoice DP WhatsApp gagal untuk order_id=%s.', order_id)
        result = None

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        if result:
            _catat_hasil(
                order,
                'KIRIM_INVOICE_DP_WA',
                f'Invoice DP otomatis terkirim ke WhatsApp {destination}.',
            )
            return {'ok': True, 'status': 'sent', 'number': destination}

        _catat_hasil(
            order,
            'GAGAL_KIRIM_INVOICE_DP_WA',
            'Invoice DP otomatis gagal dikirim karena gateway WhatsApp tidak menerima dokumen.',
        )
        return {'ok': False, 'status': 'failed', 'reason': 'gateway_unavailable'}


def kirim_invoice_pesanan_whatsapp(*, order_id):
    """Kirim invoice/nota verifikasi manual dari antrean WhatsApp.

    Tidak membatasi metode pembayaran maupun status DP: petugas perlu dapat
    mengirim nota yang sudah diverifikasi sebelum pelanggan melunasi pesanan.
    """
    with transaction.atomic():
        order = (Order.objects.select_for_update()
                 .prefetch_related('items')
                 .get(pk=order_id))
        destination = normalisasi_nomor_whatsapp(order.nomor_wa)
        if not destination:
            _catat_hasil(
                order,
                'GAGAL_KIRIM_INVOICE_WA',
                'Invoice pesanan tidak dikirim: nomor WhatsApp pelanggan tidak valid.',
            )
            return {'ok': False, 'status': 'skipped', 'reason': 'invalid_number'}

        invoice_pdf = susun_invoice_dp_pdf(order)
        nomor_invoice = order.id
        status_global = order.status_global

    caption_parts = [f'Invoice pesanan {nomor_invoice}.']
    if status_global == 'ready':
        caption_parts.append('✅ Pesanan Anda sudah SELESAI diproduksi dan SIAP DIAMBIL di toko.')
    caption_parts.append('Simpan nomor pesanan dan ID produk pada invoice untuk tracking.')

    try:
        result = whatsapp_client.send_media_message(
            destination,
            base64.b64encode(invoice_pdf).decode('ascii'),
            'document',
            'application/pdf',
            f'Invoice-Pesanan-{nomor_invoice}.pdf',
            caption=' '.join(caption_parts),
        )
    except Exception:
        logger.exception('Pengiriman invoice pesanan WhatsApp gagal untuk order_id=%s.', order_id)
        result = None

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        if result:
            _catat_hasil(
                order,
                'KIRIM_INVOICE_WA',
                f'Invoice pesanan terkirim ke WhatsApp {destination}.',
            )
            return {'ok': True, 'status': 'sent', 'number': destination}

        _catat_hasil(
            order,
            'GAGAL_KIRIM_INVOICE_WA',
            'Invoice pesanan gagal dikirim karena gateway WhatsApp tidak menerima dokumen.',
        )
        return {'ok': False, 'status': 'failed', 'reason': 'gateway_unavailable'}


def _invoice_dp_otomatis_aktif():
    """SystemConfig `order_invoice_dp_wa_otomatis_aktif` — default AKTIF
    kalau key belum pernah diset (tidak mengubah perilaku lama). Sama pola
    dengan `pos_resi_wa_otomatis_aktif` (lihat pos_receipt_whatsapp.py) —
    dipakai mematikan SEMENTARA kirim invoice DP WA otomatis tanpa redeploy
    (instruksi user 2026-08-12). Kirim manual (Antrean WA) tidak terpengaruh."""
    from ..models import SystemConfig
    try:
        nilai = SystemConfig.objects.get(pk='order_invoice_dp_wa_otomatis_aktif').value
    except SystemConfig.DoesNotExist:
        return True
    return str(nilai).strip().lower() not in ('false', '0', 'off', 'nonaktif')


def jadwalkan_invoice_dp_otomatis(order_id):
    """Kirim hanya setelah commit, agar gateway tidak bisa membatalkan transaksi DP."""
    if not _invoice_dp_otomatis_aktif():
        logger.info('Invoice DP WA otomatis dimatikan sementara (SystemConfig) — order_id=%s dilewati.', order_id)
        return
    transaction.on_commit(lambda: kirim_invoice_dp_whatsapp(order_id=order_id, otomatis=True))
