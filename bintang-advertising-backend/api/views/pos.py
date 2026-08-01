from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from django.utils import timezone

from ..models import POSAntrianDevice, SaldoKasHarian, RingkasanShift, POSPaymentMethod
from ..serializers import (
    POSAntrianDeviceSerializer, SaldoKasHarianSerializer, RingkasanShiftSerializer,
    POSPaymentMethodSerializer,
)
from ..permissions import IsOwnerManagerAdminOrReadOnly, IsOwnerManagerAdminOrKasir
from ..services.shift_summary import calculate_shift_cash_summary


class POSPaymentMethodViewSet(viewsets.ModelViewSet):
    """Cara pembayaran POS (Pengaturan POS > Pembayaran)."""
    queryset = POSPaymentMethod.objects.all()
    serializer_class = POSPaymentMethodSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

class POSAntrianDeviceViewSet(viewsets.ModelViewSet):
    queryset = POSAntrianDevice.objects.all().order_by('id')
    serializer_class = POSAntrianDeviceSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]


class SaldoKasHarianViewSet(viewsets.ModelViewSet):
    queryset = SaldoKasHarian.objects.all().order_by('-tanggal', '-id')
    serializer_class = SaldoKasHarianSerializer
    permission_classes = [IsAuthenticated, IsOwnerManagerAdminOrKasir]
    http_method_names = ['get', 'post', 'head', 'options']

    def create(self, request, *args, **kwargs):
        """Satu kasir aktif dalam satu waktu (ganti operator = bergantian,
        bukan paralel) — mesin kasir fisiknya cuma satu. Dikunci di server
        (row-lock) supaya dua kasir tidak bisa sama-sama buka shift meski
        lewat device/tab berbeda; sebelumnya tidak ada penegakan sama sekali.
        """
        with transaction.atomic():
            shift_terbuka = (
                SaldoKasHarian.objects.select_for_update()
                .filter(kas_akhir__isnull=True, waktu_tutup__isnull=True)
                .select_related('kasir')
                .first()
            )
            if shift_terbuka:
                nama = shift_terbuka.kasir.get_full_name() or shift_terbuka.kasir.username
                raise ValidationError({
                    'error': f'Shift masih dibuka oleh {nama}. Tutup shift tersebut dulu '
                             f'sebelum ganti operator / buka shift baru — satu kasir aktif '
                             f'dalam satu waktu.'
                })
            return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(kasir=self.request.user, waktu_buka=timezone.now())

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == 'kasir':
            queryset = queryset.filter(kasir=self.request.user)
        tanggal = self.request.query_params.get('tanggal')
        if tanggal:
            queryset = queryset.filter(tanggal=tanggal)
        
        query = self.request.query_params.get('query')
        if query:
            queryset = queryset.filter(
                Q(kasir__username__icontains=query) |
                Q(kasir__first_name__icontains=query) |
                Q(kasir__last_name__icontains=query) |
                Q(shift__icontains=query)
            )
        return queryset

    @action(detail=True, methods=['post'], url_path='close')
    @transaction.atomic
    def close(self, request, pk=None):
        """Tutup shift sekaligus membuat Ringkasan Shift (V2).

        expected = kas awal
                 + penjualan POS tunai selama shift
                 + Pendapatan - Pengeluaran (kas masuk/keluar) pada jendela shift.

        Dihitung di server agar angka rekonsiliasi tidak bisa dimanipulasi dari
        browser. `selisih` dihitung otomatis oleh RingkasanShift.save().
        """
        shift = SaldoKasHarian.objects.select_for_update().get(pk=pk)
        if request.user.role == 'kasir' and shift.kasir_id != request.user.id:
            return Response({'error': 'Anda hanya dapat menutup shift sendiri.'}, status=403)
        if shift.waktu_tutup:
            return Response({'error': 'Shift ini sudah ditutup.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            kas_akhir = Decimal(str(request.data.get('kas_akhir') or 0))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'kas_akhir harus berupa angka.'}, status=status.HTTP_400_BAD_REQUEST)

        sekarang = timezone.now()
        mulai = shift.waktu_buka or sekarang

        rincian = calculate_shift_cash_summary(shift)

        shift.kas_akhir = kas_akhir
        shift.waktu_tutup = sekarang
        shift.catatan = (request.data.get('catatan') or '').strip()
        shift.save()

        ringkasan = RingkasanShift.objects.create(
            tanggal=shift.tanggal, kasir=shift.kasir,
            mulai=mulai, berakhir=sekarang,
            expected=rincian['expected'], aktual=kas_akhir,
            rincian_tersedia=True,
            kas_awal=rincian['kas_awal'],
            penjualan_tunai=rincian['penjualan_tunai'],
            kas_masuk=rincian['kas_masuk'],
            kas_keluar=rincian['kas_keluar'],
        )

        return Response({
            'shift': SaldoKasHarianSerializer(shift).data,
            'ringkasan': RingkasanShiftSerializer(ringkasan).data,
            'rincian': {
                **rincian,
                'aktual': kas_akhir,
                'selisih': ringkasan.selisih,
            },
        }, status=status.HTTP_201_CREATED)


class RingkasanShiftViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RingkasanShift.objects.all().order_by('-tanggal', '-mulai')
    serializer_class = RingkasanShiftSerializer
    permission_classes = [IsAuthenticated, IsOwnerManagerAdminOrKasir]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == 'kasir':
            queryset = queryset.filter(kasir=self.request.user)
        
        tanggal_mulai = self.request.query_params.get('tanggal_mulai')
        tanggal_akhir = self.request.query_params.get('tanggal_akhir')
        
        if tanggal_mulai:
            queryset = queryset.filter(tanggal__gte=tanggal_mulai)
        if tanggal_akhir:
            queryset = queryset.filter(tanggal__lte=tanggal_akhir)
            
        query = self.request.query_params.get('query')
        if query:
            queryset = queryset.filter(
                Q(kasir__username__icontains=query) |
                Q(kasir__first_name__icontains=query) |
                Q(kasir__last_name__icontains=query)
            )
        return queryset
