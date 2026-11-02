"""Metrik KPI karyawan dari data ERP (2026-11-02).

HR (modul KPI/OKR) memakai angka ini sebagai capaian otomatis sebuah Key Result,
dan dashboard ERP/CRM menampilkan hasilnya per karyawan. Semua angka dihitung
langsung dari tabel kerja, jadi begitu SPK diselesaikan atau penjualan tercatat,
angkanya ikut berubah pada pemanggilan berikutnya.

Definisi (sama dengan Timecard / Rekap Kinerja HR):
  spk_selesai  jumlah SPK berstatus selesai yang PIC-nya karyawan ini, waktu selesai di periode
  spk_gagal    jumlah SPK gagal di periode (tidak menambah capaian)
  insentif     jumlah JobBoard.insentif dari SPK selesai di periode
  omzet_kasir  penjualan kasir lunas (kasir atau pelayan = karyawan ini) + pesanan aktif yang
               dilayani karyawan ini, nilai rupiah, di periode
"""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from ..models import JobBoard, Order
from ..pos_models import POSSale

# Pesanan yang belum dianggap penjualan (belum disepakati / dibatalkan).
STATUS_ORDER_BUKAN_OMZET = ('draft', 'quotation', 'batal')


def _jendela(dari, sampai):
    awal = timezone.make_aware(datetime.combine(dari, time.min))
    akhir = timezone.make_aware(datetime.combine(sampai + timedelta(days=1), time.min))
    return awal, akhir


def hitung_metrik(user, dari, sampai):
    """Metrik `user` (CustomUser) untuk tanggal `dari`..`sampai` inklusif (zona waktu lokal)."""
    awal, akhir = _jendela(dari, sampai)

    job = JobBoard.objects.filter(pic_staff=user, waktu_selesai__gte=awal, waktu_selesai__lt=akhir)
    selesai = job.filter(status_pekerjaan='selesai')
    insentif = selesai.aggregate(t=Sum('insentif'))['t'] or 0

    penjualan = (
        POSSale.objects.filter(status='paid', created_at__gte=awal, created_at__lt=akhir)
        .filter(Q(dilayani_oleh=user) | Q(dilayani_oleh__isnull=True, kasir=user))
        .aggregate(t=Sum('total'))['t'] or Decimal('0')
    )
    pesanan = (
        Order.objects.filter(dilayani_oleh=user, waktu__gte=awal, waktu__lt=akhir)
        .exclude(status_global__in=STATUS_ORDER_BUKAN_OMZET)
        .aggregate(t=Sum('total_harga'))['t'] or 0
    )

    return {
        'spk_selesai': selesai.count(),
        'spk_gagal': job.filter(status_pekerjaan='gagal').count(),
        'insentif': int(insentif),
        'omzet_kasir': int(Decimal(penjualan) + Decimal(pesanan)),
    }
