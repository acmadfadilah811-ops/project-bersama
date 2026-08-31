"""View AI Business Analyst — mengikuti pola executive_dashboard_views.py."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from . import ai_business_analyst
from .executive_dashboard_views import _period


class AiBusinessAnalystView(APIView):
    """GET /api/ai-business-analyst/?period=mtd|qtd|ytd|12m

    Dashboard analisis bisnis lintas modul (penjualan, profitabilitas, stok,
    dst) — dibatasi owner/manager, sama seperti Dashboard Eksekutif.
    """

    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    def get(self, request):
        period, error = _period(request)
        if error:
            return error
        return Response(ai_business_analyst.build(period))
