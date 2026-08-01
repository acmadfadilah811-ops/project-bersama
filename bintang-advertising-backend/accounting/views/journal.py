from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from api.pagination import OptionalPageNumberPagination
from api.permissions import IsOwnerOrManager

from ..models import JournalAuditLog, JournalEntry
from ..serializers import JournalAuditLogSerializer, JournalEntryCreateSerializer, JournalEntryListSerializer
from ..services.journal import create_journal_entry
from ..services.journal_audit import build_deletion_note
from ..services.journal_export import build_journal_export
from ..services.journal_import import build_preview, commit_entries, parse_csv_file
from .common import resolve_date_range


def _filter_journal_queryset(queryset, request):
    """Filter bersama List dan Export Jurnal Umum, supaya export selalu persis data yang tampil di layar."""
    source_ids = []
    for source_id in (request.query_params.get("source_ids") or "").split(","):
        source_id = source_id.strip()
        if source_id.isdigit():
            source_ids.append(int(source_id))

    # Lookup pasangan jurnal berdasarkan dokumen sumber harus memuat seluruh
    # riwayat dokumen itu, bukan hanya default rentang tanggal hari ini.
    if source_ids:
        queryset = queryset.filter(source_id__in=source_ids)
    else:
        date_from, date_to = resolve_date_range(request)
        queryset = queryset.filter(date__gte=date_from, date__lte=date_to)

    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(entry_number__icontains=search)

    source_type = request.query_params.get("source_type")
    if source_type:
        types = [t.strip() for t in source_type.split(",") if t.strip()]
        if types:
            queryset = queryset.filter(source_type__in=types)

    # Dipakai Invoice untuk pisahkan transaksi asli vs jurnal pembalik (Retur),
    # dan Transaksi Kas untuk pisahkan Pendapatan/Pengeluaran (lihat description
    # yang selalu diawali get_arah_display() di post_cash_transaction_journal()).
    is_reversal = request.query_params.get("is_reversal")
    if is_reversal is not None:
        queryset = queryset.filter(reversed_entry__isnull=(is_reversal.lower() != "true"))

    description_prefix = request.query_params.get("description_prefix")
    if description_prefix:
        queryset = queryset.filter(description__istartswith=description_prefix)

    return queryset.order_by("-date", "-created_at")


class JournalAuditLogListView(generics.ListAPIView):
    """
    GET /api/accounting/journal-audit-logs/?date_from=&date_to=&search=

    Log Jurnal: riwayat aksi (Dibuat/Diposting/Dibatalkan/Dijurnal-balik/Dihapus)
    per Journal Entry. `search` mencocokkan No. Transaksi atau nama aktor.
    """

    permission_classes = [IsOwnerOrManager]
    serializer_class = JournalAuditLogSerializer
    pagination_class = OptionalPageNumberPagination

    def get_queryset(self):
        queryset = JournalAuditLog.objects.select_related("journal_entry", "actor")
        date_from, date_to = resolve_date_range(self.request)
        queryset = queryset.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(journal_entry__entry_number__icontains=search)
                | Q(actor__username__icontains=search)
                | Q(actor__first_name__icontains=search)
            )
        return queryset.order_by("-created_at")


class JournalEntryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/accounting/journal-entries/?date_from=&date_to=&search=
    POST /api/accounting/journal-entries/

    Jurnal Umum: list (default rentang hari ini, sama seperti default Olsera)
    + search No. Transaksi (entry_number), dan create — 1 endpoint melayani
    Form Jurnal Tunggal (Advance/Basic) dan Form Multi Jurnal sekaligus, lihat
    JournalEntryCreateSerializer.
    """

    permission_classes = [IsOwnerOrManager]
    queryset = JournalEntry.objects.select_related("journal_template", "department", "created_by", "posted_by").prefetch_related(
        "lines__account",
    )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return JournalEntryCreateSerializer
        return JournalEntryListSerializer

    def get_queryset(self):
        return _filter_journal_queryset(super().get_queryset(), self.request)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()
        output = JournalEntryListSerializer(entry, context=self.get_serializer_context())
        return Response(output.data, status=201)


class JournalImportPreviewView(APIView):
    """
    POST /api/accounting/journal-entries/import/preview/  (multipart, field 'file')

    Langkah 1 dari 2 (baca dulu, proses belakangan — seperti import produk):
    parse CSV, kelompokkan baris jadi calon Journal Entry, validasi (akun ada,
    balance, dll), TIDAK menyimpan apa pun. Hasilnya ditinjau user, lalu
    dikirim balik ke /import/commit/ (bukan upload ulang file-nya).
    """

    permission_classes = [IsOwnerOrManager]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "File CSV wajib diunggah (field 'file')."}, status=status.HTTP_400_BAD_REQUEST)

        rows, file_errors = parse_csv_file(file_obj)
        if not rows:
            return Response({"detail": " ".join(file_errors) or "File kosong."}, status=status.HTTP_400_BAD_REQUEST)

        preview = build_preview(rows)
        return Response({
            "file_warnings": file_errors,
            "total_entries": len(preview),
            "valid_entries": sum(1 for p in preview if p["is_valid"]),
            "entries": preview,
        })


class JournalImportCommitView(APIView):
    """
    POST /api/accounting/journal-entries/import/commit/

    Langkah 2 dari 2: body = {"entries": [...]} persis bentuk `entries` dari
    respons /import/preview/ (biasanya sudah ditinjau/dikoreksi user di
    frontend). Entry dengan is_valid=false dilewati, tidak diproses.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        entries = request.data.get("entries") or []
        valid_entries = [e for e in entries if e.get("is_valid")]
        if not valid_entries:
            return Response(
                {"detail": "Tidak ada entry valid untuk diproses."}, status=status.HTTP_400_BAD_REQUEST,
            )

        results = commit_entries(valid_entries, created_by=request.user)
        return Response({
            "processed": len(results),
            "success": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "results": results,
        })


class JournalExportView(APIView):
    """
    GET /api/accounting/journal-entries/export/?date_from=&date_to=&search=

    Export Excel — pakai filter yang sama persis dengan List (default hari
    ini), jadi hasil export selalu cocok dengan apa yang lagi tampil di layar.
    1 baris Excel per JournalEntryLine (Akun, Debit, Kredit, dst).
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        base_qs = JournalEntry.objects.select_related("journal_template", "department", "created_by", "posted_by").prefetch_related(
            "lines__account",
        )
        entries = _filter_journal_queryset(base_qs, request)

        buffer = build_journal_export(entries)
        filename = f"jurnal-umum-{date.today():%Y%m%d}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


from django.shortcuts import get_object_or_404

class JournalEntryDetailView(APIView):
    """
    GET /api/accounting/journal-entries/<entry_number>/  â€” detail pasangan jurnal
    DELETE /api/accounting/journal-entries/<entry_number>/
    """
    permission_classes = [IsOwnerOrManager]

    def get(self, request, entry_number):
        entry = get_object_or_404(
            JournalEntry.objects.select_related("journal_template", "department", "created_by", "posted_by").prefetch_related(
                "lines__account",
            ),
            entry_number=entry_number,
        )
        return Response(JournalEntryListSerializer(entry, context={"request": request}).data)

    def delete(self, request, entry_number):
        """
        Jurnal `posted` TIDAK PERNAH di-hard-delete (L7/M7) — "Hapus" di sini
        berarti: buat jurnal pembalik (baris debit/kredit dibalik dari entry
        asli), lalu catat aksinya ke Log Jurnal (`JournalAuditLog`) dengan
        deskripsi berisi rincian tiap baris asli (format "Debit/Kredit akun
        ... IDR x", dipisah ' | ') supaya tetap bisa diaudit walau jurnal
        aslinya sudah dibalik.
        """
        entry = get_object_or_404(
            JournalEntry.objects.prefetch_related("lines__account"), entry_number=entry_number,
        )
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"detail": "Alasan penghapusan wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)
        if entry.status != JournalEntry.Status.POSTED:
            return Response(
                {"detail": "Hanya transaksi berstatus Terposting yang bisa dihapus."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if JournalEntry.objects.filter(reversed_entry=entry, status=JournalEntry.Status.POSTED).exists():
            return Response(
                {"detail": "Transaksi ini sudah pernah dihapus/dibalik sebelumnya."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        note = build_deletion_note(entry, reason=reason)
        reversal_lines = [
            {
                "account": line.account, "debit": line.kredit, "kredit": line.debit,
                "description": line.description, "external_document_no": line.external_document_no,
                "supplier": line.supplier, "customer": line.customer,
            }
            for line in entry.lines.all()
        ]

        try:
            with transaction.atomic():
                reversal = create_journal_entry(
                    date=timezone.localdate(),
                    lines=reversal_lines,
                    description=f"Pembalikan {entry.entry_number} (dihapus): {entry.description}",
                    source_type=entry.source_type,
                    source_id=None,
                    created_by=request.user,
                    status=JournalEntry.Status.POSTED,
                )
                reversal.reversed_entry = entry
                reversal.save(update_fields=["reversed_entry"])
                JournalAuditLog.objects.create(
                    journal_entry=entry,
                    action=JournalAuditLog.Action.DELETED,
                    actor=request.user,
                    note=note,
                )
        except DjangoValidationError as exc:
            return Response({"detail": getattr(exc, "messages", [str(exc)])}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"message": "Transaksi berhasil dihapus (dicatat sebagai jurnal pembalik).",
             "reversal_entry_number": reversal.entry_number},
            status=status.HTTP_200_OK,
        )


class SingleJournalEntryExportView(APIView):
    """
    GET /api/accounting/journal-entries/<entry_number>/export/

    Export Excel utk 1 Journal Entry saja (tombol "Cetak PDF" per-baris di
    list Jurnal Umum — labelnya "PDF" tapi isinya Excel, reuse
    build_journal_export() yang sama dengan JournalExportView, cuma daftar
    entry-nya cuma 1).
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request, entry_number):
        entry = get_object_or_404(
            JournalEntry.objects.select_related("journal_template", "department").prefetch_related("lines__account"),
            entry_number=entry_number,
        )
        buffer = build_journal_export([entry])
        filename = f"jurnal-{entry.entry_number}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
