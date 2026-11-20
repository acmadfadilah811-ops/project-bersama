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

Tambahan 2026-11-14 (indikator KPI Karyawan HR, acuan file KPI owner):
  jumlah_order      jumlah transaksi kasir lunas + pesanan aktif yang dilayani karyawan ini
  omzet_divisi      pendapatan unit bisnis karyawan ini (definisi sama dengan Ringkasan)
  omzet_perusahaan  pendapatan semua unit bisnis
  produksi_m2       luas cetak (m2 x qty) dari SPK selesai yang PIC-nya karyawan ini
  produksi_qty      jumlah (qty) dari SPK selesai yang PIC-nya karyawan ini, mis. klik A3
  kesalahan         SPK gagal + tanggungan reorder human error atas nama karyawan ini
  kepuasan          rata-rata nilai survei pelanggan (1-5) dari transaksi yang dilayani; None bila belum ada
  akurasi_opname    akurasi stok opname yang diposting di periode, persen (semua gudang); None bila belum ada
"""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Avg, F, FloatField, Q, Sum
from django.db.models.functions import Abs
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

    jumlah_pos = (
        POSSale.objects.filter(status='paid', created_at__gte=awal, created_at__lt=akhir)
        .filter(Q(dilayani_oleh=user) | Q(dilayani_oleh__isnull=True, kasir=user)).count()
    )
    jumlah_pesanan = (
        Order.objects.filter(dilayani_oleh=user, waktu__gte=awal, waktu__lt=akhir)
        .exclude(status_global__in=STATUS_ORDER_BUKAN_OMZET).count()
    )
    produksi = selesai.filter(order_item__isnull=False).aggregate(
        m2=Sum(F('order_item__luas') * F('order_item__qty'), output_field=FloatField()),
        qty=Sum('order_item__qty'),
    )
    spk_gagal = job.filter(status_pekerjaan='gagal').count()

    return {
        'spk_selesai': selesai.count(),
        'spk_gagal': spk_gagal,
        'insentif': int(insentif),
        'omzet_kasir': int(Decimal(penjualan) + Decimal(pesanan)),
        'jumlah_order': jumlah_pos + jumlah_pesanan,
        'omzet_divisi': _omzet_divisi(user, dari, sampai),
        'omzet_perusahaan': _omzet_perusahaan(dari, sampai),
        'produksi_m2': round(float(produksi['m2'] or 0), 2),
        'produksi_qty': float(produksi['qty'] or 0),
        'kesalahan': spk_gagal + _tanggungan_reorder(user, awal, akhir),
        'kepuasan': _kepuasan(user, awal, akhir),
        'akurasi_opname': _akurasi_opname(dari, sampai),
    }


def _omzet_perusahaan(dari, sampai):
    from ..executive_dashboard import _pendapatan

    return int(_pendapatan(dari, sampai))


def _omzet_divisi(user, dari, sampai):
    """Pendapatan unit bisnis karyawan; 0 bila akun belum bertanda unit bisnis."""
    if not getattr(user, 'unit_bisnis_id', None):
        return 0
    from ..executive_dashboard import _pendapatan_per_unit

    nilai, _jumlah = _pendapatan_per_unit(dari, sampai).get(user.unit_bisnis_id, (0, 0))
    return int(nilai)


def _tanggungan_reorder(user, awal, akhir):
    from ..reorder_models import TanggunganReorder

    return TanggunganReorder.objects.filter(staff=user, dibuat__gte=awal, dibuat__lt=akhir).count()


def _kepuasan(user, awal, akhir):
    from ..survei_models import SurveiKepuasan

    qs = SurveiKepuasan.objects.filter(dibuat_pada__gte=awal, dibuat_pada__lt=akhir).filter(
        Q(pos_sale__dilayani_oleh=user)
        | Q(pos_sale__dilayani_oleh__isnull=True, pos_sale__kasir=user)
        | Q(order__dilayani_oleh=user)
    )
    rata = qs.aggregate(r=Avg('rata_rata'))['r']
    return round(float(rata), 2) if rata is not None else None


def _akurasi_opname(dari, sampai):
    """100 - (total selisih qty / total qty sistem x 100) untuk opname yang diposting di periode."""
    from ..product_models import StockOpnameDocumentItem

    agg = StockOpnameDocumentItem.objects.filter(
        document__waktu_diposting__isnull=False, document__tanggal__range=(dari, sampai),
    ).aggregate(sistem=Sum('stok_sistem'), selisih=Sum(Abs(F('stok_aktual') - F('stok_sistem'))))
    sistem = float(agg['sistem'] or 0)
    if sistem <= 0:
        return None
    return round(max(0.0, 100 - float(agg['selisih'] or 0) / sistem * 100), 2)
