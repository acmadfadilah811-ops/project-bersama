"""Endpoint admin utk pricelist bot WA -- lihat api/services/wa_pricelist_admin.py
untuk penjelasan lengkap & skema data. Owner/Manager only (data harga
sensitif), pola permission sama dgn SystemConfigViewSet (config.py)."""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsStrictOwnerOrManager
from ..services import wa_pricelist_admin as svc


class WaPricelistListView(APIView):
    """GET /api/wa-pricelist/ -- semua kategori (teks + data terstruktur kalau ada)."""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        return Response({'kategori': svc.get_semua_kategori()})


class WaPricelistDetailView(APIView):
    """GET/PATCH /api/wa-pricelist/<slug>/"""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request, slug):
        try:
            return Response(svc.get_satu_kategori(slug))
        except svc.PricelistAdminError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, slug):
        try:
            data = svc.update_kategori(slug, request.data.get('teks'), request.data.get('bahan'))
            return Response(data)
        except svc.PricelistAdminError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WaPricelistTemplateView(APIView):
    """GET /api/wa-pricelist/<slug>/template/ -- unduh CSV (kolom sesuai
    tier kategori ini + data harga terkini, dipakai sebagai template edit)."""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request, slug):
        try:
            csv_text = svc.bahan_ke_csv(slug)
        except svc.PricelistAdminError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        response = HttpResponse(csv_text, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="pricelist_{slug}.csv"'
        return response


class WaPricelistImportView(APIView):
    """POST /api/wa-pricelist/<slug>/import/ -- upload CSV (multipart,
    field 'file'), replace seluruh baris bahan kategori ini."""
    permission_classes = [IsStrictOwnerOrManager]
    parser_classes = [MultiPartParser]

    def post(self, request, slug):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': "File CSV wajib diunggah (field 'file')."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = svc.csv_ke_bahan(slug, file_obj)
            return Response(data)
        except svc.PricelistAdminError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
