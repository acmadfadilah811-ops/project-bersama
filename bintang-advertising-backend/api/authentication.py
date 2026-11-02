"""Autentikasi JWT + gerbang absensi HR (2026-09-29).

JWTAuthentication biasa, lalu -- untuk role wajib absen -- cek status
absensi HR (api/services/absensi_hr_gate.py). Dipasang sebagai
DEFAULT_AUTHENTICATION_CLASSES supaya berlaku di SEMUA endpoint tanpa
harus menambah permission satu per satu (banyak view menimpa
permission_classes, tapi tidak ada yang menimpa authentication_classes).

Token yang sudah terbit sebelum staff absen pulang tetap valid s/d 1 jam
(ACCESS_TOKEN_LIFETIME); gerbang ini yang memastikan token itu tidak bisa
dipakai lagi begitu status HR berubah. Frontend mengenali kode
`belum_absen_hr` lalu logout dengan pesan (lihat api/apiClient.js).
"""

import re

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework_simplejwt.authentication import JWTAuthentication

from .services.absensi_hr_gate import KODE, STATUS_TUTUP_SHIFT, cek_gerbang

# Tetap bisa dipanggil walau terkunci: logout harus berhasil (mencabut
# refresh token), bukan ikut ditolak.
JALUR_DIKECUALIKAN = (
    '/api/auth/logout/',
)


# Kasir yang sudah absen pulang tapi shiftnya masih terbuka: hanya membaca dan menutup shift.
_TUTUP_SHIFT = re.compile(r'^/api/saldo-kas-harian/\d+/close/?$')


class BelumAbsenHR(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = KODE
    default_detail = 'Anda belum absen masuk hari ini di HR.'


class JWTAuthenticationAbsensiHR(JWTAuthentication):
    def authenticate(self, request):
        hasil = super().authenticate(request)
        if hasil is None:
            return None
        user, token = hasil
        if request.path.startswith(JALUR_DIKECUALIKAN):
            return hasil
        gerbang = cek_gerbang(user)
        if not gerbang.boleh:
            raise BelumAbsenHR(detail={'detail': gerbang.pesan, 'code': KODE, 'status_absen': gerbang.status})
        hanya_tutup_shift = gerbang.status == STATUS_TUTUP_SHIFT
        if hanya_tutup_shift and request.method not in ('GET', 'HEAD', 'OPTIONS') and not _TUTUP_SHIFT.match(request.path):
            raise BelumAbsenHR(detail={'detail': gerbang.pesan, 'code': KODE, 'status_absen': gerbang.status})
        return hasil
