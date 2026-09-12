"""Jembatan HR (Horilla) -> Bintang: endpoint server-ke-server dipanggil
OTOMATIS oleh sistem HR saat karyawan baru dibuat atau kandidat rekrutmen
di-approve/convert jadi karyawan, supaya akun Bintang-nya tercipta otomatis
dengan ID yang tertaut -- tidak perlu admin input ulang manual di 2 tempat,
dan mencegah identitas ganda yang bisa bikin data penggajian tidak sinkron.

Fail-closed by design (pola sama dengan EvolutionWebhookView/ExternalBotView
di api/views/external_bot.py): kalau HR_BRIDGE_API_KEY tidak diisi di env,
endpoint ini menolak SEMUA request.
"""
import logging
import os
import re
import secrets

from django.db import transaction
from django.utils.crypto import constant_time_compare
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from ..models import CustomUser, UnitBisnis

logger = logging.getLogger(__name__)

# Departemen HR yang TIDAK bekerja di Bintang (marketing pakai CRM, HR & GA
# tidak butuh Papan Kerja) -- bridge skip diam-diam untuk departemen ini.
DEPARTEMEN_TANPA_AKUN_BINTANG = {
    'sales marketing & creative',
    'hr & ga',
}

# Departemen -> Unit Bisnis, best-effort. Departemen yang tidak ada di sini
# dibiarkan tanpa unit_bisnis (fail-open, sama seperti pola unit_bisnis yang
# sudah ada di CustomUser).
DEPARTEMEN_KE_UNIT_BISNIS = {
    'fotografi': 'StarFoto',
    'digital printing': 'Star Advertising',
    'adv workshop': 'Star Advertising',
}


def _map_job_position_ke_role(job_position: str) -> str:
    """Peta nama Job Position dari HR ke role Bintang. "CEO" sengaja
    dipetakan ke 'manager', BUKAN 'owner' -- role Owner (akses tertinggi)
    tidak pernah dibuat otomatis oleh sistem lain, harus dinaikkan manual
    oleh Owner yang sudah ada."""
    label = (job_position or '').strip().lower()
    if label.startswith('spv'):
        return 'spv'
    if label.startswith('kordiv') or label == 'admin finance':
        return 'kordiv'
    if label in ('manager', 'ceo'):
        return 'manager'
    if 'kasir' in label:
        return 'kasir'
    return 'staff'


def _buat_username_unik(nama_depan: str, nama_belakang: str) -> str:
    dasar = re.sub(r'[^a-z0-9.]', '', f"{nama_depan}.{nama_belakang}".strip('.').lower()) or 'karyawan'
    username = dasar
    counter = 2
    while CustomUser.objects.filter(username=username).exists():
        username = f"{dasar}{counter}"
        counter += 1
    return username


class HRBridgeThrottle(AnonRateThrottle):
    """Rate limit longgar tapi ada -- endpoint ini dipanggil per event
    penambahan/perubahan data kerja karyawan, bukan traffic tinggi."""
    scope = 'hr_bridge'
    rate = '30/min'


class HRBridgeCreateAccountView(APIView):
    """POST /api/bridge/hr-employee/

    Body: {
      "hr_employee_id": 42, "first_name": "Budi", "last_name": "Santoso",
      "email": "budi@contoh.com", "no_hp": "0812...",
      "job_position": "Kordiv A3", "department": "Digital Printing"
    }
    """
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def _cek_api_key(self, request):
        """Return None kalau valid, atau Response 401/500 kalau tidak.
        Fail-closed: key WAJIB dikonfigurasi di server, bukan opsional."""
        expected = os.getenv("HR_BRIDGE_API_KEY")
        if not expected:
            logger.error("HR_BRIDGE_API_KEY belum dikonfigurasi. Endpoint HR bridge ditutup.")
            return Response({'error': 'HR bridge API belum dikonfigurasi di server.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        diberikan = request.headers.get('X-Api-Key', '') or ''
        if not diberikan or not constant_time_compare(diberikan, expected):
            logger.warning("HR bridge API: X-Api-Key tidak valid.")
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
        return None

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        auth_error = self._cek_api_key(request)
        if auth_error:
            return auth_error

        hr_employee_id = request.data.get('hr_employee_id')
        if not hr_employee_id:
            return Response({'error': "Field 'hr_employee_id' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)

        department = str(request.data.get('department') or '').strip()
        if department.lower() in DEPARTEMEN_TANPA_AKUN_BINTANG:
            return Response({'skipped': True, 'reason': f"Departemen '{department}' tidak bekerja di Bintang."}, status=status.HTTP_200_OK)

        first_name = str(request.data.get('first_name') or '').strip()
        last_name = str(request.data.get('last_name') or '').strip()
        email = str(request.data.get('email') or '').strip()
        no_hp = str(request.data.get('no_hp') or '').strip()
        job_position = str(request.data.get('job_position') or '').strip()
        role = _map_job_position_ke_role(job_position)

        unit_bisnis_nama = DEPARTEMEN_KE_UNIT_BISNIS.get(department.lower())
        unit_bisnis = UnitBisnis.objects.filter(nama=unit_bisnis_nama).first() if unit_bisnis_nama else None

        existing = CustomUser.objects.filter(hr_employee_id=hr_employee_id).first()
        if existing:
            # Idempotent: panggilan berikutnya (mis. HR simpan ulang data
            # kerja yang sama) UPDATE akun yang sudah ada, tidak bikin dobel.
            existing.first_name = first_name or existing.first_name
            existing.last_name = last_name or existing.last_name
            existing.email = email or existing.email
            existing.no_hp = no_hp or existing.no_hp
            existing.posisi = job_position or existing.posisi
            existing.role = role
            existing.unit_bisnis = unit_bisnis
            existing.save()
            return Response({
                'id': existing.id, 'username': existing.username, 'role': existing.role,
                'hr_employee_id': existing.hr_employee_id, 'created': False,
            }, status=status.HTTP_200_OK)

        username = _buat_username_unik(first_name, last_name)
        password_sementara = secrets.token_urlsafe(9)  # ~12 karakter, cukup kuat utk password sementara

        user = CustomUser(
            username=username,
            first_name=first_name,
            last_name=last_name,
            email=email,
            no_hp=no_hp,
            posisi=job_position,
            role=role,
            unit_bisnis=unit_bisnis,
            hr_employee_id=hr_employee_id,
        )
        user.set_password(password_sementara)
        user.save()

        return Response({
            'id': user.id, 'username': user.username, 'role': user.role,
            'hr_employee_id': user.hr_employee_id, 'created': True,
            'temp_password': password_sementara,
        }, status=status.HTTP_201_CREATED)
