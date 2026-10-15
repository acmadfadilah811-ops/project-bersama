import calendar
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Sum, Count, Q, F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..permissions import IsOwnerOrManager, filter_param_unit_bisnis

from ..models import Order, OrderItem, JobBoard, CustomUser, InventoryItem
from ..pos_models import POSSale

PERIODE_LEADERBOARD = ('bulan_ini', 'bulan_lalu', 'semua')


def _rentang_periode(periode, now):
    awal_bulan = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if periode == 'bulan_lalu':
        awal_lalu = (awal_bulan - timedelta(days=1)).replace(day=1)
        return awal_lalu, awal_bulan
    if periode == 'semua':
        return None, None
    return awal_bulan, None


def hitung_leaderboard(periode='bulan_ini', request=None, batas=10):
    """Peringkat staff & kordiv aktif menurut SPK selesai pada periode (2026-10-15).

    Dulu hanya role 'staff', sepanjang masa, akun nonaktif ikut, dan username yang
    tampil. Unit = unit bisnis akun (?unit_bisnis= seperti halaman Pesanan)."""
    mulai, sampai = _rentang_periode(periode, timezone.localtime(timezone.now()))
    syarat = Q(my_tasks__status_pekerjaan='selesai')
    if mulai:
        syarat &= Q(my_tasks__waktu_selesai__gte=mulai)
    if sampai:
        syarat &= Q(my_tasks__waktu_selesai__lt=sampai)
    qs = CustomUser.objects.filter(role__in=['staff', 'kordiv'], is_active=True)
    if request is not None:
        qs = filter_param_unit_bisnis(qs, request)
    qs = qs.select_related('unit_bisnis', 'divisi').annotate(
        jumlah_job_selesai=Count('my_tasks', filter=syarat),
        total_insentif=Sum('my_tasks__insentif', filter=syarat),
    ).filter(jumlah_job_selesai__gt=0).order_by('-jumlah_job_selesai', '-total_insentif', 'username')[:batas]
    return [
        {
            'id': u.id,
            'nama': u.get_full_name() or u.username,
            'username': u.username,
            'role': u.role,
            'jabatan': u.posisi or (u.divisi.nama if u.divisi_id else ''),
            'unit_bisnis': u.unit_bisnis_id,
            'unit_bisnis_nama': u.unit_bisnis.nama if u.unit_bisnis_id else '',
            'jumlah_job_selesai': u.jumlah_job_selesai,
            'total_insentif': u.total_insentif or 0,
        }
        for u in qs
    ]


class LeaderboardStaffView(APIView):
    """GET /api/dashboard/leaderboard/?periode=bulan_ini|bulan_lalu|semua&unit_bisnis=<id|none>"""
    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        periode = request.query_params.get('periode') or 'bulan_ini'
        if periode not in PERIODE_LEADERBOARD:
            periode = 'bulan_ini'
        return Response({'periode': periode, 'hasil': hitung_leaderboard(periode, request)})


class DashboardView(APIView):
    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        cache_key = f"dashboard_data:{request.user.role}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # Ambil waktu sekarang sesuai timezone lokal
        now = timezone.localtime(timezone.now())
        
        # 1. Rentang waktu hari ini
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # 2. Rentang waktu bulan ini
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Cari hari terakhir di bulan ini
        _, last_day = calendar.monthrange(now.year, now.month)
        month_end = now.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)

        # --- Total Order ---
        # Ganti __date dan __month dengan rentang (__gte, __lt) agar aman di SQLite
        total_order_hari_ini = Order.objects.filter(waktu__gte=today_start, waktu__lt=today_end).count()
        total_order_bulan_ini = Order.objects.filter(waktu__gte=month_start, waktu__lte=month_end).count()

        # --- Omset ---
        # Omset = penjualan dari SEMUA kanal kasir, bukan cuma pesanan (Order):
        # - OrderItem: pesanan WA/DP, TAPI order yang dibatalkan bukan penjualan
        #   nyata jadi dikeluarkan dari total.
        # - POSSale: transaksi kasir langsung (walk-in) yang tidak pernah
        #   tertaut ke Order sama sekali — sebelumnya tidak pernah ikut
        #   terhitung di sini sehingga omset dashboard selalu lebih kecil dari
        #   omset nyata begitu ada transaksi POS.
        def _omset_periode(start, end):
            order_total = OrderItem.objects.filter(
                order__waktu__gte=start,
                order__waktu__lte=end,
            ).exclude(order__status_global='batal').aggregate(total=Sum('harga_jual'))['total'] or 0
            pos_total = POSSale.objects.filter(
                status='paid',
                created_at__gte=start,
                created_at__lte=end,
            ).aggregate(total=Sum('total'))['total'] or 0
            return order_total + pos_total

        omset_bulan_ini = _omset_periode(month_start, month_end)

        # --- Omset 6 Bulan Terakhir (Untuk Grafik) ---
        omset_6_bulan = []
        for i in range(5, -1, -1):
            target_month = now.month - i
            target_year = now.year
            if target_month <= 0:
                target_month += 12
                target_year -= 1

            # Tentukan rentang waktu untuk bulan target
            m_start = now.replace(year=target_year, month=target_month, day=1, hour=0, minute=0, second=0, microsecond=0)
            _, m_last_day = calendar.monthrange(target_year, target_month)
            m_end = now.replace(year=target_year, month=target_month, day=m_last_day, hour=23, minute=59, second=59, microsecond=999999)

            nama_bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"][target_month - 1]

            omset_6_bulan.append({
                'bulan': f"{nama_bulan}",
                'total': _omset_periode(m_start, m_end)
            })

        # --- Distribusi Status Order ---
        order_per_status = {
            s: Order.objects.filter(status_global=s).count()
            for s in ['review', 'desain', 'proses', 'ready', 'selesai', 'batal']
        }

        # --- Distribusi Status Job ---
        job_per_status = {
            s: JobBoard.objects.filter(status_pekerjaan=s).count()
            for s in ['antrean', 'dikerjakan', 'selesai', 'gagal', 'kendala']
        }

        # --- Top Staff bulan ini (staff & kordiv aktif; sama dengan leaderboard) ---
        top_staff = hitung_leaderboard('bulan_ini', batas=5)

        # --- Stok Kritis (stok di bawah minimum) ---
        stok_kritis_qs = InventoryItem.objects.filter(stok__lt=F('min_stok'))
        stok_kritis = [
            {
                'nama': item.nama,
                'stok': item.stok,
                'min_stok': item.min_stok,
                'satuan': item.satuan,
            }
            for item in stok_kritis_qs
        ]

        data = {
            'total_order_hari_ini': total_order_hari_ini,
            'total_order_bulan_ini': total_order_bulan_ini,
            'omset_bulan_ini': omset_bulan_ini,
            'omset_6_bulan': omset_6_bulan,
            'order_per_status': order_per_status,
            'job_per_status': job_per_status,
            'top_staff': top_staff,
            'stok_kritis': stok_kritis,
        }
        cache.set(cache_key, data, timeout=300)
        return Response(data)
