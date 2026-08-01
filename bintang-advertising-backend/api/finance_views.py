import csv
import io

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from .permissions import IsStrictOwnerOrManager, IsOwnerManagerAdminOrKasir
from rest_framework.response import Response

from .finance_models import CashTransactionType, CashTransaction, CashTransactionAttachment
from .finance_serializers import (
    CashTransactionTypeSerializer, CashTransactionSerializer,
)

CSV_IMPORT_MAX_ROWS = 500


def _next_number(prefix):
    """Nomor dokumen berikutnya untuk prefix hari ini (ambil tertinggi, bukan count)."""
    last = CashTransaction.objects.filter(nomor__startswith=prefix).order_by('-nomor').first()
    if last:
        try:
            next_num = int(last.nomor[len(prefix):]) + 1
        except ValueError:
            next_num = 1
    else:
        next_num = 1
    return f"{prefix}{next_num:06d}"


def _norm_direction(raw):
    """Normalisasi teks Type CSV -> 'pendapatan' / 'pengeluaran'."""
    v = (raw or '').strip().lower()
    if v in ('pendapatan', 'income', 'masuk', 'kas masuk'):
        return 'pendapatan'
    if v in ('pengeluaran', 'expense', 'keluar', 'kas keluar'):
        return 'pengeluaran'
    return None


class CashTransactionTypeViewSet(viewsets.ModelViewSet):
    """Tipe Transaksi (master) untuk Pendapatan/Pengeluaran.

    Kasir boleh membaca (perlu daftar tipe untuk form Kas Masuk/Keluar di
    layar shift). Menambah tipe baru punya gerbang tersendiri di create()
    (setelan POS `blokir_tambah_tipe_kas`); ubah/hapus tipe master tetap
    Owner/Manager saja — bukan hal yang kasir perlu lakukan sehari-hari.
    """
    queryset = CashTransactionType.objects.all()
    serializer_class = CashTransactionTypeSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsStrictOwnerOrManager()]
        return [IsOwnerManagerAdminOrKasir()]

    def get_queryset(self):
        qs = super().get_queryset()
        tipe = self.request.query_params.get('tipe')
        if tipe in ('pendapatan', 'pengeluaran'):
            qs = qs.filter(tipe=tipe)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(nama__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        """Hormati Pengaturan POS: 'Tidak diperbolehkan menambah tipe Kas
        Masuk/Keluar' — memblokir kasir/staff, pemilik & manajer tetap boleh."""
        from . import pos_settings
        user = request.user
        is_atasan = getattr(user, 'role', '') in ('owner', 'manager') or user.is_superuser
        if pos_settings.blokir_tambah_tipe_kas() and not is_atasan:
            return Response(
                {'error': 'Menambah tipe transaksi dinonaktifkan di Pengaturan POS. '
                          'Hubungi pemilik/manajer.'},
                status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        """Import massal tipe transaksi. Kolom: Name, Type (Pendapatan/Pengeluaran)."""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'File CSV wajib diunggah.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            decoded = file_obj.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'File harus berupa CSV berformat teks (UTF-8).'}, status=status.HTTP_400_BAD_REQUEST)

        rows = list(csv.DictReader(io.StringIO(decoded)))
        if len(rows) > CSV_IMPORT_MAX_ROWS:
            return Response(
                {'error': f'Maksimal {CSV_IMPORT_MAX_ROWS} baris per import — file ini berisi {len(rows)} baris.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        errors = []
        for idx, row in enumerate(rows, start=2):  # baris 1 = header
            low = {(k or '').strip().lower(): (v or '').strip() for k, v in row.items()}
            nama = low.get('name') or low.get('nama')
            tipe = _norm_direction(low.get('type') or low.get('tipe'))
            if not nama:
                errors.append(f"Baris {idx}: kolom Name kosong.")
                continue
            if not tipe:
                errors.append(f"Baris {idx}: Type '{low.get('type') or low.get('tipe') or ''}' tidak valid (isi Pendapatan/Pengeluaran).")
                continue
            obj = CashTransactionType.objects.create(nama=nama, tipe=tipe, dibuat_oleh=request.user)
            created.append(obj)

        return Response(
            {
                'created': CashTransactionTypeSerializer(created, many=True).data,
                'errors': errors,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )


class CashTransactionViewSet(viewsets.ModelViewSet):
    """Transaksi Pendapatan/Pengeluaran (Kas Masuk/Keluar) + lampiran bukti.

    Kasir boleh mencatat Kas Masuk/Keluar shift-nya sendiri (kebutuhan layar
    Shift POS) — dibatasi ke transaksi miliknya sendiri lewat get_queryset()
    (sama pola dengan SaldoKasHarianViewSet). Posting/pembatalan ke jurnal
    akuntansi (`post`/`cancel`) tetap Owner/Manager saja — beda kelas
    sensitivitas dari sekadar mencatat draft kas masuk/keluar.
    """
    queryset = (
        CashTransaction.objects.all()
        .select_related('tipe_transaksi', 'staff', 'dibuat_oleh')
        .prefetch_related('lampiran')
    )
    serializer_class = CashTransactionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ('post_journal', 'cancel_journal'):
            return [IsStrictOwnerOrManager()]
        return [IsOwnerManagerAdminOrKasir()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == 'kasir':
            qs = qs.filter(staff=self.request.user)
        arah = self.request.query_params.get('arah')
        if arah in ('pendapatan', 'pengeluaran'):
            qs = qs.filter(arah=arah)
        return qs

    def perform_create(self, serializer):
        tipe = serializer.validated_data.get('tipe_transaksi')
        nomor = _next_number(f"KAS{timezone.now().date().strftime('%y%m%d')}")
        staff = serializer.validated_data.get('staff') or self.request.user
        from .models import SaldoKasHarian
        shift = SaldoKasHarian.objects.filter(kasir=self.request.user, kas_akhir__isnull=True, waktu_tutup__isnull=True).order_by('-id').first()
        obj = serializer.save(nomor=nomor, arah=tipe.tipe, staff=staff, shift=shift, dibuat_oleh=self.request.user)
        for f in self.request.FILES.getlist('lampiran'):
            CashTransactionAttachment.objects.create(transaction=obj, file=f)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'draft':
            return Response({'error': 'Transaksi yang sudah diposting/dibatalkan tidak bisa diubah.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        tipe = serializer.validated_data.get('tipe_transaksi')
        obj = serializer.save()
        if tipe:
            obj.arah = tipe.tipe
            obj.save(update_fields=['arah', 'updated_at'])
        for f in self.request.FILES.getlist('lampiran'):
            CashTransactionAttachment.objects.create(transaction=obj, file=f)

    @action(detail=True, methods=['post'], url_path='remove-attachment')
    def remove_attachment(self, request, pk=None):
        tx = self.get_object()
        att_id = request.data.get('attachment_id')
        deleted, _ = CashTransactionAttachment.objects.filter(transaction=tx, id=att_id).delete()
        if not deleted:
            return Response({'error': 'Lampiran tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CashTransactionSerializer(tx, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='post')
    def post_journal(self, request, pk=None):
        tx = self.get_object()
        if tx.status != 'draft':
            return Response({'error': 'Transaksi sudah diposting/dibatalkan.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError
        from accounting.services.cash_transaction_posting import post_cash_transaction_journal

        try:
            post_cash_transaction_journal(tx, request.user)
        except DjangoValidationError as exc:
            raise ValidationError(getattr(exc, 'messages', [str(exc)])) from exc
        tx.status = 'selesai'
        tx.save(update_fields=['status', 'updated_at'])
        return Response(CashTransactionSerializer(tx, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_journal(self, request, pk=None):
        tx = self.get_object()
        if tx.status != 'selesai':
            return Response({'error': 'Hanya transaksi Terposting yang bisa dibatalkan.'}, status=status.HTTP_400_BAD_REQUEST)

        from accounting.services.cash_transaction_posting import reverse_cash_transaction_journal

        reverse_cash_transaction_journal(tx, request.user)
        tx.status = 'batal'
        tx.save(update_fields=['status', 'updated_at'])
        return Response(CashTransactionSerializer(tx, context={'request': request}).data)
