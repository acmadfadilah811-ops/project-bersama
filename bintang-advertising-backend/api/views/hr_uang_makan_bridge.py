"""POST /api/bridge/hr-uang-makan/ -- HR memberi tahu uang makan mingguan dibayar/dibatalkan (2026-10-30).

Body: {"aksi": "bayar"|"batal", "hr_pembayaran_id", "hr_employee_id", "nama", "minggu_mulai", "minggu_selesai",
"total", "metode": "tunai"|"transfer", "tanggal"}. Auth X-Api-Key = HR_BRIDGE_API_KEY (sama dengan jembatan HR lain).
Jurnal dibuat oleh accounting/services/uang_makan_posting.py; respons berisi nomor jurnal supaya HR mencatatnya.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key


class HRBridgeUangMakanView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def post(self, request, *args, **kwargs):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error

        # Lazy import: accounting sudah meng-import api.models (cegah circular import, DB5).
        from accounting.services import uang_makan_posting as svc

        aksi = request.data.get("aksi")
        try:
            if aksi == "bayar":
                entry, baru = svc.posting(request.data)
                return Response(
                    {"jurnal_id": entry.pk, "nomor": entry.entry_number, "baru": baru},
                    status=status.HTTP_201_CREATED if baru else status.HTTP_200_OK,
                )
            if aksi == "batal":
                rev = svc.batal(request.data)
                return Response({"jurnal_pembalik_id": getattr(rev, "pk", None),
                                 "nomor": getattr(rev, "entry_number", None)})
        except svc.UangMakanError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"error": "Field 'aksi' harus 'bayar' atau 'batal'."}, status=status.HTTP_400_BAD_REQUEST)
