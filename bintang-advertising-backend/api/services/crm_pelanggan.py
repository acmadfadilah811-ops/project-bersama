"""Pelanggan baru di ERP otomatis masuk CRM sebagai Contact (2026-11-02).

Sebelumnya hanya pelanggan yang sudah punya penjualan/order kasir yang sampai ke CRM, sehingga pelanggan
yang baru didaftarkan (Pelanggan & Supplier > Pelanggan, atau dari kasir) tidak terlihat di CRM sampai
mereka berbelanja. Sekarang setiap Customer baru yang punya nomor HP/WA yang valid dikirim ke CRM lewat
endpoint jembatan yang sama dengan penjualan (/api/bridge/bintang-sale/) TANPA blok `sale`, jadi hanya
Contact yang dibuat/diperbarui (CRM dedup per nomor), tanpa Opportunity.

Sama seperti jalur order: kegagalan hanya dicatat (membuat pelanggan tidak boleh gagal/lambat gara-gara
CRM down), idempoten, dan bisa diulang lewat `manage.py sinkron_pelanggan_crm`.
"""

import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

logger = logging.getLogger(__name__)

TIMEOUT = 6
# Saat `manage.py test` pengiriman dijalankan sinkron supaya hasilnya bisa diperiksa dan koneksi DB tes tidak
# dipakai thread lain. Di server, antrean 2 pekerja menahan lonjakan (mis. impor banyak pelanggan sekaligus).
JALANKAN_ASINKRON = 'test' not in sys.argv
_antrean = ThreadPoolExecutor(max_workers=2, thread_name_prefix='crm-pelanggan')


def nomor_untuk_crm(customer):
    """Nomor yang dipakai CRM sebagai kunci kontak, atau '' bila pelanggan tak punya nomor WA valid.

    Memakai nomor Contact ERP yang sudah tertaut ke pelanggan ini bila ada (order kasir mengirim nomor itu,
    jadi kontak CRM-nya sama); selain itu nomor dinormalisasi ke format 62..."""
    from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp

    baku = normalisasi_nomor_whatsapp(customer.handphone)
    if not baku:
        return ''
    kontak = customer.contacts.order_by('nomor_wa').first()
    if kontak is not None and normalisasi_nomor_whatsapp(kontak.nomor_wa) == baku:
        return kontak.nomor_wa
    return baku


def _payload(customer, nomor):
    payload = {
        'nomor_wa': nomor,
        'nama': customer.nama,
        'email': customer.email,
        'alamat': customer.alamat,
        'kota': customer.kota,
        'provinsi': customer.provinsi,
        'negara': customer.negara,
        'kode_pos': customer.kode_pos,
        'nama_perusahaan': customer.nama_perusahaan,
        'kode_pelanggan': customer.kode_pelanggan,
        'sumber': 'erp-pelanggan',
    }
    pembuat = customer.dibuat_oleh
    hr_id = getattr(pembuat, 'hr_employee_id', None)
    if hr_id:
        payload['penjual_hr_employee_id'] = hr_id
    return payload


def kirim_pelanggan_ke_crm(customer_id):
    """Kirim/perbarui satu pelanggan ke CRM. True bila CRM menerima. Aman dipanggil berulang."""
    from ..customer_models import Customer
    from .crm_bridge import DEFAULT_CRM_BRIDGE_URL

    customer = Customer.objects.select_related('dibuat_oleh').filter(pk=customer_id).first()
    if customer is None or not customer.is_active or not (customer.nama or '').strip():
        return False
    nomor = nomor_untuk_crm(customer)
    if not nomor:
        return False  # tanpa nomor WA tidak ada identitas untuk Contact CRM
    api_key = os.getenv('CRM_BRIDGE_API_KEY')
    if not api_key:
        logger.warning('CRM_BRIDGE_API_KEY belum dikonfigurasi -- lewati kirim pelanggan ke CRM.')
        return False
    try:
        r = requests.post(
            os.getenv('CRM_BRIDGE_URL', DEFAULT_CRM_BRIDGE_URL),
            json=_payload(customer, nomor),
            headers={'X-Api-Key': api_key, 'X-Forwarded-Proto': 'https'},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
    except Exception:  # noqa: BLE001
        logger.exception('CRM: gagal mengirim pelanggan %s ke CRM.', customer_id)
        return False
    return True


def _kirim_aman(customer_id):
    from django.db import close_old_connections

    try:
        kirim_pelanggan_ke_crm(customer_id)
    except Exception:  # noqa: BLE001 -- pekerja latar tidak boleh melempar
        logger.exception('CRM: gagal mengirim pelanggan %s.', customer_id)
    finally:
        close_old_connections()


def jadwalkan_kirim_pelanggan_ke_crm(customer_id):
    if not JALANKAN_ASINKRON:
        kirim_pelanggan_ke_crm(customer_id)
        return
    _antrean.submit(_kirim_aman, customer_id)
