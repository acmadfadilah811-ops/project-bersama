"""POST /api/bridge/hr-employee-kredensial/  (X-Api-Key = HR_BRIDGE_API_KEY)

  {"hr_employee_id": 42, "hanya_lihat": true}                  -> username sekarang
  {"hr_employee_id": 42, "username": "budi.santoso", "password": "..."}  -> samakan dgn HR
409 bila username dipakai akun lain. Logika di services/hr_kredensial.py.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services import hr_kredensial as svc
from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key


class HRBridgeKredensialView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def post(self, request):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error
        hr_id = request.data.get('hr_employee_id')
        if not hr_id:
            return Response({'error': "Field 'hr_employee_id' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(svc.satukan_kredensial(
                hr_id, request.data.get('username'), request.data.get('password'),
                hanya_lihat=bool(request.data.get('hanya_lihat')),
            ))
        except svc.UsernameTerpakai as exc:
            return Response({'username_terpakai': True, 'error': str(exc)}, status=status.HTTP_409_CONFLICT)
        except svc.TidakValid as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
