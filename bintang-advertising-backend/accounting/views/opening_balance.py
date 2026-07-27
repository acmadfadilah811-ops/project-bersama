from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..serializers.opening_balance import OpeningBalanceSubmitSerializer
from ..services.opening_balance import submit_opening_balances


class OpeningBalanceSubmitView(APIView):
    """
    POST /api/accounting/opening-balances/
    body: {"entries": [{"account": <id>, "amount": <number>}, ...]}

    Popup "Masukan Saldo Awal" — muncul otomatis setelah wizard Pengaturan Awal
    selesai (skippable). Posting 1 JournalEntry seimbang lewat
    services.opening_balance.submit_opening_balances().
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        serializer = OpeningBalanceSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            entry = submit_opening_balances(
                entries=serializer.validated_data["entries"], actor=request.user,
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))

        if entry is None:
            return Response({"id": None, "entry_number": None}, status=200)

        return Response({"id": entry.id, "entry_number": entry.entry_number}, status=201)

