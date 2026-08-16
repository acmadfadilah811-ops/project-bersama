"""Persetujuan OTP owner untuk void transaksi POS Lunas oleh kasir.

Padanan `api/services/order_void_otp.py` untuk transaksi kasir yang
dibayar langsung/lunas (POSSale), bukan Order (Pesanan) DP. Kasir tidak
bisa memanggil /pos/sales/{id}/void/ langsung — dia harus mengajukan
permintaan di sini dulu (`ajukan_permintaan_void`), owner menyetujui lewat
Dashboard (`setujui_permintaan_void`, men-generate `otp_code`), baru kasir
bisa menyelesaikan void dengan kode itu (`verifikasi_dan_gunakan_otp`,
dipanggil dari dalam POSSaleViewSet.void()). Owner/manager/admin TETAP
bisa langsung void tanpa alur ini — mereka sendiri approver-nya (instruksi
user 2026-08-14).
"""
import secrets
from datetime import timedelta

from django.utils import timezone

from ..pos_models import POSVoidRequest

OTP_EXPIRY_MINUTES = 15
ROLE_BYPASS_OTP = ('owner', 'manager', 'admin')


class PosVoidOtpError(Exception):
    pass


def ajukan_permintaan_void(*, sale, kasir, alasan):
    alasan = (alasan or '').strip()
    if not alasan:
        raise PosVoidOtpError('Alasan pembatalan wajib diisi.')
    if sale.status == 'void':
        raise PosVoidOtpError('Transaksi ini sudah di-void sebelumnya.')
    if sale.diambil_pada:
        raise PosVoidOtpError('Transaksi ini sudah ditandai diambil pelanggan, tidak dapat diajukan pembatalan.')

    aktif = (
        POSVoidRequest.objects.filter(sale=sale, status__in=('pending', 'disetujui'))
        .order_by('-dibuat_pada')
        .first()
    )
    if aktif and not (aktif.status == 'disetujui' and aktif.kadaluarsa_pada and timezone.now() > aktif.kadaluarsa_pada):
        raise PosVoidOtpError('Sudah ada permintaan pembatalan yang masih berlaku untuk transaksi ini.')

    return POSVoidRequest.objects.create(sale=sale, diminta_oleh=kasir, alasan=alasan, status='pending')


def setujui_permintaan_void(*, void_request, approver):
    void_request = POSVoidRequest.objects.select_for_update().get(pk=void_request.pk)
    if void_request.status != 'pending':
        raise PosVoidOtpError('Permintaan ini sudah tidak berstatus menunggu persetujuan.')

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
    void_request = POSVoidRequest.objects.select_for_update().get(pk=void_request.pk)
    if void_request.status != 'pending':
        raise PosVoidOtpError('Permintaan ini sudah tidak berstatus menunggu persetujuan.')

    void_request.status = 'ditolak'
    void_request.disetujui_oleh = approver
    void_request.alasan_tolak = (alasan_tolak or '').strip()
    void_request.save(update_fields=['status', 'disetujui_oleh', 'alasan_tolak'])
    return void_request


def verifikasi_dan_gunakan_otp(*, sale, kasir, void_request_id, otp_code):
    """Dipanggil dari dalam POSSaleViewSet.void() SEBELUM void_sale()
    dijalankan — request ditandai 'digunakan' di sini supaya kode sekali
    pakai tidak bisa dipakai ulang lewat percobaan/retry paralel."""
    if not void_request_id or not otp_code:
        raise PosVoidOtpError('Kode OTP persetujuan owner wajib diisi untuk void transaksi ini.')
    try:
        void_request = POSVoidRequest.objects.select_for_update().get(
            pk=void_request_id, sale=sale, diminta_oleh=kasir,
        )
    except (POSVoidRequest.DoesNotExist, ValueError, TypeError):
        raise PosVoidOtpError('Permintaan OTP tidak ditemukan.')

    if void_request.status != 'disetujui':
        raise PosVoidOtpError('Permintaan OTP belum disetujui owner.')
    if void_request.kadaluarsa_pada and timezone.now() > void_request.kadaluarsa_pada:
        raise PosVoidOtpError('Kode OTP sudah kadaluarsa. Silakan ajukan permintaan baru.')
    if not secrets.compare_digest(str(otp_code).strip(), void_request.otp_code):
        raise PosVoidOtpError('Kode OTP tidak sesuai.')

    void_request.status = 'digunakan'
    void_request.digunakan_pada = timezone.now()
    void_request.save(update_fields=['status', 'digunakan_pada'])
    return void_request
