"""POST /api/bridge/hr-employee-hapus/  {"hr_employee_id": 42}

Dipanggil HR (server-ke-server, X-Api-Key = HR_BRIDGE_API_KEY) saat karyawan
DIHAPUS di HR. Logika & aturan di services/hr_hapus_akun.py.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.hr_hapus_akun import hapus_akun_dari_hr
from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key


class HRBridgeHapusAkunView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def post(self, request):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error
        hr_employee_id = request.data.get('hr_employee_id')
        if not hr_employee_id:
            return Response({'error': "Field 'hr_employee_id' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(hapus_akun_dari_hr(hr_employee_id))
