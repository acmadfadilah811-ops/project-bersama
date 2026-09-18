"""Persetujuan OTP owner untuk MENGKONFIRMASI retur/pengembalian Order.

Kasir bebas mengajukan retur berstatus 'Tunda' lewat /orders/{id}/retur/
(tanpa efek samping apa pun). Yang butuh persetujuan OTP owner HANYA
transisi ke status 'Dikonfirmasi' -- itu yang memicu pemulihan stok +
posting jurnal pembalik akuntansi (lihat retur() di api/views/orders.py
dan perform_update() di PengembalianOrderViewSet). Sebelum 2026-09-18,
kasir bisa mengonfirmasi retur sendirian tanpa persetujuan apa pun --
gap keamanan yang sama kelasnya dengan void sebelum 2026-08-14, ditutup
dengan pola OTP yang identik (lihat api/services/order_void_otp.py).

Owner/manager/admin TETAP bisa langsung konfirmasi tanpa alur ini --
mereka sendiri approver-nya, tidak perlu approve diri sendiri.
"""
import secrets
from datetime import timedelta

from django.utils import timezone

from ..models import OrderReturnRequest

OTP_EXPIRY_MINUTES = 15
ROLE_BYPASS_OTP = ('owner', 'manager', 'admin')


class ReturnOtpError(Exception):
    pass


def ajukan_permintaan_return(*, order, kasir, alasan):
    alasan = (alasan or '').strip()
    if not alasan:
        raise ReturnOtpError('Alasan retur wajib diisi.')

    aktif = (
        OrderReturnRequest.objects.filter(order=order, status__in=('pending', 'disetujui'))
        .order_by('-dibuat_pada')
        .first()
    )
    if aktif and not (aktif.status == 'disetujui' and aktif.kadaluarsa_pada and timezone.now() > aktif.kadaluarsa_pada):
        raise ReturnOtpError('Sudah ada permintaan konfirmasi retur yang masih berlaku untuk pesanan ini.')

    return OrderReturnRequest.objects.create(order=order, diminta_oleh=kasir, alasan=alasan, status='pending')


def setujui_permintaan_return(*, return_request, approver):
    return_request = OrderReturnRequest.objects.select_for_update().get(pk=return_request.pk)
    if return_request.status != 'pending':
        raise ReturnOtpError('Permintaan ini sudah tidak berstatus menunggu persetujuan.')

    kode = f'{secrets.randbelow(1000000):06d}'
    return_request.otp_code = kode
    return_request.status = 'disetujui'
    return_request.disetujui_oleh = approver
    return_request.disetujui_pada = timezone.now()
    return_request.kadaluarsa_pada = return_request.disetujui_pada + timedelta(minutes=OTP_EXPIRY_MINUTES)
    return_request.save(update_fields=[
        'otp_code', 'status', 'disetujui_oleh', 'disetujui_pada', 'kadaluarsa_pada',
    ])
    return return_request


def tolak_permintaan_return(*, return_request, approver, alasan_tolak=''):
    return_request = OrderReturnRequest.objects.select_for_update().get(pk=return_request.pk)
    if return_request.status != 'pending':
        raise ReturnOtpError('Permintaan ini sudah tidak berstatus menunggu persetujuan.')

    return_request.status = 'ditolak'
    return_request.disetujui_oleh = approver
    return_request.alasan_tolak = (alasan_tolak or '').strip()
    return_request.save(update_fields=['status', 'disetujui_oleh', 'alasan_tolak'])
    return return_request


def verifikasi_dan_gunakan_otp(*, order, kasir, return_request_id, otp_code):
    """Dipanggil SEBELUM status PengembalianOrder benar-benar diubah jadi
    'Dikonfirmasi' -- request ditandai 'digunakan' di sini supaya kode
    sekali pakai tidak bisa dipakai ulang lewat percobaan/retry paralel."""
    if not return_request_id or not otp_code:
        raise ReturnOtpError('Kode OTP persetujuan owner wajib diisi untuk mengonfirmasi retur.')
    try:
        return_request = OrderReturnRequest.objects.select_for_update().get(
            pk=return_request_id, order=order, diminta_oleh=kasir,
        )
    except (OrderReturnRequest.DoesNotExist, ValueError, TypeError):
        raise ReturnOtpError('Permintaan OTP tidak ditemukan.')

    if return_request.status != 'disetujui':
        raise ReturnOtpError('Permintaan OTP belum disetujui owner.')
    if return_request.kadaluarsa_pada and timezone.now() > return_request.kadaluarsa_pada:
        raise ReturnOtpError('Kode OTP sudah kadaluarsa. Silakan ajukan permintaan baru.')
    if not secrets.compare_digest(str(otp_code).strip(), return_request.otp_code):
        raise ReturnOtpError('Kode OTP tidak sesuai.')

    return_request.status = 'digunakan'
    return_request.digunakan_pada = timezone.now()
    return_request.save(update_fields=['status', 'digunakan_pada'])
    return return_request
