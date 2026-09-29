"""Endpoint pengembalian pekerjaan ke tahap sebelumnya (PRD-05 UAT, 2026-09-29).
Logika ada di api/services/pengembalian_job.py.

POST /api/jobs/{id}/kembalikan/                  {alasan}
GET  /api/pengembalian-job/?arah=masuk|keluar&status=menunggu|diterima|ditolak|semua
POST /api/pengembalian-job/{id}/terima/          {catatan?}  (staff tujuan, tanpa Kordiv/SPV)
POST /api/pengembalian-job/{id}/tolak/           {catatan}   (wajib)
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import JobBoard
from ..pengembalian_job_models import PengembalianJob
from ..permissions import IsClockedIn
from ..services import pengembalian_job as svc
from rest_framework.permissions import IsAuthenticated


def _nama_pelanggan(job):
    # Sama dengan JobBoardSerializer.get_pelanggan_nama: Order menyimpan nama
    # langsung, POS menautkan ke Contact.
    pelanggan = job.pelanggan
    return (getattr(pelanggan, 'nama', None) or 'Pelanggan Umum') if pelanggan else 'Pelanggan Umum'


def _data(p):
    job, tujuan = p.job, p.job_tujuan
    return {
        'id': p.id,
        'status': p.status,
        'status_label': p.get_status_display(),
        'alasan': p.alasan,
        'job_id': job.id,
        'nama_produk': job.nama_produk,
        'nomor_sumber': job.nomor_sumber,
        'pelanggan_nama': _nama_pelanggan(job),
        'tahap_asal': job.tahap.nama if job.tahap else None,
        'tahap_tujuan': tujuan.tahap.nama if tujuan.tahap else None,
        'divisi_tujuan': tujuan.tahap.divisi.nama if tujuan.tahap else None,
        'penerima': tujuan.pic_staff.username if tujuan.pic_staff else None,
        'diajukan_oleh': p.diajukan_oleh.username if p.diajukan_oleh else None,
        'diajukan_pada': p.diajukan_pada,
        'diputuskan_oleh': p.diputuskan_oleh.username if p.diputuskan_oleh else None,
        'diputuskan_pada': p.diputuskan_pada,
        'catatan_keputusan': p.catatan_keputusan,
    }


class KembalikanJobView(APIView):
    permission_classes = [IsAuthenticated, IsClockedIn]

    def post(self, request, job_id):
        try:
            job = JobBoard.objects.select_related('tahap').get(pk=job_id)
        except JobBoard.DoesNotExist:
            return Response({'error': 'Job tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        p = svc.ajukan(request.user, job, request.data.get('alasan'))
        return Response(_data(p), status=status.HTTP_201_CREATED)


class PengembalianJobListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        arah = request.query_params.get('arah', 'masuk')
        if arah == 'keluar':
            qs = PengembalianJob.objects.filter(diajukan_oleh=user).select_related(
                'job__tahap', 'job_tujuan__tahap__divisi', 'job_tujuan__pic_staff',
                'diajukan_oleh', 'diputuskan_oleh',
            )
        else:
            qs = svc.queryset_untuk_penerima(user).select_related('job_tujuan__pic_staff', 'diputuskan_oleh')
        status_param = request.query_params.get('status', 'menunggu')
        if status_param in dict(PengembalianJob.Status.choices):
            qs = qs.filter(status=status_param)
        return Response([_data(p) for p in qs[:100]])


class KeputusanPengembalianView(APIView):
    permission_classes = [IsAuthenticated, IsClockedIn]
    aksi = None  # 'terima' | 'tolak'

    def post(self, request, pk):
        catatan = request.data.get('catatan', '')
        fungsi = svc.terima if self.aksi == 'terima' else svc.tolak
        p = fungsi(request.user, pk, catatan)
        p = PengembalianJob.objects.select_related(
            'job__tahap', 'job_tujuan__tahap__divisi', 'job_tujuan__pic_staff',
            'diajukan_oleh', 'diputuskan_oleh',
        ).get(pk=p.pk)
        return Response(_data(p))
