"""Laporan penjualan tambahan yang hanya membaca sumber transaksi yang tercatat.

Laporan dengan dimensi yang tidak ada di model (marketplace, meja, perangkat,
alamat, dan deposit) sengaja tidak didaftarkan di sini.
"""
from collections import defaultdict

from django.db.models import F, Q

from api.finance_models import CashTransaction
from api.models import Order, OrderActivityLog, OrderItem, PengembalianOrder
from api.customer_models import Customer
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
    ).prefetch_related('items__product__koleksi')
    return _date_range(queryset, params, 'created_at')


def _orders(params, statuses=None):
    """Order penjualan. Default: SEMUA status kecuali batal — konsisten dengan
    ``_orders_in_range`` di report_views.py (laporan "Rincian Penjualan" utama).
    Sebelumnya default di sini adalah hanya status='selesai', membuat laporan
    turunan modul ini (Penjualan berdasarkan Tanggal/Pelanggan/Jam/Penjual, dll)
    selalu menampilkan total lebih kecil dari laporan "Rincian Penjualan" untuk
    periode yang sama — order 'proses'/'desain'/'ready' terlewat begitu saja."""
    queryset = Order.objects.select_related('dilayani_oleh', 'kupon').prefetch_related('items__product__koleksi')
    if statuses:
        queryset = queryset.filter(status_global__in=statuses)
    else:
        queryset = queryset.exclude(status_global='batal')
    return _date_range(queryset, params, 'waktu')


def _cancelled_orders(params):
    """Order batal beserta audit CANCEL yang menjadi sumber waktu/pelakunya.

    Order lama yang dibatalkan sebelum audit `CANCEL` tersedia tetap boleh
    muncul saat tanpa filter tanggal, tetapi tidak dipaksakan masuk ke periode
    tertentu karena waktu pembatalannya memang tidak diketahui.
    """
    queryset = Order.objects.filter(status_global='batal').select_related('dilayani_oleh').prefetch_related('items')
    logs = OrderActivityLog.objects.filter(tindakan='CANCEL', order_id__in=queryset.values('pk')).select_related('user')
    logs = _date_range(logs, params, 'waktu').order_by('order_id', '-waktu')
    latest_log_by_order = {}
    for log in logs:
        latest_log_by_order.setdefault(log.order_id, log)

    if params['start'] or params['end']:
        queryset = queryset.filter(pk__in=latest_log_by_order)
    return [(order, latest_log_by_order.get(order.id)) for order in queryset]


def _void_pos_sales(params, *, unpaid_only=False):
    """POS void berdasarkan waktu void yang benar, bukan tanggal jual awal."""
    queryset = POSSale.objects.filter(status='void').select_related(
        'kasir', 'dilayani_oleh', 'pelanggan', 'voided_by'
    ).prefetch_related('items__product')
    queryset = _date_range(queryset, params, 'voided_at')
    if unpaid_only:
        queryset = queryset.filter(dibayar__lt=F('total'))
    return queryset


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
            'diskon': max(0, sum(_num(item.harga_jual) for item in order.items.all()) - _num(order.total_harga)),
            'diskon_penjualan': _num(order.diskon_otomatis),
        })
    return rows


def _completed_sale_items(params):
    """Baris item dari transaksi penjualan yang benar-benar selesai/paid.

    Helper ini sengaja tidak mengisi HPP, komisi, atau diskon item bila nilai
    historisnya tidak direkam per baris. Laporan yang memakainya hanya
    menampilkan fakta transaksi yang tersedia.
    """
    rows = []
    for order in _orders(params):
        for item in order.items.all():
            product = item.product
            rows.append({
                'sumber': 'Order', 'no_pesanan': str(order.id),
                'tanggal': order.waktu.date().isoformat() if order.waktu else '',
                'penjualan_oleh': _user_name(order.dilayani_oleh),
                'pelanggan': order.nama or 'Tanpa pelanggan',
                'id_pelanggan': order.nomor_wa or '',
                'item': product.nama if product else (item.jenis_produk or ''),
                'koleksi': product.koleksi.nama if product and product.koleksi else 'Tanpa Koleksi',
                'qty': _num(item.qty), 'total_penjualan': _num(item.harga_jual),
                'cara_pembayaran': order.metode_pembayaran or '',
                'lunas': _num(order.sisa_tagihan) <= 0,
            })
    for sale in _pos_sales(params):
        for item in sale.items.all():
            product = item.product
            rows.append({
                'sumber': 'POS', 'no_pesanan': sale.nomor,
                'tanggal': sale.created_at.date().isoformat() if sale.created_at else '',
                'penjualan_oleh': _user_name(sale.dilayani_oleh) or _user_name(sale.kasir),
                'pelanggan': sale.pelanggan.nama if sale.pelanggan else 'Tanpa pelanggan',
                'id_pelanggan': sale.pelanggan_id or '',
                'item': item.nama_snapshot or (product.nama if product else ''),
                'koleksi': product.koleksi.nama if product and product.koleksi else 'Tanpa Koleksi',
                'qty': _num(item.qty), 'total_penjualan': _num(item.subtotal),
                'cara_pembayaran': sale.metode_bayar or '',
                'lunas': _num(sale.dibayar) >= _num(sale.total),
            })
    return rows


@report('item-koleksi', 'Item Penjualan Berdasarkan Koleksi', [
    ('sumber', 'Sumber', 'text'), ('no_pesanan', 'No. Pesanan', 'text'),
    ('tanggal', 'Tanggal Jual', 'date'), ('penjualan_oleh', 'Penjualan Oleh', 'text'),
    ('koleksi', 'Koleksi', 'text'), ('item', 'Item', 'text'),
    ('pelanggan', 'Pelanggan', 'text'), ('qty', 'Qty', 'qty'),
    ('total_penjualan', 'Total Penjualan', 'money'),
])
def items_by_collection(params):
    rows = _completed_sale_items(params)
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR',
        'qty_terjual': sum(_num(row['qty']) for row in rows),
        'total_penjualan': sum(_num(row['total_penjualan']) for row in rows),
    }]}}


@report('pelunasan-non-kredit', 'Item Penjualan berdasarkan Pelunasan Non Kredit', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal', 'Tanggal', 'date'),
    ('penjualan_oleh', 'Penjualan Oleh', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_penjualan', 'Total Penjualan', 'money'),
    ('cara_pembayaran', 'Cara Pembayaran', 'text'),
])
def non_credit_settlements(params):
    rows = [row for row in _completed_sale_items(params)
            if row['lunas'] and row['cara_pembayaran'].strip().lower() != 'kredit']
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR',
        'total_penjualan': sum(_num(row['total_penjualan']) for row in rows),
    }]}}


@report('penjualan-penjual', 'Penjualan berdasarkan Penjual', [
    ('penjual', 'Penjual', 'text'), ('qty', 'Qty Terjual', 'qty'),
    ('total_penjualan', 'Total Penjualan', 'money'),
])
def sales_by_seller(params):
    grouped = defaultdict(lambda: {'qty': 0.0, 'total': 0.0})
    for row in _completed_sale_items(params):
        seller = row['penjualan_oleh'] or 'Tidak tercatat'
        grouped[seller]['qty'] += _num(row['qty'])
        grouped[seller]['total'] += _num(row['total_penjualan'])
    rows = [{'penjual': seller, 'qty': value['qty'], 'total_penjualan': value['total']}
            for seller, value in sorted(grouped.items())]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR',
        'qty_terjual': sum(row['qty'] for row in rows),
        'total_penjualan': sum(row['total_penjualan'] for row in rows),
    }]}}


@report('item-pelanggan', 'Item Penjualan Berdasarkan Pelanggan', [
    ('sumber', 'Sumber', 'text'), ('no_pesanan', 'No. Pesanan', 'text'),
    ('tanggal', 'Tanggal', 'date'), ('id_pelanggan', 'ID Pelanggan', 'text'),
    ('pelanggan', 'Pelanggan', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_penjualan', 'Total Penjualan', 'money'),
])
def items_by_customer(params):
    rows = _completed_sale_items(params)
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR',
        'qty_terjual': sum(_num(row['qty']) for row in rows),
        'total_penjualan': sum(_num(row['total_penjualan']) for row in rows),
    }]}}


@report('sisa-deposit', 'Sisa Deposit Pelanggan', [
    ('id_pelanggan', 'ID Pelanggan', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('email', 'Email', 'text'), ('sisa_deposit', 'Sisa Deposit', 'money'),
])
def remaining_customer_deposit(params):
    queryset = Customer.objects.filter(deposit__gt=0).order_by('nama', 'id')
    if params['search']:
        search = params['search']
        queryset = queryset.filter(
            Q(nama__icontains=search) | Q(kode_pelanggan__icontains=search) | Q(email__icontains=search)
        )
    rows = [{
        'id_pelanggan': customer.kode_pelanggan or str(customer.id),
        'pelanggan': customer.nama, 'email': customer.email or '',
        'sisa_deposit': _num(customer.deposit),
    } for customer in queryset]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR',
        'total_sisa_deposit': sum(_num(row['sisa_deposit']) for row in rows),
    }]}}


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
        # order.total_harga SUDAH bersih setelah diskon (persen + kupon +
        # otomatis) — sebelumnya "diskon" di sini dihitung sebagai persen dari
        # total yang SUDAH terdiskon (total * diskon_persen/100), meremehkan
        # nominal diskon asli & mengabaikan diskon kupon/otomatis. Dihitung
        # ulang dari selisih subtotal item, sama seperti _paid_rows().
        subtotal_item = sum(_num(item.harga_jual) for item in order.items.all())
        rows.append({
            'no_pesanan': order.id, 'tanggal': order.waktu.date().isoformat(),
            'penjualan_oleh': _user_name(order.dilayani_oleh), 'pelanggan': order.nama,
            'total_penjualan': total, 'pengiriman_pajak': 0, 'modal_produk': modal,
            'laba': total - modal, 'biaya_layanan': 0,
            'diskon': max(0.0, subtotal_item - total),
        })
    return {'rows': rows, 'summary': _summary(rows)}


@report('pembatalan-penjualan', 'Rincian Pembatalan Penjualan', [
    ('sumber', 'Sumber', 'text'), ('no_pesanan', 'No. Pesanan', 'text'),
    ('tanggal_pembatalan', 'Tanggal Pembatalan', 'date'),
    ('dibatalkan_oleh', 'Dibatalkan Oleh', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('jumlah', 'Jumlah', 'money'), ('catatan', 'Catatan', 'text'),
])
def cancelled_sales(params):
    rows = []
    for order, log in _cancelled_orders(params):
        rows.append({
            'sumber': 'Order', 'no_pesanan': order.id,
            'tanggal_pembatalan': log.waktu.date().isoformat() if log else '',
            'dibatalkan_oleh': _user_name(log.user) if log else '',
            'pelanggan': order.nama, 'jumlah': _num(order.total_harga),
            'catatan': log.keterangan if log else 'Audit waktu pembatalan transaksi lama belum tercatat.',
        })
    for sale in _void_pos_sales(params):
        rows.append({
            'sumber': 'POS', 'no_pesanan': sale.nomor,
            'tanggal_pembatalan': sale.voided_at.date().isoformat() if sale.voided_at else '',
            'dibatalkan_oleh': _user_name(sale.voided_by),
            'pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
            'jumlah': _num(sale.total), 'catatan': sale.catatan or '',
        })
    return {'rows': rows, 'summary': _summary(rows, 'jumlah')}


@report('pos-batal-belum-bayar', 'Detail POS Batal Belum Dibayar', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal_pembatalan', 'Tanggal Pembatalan', 'date'),
    ('id_pelanggan', 'ID Pelanggan', 'text'), ('nama_pelanggan', 'Nama Pelanggan', 'text'),
    ('dibatalkan_oleh', 'Dibatalkan Oleh', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_pesanan', 'Total Pesanan', 'money'),
])
def void_pos_items(params):
    rows = []
    for sale in _void_pos_sales(params, unpaid_only=True):
        for item in sale.items.all():
            rows.append({'no_pesanan': sale.nomor,
                         'tanggal_pembatalan': sale.voided_at.date().isoformat() if sale.voided_at else '',
                         'id_pelanggan': sale.pelanggan_id or '',
                         'nama_pelanggan': sale.pelanggan.nama if sale.pelanggan else '',
                         'dibatalkan_oleh': _user_name(sale.voided_by),
                         'item': item.nama_snapshot, 'qty': _num(item.qty), 'total_pesanan': _num(item.subtotal)})
    return {'rows': rows, 'summary': _summary(rows, 'total_pesanan')}


def _returns(params):
    # Hanya retur yang sudah disetujui adalah transaksi pengembalian aktual.
    # Draft/Tunda adalah pengajuan dan Batal tidak boleh memengaruhi laporan.
    queryset = PengembalianOrder.objects.filter(status='Dikonfirmasi').select_related('order', 'dibuat_oleh')
    if params['start']:
        queryset = queryset.filter(tanggal_pengembalian__gte=params['start'])
    if params['end']:
        queryset = queryset.filter(tanggal_pengembalian__lte=params['end'])
    return queryset


@report('rincian-pengembalian', 'Rincian Pengembalian', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('tanggal_pengembalian', 'Tanggal Pengembalian', 'date'),
    ('diproses_oleh', 'Diproses Oleh', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('jumlah', 'Jumlah', 'money'), ('catatan', 'Catatan', 'text'),
])
def return_details(params):
    rows = [{'no_pesanan': item.order_id, 'tanggal_pengembalian': item.tanggal_pengembalian.isoformat(),
             'diproses_oleh': _user_name(item.dibuat_oleh), 'pelanggan': item.order.nama,
             'jumlah': _num(item.nominal_refund), 'catatan': item.catatan or ''}
            for item in _returns(params)]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pengembalian': sum(_num(r['jumlah']) for r in rows)}]}}


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
        grouped[(item.order.nama or 'Tanpa pelanggan', item.order.email_pelanggan or '')] += _num(item.nominal_refund)
    rows = [
        {'pelanggan': name, 'email': email, 'jumlah_pengembalian': total}
        for (name, email), total in sorted(grouped.items())
    ]
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pengembalian': sum(grouped.values())}]}}


@report('item-dibatalkan', 'Item Dibatalkan', [
    ('sumber', 'Sumber', 'text'), ('no_pesanan', 'No. Pesanan', 'text'),
    ('tanggal_pembatalan', 'Tanggal Pembatalan', 'date'),
    ('dibatalkan_oleh', 'Dibatalkan Oleh', 'text'), ('item', 'Item', 'text'),
    ('qty', 'Qty', 'qty'), ('total_pesanan', 'Total Pesanan', 'money'),
])
def cancelled_items(params):
    rows = []
    for order, log in _cancelled_orders(params):
        for item in order.items.all():
            rows.append({'sumber': 'Order', 'no_pesanan': order.id,
                         'tanggal_pembatalan': log.waktu.date().isoformat() if log else '',
                         'dibatalkan_oleh': _user_name(log.user) if log else '', 'item': item.jenis_produk,
                         'qty': _num(item.qty), 'total_pesanan': _num(item.qty) * _num(item.harga_jual)})
    for sale in _void_pos_sales(params):
        for item in sale.items.all():
            rows.append({'sumber': 'POS', 'no_pesanan': sale.nomor,
                         'tanggal_pembatalan': sale.voided_at.date().isoformat() if sale.voided_at else '',
                         'dibatalkan_oleh': _user_name(sale.voided_by), 'item': item.nama_snapshot,
                         'qty': _num(item.qty), 'total_pesanan': _num(item.subtotal)})
    return {'rows': rows, 'summary': {'rows': [{'mata_uang': 'IDR', 'total_pesanan': sum(_num(r['total_pesanan']) for r in rows)}]}}


@report('log-item-pos-batal', 'Log Item POS Dibatalkan', [
    ('tanggal_penjualan', 'Tanggal Penjualan', 'date'),
    ('tanggal_pembatalan', 'Tanggal Pembatalan', 'date'),
    ('no_pesanan', 'No. Pesanan', 'text'), ('dibatalkan_oleh', 'Dibatalkan Oleh', 'text'),
    ('item', 'Item', 'text'), ('qty', 'Qty', 'qty'),
    ('total_penjualan', 'Total Penjualan', 'money'), ('catatan_order', 'Catatan Transaksi', 'text'),
])
def void_pos_item_log(params):
    rows = []
    for sale in _void_pos_sales(params):
        for item in sale.items.all():
            rows.append({
                'tanggal_penjualan': sale.created_at.date().isoformat(),
                'tanggal_pembatalan': sale.voided_at.date().isoformat() if sale.voided_at else '',
                'no_pesanan': sale.nomor, 'dibatalkan_oleh': _user_name(sale.voided_by),
                'item': item.nama_snapshot, 'qty': _num(item.qty),
                'total_penjualan': _num(item.subtotal), 'catatan_order': sale.catatan or '',
            })
    return {'rows': rows, 'summary': {'rows': [{
        'total_item': len(rows), 'total_penjualan': sum(_num(row['total_penjualan']) for row in rows),
    }]}}
