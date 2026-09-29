"""Gerbang absensi HR (2026-09-29): staff yang belum absen masuk di HR
(mobile/web Horilla) -- atau sudah absen pulang -- tidak bisa membuka
Bintang sama sekali (keputusan user: HR satu-satunya sumber absensi,
berlaku seluruh aplikasi, owner/manager/admin bebas).

Dipakai di tiga tempat:
  - users/views.py CustomLoginView & VerifyLoginView -- tolak login.
  - api/authentication.py JWTAuthenticationAbsensiHR -- tolak setiap
    request JWT (token lama tetap hidup s/d 1 jam, jadi login saja kurang).
  - api/permissions.py IsClockedIn -- papan produksi (dulu pakai tombol
    "Mulai Kerja" Bintang, sekarang ikut status HR).

Status diambil dari HR /api/attendance/status-absensi/ (lihat
horilla_api/api_views/attendance/status_absensi.py di HR) lewat hostname
internal docker, di-cache 60 detik per karyawan supaya tidak memanggil HR
di setiap request.

Pengecualian yang disengaja:
  - Manajer membuka kunci manual (Absensi Bintang hari ini
    workspace_unlocked=True) -- mekanisme lama tetap berlaku.
  - HR tidak bisa dihubungi / API key belum diisi -> FAIL-OPEN (boleh),
    dicatat di log. HR yang down tidak boleh menghentikan kasir & produksi
    (filosofi sama dengan hr_leave_status_bridge.py).
"""

import logging
import os
from dataclasses import dataclass

import requests
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

ROLE_WAJIB_ABSEN = frozenset({'staff', 'kasir', 'spv', 'kordiv', 'admin_finance', 'spv_finance'})

DEFAULT_HR_STATUS_ABSENSI_URL = "http://horilla-hr-web-1:8000/api/attendance/status-absensi/"
DEFAULT_HR_HOST = "hr.starphotoadvertising.com"
TIMEOUT = 3
CACHE_DETIK = 60
CACHE_DETIK_GAGAL = 20

KODE = 'belum_absen_hr'


@dataclass(frozen=True)
class HasilGerbang:
    boleh: bool
    status: str  # 'bebas' | 'masuk' | 'belum' | 'pulang' | 'tidak_terhubung' | 'hr_tidak_tersedia' | 'dibuka_manajer'
    pesan: str = ''


def _kunci_cache(hr_employee_id):
    return f"absen_hr:{hr_employee_id}"


def hapus_cache(hr_employee_id):
    if hr_employee_id:
        cache.delete(_kunci_cache(hr_employee_id))


def _tanya_hr(hr_employee_id):
    """Return dict jawaban HR, atau None kalau HR tidak bisa ditanya."""
    api_key = os.getenv("INSIGHTS_BRIDGE_API_KEY")
    if not api_key:
        logger.warning("INSIGHTS_BRIDGE_API_KEY belum diisi -- gerbang absensi HR dilewati (fail-open).")
        return None
    url = os.getenv("HR_STATUS_ABSENSI_URL", DEFAULT_HR_STATUS_ABSENSI_URL)
    headers = {
        "X-Api-Key": api_key,
        "X-Forwarded-Proto": "https",
        "Host": os.getenv("HR_INSIGHTS_HOST", DEFAULT_HR_HOST),
    }
    try:
        res = requests.get(url, params={"hr_employee_id": hr_employee_id}, headers=headers, timeout=TIMEOUT)
        res.raise_for_status()
        return res.json()
    except Exception:
        logger.exception("Gagal cek status absensi HR hr_employee_id=%s (fail-open).", hr_employee_id)
        return None


def _status_hr(hr_employee_id, pakai_cache=True):
    kunci = _kunci_cache(hr_employee_id)
    if pakai_cache:
        tersimpan = cache.get(kunci)
        if tersimpan is not None:
            return tersimpan
    data = _tanya_hr(hr_employee_id)
    if data is None:
        hasil = {'hr_tidak_tersedia': True}
        cache.set(kunci, hasil, CACHE_DETIK_GAGAL)
        return hasil
    # Cuma status "masuk" yang di-cache: status terkunci selalu dicek ulang,
    # supaya staff yang baru absen di HP langsung bisa masuk.
    if data.get('status') == 'masuk':
        cache.set(kunci, data, CACHE_DETIK)
    return data


def _dibuka_manajer(user):
    from hr.models import Absensi

    return Absensi.objects.filter(
        staff=user, tanggal=timezone.localdate(), workspace_unlocked=True,
    ).exists()


def gerbang_aktif():
    """Saklar settings.ABSENSI_HR_GATE_AKTIF (env). Mati = semua boleh lewat
    gerbang ini (IsClockedIn kembali ke aturan lama). Dipakai juga sebagai
    saklar darurat kalau data hr_employee_id belum lengkap."""
    from django.conf import settings

    return bool(getattr(settings, 'ABSENSI_HR_GATE_AKTIF', False))


def cek_gerbang(user, pakai_cache=True):
    """Boleh-tidaknya `user` memakai Bintang saat ini menurut absensi HR."""
    if not gerbang_aktif():
        return HasilGerbang(True, 'bebas')
    if not user or not getattr(user, 'is_authenticated', False):
        return HasilGerbang(True, 'bebas')
    if getattr(user, 'role', '') not in ROLE_WAJIB_ABSEN:
        return HasilGerbang(True, 'bebas')

    if _dibuka_manajer(user):
        return HasilGerbang(True, 'dibuka_manajer')

    hr_employee_id = getattr(user, 'hr_employee_id', None)
    if not hr_employee_id:
        return HasilGerbang(
            False, 'tidak_terhubung',
            'Akun Anda belum terhubung ke data karyawan HR, jadi absensi tidak bisa dicek. '
            'Hubungi HR/admin.',
        )

    data = _status_hr(hr_employee_id, pakai_cache=pakai_cache)
    if data.get('hr_tidak_tersedia'):
        return HasilGerbang(True, 'hr_tidak_tersedia')
    if not data.get('applicable'):
        return HasilGerbang(
            False, 'tidak_terhubung',
            'Data karyawan Anda tidak ditemukan atau nonaktif di HR. Hubungi HR.',
        )

    status_absen = data.get('status')
    if status_absen == 'masuk':
        return HasilGerbang(True, 'masuk')
    if status_absen == 'pulang':
        return HasilGerbang(
            False, 'pulang',
            f"Anda sudah absen pulang di HR hari ini (pukul {(data.get('jam_pulang') or '')[:5]}). "
            'Aplikasi terkunci sampai absen masuk berikutnya, atau minta manajer membuka kunci.',
        )
    return HasilGerbang(
        False, 'belum',
        'Anda belum absen masuk hari ini. Absen masuk dulu di aplikasi HR (HP) atau web HR, '
        'lalu coba lagi.',
    )
