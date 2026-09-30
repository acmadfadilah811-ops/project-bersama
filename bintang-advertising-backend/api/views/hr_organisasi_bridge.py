"""Jembatan HR -> Bintang untuk struktur organisasi (2026-09-30).

POST /api/bridge/hr-organisasi/   (X-Api-Key = HR_BRIDGE_API_KEY, sama dgn jembatan akun)
  {"jenis": "departemen", "hr_id": 3, "nama": "Digital Printing", "nama_lama": null}
  {"jenis": "peran_jabatan", "hr_id": 9, "nama": "Operator", "nama_lama": null,
   "jabatan": "Operator A3", "departemen": "Digital Printing", "departemen_hr_id": 3}
Logika di services/hr_organisasi.py.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services import hr_organisasi as svc
from .hr_bridge import HRBridgeThrottle, _cek_hr_bridge_api_key


class HROrganisasiView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HRBridgeThrottle]

    def post(self, request):
        auth_error = _cek_hr_bridge_api_key(request)
        if auth_error:
            return auth_error

        jenis = str(request.data.get('jenis') or '')
        hr_id = request.data.get('hr_id')
        nama = str(request.data.get('nama') or '').strip()
        nama_lama = str(request.data.get('nama_lama') or '').strip() or None
        if not hr_id or not nama:
            return Response({'error': "Field 'hr_id' dan 'nama' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if jenis == 'departemen':
                if svc.dilewati(nama):
                    return Response({'skipped': True, 'reason': f"Departemen '{nama}' tidak bekerja di Bintang."})
                divisi = svc.sinkron_departemen(hr_id, nama, nama_lama, request.data.get('unit_bisnis'))
                return Response({'divisi_id': divisi.id, 'nama': divisi.nama})
            if jenis == 'peran_jabatan':
                departemen = str(request.data.get('departemen') or '').strip()
                if svc.dilewati(departemen):
                    return Response({'skipped': True, 'reason': f"Departemen '{departemen}' tidak bekerja di Bintang."})
                if not departemen or not request.data.get('departemen_hr_id'):
                    return Response({'error': "Field 'departemen' dan 'departemen_hr_id' wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
                tahap = svc.sinkron_peran_jabatan(
                    hr_id, nama, nama_lama, str(request.data.get('jabatan') or '').strip(),
                    departemen, request.data.get('departemen_hr_id'), request.data.get('unit_bisnis'),
                )
                return Response({'tahap_id': tahap.id, 'nama': tahap.nama, 'divisi_id': tahap.divisi_id, 'urutan': tahap.urutan})
        except svc.KonflikNama as exc:
            return Response({'error': exc.pesan}, status=status.HTTP_409_CONFLICT)
        return Response({'error': "Field 'jenis' harus 'departemen' atau 'peran_jabatan'."}, status=status.HTTP_400_BAD_REQUEST)
