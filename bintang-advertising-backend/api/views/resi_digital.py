"""Struk online + survei kepuasan (2026-10-06).

Publik (tanpa login, dibatasi laju):
  GET  /api/resi/<token>/          -> data struk + status survei
  POST /api/resi/<token>/survei/   -> {"nilai": {aspek_id: 1..5}, "catatan": "..."}
Owner/Manager:
  GET  /api/survei-kepuasan/       -> ringkasan per aspek + daftar tanggapan (?mulai=&selesai=)
  /api/aspek-survei/               -> kelola aspek survei
"""
from datetime import date

from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from ..permissions import IsOwnerOrManager
from ..services import resi_digital as svc
from ..survei_models import AspekSurvei, NilaiSurvei, SurveiKepuasan


class ResiPublikThrottle(AnonRateThrottle):
    scope = 'resi_publik'
    rate = '60/min'


class SurveiPublikThrottle(AnonRateThrottle):
    scope = 'resi_survei'
    rate = '10/min'


class ResiPublikView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ResiPublikThrottle]

    def get(self, request, token):
        try:
            return Response(svc.data_resi(token))
        except svc.TokenTidakValid:
            return Response({'error': 'Struk tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)


class ResiSurveiView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SurveiPublikThrottle]

    def post(self, request, token):
        nilai = request.data.get('nilai')
        if not isinstance(nilai, dict):
            return Response({'error': 'Nilai survei wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            svc.simpan_survei(token, nilai, request.data.get('catatan', ''))
        except svc.TokenTidakValid:
            return Response({'error': 'Struk tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        except svc.SurveiSudahDiisi:
            return Response({'error': 'Survei untuk transaksi ini sudah diisi. Terima kasih!'}, status=status.HTTP_409_CONFLICT)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'ok': True}, status=status.HTTP_201_CREATED)


def _tanggal(teks):
    try:
        return date.fromisoformat(teks) if teks else None
    except ValueError:
        return None


class SurveiKepuasanView(APIView):
    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        qs = SurveiKepuasan.objects.select_related('pos_sale', 'order').prefetch_related('nilai__aspek')
        mulai, selesai = _tanggal(request.query_params.get('mulai')), _tanggal(request.query_params.get('selesai'))
        if mulai:
            qs = qs.filter(dibuat_pada__date__gte=mulai)
        if selesai:
            qs = qs.filter(dibuat_pada__date__lte=selesai)
        nilai = NilaiSurvei.objects.filter(survei__in=qs)
        per_aspek = [
            {'aspek': r['aspek__nama'], 'rata_rata': round(float(r['rata'] or 0), 2), 'jumlah': r['n']}
            for r in nilai.values('aspek__nama', 'aspek__urutan').annotate(rata=Avg('nilai'), n=Count('id')).order_by('aspek__urutan')
        ]
        ringkasan = qs.aggregate(rata=Avg('rata_rata'), n=Count('id'), puas=Count('id', filter=Q(rata_rata__gte=4)))
        # Grafik: tren harian, sebaran bintang (semua jawaban per aspek), CSAT = % tanggapan rata-rata >= 4.
        tren = [
            {'tanggal': r['tgl'].isoformat(), 'rata_rata': round(float(r['rata'] or 0), 2), 'jumlah': r['n']}
            for r in qs.order_by().annotate(tgl=TruncDate('dibuat_pada')).values('tgl')
            .annotate(rata=Avg('rata_rata'), n=Count('id')).order_by('tgl')
        ]
        hitung = dict(nilai.order_by().values_list('nilai').annotate(n=Count('id')))
        sebaran = [{'bintang': b, 'jumlah': hitung.get(b, 0)} for b in range(5, 0, -1)]
        tanggapan = [
            {
                'id': s.id, 'waktu': s.dibuat_pada.isoformat(), 'transaksi': s.nomor_transaksi,
                'jenis': 'pos' if s.pos_sale_id else 'order', 'pelanggan': s.nama_pelanggan,
                'nomor_wa': s.nomor_wa, 'rata_rata': float(s.rata_rata), 'catatan': s.catatan,
                'nilai': [{'aspek': n.aspek.nama, 'nilai': n.nilai} for n in s.nilai.all()],
            }
            for s in qs[:500]
        ]
        return Response({
            'jumlah': ringkasan['n'] or 0,
            'rata_rata': round(float(ringkasan['rata'] or 0), 2),
            'csat': round(100 * (ringkasan['puas'] or 0) / ringkasan['n'], 1) if ringkasan['n'] else 0,
            'per_aspek': per_aspek,
            'tren': tren,
            'sebaran': sebaran,
            'jumlah_catatan': qs.exclude(catatan='').count(),
            'tanggapan': tanggapan,
        })


class AspekSurveiSerializer(serializers.ModelSerializer):
    class Meta:
        model = AspekSurvei
        fields = ['id', 'nama', 'urutan', 'aktif']


class AspekSurveiViewSet(viewsets.ModelViewSet):
    queryset = AspekSurvei.objects.all()
    serializer_class = AspekSurveiSerializer
    permission_classes = [IsOwnerOrManager]

    def destroy(self, request, *args, **kwargs):
        aspek = self.get_object()
        if aspek.nilai.exists():
            return Response(
                {'error': 'Aspek ini sudah punya jawaban survei; nonaktifkan saja supaya riwayat tetap utuh.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
