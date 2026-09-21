"""Posting Gaji (HR -> jurnal). View tipis; aturan ada di services/payroll_posting.py.
Hanya Owner/Manager (posting jurnal eksklusif keduanya -- Aturan M2)."""

from datetime import date

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsStrictOwnerOrManager

from ..models import PayrollComponentMapping, PayrollPosting
from ..serializers.payroll import PayrollComponentMappingSerializer, PayrollPostingSerializer, bentuk_pratinjau
from ..services import payroll_posting as svc


def _periode(data):
    try:
        tahun, bulan = int(data.get("tahun")), int(data.get("bulan"))
        date(tahun, bulan, 1)
    except (TypeError, ValueError):
        raise svc.PayrollError("tahun dan bulan wajib berupa angka yang valid.")
    return tahun, bulan


class _PayrollAPIView(APIView):
    permission_classes = [IsStrictOwnerOrManager]

    def handle_exception(self, exc):
        if isinstance(exc, svc.PayrollError):
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return super().handle_exception(exc)


class PayrollPratinjauView(_PayrollAPIView):
    """GET /api/accounting/payroll/pratinjau/?tahun=&bulan= -- baca-saja."""

    def get(self, request):
        tahun, bulan = _periode(request.query_params)
        return Response(bentuk_pratinjau(svc.pratinjau(tahun, bulan)))


class PayrollPostingView(_PayrollAPIView):
    """POST /api/accounting/payroll/posting/ {tahun, bulan}"""

    def post(self, request):
        tahun, bulan = _periode(request.data)
        return Response(PayrollPostingSerializer(svc.posting(tahun, bulan, request.user)).data,
                        status=status.HTTP_201_CREATED)


class PayrollKoreksiView(_PayrollAPIView):
    """POST /api/accounting/payroll/koreksi/ {tahun, bulan} -- balik versi lama + posting ulang."""

    def post(self, request):
        tahun, bulan = _periode(request.data)
        return Response(PayrollPostingSerializer(svc.koreksi(tahun, bulan, request.user)).data,
                        status=status.HTTP_201_CREATED)


class PayrollBayarView(_PayrollAPIView):
    """POST /api/accounting/payroll/bayar/ {tahun, bulan, akun_kas, tanggal?}"""

    def post(self, request):
        tahun, bulan = _periode(request.data)
        tanggal = request.data.get("tanggal") or None
        if tanggal:
            try:
                tanggal = date.fromisoformat(str(tanggal))
            except ValueError:
                raise svc.PayrollError("Format tanggal harus YYYY-MM-DD.")
        p = svc.bayar(tahun, bulan, request.data.get("akun_kas"), tanggal, request.user)
        return Response(PayrollPostingSerializer(p).data)


class PayrollRiwayatView(generics.ListAPIView):
    """GET /api/accounting/payroll/riwayat/ -- semua versi posting, terbaru dulu."""

    permission_classes = [IsStrictOwnerOrManager]
    serializer_class = PayrollPostingSerializer
    pagination_class = None
    queryset = PayrollPosting.objects.select_related("journal_entry", "payment_journal_entry", "posted_by")


class PayrollPemetaanListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/accounting/payroll/pemetaan/ -- judul komponen HR -> akun."""

    permission_classes = [IsStrictOwnerOrManager]
    serializer_class = PayrollComponentMappingSerializer
    pagination_class = None
    queryset = PayrollComponentMapping.objects.select_related("akun", "akun_iuran_perusahaan")


class PayrollPemetaanDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsStrictOwnerOrManager]
    serializer_class = PayrollComponentMappingSerializer
    queryset = PayrollComponentMapping.objects.select_related("akun", "akun_iuran_perusahaan")
