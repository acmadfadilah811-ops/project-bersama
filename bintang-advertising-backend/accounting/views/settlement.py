from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..serializers.settlement import SettlementBatchSerializer, SettlementConfirmSerializer
from ..services.settlement import confirm_settlement_batches, get_settlement_batches
from .common import resolve_date_range


class SettlementListView(APIView):
    """
    GET /api/accounting/settlements/?date_from=&date_to=

    Return settlement batches grouped by (tanggal, metode bayar).
    Tiap baris = agregasi semua transaksi non-tunai unsettled pada tanggal
    itu dengan metode bayar itu.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        date_from, date_to = resolve_date_range(request)
        batches = get_settlement_batches(date_from, date_to)
        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "total": len(batches),
            "results": SettlementBatchSerializer(batches, many=True).data,
        })


class SettlementConfirmView(APIView):
    """
    POST /api/accounting/settlements/confirm/
    body: {
        "batches": [{"date": "2026-07-25", "payment_method_id": 3}, ...],
        "bank_account_id": 5
    }

    Confirm satu atau lebih batch. Tiap batch → 1 JournalEntry
    (KREDIT piutang transit, DEBIT kas/bank + DEBIT MDR kalau ada).
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        serializer = SettlementConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            entries = confirm_settlement_batches(
                batch_keys=serializer.validated_data["batches"],
                bank_account_id=serializer.validated_data["bank_account_id"],
                actor=request.user,
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))

        return Response({
            "confirmed_count": len(entries),
            "journal_entries": [
                {"id": e.id, "entry_number": e.entry_number, "date": str(e.date)}
                for e in entries
            ],
        })
