"""Kirim order kasir (StarFoto & Advertising) ke CRM (2026-10-12).

Arah ERP -> CRM, sama jalurnya dengan penjualan POS (services/crm_bridge.py):
endpoint CRM /api/bridge/bintang-sale/ membuat/memperbarui Contact (dedup nomor
WA) dan Opportunity (dedup `order:<id>`). Opportunity berstatus Open selama
order belum lunas, lalu Closed Won saat lunas.

Pemilik data di CRM mengikuti penjual: bila penjual order (dilayani_oleh)
punya akun CRM (tertaut lewat hr_employee_id), dialah pemiliknya sehingga
staff hanya melihat penjualannya sendiri; selain itu CRM memakai pemilik
bawaan (akun atasan). Order asal CRM tidak dikirim (sudah punya Opportunity).

Kegagalan HANYA dicatat -- checkout tidak boleh gagal/lambat gara-gara CRM
down. Percobaan berikutnya terjadi saat order berubah (lunas/total) atau lewat
`manage.py sinkron_order_crm`."""

import logging
import os
import sys
import threading

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)

TIMEOUT = 6
# Thread latar hanya di server; saat `manage.py test` pengiriman sinkron supaya
# koneksi DB tes tidak dipakai thread lain dan hasilnya bisa diperiksa.
JALANKAN_ASINKRON = 'test' not in sys.argv


def jadwalkan_kirim_order_ke_crm(order_id):
    """Catat penanda (supaya bisa dicoba ulang) lalu kirim di thread terpisah."""
    from ..crm_push_models import OrderKeCRM
    from ..models import Order

    baris, baru = OrderKeCRM.objects.get_or_create(order_id=order_id)
    if not baru and baris.terkirim_pada:
        # Beberapa penyimpanan dalam satu transaksi menjadwalkan beberapa kali;
        # lewati bila CRM sudah memegang keadaan terbaru.
        order = Order.objects.filter(pk=order_id).values('total_harga', 'sisa_tagihan').first()
        if order is None:
            return
        lunas = bool(order['total_harga']) and not order['sisa_tagihan']
        if (lunas and baris.lunas_terkirim_pada) or (not lunas and baris.total_terkirim == order['total_harga']):
            return
    if not JALANKAN_ASINKRON:
        kirim_order_ke_crm(order_id)
        return
    threading.Thread(target=_kirim_aman, args=(order_id,), daemon=True).start()


def _kirim_aman(order_id):
    from django.db import close_old_connections

    try:
        kirim_order_ke_crm(order_id)
    except Exception:  # noqa: BLE001 -- thread latar tidak boleh melempar
        logger.exception('CRM: gagal mengirim order %s.', order_id)
    finally:
        close_old_connections()


def _payload(order, lunas):
    from .pelanggan_nomor import cari_customer_per_nomor

    unit = order.unit_bisnis.nama if order.unit_bisnis_id else ''
    penjual = order.dilayani_oleh
    payload = {
        'nomor_wa': order.nomor_wa,
        'nama': order.nama,
        'sale': {
            # id order muat di kolom CRM (maks. 40 karakter); tanpa prefix.
            'id': order.pk,
            'nomor': order.pk,
            'total': float(order.total_harga),
            'tanggal': timezone.localtime(order.waktu).date().isoformat(),
            'lunas': lunas,
            'unit_bisnis': unit,
        },
        'penjual_hr_employee_id': getattr(penjual, 'hr_employee_id', None),
    }
    customer = cari_customer_per_nomor(order.nomor_wa)
    if customer is not None:
        payload.update({
            'email': customer.email,
            'alamat': customer.alamat,
            'kota': customer.kota,
            'provinsi': customer.provinsi,
            'negara': customer.negara,
            'kode_pos': customer.kode_pos,
            'nama_perusahaan': customer.nama_perusahaan,
        })
    return payload


def kirim_order_ke_crm(order_id):
    """Kirim/perbarui satu order kasir. Aman dipanggil berulang (CRM idempoten)."""
    from ..crm_order_models import OrderAsalCRM
    from ..crm_push_models import OrderKeCRM
    from ..models import Order
    from .crm_bridge import DEFAULT_CRM_BRIDGE_URL

    order = Order.objects.select_related('unit_bisnis', 'dilayani_oleh').filter(pk=order_id).first()
    if order is None or order.sumber != 'pos' or order.status_global == 'batal':
        return
    if not (order.nomor_wa or '').strip():
        return  # tanpa nomor WA tidak ada identitas untuk Contact CRM
    if OrderAsalCRM.objects.filter(order_id=order.pk).exists():
        return
    api_key = os.getenv('CRM_BRIDGE_API_KEY')
    if not api_key:
        logger.warning('CRM_BRIDGE_API_KEY belum dikonfigurasi -- lewati kirim order ke CRM.')
        return

    lunas = bool(order.total_harga) and not order.sisa_tagihan
    total = order.total_harga
    # Penjaga idempoten: beberapa save dalam satu transaksi menjadwalkan beberapa
    # panggilan; yang sudah terkirim dengan total & status lunas sama dilewati.
    ada = OrderKeCRM.objects.filter(order_id=order.pk).first()
    if ada and ada.terkirim_pada and ada.total_terkirim == total and (
        not lunas or ada.lunas_terkirim_pada is not None
    ):
        return
    try:
        r = requests.post(
            os.getenv('CRM_BRIDGE_URL', DEFAULT_CRM_BRIDGE_URL),
            json=_payload(order, lunas),
            headers={'X-Api-Key': api_key, 'X-Forwarded-Proto': 'https'},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        data = r.json() if r.content else {}
    except Exception:  # noqa: BLE001
        logger.exception('CRM: gagal mengirim order %s ke CRM.', order_id)
        return

    sekarang = timezone.now()
    OrderKeCRM.objects.update_or_create(order_id=order.pk, defaults={
        'terkirim_pada': sekarang,
        'total_terkirim': total,
        'crm_opportunity_id': data.get('opportunity_id'),
        **({'lunas_terkirim_pada': sekarang} if lunas else {}),
    })
