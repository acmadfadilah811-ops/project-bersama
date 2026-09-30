"""Endpoint insentif pekerjaan (2026-09-30). Logika di services/insentif_pekerjaan.py.

/api/jenis-insentif/                 CRUD master jenis insentif (Owner/Manager/Admin)
POST  /api/jobs/{id}/insentif/       {jenis_id | nama, nominal?, catatan?}  tambah baris
PATCH /api/insentif-pekerjaan/{id}/  {nominal?, catatan?}                    ubah baris
DELETE /api/insentif-pekerjaan/{id}/                                        hapus baris
Baris insentif dibaca staff lewat field `rincian_insentif` pada data SPK.
"""
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from ..insentif_models import InsentifPekerjaan, JenisInsentif
from ..models import JobBoard
from ..permissions import IsOwnerOrManager
from ..serializers_insentif import JenisInsentifSerializer
from ..services import insentif_pekerjaan as svc


class JenisInsentifViewSet(viewsets.ModelViewSet):
    queryset = JenisInsentif.objects.prefetch_related('divisi').all()
    serializer_class = JenisInsentifSerializer
    permission_classes = [IsOwnerOrManager]


def _ringkas(job):
    job.refresh_from_db(fields=['insentif'])
    return {
        'job_id': job.id,
        'insentif': job.insentif,
        'rincian_insentif': [
            {'id': r.id, 'jenis': r.jenis_id, 'nama': r.nama, 'nominal': r.nominal,
             'catatan': r.catatan, 'otomatis': r.otomatis}
            for r in job.rincian_insentif.all()
        ],
    }


class JobInsentifView(APIView):
    permission_classes = [IsOwnerOrManager]

    def post(self, request, job_id):
        job = get_object_or_404(JobBoard, pk=job_id)
        svc.tambah(
            job, request.user,
            jenis_id=request.data.get('jenis_id'), nama=request.data.get('nama'),
            nominal=request.data.get('nominal'), catatan=request.data.get('catatan'),
        )
        return Response(_ringkas(job), status=status.HTTP_201_CREATED)


class InsentifPekerjaanDetailView(APIView):
    permission_classes = [IsOwnerOrManager]

    def patch(self, request, pk):
        baris = get_object_or_404(InsentifPekerjaan.objects.select_related('job'), pk=pk)
        svc.ubah(baris, nominal=request.data.get('nominal'), catatan=request.data.get('catatan'))
        return Response(_ringkas(baris.job))

    def delete(self, request, pk):
        baris = get_object_or_404(InsentifPekerjaan.objects.select_related('job'), pk=pk)
        job = baris.job
        svc.hapus(baris)
        return Response(_ringkas(job))
