from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsStrictOwnerOrManager
from ..services.wa_bot_stats import get_snapshot_stats


class WaBotStatsView(APIView):
    """GET /api/wa-bot-config/stats/ -- snapshot statistik chat (bukan
    riwayat/time-series, lihat services/wa_bot_stats.py)."""
    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        return Response(get_snapshot_stats())
