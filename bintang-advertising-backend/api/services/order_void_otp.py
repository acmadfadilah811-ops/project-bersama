"""Persetujuan OTP owner untuk pembatalan Order oleh kasir.

Kasir tidak lagi bisa membatalkan Order sendirian lewat
/orders/{id}/batalkan/ — dia harus mengajukan permintaan di sini dulu
(`ajukan_permintaan_void`), owner menyetujui lewat Dashboard
(`setujui_permintaan_void`, men-generate `otp_code`), baru kasir bisa
menyelesaikan pembatalan dengan kode itu (`verifikasi_dan_gunakan_otp`,
dipanggil dari dalam OrderViewSet.batalkan()). Owner/manager/admin TETAP
bisa langsung /batalkan/ tanpa alur ini — mereka sendiri approver-nya,
tidak perlu approve diri sendiri (instruksi user 2026-08-14: kasir tidak
boleh membatalkan order seenaknya).
"""
import secrets
from datetime import timedelta

from django.utils import timezone

from ..models import OrderVoidRequest

OTP_EXPIRY_MINUTES = 15
ROLE_BYPASS_OTP = ('owner', 'manager', 'admin')


class VoidOtpError(Exception):
    pass


def ajukan_permintaan_void(*, order, kasir, alasan):
    alasan = (alasan or '').strip()
    if not alasan:
        raise VoidOtpError('Alasan pembatalan wajib diisi.')
    if order.status_global in ('batal', 'selesai'):
        raise VoidOtpError('Pesanan berstatus ini tidak dapat diajukan pembatalan.')

    aktif = (
        OrderVoidRequest.objects.filter(order=order, status__in=('pending', 'disetujui'))
        .order_by('-dibuat_pada')
        .first()
    )
    if aktif and not (aktif.status == 'disetujui' and aktif.kadaluarsa_pada and timezone.now() > aktif.kadaluarsa_pada):
        raise VoidOtpError('Sudah ada permintaan pembatalan yang masih berlaku untuk pesanan ini.')

    return OrderVoidRequest.objects.create(order=order, diminta_oleh=kasir, alasan=alasan, status='pending')


def setujui_permintaan_void(*, void_request, approver):
    void_request = OrderVoidRequest.objects.select_for_update().get(pk=void_request.pk)
    if void_request.status != 'pending':
        raise VoidOtpError('Permintaan ini sudah tidak berstatus menunggu persetujuan.')

    kode = f'{secrets.randbelow(1000000):06d}'
    void_request.otp_code = kode
    void_request.status = 'disetujui'
    void_request.disetujui_oleh = approver
    void_request.disetujui_pada = timezone.now()
    void_request.kadaluarsa_pada = void_request.disetujui_pada + timedelta(minutes=OTP_EXPIRY_MINUTES)
    void_request.save(update_fields=[
        'otp_code', 'status', 'disetujui_oleh', 'disetujui_pada', 'kadaluarsa_pada',
    ])
    return void_request


def tolak_permintaan_void(*, void_request, approver, alasan_tolak=''):
    void_request = OrderVoidRequest.objects.select_for_update().get(pk=void_request.pk)
    if void_request.status != 'pending':
        raise VoidOtpError('Permintaan ini sudah tidak berstatus menunggu persetujuan.')

    void_request.status = 'ditolak'
    void_request.disetujui_oleh = approver
    void_request.alasan_tolak = (alasan_tolak or '').strip()
    void_request.save(update_fields=['status', 'disetujui_oleh', 'alasan_tolak'])
    return void_request


def verifikasi_dan_gunakan_otp(*, order, kasir, void_request_id, otp_code):
    """Dipanggil dari dalam OrderViewSet.batalkan() SEBELUM batalkan_order()
    dijalankan — request ditandai 'digunakan' di sini supaya kode sekali
    pakai tidak bisa dipakai ulang lewat percobaan/retry paralel."""
    if not void_request_id or not otp_code:
        raise VoidOtpError('Kode OTP persetujuan owner wajib diisi untuk membatalkan pesanan.')
    try:
        void_request = OrderVoidRequest.objects.select_for_update().get(
            pk=void_request_id, order=order, diminta_oleh=kasir,
        )
    except (OrderVoidRequest.DoesNotExist, ValueError, TypeError):
        raise VoidOtpError('Permintaan OTP tidak ditemukan.')

    if void_request.status != 'disetujui':
        raise VoidOtpError('Permintaan OTP belum disetujui owner.')
    if void_request.kadaluarsa_pada and timezone.now() > void_request.kadaluarsa_pada:
        raise VoidOtpError('Kode OTP sudah kadaluarsa. Silakan ajukan permintaan baru.')
    if not secrets.compare_digest(str(otp_code).strip(), void_request.otp_code):
        raise VoidOtpError('Kode OTP tidak sesuai.')

    void_request.status = 'digunakan'
    void_request.digunakan_pada = timezone.now()
    void_request.save(update_fields=['status', 'digunakan_pada'])
    return void_request
