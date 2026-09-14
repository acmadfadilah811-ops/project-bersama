"""View Dashboard Insight Owner -- gabungan Bintang+HR+CRM lintas sistem.

Dipisah dari logika penggabungan (api/services/insights_bridge.py)
mengikuti pola executive_dashboard.py/executive_dashboard_views.py.
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager
from api.services.insights_bridge import build_combined_insights

PERIODE_VALID = {"mtd", "qtd", "ytd", "12m"}


class CombinedInsightsView(APIView):
    """GET /api/insights/combined/?period=mtd|qtd|ytd|12m

    Ringkasan lintas sistem (Bintang+HR+CRM) untuk Dashboard Insight
    Owner -- dibatasi owner/manager, sama seperti dashboard eksekutif
    (staff/kasir tidak boleh lihat omzet/HPP/piutang agregat, dan data
    HR/CRM di sini sama sensitifnya).
    """

    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    def get(self, request):
        period = request.query_params.get("period", "ytd")
        if period not in PERIODE_VALID:
            period = "ytd"
        return Response(build_combined_insights(period))
