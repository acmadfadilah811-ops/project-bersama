"""Laporan pembayaran tambahan dari piutang Order yang benar-benar tercatat."""
from collections import defaultdict

from api.models import Contact, Order


PAYMENT_REPORT_REGISTRY = {}


def report(report_id, label, columns):
    def decorate(handler):
        PAYMENT_REPORT_REGISTRY[report_id] = {
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


def _outstanding_orders(params, field='waktu'):
    queryset = Order.objects.exclude(status_global='batal').filter(sisa_tagihan__gt=0)
    if params['start']:
        queryset = queryset.filter(**{f'{field}__gte': params['start']})
    if params['end']:
        queryset = queryset.filter(**{f'{field}__lte': params['end']})
    return queryset.select_related('dilayani_oleh')


@report('piutang-tipe-pelanggan', 'Piutang berdasarkan Tipe Pelanggan', [
    ('tipe_pelanggan', 'Tipe Pelanggan', 'text'),
    ('jumlah_pesanan', 'Jumlah Pesanan', 'qty'),
    ('total_piutang', 'Total Sisa Tagihan', 'money'),
])
def receivables_by_customer_type(params):
    orders = list(_outstanding_orders(params))
    phone_numbers = {order.nomor_wa for order in orders if order.nomor_wa}
    contacts = Contact.objects.filter(nomor_wa__in=phone_numbers).select_related('customer__customer_group')
    customer_type_by_phone = {
        contact.nomor_wa: (
            contact.customer.customer_group.nama
            if contact.customer and contact.customer.customer_group else 'Tanpa tipe pelanggan'
        )
        for contact in contacts
    }
    grouped = defaultdict(lambda: {'jumlah_pesanan': 0, 'total_piutang': 0.0})
    for order in orders:
        customer_type = customer_type_by_phone.get(order.nomor_wa, 'Tanpa tipe pelanggan')
        grouped[customer_type]['jumlah_pesanan'] += 1
        grouped[customer_type]['total_piutang'] += _num(order.sisa_tagihan)
    rows = [
        {'tipe_pelanggan': customer_type, **amounts}
        for customer_type, amounts in sorted(grouped.items())
    ]
    return {
        'rows': rows,
        'summary': {'rows': [{
            'jumlah_pesanan': sum(row['jumlah_pesanan'] for row in rows),
            'total_piutang': sum(row['total_piutang'] for row in rows),
        }]},
    }


@report('penjualan-hutang-jatuh-tempo', 'Penjualan Hutang yang Jatuh Tempo', [
    ('no_pesanan', 'No. Pesanan', 'text'), ('pelanggan', 'Pelanggan', 'text'),
    ('tanggal_jatuh_tempo', 'Tanggal Jatuh Tempo', 'date'),
    ('total_penjualan', 'Total Penjualan', 'money'), ('telah_dibayar', 'Telah Dibayar', 'money'),
    ('sisa_tagihan', 'Sisa Tagihan', 'money'),
])
def sales_debt_due(params):
    queryset = _outstanding_orders(params, 'jatuh_tempo').filter(jatuh_tempo__isnull=False).order_by('jatuh_tempo', 'id')
    rows = [{
        'no_pesanan': str(order.id), 'pelanggan': order.nama or '',
        'tanggal_jatuh_tempo': order.jatuh_tempo.isoformat(),
        'total_penjualan': _num(order.total_harga), 'telah_dibayar': _num(order.dp_dibayar),
        'sisa_tagihan': _num(order.sisa_tagihan),
    } for order in queryset]
    return {
        'rows': rows,
        'summary': {'rows': [{
            'total_penjualan': sum(row['total_penjualan'] for row in rows),
            'telah_dibayar': sum(row['telah_dibayar'] for row in rows),
            'sisa_tagihan': sum(row['sisa_tagihan'] for row in rows),
        }]},
    }
