from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import Account
from ..serializers import (
    BankReconciliationMatchSerializer,
    BankStatementLineSerializer,
    UnmatchedJournalLineSerializer,
)
from ..services.bank_reconciliation import confirm_match, get_unmatched_journal_lines, get_unreconciled_bank_lines
from .common import resolve_date_range


class BankReconciliationView(APIView):
    """
    GET /api/accounting/bank-reconciliation/?account=<id>&date_from=&date_to=

    Return 2 himpunan data terpisah, masing-masing sudah difilter "belum
    reconciled" di level query (bukan flag mentah yang dikira-kira frontend):
    - unreconciled_internal: baris jurnal/buku besar yang belum terpasang ke
      bank statement manapun.
    - unreconciled_bank_statement: baris tabel staging hasil import CSV yang
      belum direkonsiliasi (status=Pending).

    Untuk 1 akun + rentang tanggal (default hari ini). Belum ada auto-suggest
    matching — akun 23000/23500 bukan akun kas/bank asli, arah pencocokannya
    belum tentu sama seperti Kas/Bank, jadi belum dibangun sampai ada contoh nyata.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        account_id = request.query_params.get("account")
        if not account_id:
            return Response({"detail": "Parameter 'account' wajib diisi."}, status=400)
        account = get_object_or_404(Account, id=account_id)

        date_from, date_to = resolve_date_range(request)
        unreconciled_bank_statement = get_unreconciled_bank_lines(account, date_from, date_to)
        unreconciled_internal = get_unmatched_journal_lines(account, date_from, date_to)

        return Response({
            "account": {"id": account.id, "code": account.code, "name": account.name},
            "unreconciled_bank_statement": BankStatementLineSerializer(unreconciled_bank_statement, many=True).data,
            "unreconciled_internal": UnmatchedJournalLineSerializer(unreconciled_internal, many=True).data,
        })


class BankReconciliationMatchView(APIView):
    """
    POST /api/accounting/bank-reconciliation/match/
    body: {"bank_statement_line": <id>, "journal_entry_line": <id>}

    Konfirmasi 1 baris Bank Statement cocok dengan 1 baris Journal Entry —
    tandai Reconciled. Manual (dipilih user), bukan auto-match.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        serializer = BankReconciliationMatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            bank_line = confirm_match(
                bank_statement_line=serializer.validated_data["bank_statement_line"],
                journal_entry_line=serializer.validated_data["journal_entry_line"],
                actor=request.user,
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))

        return Response(BankStatementLineSerializer(bank_line).data)
