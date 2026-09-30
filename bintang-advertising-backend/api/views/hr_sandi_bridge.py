"""POST /api/bridge/hr-employee-sandi/  (X-Api-Key = HR_BRIDGE_API_KEY)

  {"hr_employee_id": 42, "password_hash": "pbkdf2_sha256$..."}
Dipanggil HR saat sandi karyawan diganti di HR/CRM. Menyalin hash ke akun ERP.
Profil Sales tanpa login (tanpa sandi) dilewati. Logika di services/sinkron_sandi.py.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CustomUser
from ..services.sinkron_sandi import hash_valid, terapkan_hash
from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key


class HRBridgeSandiView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def post(self, request):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error
        hr_id = request.data.get('hr_employee_id')
        encoded = request.data.get('password_hash')
        if not hr_id:
            return Response({'error': "Field 'hr_employee_id' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
        if not hash_valid(encoded):
            return Response({'error': 'Format hash sandi tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)
        user = CustomUser.objects.filter(hr_employee_id=hr_id).first()
        if user is None:
            return Response({'skipped': True, 'reason': 'Belum punya akun ERP.'})
        if not user.has_usable_password():
            return Response({'skipped': True, 'reason': 'Akun tanpa login (profil Sales).'})
        terapkan_hash(user, encoded)
        return Response({'diterapkan': True})
