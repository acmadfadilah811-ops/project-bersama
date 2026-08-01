"""Endpoint baca-saja Laporan Pembelian."""
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.services.purchase_reports import build_purchase_report
from api.throttles import ReportRateThrottle


class PurchaseReportView(APIView):
    """GET /api/reports/purchases/<report_id>/?start=&end=&search=."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ReportRateThrottle]
    max_rows = 1000

    def get(self, request, report_id):
        try:
            result = build_purchase_report(
                report_id,
                start=parse_date(request.query_params.get('start') or ''),
                end=parse_date(request.query_params.get('end') or ''),
                search=(request.query_params.get('search') or '').strip(),
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        rows = result['rows']
        return Response({**result, 'rows': rows[:self.max_rows], 'truncated': len(rows) > self.max_rows})
