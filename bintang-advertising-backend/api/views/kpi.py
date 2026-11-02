"""KPI karyawan (2026-11-02).

- GET /api/bridge/metrik-kpi/  -- dipanggil HR (server ke server, X-Api-Key = HR_BRIDGE_API_KEY)
  untuk menghitung capaian otomatis Key Result di modul KPI/OKR.
- GET /api/kpi-saya/           -- dipakai dashboard karyawan ERP: mengambil KPI/OKR milik
  user yang sedang login dari HR (target diisi manager di HR, capaian dihitung otomatis).
"""
import logging
import os
from datetime import date, timedelta

import requests
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CustomUser
from ..services.metrik_kpi import hitung_metrik
from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key

logger = logging.getLogger(__name__)

DEFAULT_HR_KPI_URL = 'http://horilla-hr-web-1:8000/api/insights/hr/kpi-karyawan/'
DEFAULT_HR_HOST = 'hr.starphotoadvertising.com'
CACHE_DETIK = 15


def _tanggal(nilai):
    try:
        return date.fromisoformat(nilai)
    except (TypeError, ValueError):
        return None


class MetrikKpiBridgeView(APIView):
    """GET /api/bridge/metrik-kpi/?hr_employee_id=12&dari=2026-11-01&sampai=2026-11-30"""
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error
        dari, sampai = _tanggal(request.query_params.get('dari')), _tanggal(request.query_params.get('sampai'))
        if not dari or not sampai or sampai < dari or (sampai - dari) > timedelta(days=370):
            return Response({'error': 'dari dan sampai wajib tanggal ISO (YYYY-MM-DD), maksimal 370 hari.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            hr_id = int(request.query_params.get('hr_employee_id', ''))
        except ValueError:
            return Response({'error': 'hr_employee_id wajib angka.'}, status=status.HTTP_400_BAD_REQUEST)
        user = CustomUser.objects.filter(hr_employee_id=hr_id, is_active=True).first()
        if user is None:
            # Karyawan HR tanpa akun ERP: bukan galat, hanya tidak ada capaian ERP.
            return Response({'terhubung': False, 'spk_selesai': 0, 'spk_gagal': 0, 'insentif': 0, 'omzet_kasir': 0})
        return Response({'terhubung': True, **hitung_metrik(user, dari, sampai)})


class KpiSayaView(APIView):
    """GET /api/kpi-saya/ -- KPI/OKR user yang login, diambil dari HR (di-cache 15 detik)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hr_id = getattr(request.user, 'hr_employee_id', None)
        if not hr_id:
            return Response({'terhubung': False, 'objektif': [], 'pesan': 'Akun Anda belum terhubung ke data karyawan HR.'})
        kunci = f'kpi_saya:{hr_id}'
        if request.query_params.get('segar') != '1':
            tersimpan = cache.get(kunci)
            if tersimpan is not None:
                return Response(tersimpan)
        api_key = os.getenv('INSIGHTS_BRIDGE_API_KEY')
        if not api_key:
            return Response({'terhubung': True, 'objektif': [], 'pesan': 'Jembatan KPI belum dikonfigurasi.'})
        url = os.getenv('HR_KPI_URL', DEFAULT_HR_KPI_URL)
        headers = {
            'X-Api-Key': api_key, 'X-Forwarded-Proto': 'https',
            'Host': os.getenv('HR_INSIGHTS_HOST', DEFAULT_HR_HOST),
        }
        try:
            params = {'hr_employee_id': hr_id}
            if request.query_params.get('segar') == '1':
                params['paksa'] = 1  # tugas baru selesai: hitung ulang sekarang, jangan tunggu jeda HR
            res = requests.get(url, params=params, headers=headers, timeout=8)
            res.raise_for_status()
            data = {'terhubung': True, **res.json()}
        except Exception:
            logger.exception('Gagal mengambil KPI karyawan dari HR hr_employee_id=%s.', hr_id)
            return Response({'terhubung': True, 'objektif': [], 'pesan': 'KPI belum bisa dimuat dari HR. Coba lagi sebentar.'})
        cache.set(kunci, data, CACHE_DETIK)
        return Response(data)
