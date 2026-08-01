from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import JournalAuditLog, JournalEntry
from ..serializers import POSSaleBatchActionSerializer
from ..services.pos_manual_posting import cancel_pos_sales_posting, post_pos_sales_manually


class _POSSaleBatchActionView(APIView):
    permission_classes = [IsOwnerOrManager]

    service = None

    def post(self, request):
        serializer = POSSaleBatchActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            results = self.service(sale_ids=serializer.validated_data["sale_ids"], actor=request.user)
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))
        return Response({"results": results})


class POSSaleManualPostView(_POSSaleBatchActionView):
    service = staticmethod(post_pos_sales_manually)


class POSSaleCancelPostView(_POSSaleBatchActionView):
    service = staticmethod(cancel_pos_sales_posting)


class POSSaleJournalLogView(APIView):
    permission_classes = [IsOwnerOrManager]

    def get(self, request, sale_id):
        audit_logs = JournalAuditLog.objects.filter(
            journal_entry__source_type=JournalEntry.SourceType.POS_SALE,
            journal_entry__source_id=sale_id,
        ).select_related("actor", "journal_entry").order_by("-created_at")
        return Response([
            {
                "id": log.id,
                "action": log.action,
                "note": log.note,
                "actor_email": log.actor.email if log.actor else "",
                "created_at": log.created_at,
                "journal_entry": log.journal_entry.entry_number,
            }
            for log in audit_logs
        ])
