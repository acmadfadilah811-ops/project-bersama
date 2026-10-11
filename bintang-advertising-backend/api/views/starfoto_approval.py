"""Endpoint approval hasil edit StarFoto (2026-10-11). Logika di services/starfoto_approval.py.

Editor (divisi tahap Edit / owner):
  GET    /api/starfoto/edit-foto/                         antrean edit (baru/revisi) + file pilihan & catatan
  POST   /api/starfoto/pesanan/{id}/pratinjau/            multipart {foto, pilihan_file?} -> diberi watermark
  DELETE /api/starfoto/pratinjau/{id}/                    hapus pratinjau draf
  POST   /api/starfoto/pesanan/{id}/kirim-approval/       tutup SPK Edit & kirim tautan WA ke pelanggan
Kasir/owner:
  GET    /api/starfoto/approval-tertunda/                 belum direspons > N jam
  POST   /api/starfoto/pesanan/{id}/approval/             {keputusan:[{id, setuju, catatan}]} atas nama pelanggan
  POST   /api/starfoto/pesanan/{id}/kirim-ulang-link/
Publik (tanpa login, token bertanda tangan):
  GET/POST /api/approval-foto/{token}/                    data & keputusan pelanggan
  GET      /api/approval-foto/{token}/foto/{id}/          berkas pratinjau
"""
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsOwnerManagerAdminOrKasir
from ..serializers_starfoto import PesananFotoSerializer, PratinjauEditSerializer
from ..services import starfoto_approval as svc
from ..starfoto_models import PesananFoto, PratinjauEdit
from .resi_digital import ResiPublikThrottle


def _detail(pesanan, request):
    data = PesananFotoSerializer(pesanan, context={'request': request}).data
    data['putaran_draf'] = svc._putaran_draf(pesanan)
    data['sisa_revisi'] = max(0, svc.batas_revisi() - svc.revisi_terpakai(pesanan))
    return data


class EditFotoAntreanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([_detail(p, request) for p in svc.antrean_edit(request.user)])


class PratinjauUnggahView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        get_object_or_404(PesananFoto, pk=pk)
        pratinjau = svc.unggah_pratinjau(pk, request.user, request.FILES.get('foto'), request.data.get('pilihan_file'))
        return Response(PratinjauEditSerializer(pratinjau, context={'request': request}).data, status=status.HTTP_201_CREATED)


class PratinjauHapusView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        get_object_or_404(PratinjauEdit, pk=pk)
        svc.hapus_pratinjau(pk, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class KirimApprovalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        get_object_or_404(PesananFoto, pk=pk)
        return Response(_detail(svc.kirim_ke_pelanggan(pk, request.user), request))


class ApprovalStaffView(APIView):
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request, pk):
        get_object_or_404(PesananFoto, pk=pk)
        return Response(_detail(svc.putuskan_staff(pk, request.user, request.data.get('keputusan')), request))


class KirimUlangLinkView(APIView):
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request, pk):
        get_object_or_404(PesananFoto, pk=pk)
        return Response(_detail(svc.kirim_ulang(pk, request.user), request))


class ApprovalTertundaView(APIView):
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def get(self, request):
        return Response([_detail(p, request) for p in svc.tertunda()])


class ApprovalPublikView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ResiPublikThrottle]

    def get(self, request, token):
        try:
            return Response(svc.data_publik(token))
        except svc.TokenTidakValid as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, token):
        try:
            svc.putuskan_publik(token, request.data.get('keputusan'))
            return Response(svc.data_publik(token))
        except svc.TokenTidakValid as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)


class ApprovalFotoBerkasView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request, token, pk):
        try:
            berkas = svc.berkas_publik(token, pk)
        except svc.TokenTidakValid:
            raise Http404('Foto tidak ditemukan.')
        respons = FileResponse(berkas.open('rb'), content_type='image/jpeg')
        respons['Cache-Control'] = 'private, max-age=3600'
        return respons
