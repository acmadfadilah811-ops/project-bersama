"""Papan Kerja Admin Finance & SPV Finance -- ringkasan agregat untuk kedua
role finance baru (2026-09-18). TIDAK pernah membuat/mengubah JournalEntry
apa pun (Aturan Engineering M2/L2) -- murni membaca RingkasanShift,
CashTransaction, dan Order (piutang) yang sudah ada, dikelompokkan untuk
kebutuhan verifikasi (Admin Finance) & pelaporan agregat (SPV Finance).
"""
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..finance_models import CashTransaction
from ..models import Order
from ..pos_models import RingkasanShift
from ..permissions import IsAdminFinanceOrOwnerManager, IsSpvFinanceOrOwnerManager

PIUTANG_LIMIT = 100


def _piutang_queryset():
    # Piutang = Order dengan sisa_tagihan > 0 yang belum batal. Order
    # 'selesai'/'ready' tetap bisa punya sisa_tagihan (barang sudah
    # diambil, pembayaran belum lunas) -- itu justru piutang paling
    # relevan buat ditagih, jadi TIDAK dikecualikan, cuma 'batal' yang
    # dikecualikan (order dibatalkan, piutangnya tidak relevan lagi).
    return Order.objects.filter(sisa_tagihan__gt=0).exclude(status_global='batal')


class AdminFinanceDashboardView(APIView):
    """GET /api/finance/dashboard-admin-finance/ -- antrean verifikasi
    (setoran kas shift + pengeluaran/kas kecil) dan daftar piutang jatuh
    tempo, buat Papan Kerja Admin Finance."""
    permission_classes = [IsAuthenticated, IsAdminFinanceOrOwnerManager]

    def get(self, request):
        antrean_shift = (
            RingkasanShift.objects.filter(status_verifikasi='menunggu')
            .select_related('kasir')
            .order_by('-tanggal', '-mulai')[:PIUTANG_LIMIT]
        )
        antrean_pengeluaran = (
            CashTransaction.objects.filter(
                diverifikasi_admin_finance_oleh__isnull=True, arah='pengeluaran',
            )
            .select_related('tipe_transaksi', 'staff')
            .order_by('-waktu')[:PIUTANG_LIMIT]
        )
        piutang = _piutang_queryset().order_by('waktu')[:PIUTANG_LIMIT]

        return Response({
            'antrean_shift_count': RingkasanShift.objects.filter(status_verifikasi='menunggu').count(),
            'antrean_shift': [
                {
                    'id': r.id,
                    'tanggal': r.tanggal,
                    'kasir_nama': r.kasir.get_full_name() or r.kasir.username if r.kasir else '-',
                    'expected': r.expected,
                    'aktual': r.aktual,
                    'selisih': r.selisih,
                    'keterangan': r.keterangan,
                }
                for r in antrean_shift
            ],
            'antrean_pengeluaran_count': CashTransaction.objects.filter(
                diverifikasi_admin_finance_oleh__isnull=True, arah='pengeluaran',
            ).count(),
            'antrean_pengeluaran': [
                {
                    'id': t.id,
                    'nomor': t.nomor,
                    'tipe_nama': t.tipe_transaksi.nama if t.tipe_transaksi_id else '-',
                    'jumlah': t.jumlah,
                    'staff_nama': t.staff.get_full_name() or t.staff.username if t.staff else '-',
                    'waktu': t.waktu,
                    'catatan': t.catatan,
                    'status': t.status,
                }
                for t in antrean_pengeluaran
            ],
            'piutang_count': _piutang_queryset().count(),
            'piutang': [
                {
                    'order_id': o.id,
                    'nama': o.nama,
                    'nomor_wa': o.nomor_wa,
                    'total_harga': o.total_harga,
                    'sisa_tagihan': o.sisa_tagihan,
                    'waktu': o.waktu,
                    'status_global': o.status_global,
                }
                for o in piutang
            ],
        })


class SpvFinanceDashboardView(APIView):
    """GET /api/finance/dashboard-spv-finance/ -- agregat HASIL yang sudah
    diverifikasi Admin Finance: kas tervalidasi, pengeluaran per tipe,
    umur piutang, dan daftar eskalasi (shift yang dipertanyakan)."""
    permission_classes = [IsAuthenticated, IsSpvFinanceOrOwnerManager]

    def get(self, request):
        hari_ini = timezone.localdate()
        awal_bulan = hari_ini.replace(day=1)

        shift_tervalidasi = RingkasanShift.objects.filter(
            status_verifikasi='diverifikasi', tanggal__gte=awal_bulan,
        )
        ringkasan_kas = shift_tervalidasi.aggregate(
            total_expected=Sum('expected'), total_aktual=Sum('aktual'), total_selisih=Sum('selisih'),
            jumlah_shift=Count('id'),
        )
        selisih_per_kasir = list(
            shift_tervalidasi.values('kasir__username')
            .annotate(total_selisih=Sum('selisih'), jumlah_shift=Count('id'))
            .order_by('-total_selisih')[:10]
        )

        pengeluaran_per_tipe = list(
            CashTransaction.objects.filter(
                arah='pengeluaran', diverifikasi_admin_finance_oleh__isnull=False, waktu__date__gte=awal_bulan,
            )
            .values('tipe_transaksi__nama')
            .annotate(total=Sum('jumlah'), jumlah=Count('id'))
            .order_by('-total')
        )

        piutang_qs = _piutang_queryset()
        buckets = {'0-30': 0, '31-60': 0, '61-90': 0, '90+': 0}
        buckets_nominal = {'0-30': 0, '31-60': 0, '61-90': 0, '90+': 0}
        for o in piutang_qs.only('waktu', 'sisa_tagihan'):
            umur = (timezone.now() - o.waktu).days
            key = '0-30' if umur <= 30 else '31-60' if umur <= 60 else '61-90' if umur <= 90 else '90+'
            buckets[key] += 1
            buckets_nominal[key] += o.sisa_tagihan

        eskalasi = list(
            RingkasanShift.objects.filter(status_verifikasi='dipertanyakan')
            .select_related('kasir', 'diverifikasi_oleh')
            .order_by('-diverifikasi_pada')[:PIUTANG_LIMIT]
        )

        return Response({
            'ringkasan_kas_tervalidasi': ringkasan_kas,
            'selisih_per_kasir': selisih_per_kasir,
            'pengeluaran_per_tipe': pengeluaran_per_tipe,
            'piutang_total_sisa': piutang_qs.aggregate(total=Sum('sisa_tagihan'))['total'] or 0,
            'piutang_aging': {
                key: {'jumlah': buckets[key], 'nominal': buckets_nominal[key]} for key in buckets
            },
            'eskalasi_count': len(eskalasi),
            'eskalasi': [
                {
                    'id': r.id,
                    'tanggal': r.tanggal,
                    'kasir_nama': r.kasir.get_full_name() or r.kasir.username if r.kasir else '-',
                    'selisih': r.selisih,
                    'catatan_verifikasi': r.catatan_verifikasi,
                    'diverifikasi_oleh_nama': (
                        r.diverifikasi_oleh.get_full_name() or r.diverifikasi_oleh.username
                        if r.diverifikasi_oleh else '-'
                    ),
                    'diverifikasi_pada': r.diverifikasi_pada,
                }
                for r in eskalasi
            ],
        })
