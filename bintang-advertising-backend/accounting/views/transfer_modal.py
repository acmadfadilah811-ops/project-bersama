from rest_framework import generics, status
from rest_framework.response import Response

from api.permissions import IsOwnerOrManager

from ..models import JournalEntry
from ..serializers import JournalEntryCreateSerializer, JournalEntryListSerializer
from .common import resolve_date_range


class TransferModalListView(generics.ListAPIView):
    """
    GET /api/accounting/transfer-modal/?date_from=&date_to=&search=

    Log transfer modal — difilter otomatis source_type=capital_transfer.
    Menampilkan riwayat pemindahan dana antara akun Kas/Bank dan Ekuitas/Modal.
    """

    permission_classes = [IsOwnerOrManager]
    serializer_class = JournalEntryListSerializer
    queryset = JournalEntry.objects.select_related(
        "journal_template", "department",
    ).prefetch_related("lines__account").filter(
        source_type=JournalEntry.SourceType.CAPITAL_TRANSFER,
    )

    def get_queryset(self):
        qs = super().get_queryset()
        date_from, date_to = resolve_date_range(self.request)
        qs = qs.filter(date__gte=date_from, date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(entry_number__icontains=search)

        return qs.order_by("-date", "-created_at")


class TransferModalCreateView(generics.CreateAPIView):
    """
    POST /api/accounting/transfer-modal/

    Buat jurnal transfer modal — validasi khusus:
    wajib melibatkan minimal 1 akun Kas & Bank DAN 1 akun Ekuitas/Modal.
    Format body sama dengan /journal-entries/ (Advance Form / Multi Jurnal).
    Source_type otomatis di-set ke CAPITAL_TRANSFER.
    """

    permission_classes = [IsOwnerOrManager]
    serializer_class = JournalEntryCreateSerializer

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["source_type"] = JournalEntry.SourceType.CAPITAL_TRANSFER

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()
        output = JournalEntryListSerializer(entry, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)
