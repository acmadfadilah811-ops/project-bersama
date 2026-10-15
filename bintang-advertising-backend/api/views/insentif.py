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

from django.db.models import Q

from ..insentif_models import InsentifPekerjaan, InsentifProduk, JenisInsentif
from ..models import JobBoard
from ..permissions import IsOwnerOrManager
from ..serializers_insentif import InsentifProdukSerializer, JenisInsentifSerializer
from ..services import insentif_pekerjaan as svc


class JenisInsentifViewSet(viewsets.ModelViewSet):
    queryset = JenisInsentif.objects.select_related('unit_bisnis').prefetch_related('divisi').all()
    serializer_class = JenisInsentifSerializer
    permission_classes = [IsOwnerOrManager]


class InsentifProdukViewSet(viewsets.ModelViewSet):
    """/api/insentif-produk/  ?divisi=&product=&unit_bisnis=&cari=  (Owner/Manager/Admin)"""
    serializer_class = InsentifProdukSerializer
    permission_classes = [IsOwnerOrManager]
    pagination_class = None

    def get_queryset(self):
        qs = InsentifProduk.objects.select_related('product__unit_bisnis', 'divisi__unit_bisnis')
        p = self.request.query_params
        if p.get('divisi'):
            qs = qs.filter(divisi_id=p['divisi'])
        if p.get('product'):
            qs = qs.filter(product_id=p['product'])
        if str(p.get('unit_bisnis') or '').isdigit():
            unit = int(p['unit_bisnis'])
            qs = qs.filter(Q(product__unit_bisnis_id=unit) | Q(divisi__unit_bisnis_id=unit))
        if p.get('cari'):
            qs = qs.filter(product__nama__icontains=p['cari'])
        return qs


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
