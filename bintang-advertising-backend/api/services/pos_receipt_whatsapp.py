"""Pengiriman resi POS WhatsApp setelah pembayaran berhasil tersimpan."""

import base64
import io
import logging
import re

from django.db import transaction
from django.utils import timezone

from ..pos_models import POSSale
from ..whatsapp_client import whatsapp_client


logger = logging.getLogger(__name__)


def format_waktu_dokumen(value):
    """Format waktu dokumen dalam zona waktu Django (Asia/Jakarta)."""
    return timezone.localtime(value).strftime('%d-%m-%Y %H:%M')


def hitung_total_diskon_resi(sale):
    """Jumlah seluruh potongan yang benar-benar membentuk total transaksi.

    Kolom ``diskon`` dipertahankan untuk riwayat diskon manual. Kupon,
    Diskon Penjualan, promo, dan tebus poin disimpan terpisah, sehingga resi
    tidak boleh hanya mencetak ``sale.diskon``.
    """
    return sum((
        sale.diskon or 0,
        sale.diskon_manual or 0,
        sale.diskon_kupon or 0,
        sale.diskon_promo or 0,
        sale.diskon_penjualan or 0,
        sale.diskon_loyalti or 0,
    ))


def normalisasi_nomor_whatsapp(raw_number):
    number = re.sub(r'\D', '', str(raw_number or ''))
    if number.startswith('0'):
        number = f'62{number[1:]}'
    elif number and not number.startswith('62'):
        number = f'62{number}'
    return number if re.fullmatch(r'\d{8,15}', number) else ''


def _baris_item_resi(item):
    """Satu baris item + baris catatan-nya kalau ada. `item.catatan` sudah
    berisi ringkasan ukuran/finishing/diskon-item (dirangkai frontend saat
    checkout, lihat itemReceiptNote di PosTerminal.jsx) — cuma belum pernah
    ikut dicetak di resi sama sekali (bug ditemukan & diperbaiki 2026-08-12)."""
    baris = f'- {item.nama_snapshot} x{item.qty} = Rp {item.subtotal:,.0f}'
    if item.catatan:
        baris += f'\n  _{item.catatan}_'
    return baris


def susun_resi(sale):
    total_diskon = hitung_total_diskon_resi(sale)
    baris_item = '\n'.join(_baris_item_resi(item) for item in sale.items.all())
    return (
        f'*Resi Transaksi {sale.nomor}*\n\n'
        f'Tanggal: {format_waktu_dokumen(sale.created_at)}\n\n'
        f'{baris_item}\n\n'
        f'Subtotal: Rp {sale.subtotal:,.0f}\n'
        f'Diskon: Rp {total_diskon:,.0f}\n'
        f'Pajak: Rp {sale.pajak:,.0f}\n'
        f'*Total: Rp {sale.total:,.0f}*\n'
        f'Metode Bayar: {sale.metode_bayar}\n'
        f'Dibayar: Rp {sale.dibayar:,.0f}\n'
        f'Kembalian: Rp {sale.kembalian:,.0f}\n\n'
        'Terima kasih telah berbelanja.'
    )


def _fmt_qty(qty):
    """1.00 -> '1', 2.50 -> '2.5' — tanpa nol berlebih yang bikin resi berantakan."""
    normalized = qty.normalize()
    text = format(normalized, 'f')
    return text


def sale_siap_diambil(sale):
    """True kalau transaksi POS punya SPK produksi dan SEMUA job-nya sudah
    'selesai' (padanan Order.status_global == 'ready'). Dipakai supaya resi
    yang dikirim ulang dari panel Pesanan & Pelunasan bisa memberi tahu
    pelanggan pesanannya siap diambil — bukan cuma resi checkout polos yang
    dikirim sebelum produksi dimulai (instruksi user 2026-08-13)."""
    jobs = [job for item in sale.items.all() for job in item.jobs.all()]
    if not jobs:
        return False
    return not any(j.status_pekerjaan in ('antrean', 'dikerjakan', 'kendala') for j in jobs)


def _info_bisnis_resi():
    """Nama/alamat/telepon bisnis dari SystemConfig — header resi POS
    disamakan dengan resi Order (GlobalListPanel.jsx) supaya kedua dokumen
    yang dikirim lewat WA sama-sama membawa identitas bisnis, bukan cuma
    daftar item polos."""
    from ..models import SystemConfig
    keys = ['bisnis_nama', 'bisnis_alamat', 'bisnis_no_telepon']
    values = {row.key: row.value for row in SystemConfig.objects.filter(key__in=keys)}
    return {
        'nama': values.get('bisnis_nama') or 'Bintang Advertising',
        'alamat': values.get('bisnis_alamat') or 'Jl. Produksi No. 123, Kota',
        'telepon': values.get('bisnis_no_telepon') or '0812-3456-7890',
    }


def susun_resi_pdf(sale):
    """Bangun PDF resi transaksi (ukuran struk kecil). Kembalikan bytes."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A6
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    # A6 = 105 x 148mm. Margin 8mm tiap sisi -> lebar cetak efektif 89mm.
    # Lebar kolom di bawah SELALU dijumlah supaya tidak overflow dari 89mm.
    PAGE_WIDTH_MM = 89
    biz = _info_bisnis_resi()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A6,
        topMargin=8 * mm, bottomMargin=8 * mm, leftMargin=8 * mm, rightMargin=8 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('ResiTitle', parent=styles['Heading3'], alignment=1, spaceAfter=2)
    small_center = ParagraphStyle('ResiSmallCenter', parent=styles['Normal'], fontSize=8, alignment=1)
    biz_style = ParagraphStyle('ResiBiz', parent=styles['Normal'], fontSize=7.5, alignment=1, textColor=colors.HexColor('#64748b'))
    cell_style = ParagraphStyle('ResiCell', parent=styles['Normal'], fontSize=8, leading=10)
    cell_style_bold = ParagraphStyle('ResiCellBold', parent=cell_style, fontName='Helvetica-Bold')

    elements = [
        Paragraph(f'RESI - {sale.nomor}', title_style),
        Paragraph(biz['nama'], small_center),
        Paragraph(biz['alamat'], biz_style),
        Paragraph(f"Telp: {biz['telepon']}", biz_style),
        Spacer(1, 6),
        Paragraph(format_waktu_dokumen(sale.created_at), small_center),
    ]
    if sale.pelanggan_id:
        elements.append(Paragraph(f'Pelanggan: {sale.pelanggan.nama}', small_center))
        elements.append(Paragraph(f'No. WA: {sale.pelanggan_id}', small_center))

    if sale_siap_diambil(sale):
        elements.append(Spacer(1, 6))
        siap_style = ParagraphStyle(
            'ResiSiapDiambil', parent=styles['Normal'], fontSize=8.5, alignment=1,
            fontName='Helvetica-Bold', textColor=colors.white,
        )
        siap_table = Table(
            [[Paragraph('✔ PESANAN SUDAH SELESAI — SIAP DIAMBIL', siap_style)]],
            colWidths=[PAGE_WIDTH_MM * mm],
        )
        siap_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#059669')),
            ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(siap_table)

    elements.append(Spacer(1, 10))

    # Tabel item: Nama(44mm) + Qty(15mm) + Subtotal(30mm) = 89mm.
    item_rows = [['Item', 'Qty', 'Subtotal']]
    for item in sale.items.all():
        # `catatan` sudah berisi ukuran/finishing/diskon-item (dirangkai
        # frontend saat checkout) — dulu tersimpan tapi tidak pernah ikut
        # dicetak (bug ditemukan & diperbaiki 2026-08-12).
        nama_html = item.nama_snapshot
        if item.catatan:
            nama_html += f'<br/><font size=7 color="#64748b"><i>{item.catatan}</i></font>'
        item_rows.append([
            Paragraph(nama_html, cell_style),
            _fmt_qty(item.qty),
            f'Rp{item.subtotal:,.0f}'.replace(',', '.'),
        ])
    item_table = Table(item_rows, colWidths=[44 * mm, 15 * mm, 30 * mm], repeatRows=1)
    item_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 8))

    # Tabel ringkasan: Label(45mm) + Nilai(44mm) = 89mm.
    total_diskon = hitung_total_diskon_resi(sale)

    def _rp(nominal):
        return f'Rp{nominal:,.0f}'.replace(',', '.')

    summary_rows = [
        ['Subtotal', _rp(sale.subtotal), False],
        ['Diskon', _rp(total_diskon), False],
        ['Pajak', _rp(sale.pajak), False],
        ['Total', _rp(sale.total), True],
        ['Metode Bayar', sale.metode_bayar, False],
        ['Dibayar', _rp(sale.dibayar), False],
        ['Kembalian', _rp(sale.kembalian), False],
    ]
    summary_data = [
        [
            Paragraph(label, cell_style_bold if bold else cell_style),
            Paragraph(value, cell_style_bold if bold else cell_style),
        ]
        for label, value, bold in summary_rows
    ]
    total_row_idx = next(i for i, (_, _, bold) in enumerate(summary_rows) if bold)
    summary_table = Table(summary_data, colWidths=[45 * mm, 44 * mm])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LINEABOVE', (0, total_row_idx), (-1, total_row_idx), 0.75, colors.black),
        ('LINEBELOW', (0, total_row_idx), (-1, total_row_idx), 0.75, colors.black),
        ('TOPPADDING', (0, total_row_idx), (-1, total_row_idx), 4),
        ('BOTTOMPADDING', (0, total_row_idx), (-1, total_row_idx), 4),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 12))
    elements.append(Paragraph('Terima kasih telah berbelanja.', small_center))

    doc.build(elements)
    return buffer.getvalue()


def kirim_resi_pos_whatsapp(*, sale_id, number=None, otomatis=False):
    """Kirim satu resi POS tanpa memengaruhi transaksi penjualan yang sudah sah.

    Pengiriman otomatis hanya sekali untuk satu sale. Pengiriman manual dapat
    mengirim ulang dengan nomor yang dipilih kasir.
    """
    with transaction.atomic():
        # `of=('self',)` supaya lock FOR UPDATE cuma kena tabel POSSale —
        # `pelanggan` adalah FK nullable, select_related() dengannya bikin
        # outer join yang ditolak Postgres kalau ikut di-lock ("FOR UPDATE
        # cannot be applied to the nullable side of an outer join").
        sale = (POSSale.objects.select_for_update(of=('self',))
                .select_related('pelanggan')
                .prefetch_related('items__jobs')
                .get(pk=sale_id))
        if sale.status != 'paid':
            return {'ok': False, 'status': 'skipped', 'reason': 'sale_not_paid'}

        if otomatis and sale.whatsapp_resi_status in ('sending', 'sent'):
            return {'ok': True, 'status': sale.whatsapp_resi_status, 'duplicate': True}

        source_number = number if number is not None else getattr(sale.pelanggan, 'nomor_wa', '')
        destination = normalisasi_nomor_whatsapp(source_number)
        if not destination:
            if otomatis:
                sale.whatsapp_resi_status = 'skipped'
                sale.whatsapp_resi_error = 'Nomor WhatsApp pelanggan tidak tersedia atau tidak valid.'
                sale.save(update_fields=['whatsapp_resi_status', 'whatsapp_resi_error'])
            return {'ok': False, 'status': 'skipped', 'reason': 'invalid_number'}

        sale.whatsapp_resi_status = 'sending'
        sale.whatsapp_resi_number = destination
        sale.whatsapp_resi_error = ''
        sale.save(update_fields=['whatsapp_resi_status', 'whatsapp_resi_number', 'whatsapp_resi_error'])
        pdf_bytes = susun_resi_pdf(sale)
        nomor_sale = sale.nomor
        caption_parts = [f'Resi Transaksi {nomor_sale}']
        if sale_siap_diambil(sale):
            caption_parts.append('✅ Pesanan Anda sudah SELESAI diproduksi dan SIAP DIAMBIL di toko.')
        caption = ' '.join(caption_parts)

    try:
        pdf_base64 = base64.b64encode(pdf_bytes).decode('ascii')
        result = whatsapp_client.send_media_message(
            destination, pdf_base64, 'document', 'application/pdf',
            f'Resi-{nomor_sale}.pdf', caption=caption,
        )
    except Exception:
        logger.exception('Pengiriman resi WhatsApp POS gagal untuk sale_id=%s.', sale_id)
        result = None

    with transaction.atomic():
        sale = POSSale.objects.select_for_update().get(pk=sale_id)
        if result:
            sale.whatsapp_resi_status = 'sent'
            sale.whatsapp_resi_sent_at = timezone.now()
            sale.whatsapp_resi_error = ''
            sale.save(update_fields=[
                'whatsapp_resi_status', 'whatsapp_resi_sent_at', 'whatsapp_resi_error',
            ])
            return {'ok': True, 'status': 'sent', 'number': destination}

        sale.whatsapp_resi_status = 'failed'
        sale.whatsapp_resi_error = 'Gateway WhatsApp tidak menerima pengiriman resi.'
        sale.save(update_fields=['whatsapp_resi_status', 'whatsapp_resi_error'])
        return {'ok': False, 'status': 'failed', 'reason': 'gateway_unavailable'}


def _resi_otomatis_aktif():
    """SystemConfig `pos_resi_wa_otomatis_aktif` — default AKTIF kalau key
    belum pernah diset (tidak mengubah perilaku lama). Dipakai mematikan
    SEMENTARA pengiriman resi WA otomatis tanpa redeploy (instruksi user
    2026-08-12). Pengiriman manual (tombol 'Kirim Resi WA' di POS) TIDAK
    ikut dimatikan — cuma jalur otomatis setelah pembayaran ini."""
    from ..models import SystemConfig
    try:
        nilai = SystemConfig.objects.get(pk='pos_resi_wa_otomatis_aktif').value
    except SystemConfig.DoesNotExist:
        return True
    return str(nilai).strip().lower() not in ('false', '0', 'off', 'nonaktif')


def jadwalkan_resi_pos_otomatis(sale_id):
    """Jalankan setelah commit supaya transaksi/jurnal tidak bergantung gateway."""
    if not _resi_otomatis_aktif():
        logger.info('Resi WA otomatis dimatikan sementara (SystemConfig) — sale_id=%s dilewati.', sale_id)
        return
    transaction.on_commit(lambda: kirim_resi_pos_whatsapp(sale_id=sale_id, otomatis=True))
