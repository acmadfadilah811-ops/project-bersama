"""/api/bridge/hr-aset/ -- HR memilih aset yang masuk akuntansi (2026-11-10).

POST {"aksi": "kirim", "hr_asset_id", "kode", "nama", "kategori", "tanggal_beli", "harga",
      "jumlah", "pemegang", "status_hr", "keterangan"}  -> masuk antrean "Aset dari HR"
POST {"aksi": "tarik", "hr_asset_id"}                   -> batal sebelum diproses Finance
GET  ?ids=1,2,3                                         -> status akuntansi tiap aset (untuk HR)
Auth X-Api-Key = HR_BRIDGE_API_KEY (sama dengan jembatan HR lain). Tidak ada jurnal di sini;
jurnal baru dibuat saat Finance memproses aset di Akuntansi > Daftar Aset.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key


class HRBridgeAsetView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def get(self, request, *args, **kwargs):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error
        from accounting.models import AsetHRMasuk
        from accounting.services.aset_hr import ringkasan_untuk_hr

        ids = []
        for bagian in str(request.query_params.get("ids") or "").split(","):
            if bagian.strip().isdigit():
                ids.append(int(bagian))
        qs = AsetHRMasuk.objects.filter(hr_asset_id__in=ids[:500]).select_related("fixed_asset")
        return Response({"hasil": [ringkasan_untuk_hr(m) for m in qs]})

    def post(self, request, *args, **kwargs):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error
        # Lazy import: accounting sudah meng-import api.models (cegah circular import).
        from accounting.services import aset_hr as svc

        aksi = request.data.get("aksi")
        try:
            if aksi == "kirim":
                masuk = svc.terima_dari_hr(request.data)
                return Response(svc.ringkasan_untuk_hr(masuk), status=status.HTTP_200_OK)
            if aksi == "tarik":
                masuk = svc.tarik_dari_hr(request.data.get("hr_asset_id"))
                return Response(svc.ringkasan_untuk_hr(masuk) if masuk else {"status": "tidak_ada"})
        except svc.AsetHRError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"error": "Field 'aksi' harus 'kirim' atau 'tarik'."}, status=status.HTTP_400_BAD_REQUEST)
