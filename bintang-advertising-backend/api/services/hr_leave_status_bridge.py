"""Pemanggil server-to-server dari Bintang KE HR untuk cek status cuti/
hari libur seorang karyawan sebelum mengizinkan "Mulai Kerja" (sesi kerja
harian Bintang -- BUKAN sistem absensi/shift, itu tetap sepenuhnya
tanggung jawab HR). Kalau menurut HR staff itu sedang cuti (disetujui)
atau hari ini hari libur, "Mulai Kerja" ditolak dengan pesan jelas
(keputusan user 2026-09-22).

Auth & gaya pemanggilan mengikuti persis api/services/insights_bridge.py
(arah panggilan yang sama, Bintang -> HR): X-Api-Key dari
INSIGHTS_BRIDGE_API_KEY (bukan HR_BRIDGE_API_KEY yang berorientasi tulis),
lewat domain publik, timeout pendek.

Fail-open BERBEDA dari insights_bridge.py: kalau HR tidak bisa dihubungi/
API key belum dikonfigurasi/error apa pun, "Mulai Kerja" TETAP DIIZINKAN
(dianggap tidak ada info yang menghalangi) -- HR yang down TIDAK BOLEH
memblokir seluruh operasional produksi Bintang. Hanya kalau HR SECARA
EKSPLISIT menjawab on_leave/is_holiday=true baru ditolak."""

import logging
import os

import requests

logger = logging.getLogger(__name__)

DEFAULT_HR_LEAVE_STATUS_URL = "https://hr.starphotoadvertising.com/api/attendance/leave-holiday-status/"

TIMEOUT = 5


def cek_status_cuti_libur(hr_employee_id, tanggal=None):
    """Return dict {'on_leave': bool, 'is_holiday': bool, 'reason': str|None}
    -- selalu 'boleh mulai kerja' (semua False) kalau info tidak tersedia."""
    aman_default = {"on_leave": False, "is_holiday": False, "reason": None}
    if not hr_employee_id:
        return aman_default

    api_key = os.getenv("INSIGHTS_BRIDGE_API_KEY")
    if not api_key:
        logger.warning("INSIGHTS_BRIDGE_API_KEY belum dikonfigurasi -- lewati cek cuti/libur HR.")
        return aman_default

    url = os.getenv("HR_LEAVE_STATUS_URL", DEFAULT_HR_LEAVE_STATUS_URL)
    headers = {"X-Api-Key": api_key, "X-Forwarded-Proto": "https"}
    params = {"hr_employee_id": hr_employee_id}
    if tanggal:
        params["tanggal"] = tanggal.isoformat() if hasattr(tanggal, "isoformat") else str(tanggal)

    try:
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except Exception:
        logger.exception("Gagal cek status cuti/libur HR untuk hr_employee_id=%s.", hr_employee_id)
        return aman_default

    if not data.get("applicable"):
        return aman_default

    return {
        "on_leave": bool(data.get("on_leave")),
        "is_holiday": bool(data.get("is_holiday")),
        "reason": data.get("reason"),
    }
