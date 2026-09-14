"""Pemanggil server-to-server dari Bintang KE HR & CRM untuk Dashboard
Insight Owner -- kebalikan arah dari jembatan HR->Bintang/CRM yang sudah
ada (api/views/hr_bridge.py, yang MENERIMA panggilan dari HR). Ini yang
PERTAMA KALI Bintang memanggil keluar ke HR/CRM.

Auth & gaya pemanggilan mengikuti persis pola pengirim di sisi HR
(horilla-hr/employee/hr_bintang_bridge.py::_sinkron_ke): header
X-Api-Key + X-Forwarded-Proto (supaya tidak kena redirect
SECURE_SSL_REDIRECT di jaringan Docker internal), timeout pendek,
try/except yang MENELAN kegagalan satu sistem (log saja, kembalikan
None) supaya HR/CRM yang down tidak menjatuhkan seluruh dashboard --
prinsip sama seperti executive_dashboard.py: absen lebih baik daripada
data yang salah/setengah gagal ditampilkan sebagai sukses.
"""

import logging
import os

import requests

logger = logging.getLogger(__name__)


# Lewat domain publik (HTTPS, ke luar via Cloudflare), BUKAN hostname
# docker internal seperti hr_bintang_bridge.py di sisi HR (yang MENERIMA
# panggilan, arah sebaliknya) -- ALLOWED_HOSTS di HR/CRM hanya berisi
# domain publik mereka (lihat masing-masing .env di VPS), jadi memanggil
# lewat hostname internal (mis. http://horilla-hr-web-1:8000/...) kena
# ditolak Django (400 DisallowedHost) kecuali hostname itu ditambahkan ke
# ALLOWED_HOSTS secara eksplisit -- ditemukan langsung saat verifikasi
# live: CRM kebetulan sudah punya hostname-nya sendiri di ALLOWED_HOSTS,
# HR belum. Lewat domain publik sekalian menghindari kerapuhan itu di
# kedua sisi, dengan trade-off round-trip lewat Cloudflare (dampaknya
# kecil -- endpoint ini dipanggil per buka dashboard, bukan per request).
DEFAULT_HR_INSIGHTS_URL = "https://hr.starphotoadvertising.com/api/insights/hr/"
DEFAULT_CRM_INSIGHTS_URL = "https://crm.starphotoadvertising.com/api/insights/crm/"

TIMEOUT = 10


def _get(base_url_env, default_base_url, path):
    api_key = os.getenv("INSIGHTS_BRIDGE_API_KEY")
    if not api_key:
        logger.warning(
            "INSIGHTS_BRIDGE_API_KEY belum dikonfigurasi -- lewati panggilan insight."
        )
        return None

    base_url = os.getenv(base_url_env, default_base_url)
    url = base_url.rstrip("/") + "/" + path.lstrip("/")
    headers = {"X-Api-Key": api_key, "X-Forwarded-Proto": "https"}
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except Exception:
        logger.exception("Insights bridge: gagal memanggil %s.", url)
        return None


def get_hr_headcount():
    return _get("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL, "headcount/")


def get_hr_attendance(from_date=None, to_date=None):
    path = "attendance/"
    params = []
    if from_date:
        params.append(f"from_date={from_date}")
    if to_date:
        params.append(f"to_date={to_date}")
    if params:
        path += "?" + "&".join(params)
    return _get("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL, path)


def get_hr_leave_trend():
    return _get("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL, "leave-trend/")


def get_hr_overtime_trend():
    return _get("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL, "overtime-trend/")


def get_hr_turnover():
    return _get("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL, "turnover/")


def get_crm_leads():
    return _get("CRM_INSIGHTS_URL", DEFAULT_CRM_INSIGHTS_URL, "leads/")


def get_crm_pipeline():
    return _get("CRM_INSIGHTS_URL", DEFAULT_CRM_INSIGHTS_URL, "pipeline/")


def get_crm_campaigns():
    return _get("CRM_INSIGHTS_URL", DEFAULT_CRM_INSIGHTS_URL, "campaigns/")


def build_combined_insights(period="ytd"):
    """Gabungkan data Bintang (dashboard eksekutif yang sudah ada) + HR +
    CRM jadi satu payload terstruktur per sistem. Tiap sub-sistem yang
    gagal/timeout jadi None, BUKAN menjatuhkan seluruh response -- lihat
    docstring modul ini."""
    from api.executive_dashboard import build as build_bintang_dashboard

    return {
        "bintang": build_bintang_dashboard(period),
        "hr": {
            "headcount": get_hr_headcount(),
            "attendance": get_hr_attendance(),
            "leave_trend": get_hr_leave_trend(),
            "overtime_trend": get_hr_overtime_trend(),
            "turnover": get_hr_turnover(),
        },
        "crm": {
            "leads": get_crm_leads(),
            "pipeline": get_crm_pipeline(),
            "campaigns": get_crm_campaigns(),
        },
    }
