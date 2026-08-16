"""Perhitungan snapshot kas untuk Ringkasan Shift."""
from decimal import Decimal

from django.db.models import Sum

from ..finance_models import CashTransaction
from ..models import POSPaymentMethod, OrderPayment
from ..pos_models import POSSale


def calculate_shift_cash_summary(shift):
    """Hitung kas fisik dan rekap semua metode pembayaran pada ``shift``."""
    payment_methods = list(POSPaymentMethod.objects.filter(is_active=True).order_by('urutan', 'id'))
    by_name = {(method.nama or '').casefold(): method for method in payment_methods}
    by_type = {}
    for method in payment_methods:
        by_type.setdefault((method.tipe or '').casefold(), method)

    def resolve_method(raw_method):
        raw = str(raw_method or '').strip()
        key = raw.casefold()
        method = by_name.get(key) or by_type.get(key)
        if method:
            return method.nama, method.tipe
        if key in {'cash', 'tunai'}:
            return 'Tunai', 'Tunai'
        return raw or 'Lainnya', 'Lainnya'

    rekap = {}

    def add_payment(raw_method, amount, source):
        label, tipe = resolve_method(raw_method)
        key = label.casefold()
        row = rekap.setdefault(key, {
            'metode': label,
            'tipe': tipe,
            'total': Decimal('0'),
            'pos': Decimal('0'),
            'order': Decimal('0'),
        })
        amount = Decimal(str(amount or 0))
        row['total'] += amount
        row[source] += amount

    penjualan_tunai = Decimal('0')
    for sale in POSSale.objects.filter(shift=shift, status='paid'):
        add_payment(sale.metode_bayar, sale.total, 'pos')
        _, tipe = resolve_method(sale.metode_bayar)
        if tipe.casefold() == 'tunai':
            penjualan_tunai += Decimal(str(sale.total or 0))

    # DP dan pelunasan Order yang dicatat oleh kasir pada shift aktif juga
    # merupakan uang fisik di laci bila metodenya tunai.
    for payment in OrderPayment.objects.filter(shift=shift):
        add_payment(payment.metode_pembayaran, payment.jumlah, 'order')
        _, tipe = resolve_method(payment.metode_pembayaran)
        if tipe.casefold() == 'tunai':
            penjualan_tunai += Decimal(str(payment.jumlah or 0))

    rincian_metode = [
        {
            **row,
            'total': format(row['total'], '.2f'),
            'pos': format(row['pos'], '.2f'),
            'order': format(row['order'], '.2f'),
        }
        for row in sorted(rekap.values(), key=lambda row: (row['tipe'], row['metode']))
    ]

    transaksi = CashTransaction.objects.filter(shift=shift)
    kas_masuk = transaksi.filter(arah='pendapatan').aggregate(total=Sum('jumlah'))['total'] or Decimal('0')
    kas_keluar = transaksi.filter(arah='pengeluaran').aggregate(total=Sum('jumlah'))['total'] or Decimal('0')
    kas_awal = Decimal(str(shift.kas_awal or 0))

    return {
        'kas_awal': kas_awal,
        'penjualan_tunai': penjualan_tunai,
        'kas_masuk': kas_masuk,
        'kas_keluar': kas_keluar,
        'rincian_metode': rincian_metode,
        'expected': kas_awal + penjualan_tunai + kas_masuk - kas_keluar,
    }
