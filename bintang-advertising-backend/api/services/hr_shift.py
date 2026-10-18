"""Shift kerja dari HR untuk ERP (2026-10-19). HR sumber tunggal; ERP hanya membaca.

Diambil dari HR /api/attendance/daftar-shift/ (server-ke-server, X-Api-Key), di-cache 5 menit.
HR tidak bisa dihubungi -> pakai salinan terakhir yang berhasil diambil; kalau belum pernah
berhasil, kembalikan None (view jatuh ke data lokal lama sebagai cadangan)."""
import logging
import os

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

DEFAULT_URL = "http://horilla-hr-web-1:8000/api/attendance/daftar-shift/"
DEFAULT_HOST = "hr.starphotoadvertising.com"
KUNCI_CACHE = "hr_daftar_shift"
KUNCI_SALINAN = "hr_daftar_shift_salinan"
CACHE_DETIK = 300


def ambil_shift_hr():
    tersimpan = cache.get(KUNCI_CACHE)
    if tersimpan is not None:
        return tersimpan
    api_key = os.getenv("INSIGHTS_BRIDGE_API_KEY")
    if api_key:
        try:
            res = requests.get(
                os.getenv("HR_DAFTAR_SHIFT_URL", DEFAULT_URL),
                headers={
                    "X-Api-Key": api_key,
                    "X-Forwarded-Proto": "https",
                    "Host": os.getenv("HR_INSIGHTS_HOST", DEFAULT_HOST),
                },
                timeout=3,
            )
            res.raise_for_status()
            data = res.json()
            cache.set(KUNCI_CACHE, data, CACHE_DETIK)
            cache.set(KUNCI_SALINAN, data, None)
            return data
        except Exception:
            logger.exception("Gagal mengambil daftar shift dari HR.")
    return cache.get(KUNCI_SALINAN)
