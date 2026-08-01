"""Perhitungan snapshot kas untuk Ringkasan Shift."""
from decimal import Decimal

from django.db.models import Sum

from ..finance_models import CashTransaction
from ..models import POSPaymentMethod
from ..pos_models import POSSale


def calculate_shift_cash_summary(shift):
    """Hitung komponen kas aktual yang terkait langsung dengan ``shift``."""
    nama_tunai = {
        (nama or '').lower()
        for nama in POSPaymentMethod.objects.filter(tipe='Tunai').values_list('nama', flat=True)
    }
    nama_tunai |= {'cash', 'tunai'}

    penjualan_tunai = Decimal('0')
    for sale in POSSale.objects.filter(shift=shift, status='paid'):
        if (sale.metode_bayar or '').lower() in nama_tunai:
            penjualan_tunai += Decimal(str(sale.total or 0))

    transaksi = CashTransaction.objects.filter(shift=shift)
    kas_masuk = transaksi.filter(arah='pendapatan').aggregate(total=Sum('jumlah'))['total'] or Decimal('0')
    kas_keluar = transaksi.filter(arah='pengeluaran').aggregate(total=Sum('jumlah'))['total'] or Decimal('0')
    kas_awal = Decimal(str(shift.kas_awal or 0))

    return {
        'kas_awal': kas_awal,
        'penjualan_tunai': penjualan_tunai,
        'kas_masuk': kas_masuk,
        'kas_keluar': kas_keluar,
        'expected': kas_awal + penjualan_tunai + kas_masuk - kas_keluar,
    }
