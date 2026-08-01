"""
accounting/views/pos_reconciliation.py

Endpoint rekonsiliasi shift POS vs JournalEntry (T-105).
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from api.permissions import IsOwnerOrManager
from ..services.pos_reconciliation import reconcile_pos_shift


class POSShiftReconciliationView(APIView):
    """
    GET /api/accounting/pos-reconciliation/?shift_id=&date_from=&date_to=
    Rekonsiliasi shift POS vs JournalEntry.
    """

    permission_classes = [permissions.IsAuthenticated, IsOwnerOrManager]

    def get(self, request):
        shift_id = request.query_params.get("shift_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if shift_id:
            try:
                shift_id = int(shift_id)
            except ValueError:
                return Response(
                    {"error": "shift_id harus berupa integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        summary = reconcile_pos_shift(
            shift_id=shift_id,
            date_from=date_from,
            date_to=date_to,
        )

        return Response(summary, status=status.HTTP_200_OK)
