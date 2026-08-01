"""Query baca-saja untuk seluruh Laporan Pembelian.

Tidak ada jurnal, stok, atau dokumen pembelian yang diubah di sini. Semua nilai
uang dihitung dari PurchaseItem dan PurchasePayment dengan Decimal.
"""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Q

from api.product_models import Product, Purchase, PurchaseItem, PurchasePayment
from api.services.purchase_report_schema import REPORT_COLUMNS


ZERO = Decimal('0')


def _columns(report_id):
    try:
        return [
            {'key': key, 'label': label, 'type': value_type}
            for key, label, value_type in REPORT_COLUMNS[report_id]
        ]
    except KeyError as exc:
        raise ValueError('Jenis laporan pembelian tidak tersedia.') from exc


def _name(user):
    if not user:
        return ''
    return (f'{user.first_name} {user.last_name}'.strip() or user.username)


def _purchase_total(purchase):
    return sum((item.qty * item.harga_beli for item in purchase.items.all()), start=ZERO)


def _paid_total(purchase):
    return sum((payment.nominal for payment in purchase.payments.all()), start=ZERO)


def _supplier_name(purchase):
    return purchase.supplier_ref.nama if purchase.supplier_ref else purchase.supplier


def _supplier_email(purchase):
    return purchase.supplier_ref.email if purchase.supplier_ref else ''


def _apply_date(queryset, start, end, field='tanggal'):
    if start:
        queryset = queryset.filter(**{f'{field}__gte': start})
    if end:
        queryset = queryset.filter(**{f'{field}__lte': end})
    return queryset


def _purchase_queryset(*, start, end, search, returns=False):
    queryset = (
        Purchase.objects.filter(is_retur=returns).exclude(status='batal')
        .select_related('dibuat_oleh', 'supplier_ref')
        .prefetch_related('items__product', 'items__variant', 'payments')
        .order_by('-tanggal', '-id')
    )
    queryset = _apply_date(queryset, start, end)
    if search:
        queryset = queryset.filter(
            Q(nomor__icontains=search) | Q(supplier__icontains=search)
            | Q(supplier_ref__nama__icontains=search)
        )
    return queryset


def _summary(label, value):
    return {'items': [{'label': label, 'value': value, 'type': 'money'}]}


def _rincian(start, end, search):
    rows = []
    total = ZERO
    for purchase in _purchase_queryset(start=start, end=end, search=search):
        subtotal = _purchase_total(purchase)
        paid = _paid_total(purchase)
        total += subtotal
        rows.append({
            'no_pembelian': purchase.nomor,
            'tanggal': purchase.tanggal,
            'pembelian_oleh': _name(purchase.dibuat_oleh),
            'tanggal_diterima': purchase.tanggal_diterima,
            'no_terima': purchase.no_terima,
            'supplier': _supplier_name(purchase),
            'subtotal': subtotal,
            'total_dibayar': paid,
            'sisa': subtotal - paid,
            'status': purchase.payment_status,
        })
    return rows, _summary('Total Pembelian', total)


def _per_tanggal(start, end, search):
    grouped = defaultdict(Decimal)
    for purchase in _purchase_queryset(start=start, end=end, search=search):
        grouped[purchase.tanggal] += _purchase_total(purchase)
    rows = [{'tanggal': date, 'total': total} for date, total in sorted(grouped.items(), reverse=True)]
    return rows, _summary('Total Pembelian', sum(grouped.values(), start=ZERO))


def _item_per_tanggal(start, end, search):
    rows = []
    total = ZERO
    for purchase in _purchase_queryset(start=start, end=end, search=search):
        for item in purchase.items.all():
            subtotal = item.qty * item.harga_beli
            total += subtotal
            rows.append({
                'tanggal': purchase.tanggal,
                'produk': item.product.nama,
                'sku': item.variant.sku if item.variant and item.variant.sku else item.product.sku,
                'qty': item.qty,
                'harga_beli': item.harga_beli,
                'subtotal': subtotal,
            })
    return rows, _summary('Total Item Pembelian', total)


def _per_supplier(start, end, search):
    grouped = {}
    for purchase in _purchase_queryset(start=start, end=end, search=search):
        key = (_supplier_name(purchase), _supplier_email(purchase))
        grouped[key] = grouped.get(key, ZERO) + _purchase_total(purchase)
    rows = [
        {'supplier': supplier, 'email': email, 'total': total}
        for (supplier, email), total in sorted(grouped.items(), key=lambda item: item[0][0].lower())
    ]
    return rows, _summary('Total Pembelian', sum(grouped.values(), start=ZERO))


def _per_pembeli(start, end, search):
    grouped = defaultdict(Decimal)
    for purchase in _purchase_queryset(start=start, end=end, search=search):
        grouped[(purchase.tanggal, _name(purchase.dibuat_oleh))] += _purchase_total(purchase)
    rows = [
        {'tgl_beli': date, 'staff': staff, 'total': total}
        for (date, staff), total in sorted(grouped.items(), reverse=True)
    ]
    return rows, _summary('Total Pembelian', sum(grouped.values(), start=ZERO))


def _retur_per_tanggal(start, end, search):
    rows = []
    total = ZERO
    for purchase in _purchase_queryset(start=start, end=end, search=search, returns=True):
        for item in purchase.items.all():
            subtotal = item.qty * item.harga_beli
            total += subtotal
            rows.append({
                'no_pengembalian': purchase.nomor,
                'tanggal': purchase.tanggal,
                'harga_satuan': item.harga_beli,
                'qty': item.qty,
                'total': subtotal,
            })
    return rows, _summary('Total Retur Pembelian', total)


def _retur_per_supplier(start, end, search):
    rows = []
    total = ZERO
    for purchase in _purchase_queryset(start=start, end=end, search=search, returns=True):
        purchase_total = _purchase_total(purchase)
        total += purchase_total
        rows.append({
            'no_pengembalian': purchase.nomor,
            'supplier': _supplier_name(purchase),
            'email': _supplier_email(purchase),
            'total': purchase_total,
        })
    return rows, _summary('Total Retur Pembelian', total)


def _belum_lunas(start, end, search):
    rows = []
    outstanding = ZERO
    for purchase in _purchase_queryset(start=start, end=end, search=search).exclude(payment_status='lunas'):
        total = _purchase_total(purchase)
        paid = _paid_total(purchase)
        remaining = total - paid
        outstanding += remaining
        rows.append({
            'no_pembelian': purchase.nomor,
            'tanggal': purchase.tanggal,
            'supplier': _supplier_name(purchase),
            'total': total,
            'telah_dibayar': paid,
            'sisa': remaining,
            'jatuh_tempo': purchase.jatuh_tempo,
        })
    return rows, _summary('Total Sisa Tagihan', outstanding)


def _pembayaran(start, end, search):
    payments = PurchasePayment.objects.select_related('purchase__supplier_ref').order_by('-tanggal', '-id')
    payments = _apply_date(payments, start, end)
    if search:
        payments = payments.filter(
            Q(purchase__nomor__icontains=search) | Q(purchase__supplier__icontains=search)
            | Q(purchase__supplier_ref__nama__icontains=search)
        )
    rows = []
    total = ZERO
    for payment in payments:
        if payment.purchase.is_retur or payment.purchase.status == 'batal':
            continue
        total += payment.nominal
        rows.append({
            'no_pembelian': payment.purchase.nomor,
            'tanggal': payment.tanggal,
            'supplier': _supplier_name(payment.purchase),
            'metode': payment.metode,
            'nominal': payment.nominal,
            'catatan': payment.catatan,
        })
    return rows, _summary('Total Pembayaran Pembelian', total)


def _rekomendasi(start, end, search):
    in_transit = defaultdict(Decimal)
    pending_items = PurchaseItem.objects.filter(
        purchase__is_retur=False,
        purchase__receive_status='tunda',
    ).exclude(purchase__status='batal')
    for item in pending_items:
        in_transit[item.product_id] += item.qty

    products = Product.objects.select_related('kategori').all().order_by('nama')
    if search:
        products = products.filter(Q(nama__icontains=search) | Q(sku__icontains=search))
    rows = []
    for product in products:
        stock = product.qty_stok or ZERO
        minimum = product.stok_minimum or ZERO
        shortage = max(ZERO, minimum - stock - in_transit[product.id])
        if shortage <= ZERO and in_transit[product.id] <= ZERO:
            continue
        rows.append({
            'nama_produk': product.nama,
            'kategori_produk': product.kategori.nama if product.kategori else 'Umum',
            'harga_beli': product.harga_beli,
            'sedang_dikirim': in_transit[product.id],
            'qty_stok': stock,
            'kekurangan_stok': shortage,
        })
    return rows, {'items': [
        {'label': 'Produk Perlu Dibeli', 'value': len(rows), 'type': 'qty'},
        {'label': 'Total Kekurangan Stok', 'value': sum((row['kekurangan_stok'] for row in rows), start=ZERO), 'type': 'qty'},
    ]}


REPORT_HANDLERS = {
    'rincian-pembelian': _rincian,
    'pembelian-tanggal': _per_tanggal,
    'item-pembelian-tanggal': _item_per_tanggal,
    'pembelian-supplier': _per_supplier,
    'pembelian-pembeli': _per_pembeli,
    'retur-pembelian-tanggal': _retur_per_tanggal,
    'retur-pembelian-supplier': _retur_per_supplier,
    'pembayaran-belum-lunas': _belum_lunas,
    'pembayaran-pembelian': _pembayaran,
    'rekomendasi-pembelian': _rekomendasi,
}


def build_purchase_report(report_id, *, start=None, end=None, search=''):
    """Kembalikan kontrak tabel laporan untuk satu laporan pembelian."""
    try:
        rows, summary = REPORT_HANDLERS[report_id](start, end, search)
    except KeyError as exc:
        raise ValueError('Jenis laporan pembelian tidak tersedia.') from exc
    return {'columns': _columns(report_id), 'rows': rows, 'summary': summary}
