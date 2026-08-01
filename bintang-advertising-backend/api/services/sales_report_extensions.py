"""Laporan penjualan tambahan yang hanya membaca sumber transaksi yang tercatat.

Laporan dengan dimensi yang tidak ada di model (marketplace, meja, perangkat,
alamat, dan deposit) sengaja tidak didaftarkan di sini.
"""
from collections import defaultdict

from api.finance_models import CashTransaction
from api.models import Order, OrderItem, PengembalianOrder
from api.pos_models import POSSale, POSSaleItem


EXTENDED_REPORT_REGISTRY = {}


def report(report_id, label, columns):
    def decorate(handler):
        EXTENDED_REPORT_REGISTRY[report_id] = {
            'handler': handler,
            'label': label,
            'columns': [
                {'key': key, 'label': column_label, 'type': column_type}
                for key, column_label, column_type in columns
            ],
        }
        return handler
    return decorate


def _num(value):
    return float(value or 0)


def _user_name(user):
    if not user:
        return ''
    return f'{user.first_name} {user.last_name}'.strip() or user.username


def _date_range(queryset, params, field):
    if params['start']:
        queryset = queryset.filter(**{f'{field}__date__gte': params['start']})
    if params['end']:
        queryset = queryset.filter(**{f'{field}__date__lte': params['end']})
    return queryset


def _pos_sales(params, status='paid'):
    queryset = POSSale.objects.filter(status=status).select_related(
        'kasir', 'dilayani_oleh', 'pelanggan', 'kupon'
    ).prefetch_related('items__product')
    return _date_range(queryset, params, 'created_at')


def _orders(params, statuses=('selesai',)):
    queryset = Order.objects.filter(status_global__in=statuses).select_related(
        'dilayani_oleh', 'kupon'
    ).prefetch_related('items__product')
    return _date_range(queryset, params, 'waktu')


def _summary(rows, key='total_penjualan'):
    return {'rows': [{'mata_uang': 'IDR', key: sum(_num(row.get(key)) for row in rows)}]}


@report('loyalti-point', 'Rincian Penggunaan Loyalti Point', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal_jual', 'Tanggal Jual', 'date'),
    ('tanggal_pembayaran', 'Tanggal Pembayaran', 'date'), ('penjualan_oleh', 'Penjualan Oleh', 'text'),
    ('id_pelanggan', 'ID Pelanggan', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('type_loyalti', 'Tipe Loyalti Point', 'text'), ('tebus_point', 'Tebus Point', 'qty'),
    ('tebus_diskon', 'Tebus Diskon', 'money'), ('tebus_item_gratis', 'Tebus Item Gratis', 'money'),
    ('qty_item_gratis', 'Qty Item Gratis', 'qty'), ('total_penjualan', 'Total Penjualan', 'money'),
])
def loyalty_point(params):
    rows = []
    for sale in _pos_sales(params).filter(poin_ditebus__gt=0):
        rows.append({
            'no_pesanan': sale.nomor, 'tanggal_jual': sale.created_at.date().isoformat(),
            'tanggal_pembayaran': sale.created_at.date().isoformat(), 'penjualan_oleh': _user_name(sale.kasir),
            'id_pelanggan': sale.pelanggan_id or '', 'pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
            'type_loyalti': 'Penukaran poin', 'tebus_point': sale.poin_ditebus,
            'tebus_diskon': _num(sale.diskon_loyalti), 'tebus_item_gratis': 0,
            'qty_item_gratis': 0, 'total_penjualan': _num(sale.total),
        })
    return {'rows': rows, 'summary': _summary(rows)}


@report('pending-pos', 'Rincian Penjualan Pending POS', [
    ('catatan', 'Catatan', 'text'), ('tanggal_jual', 'Tanggal Jual', 'date'),
    ('dilayani_oleh', 'Dilayani Oleh', 'text'), ('pelanggan_id', 'Pelanggan ID', 'text'),
    ('pelanggan', 'Pelanggan', 'text'), ('total', 'Total', 'money'),
])
def pending_pos(params):
    rows = [{
        'catatan': sale.catatan, 'tanggal_jual': sale.created_at.date().isoformat(),
        'dilayani_oleh': _user_name(sale.dilayani_oleh) or _user_name(sale.kasir),
        'pelanggan_id': sale.pelanggan_id or '', 'pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
        'total': _num(sale.total),
    } for sale in _pos_sales(params, 'hold')]
    return {'rows': rows, 'summary': _summary(rows, 'total')}


@report('item-pending-pos', 'Item Pending POS berdasarkan Tanggal', [
    ('catatan', 'Catatan', 'text'), ('tanggal_jual', 'Tanggal Jual', 'date'),
    ('pelanggan_id', 'Pelanggan ID', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('penjualan_oleh', 'Penjualan Oleh', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_pesanan', 'Total Pesanan', 'money'),
])
def item_pending_pos(params):
    rows = []
    for sale in _pos_sales(params, 'hold'):
        for item in sale.items.all():
            rows.append({
                'catatan': sale.catatan, 'tanggal_jual': sale.created_at.date().isoformat(),
                'pelanggan_id': sale.pelanggan_id or '', 'pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
                'penjualan_oleh': _user_name(sale.kasir), 'item': item.nama_snapshot,
                'qty': _num(item.qty), 'total_pesanan': _num(item.subtotal),
            })
    return {'rows': rows, 'summary': _summary(rows, 'total_pesanan')}


def _paid_rows(params):
    rows = []
    for sale in _pos_sales(params):
        modal = sum(_num(item.product.harga_beli) * _num(item.qty) for item in sale.items.all() if item.product)
        rows.append({
            'no_pesanan': sale.nomor, 'tanggal': sale.created_at.date().isoformat(),
            'penjualan_oleh': _user_name(sale.kasir), 'pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
            'total_penjualan': _num(sale.total), 'pengiriman_pajak': _num(sale.pajak),
            'modal_produk': modal, 'laba': _num(sale.total) - modal, 'biaya_layanan': 0,
            'diskon': _num(sale.diskon), 'diskon_penjualan': _num(sale.diskon_penjualan),
        })
    for order in _orders(params):
        modal = sum(_num(item.biaya_bahan) for item in order.items.all())
        rows.append({
            'no_pesanan': order.id, 'tanggal': order.waktu.date().isoformat(),
            'penjualan_oleh': _user_name(order.dilayani_oleh), 'pelanggan': order.nama,
            'total_penjualan': _num(order.total_harga), 'pengiriman_pajak': 0,
            'modal_produk': modal, 'laba': _num(order.total_harga) - modal, 'biaya_layanan': 0,
            'diskon': _num(order.total_harga) * _num(order.diskon_persen) / 100, 'diskon_penjualan': 0,
        })
    return rows


@report('berdasarkan-jam', 'Rincian Penjualan berdasarkan Jam', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal', 'Tanggal', 'date'),
    ('penjualan_oleh', 'Penjualan Oleh', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('total_penjualan', 'Total Penjualan', 'money'), ('pengiriman_pajak', 'Pengiriman + Pajak', 'money'),
    ('modal_produk', 'Modal Produk', 'money'), ('laba', 'Laba', 'money'),
    ('biaya_layanan', 'Biaya Layanan', 'money'), ('diskon_penjualan', 'Diskon Penjualan', 'money'),
])
def sales_by_hour(params):
    rows = _paid_rows(params)
    return {'rows': rows, 'summary': _summary(rows)}


@report('penjualan-tanggal', 'Penjualan berdasarkan Tanggal', [
    ('tanggal', 'Tanggal', 'date'), ('jumlah', 'Jumlah', 'money'),
])
def sales_by_date(params):
    grouped = defaultdict(float)
    for row in _paid_rows(params):
        grouped[row['tanggal']] += _num(row['total_penjualan'])
    rows = [{'tanggal': date, 'jumlah': total} for date, total in sorted(grouped.items(), reverse=True)]
    return {'rows': rows, 'summary': {'items': [{'label': 'Jumlah', 'value': sum(grouped.values()), 'type': 'money'}]}}


@report('penjualan-pelanggan', 'Penjualan berdasarkan Pelanggan', [
    ('sumber_penjualan', 'Sumber Penjualan', 'text'), ('tipe_pelanggan', 'Tipe Pelanggan', 'text'),
    ('pelanggan', 'Pelanggan', 'text'), ('total_penjualan', 'Total Penjualan', 'money'),
    ('biaya_pengiriman', 'Biaya Pengiriman', 'money'),
    ('total_minus_pengiriman', 'Total Penjualan - Biaya Pengiriman', 'money'),
])
def sales_by_customer(params):
    grouped = defaultdict(float)
    for row in _paid_rows(params):
        grouped[row['pelanggan'] or 'Tanpa pelanggan'] += _num(row['total_penjualan'])
    rows = [{'sumber_penjualan': 'Order/POS', 'tipe_pelanggan': '', 'pelanggan': name,
             'total_penjualan': total, 'biaya_pengiriman': 0, 'total_minus_pengiriman': total}
            for name, total in sorted(grouped.items())]
    return {'rows': rows, 'summary': _summary(rows)}


@report('pengeluaran-tanggal', 'Pengeluaran berdasarkan Tanggal', [
    ('no_transaksi', 'No. Transaksi', 'text'), ('tanggal', 'Tanggal', 'date'),
    ('tipe', 'Tipe', 'text'), ('staff', 'Staff', 'text'), ('deskripsi', 'Deskripsi', 'text'),
    ('jumlah', 'Jumlah', 'money'),
])
def expenses_by_date(params):
    queryset = CashTransaction.objects.filter(arah='pengeluaran', status='selesai').select_related('tipe_transaksi', 'staff')
    queryset = _date_range(queryset, params, 'waktu')
    rows = [{'no_transaksi': txn.nomor, 'tanggal': txn.waktu.date().isoformat(),
             'tipe': txn.tipe_transaksi.nama, 'staff': _user_name(txn.staff),
             'deskripsi': txn.catatan, 'jumlah': _num(txn.jumlah)} for txn in queryset]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pengeluaran': sum(_num(r['jumlah']) for r in rows)}]}}


@report('penjualan-pendapatan-pengeluaran', 'Penjualan + Pendapatan/Pengeluaran', [
    ('no', 'No', 'text'), ('tanggal', 'Tanggal', 'date'), ('tipe', 'Tipe', 'text'),
    ('pendapatan', 'Pendapatan', 'money'), ('pengeluaran', 'Pengeluaran', 'money'), ('total', 'Total', 'money'),
])
def sales_income_expense(params):
    grouped = defaultdict(lambda: {'pendapatan': 0.0, 'pengeluaran': 0.0})
    for row in _paid_rows(params):
        grouped[row['tanggal']]['pendapatan'] += _num(row['total_penjualan'])
    cash = _date_range(CashTransaction.objects.filter(status='selesai'), params, 'waktu')
    for txn in cash:
        grouped[txn.waktu.date().isoformat()][txn.arah] += _num(txn.jumlah)
    rows = [{'no': index + 1, 'tanggal': date, 'tipe': 'Transaksi', **amounts,
             'total': amounts['pendapatan'] - amounts['pengeluaran']}
            for index, (date, amounts) in enumerate(sorted(grouped.items(), reverse=True))]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR',
        'total_pendapatan': sum(r['pendapatan'] for r in rows),
        'total_pengeluaran': sum(r['pengeluaran'] for r in rows),
        'jumlah': sum(r['total'] for r in rows)}]}}


@report('penjualan-kredit', 'Rincian Penjualan Kredit', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal', 'Tanggal', 'date'),
    ('penjualan_oleh', 'Penjualan Oleh', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('total_penjualan', 'Total Penjualan', 'money'), ('pengiriman_pajak', 'Pengiriman + Pajak', 'money'),
    ('modal_produk', 'Modal Produk', 'money'), ('laba', 'Laba', 'money'),
    ('biaya_layanan', 'Biaya Layanan', 'money'), ('diskon', 'Diskon', 'money'),
])
def credit_sales(params):
    rows = []
    for order in _orders(params).filter(metode_pembayaran__iexact='kredit'):
        modal = sum(_num(item.biaya_bahan) for item in order.items.all())
        total = _num(order.total_harga)
        rows.append({
            'no_pesanan': order.id, 'tanggal': order.waktu.date().isoformat(),
            'penjualan_oleh': _user_name(order.dilayani_oleh), 'pelanggan': order.nama,
            'total_penjualan': total, 'pengiriman_pajak': 0, 'modal_produk': modal,
            'laba': total - modal, 'biaya_layanan': 0,
            'diskon': total * _num(order.diskon_persen) / 100,
        })
    return {'rows': rows, 'summary': _summary(rows)}


@report('pembatalan-penjualan', 'Rincian Pembatalan Penjualan', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal_jual', 'Tanggal Jual', 'date'),
    ('penjualan_oleh', 'Penjualan Oleh', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('jumlah', 'Jumlah', 'money'), ('catatan', 'Catatan', 'text'),
])
def cancelled_sales(params):
    rows = [{'no_pesanan': order.id, 'tanggal_jual': order.waktu.date().isoformat(),
             'penjualan_oleh': _user_name(order.dilayani_oleh), 'pelanggan': order.nama,
             'jumlah': _num(order.total_harga), 'catatan': order.catatan_pelanggan}
            for order in _orders(params, ('batal',))]
    return {'rows': rows, 'summary': _summary(rows, 'jumlah')}


@report('pos-batal-belum-bayar', 'Detail POS Batal Belum Dibayar', [
    ('catatan', 'Catatan', 'text'), ('tanggal_jual', 'Tanggal Jual', 'date'),
    ('id_pelanggan', 'ID Pelanggan', 'text'), ('nama_pelanggan', 'Nama Pelanggan', 'text'),
    ('dilayani_oleh', 'Dilayani Oleh', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_pesanan', 'Total Pesanan', 'money'),
])
def void_pos_items(params):
    rows = []
    for sale in _pos_sales(params, 'void'):
        for item in sale.items.all():
            rows.append({'catatan': sale.catatan, 'tanggal_jual': sale.created_at.date().isoformat(),
                         'id_pelanggan': sale.pelanggan_id or '',
                         'nama_pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
                         'dilayani_oleh': _user_name(sale.dilayani_oleh) or _user_name(sale.kasir),
                         'item': item.nama_snapshot, 'qty': _num(item.qty), 'total_pesanan': _num(item.subtotal)})
    return {'rows': rows, 'summary': _summary(rows, 'total_pesanan')}


def _returns(params):
    queryset = PengembalianOrder.objects.select_related('order', 'dibuat_oleh')
    if params['start']:
        queryset = queryset.filter(tanggal_pengembalian__gte=params['start'])
    if params['end']:
        queryset = queryset.filter(tanggal_pengembalian__lte=params['end'])
    return queryset


@report('rincian-pengembalian', 'Rincian Pengembalian', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal_pengembalian', 'Tanggal Pengembalian', 'date'),
    ('diproses_oleh', 'Diproses Oleh', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('jumlah', 'Jumlah', 'money'), ('modal_produk', 'Modal Produk', 'money'), ('catatan', 'Catatan', 'text'),
])
def return_details(params):
    rows = [{'no_pesanan': item.order_id, 'tanggal_pengembalian': item.tanggal_pengembalian.isoformat(),
             'diproses_oleh': _user_name(item.dibuat_oleh), 'pelanggan': item.order.nama,
             'jumlah': _num(item.nominal_refund), 'modal_produk': 0, 'catatan': item.catatan or ''}
            for item in _returns(params)]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pengembalian': sum(_num(r['jumlah']) for r in rows), 'modal_produk': 0}]}}


@report('pengembalian-tanggal', 'Pengembalian berdasarkan Tanggal', [
    ('tanggal_pengembalian', 'Tanggal Pengembalian', 'date'), ('jumlah_pengembalian', 'Jumlah Pengembalian', 'money'),
])
def returns_by_date(params):
    grouped = defaultdict(float)
    for item in _returns(params):
        grouped[item.tanggal_pengembalian.isoformat()] += _num(item.nominal_refund)
    rows = [{'tanggal_pengembalian': date, 'jumlah_pengembalian': total} for date, total in sorted(grouped.items(), reverse=True)]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pengembalian': sum(grouped.values())}]}}


@report('pengembalian-pelanggan', 'Pengembalian berdasarkan Pelanggan', [
    ('pelanggan', 'Pelanggan', 'text'), ('email', 'Email', 'text'), ('jumlah_pengembalian', 'Jumlah Pengembalian', 'money'),
])
def returns_by_customer(params):
    grouped = defaultdict(float)
    for item in _returns(params):
        grouped[item.order.nama or 'Tanpa pelanggan'] += _num(item.nominal_refund)
    rows = [{'pelanggan': name, 'email': '', 'jumlah_pengembalian': total} for name, total in sorted(grouped.items())]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pengembalian': sum(grouped.values())}]}}


@report('item-dibatalkan', 'Item Dibatalkan', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal_jual', 'Tanggal Jual', 'date'),
    ('penjualan_oleh', 'Penjualan Oleh', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_pesanan', 'Total Pesanan', 'money'),
])
def cancelled_items(params):
    rows = []
    for order in _orders(params, ('batal',)):
        for item in order.items.all():
            rows.append({'no_pesanan': order.id, 'tanggal_jual': order.waktu.date().isoformat(),
                         'penjualan_oleh': _user_name(order.dilayani_oleh), 'item': item.jenis_produk,
                         'qty': _num(item.qty), 'total_pesanan': _num(item.qty) * _num(item.harga_jual)})
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pesanan': sum(_num(r['total_pesanan']) for r in rows)}]}}
