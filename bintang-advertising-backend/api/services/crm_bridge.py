"""Jembatan Bintang -> CRM (Horilla CRM): kirim data pelanggan + penjualan
POS yang lunas ke CRM supaya CRM punya Contact + Opportunity ("Closed
Won") real tanpa entri manual.

Arah kebalikan dari insights_bridge.py (yang MENARIK data dari CRM/HR
untuk dashboard) -- ini yang MENDORONG data KE CRM, dipanggil setelah
POS Sale commit (lihat pos_services.create_sale). Auth & gaya panggilan
mengikuti pola yang sama: X-Api-Key + X-Forwarded-Proto, timeout pendek,
try/except yang MENELAN kegagalan (log saja) -- checkout POS tidak boleh
gagal/lambat gara-gara CRM down.
"""

import logging
import os

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)

DEFAULT_CRM_BRIDGE_URL = 'https://crm.starphotoadvertising.com/api/bridge/bintang-sale/'
TIMEOUT = 10


def _rincian_possale(sale, kontak):
    """Rincian penjualan POS untuk Peluang CRM (nama pelanggan, unit, item) -- 2026-11-02."""
    from ..qty_format import qty_json

    pelayan = sale.dilayani_oleh or sale.kasir
    return {
        'unit_bisnis': sale.unit_bisnis.nama if sale.unit_bisnis_id else '',
        'lunas': True,  # POSSale hanya dikirim saat 'paid'
        'pelanggan': kontak.nama,
        'dilayani_oleh': pelayan.get_full_name() if pelayan else '',
        'metode_pembayaran': sale.metode_bayar,
        'catatan': (sale.catatan or '')[:500],
        'items': [
            {
                'nama': item.nama_snapshot,
                'qty': qty_json(item.uom_qty if item.uom_qty is not None else item.qty),
                'subtotal': int(item.subtotal or 0),
            }
            for item in sale.items.all().order_by('id')
        ],
    }


def sync_possale_ke_crm(sale_id, paksa=False):
    """Kirim satu POSSale (harus sudah berstatus 'paid') ke CRM. Aman
    dipanggil berkali-kali untuk sale yang sama -- CRM dedup by
    bintang_sale_id, dan sale yang sudah synced_to_crm_at dilewati di sini
    juga supaya tidak ada panggilan jaringan sia-sia. `paksa=True` melewati
    penjaga itu (sinkron ulang rincian untuk Peluang lama)."""
    from ..pos_models import POSSale

    try:
        sale = POSSale.objects.select_related(
            'pelanggan', 'pelanggan__customer', 'unit_bisnis', 'dilayani_oleh', 'kasir',
        ).get(pk=sale_id)
    except POSSale.DoesNotExist:
        logger.warning('CRM bridge: POSSale id=%s tidak ditemukan, dilewati.', sale_id)
        return

    if sale.synced_to_crm_at is not None and not paksa:
        return
    if sale.status != 'paid':
        return
    if sale.pelanggan is None:
        # Transaksi tanpa pelanggan tertaut (walk-in tanpa nomor WA) --
        # tidak ada identitas untuk dibuatkan Contact di CRM.
        return

    api_key = os.getenv('CRM_BRIDGE_API_KEY')
    if not api_key:
        logger.warning('CRM_BRIDGE_API_KEY belum dikonfigurasi -- lewati sync ke CRM.')
        return

    kontak = sale.pelanggan
    member = kontak.customer

    payload = {
        'nomor_wa': kontak.nomor_wa,
        'nama': kontak.nama,
        'sale': {
            'id': f'possale:{sale.id}',
            'nomor': sale.nomor,
            'total': float(sale.total),
            'tanggal': sale.created_at.date().isoformat(),
            **_rincian_possale(sale, kontak),
        },
    }
    if member is not None:
        payload.update({
            'email': member.email,
            'alamat': member.alamat,
            'kota': member.kota,
            'provinsi': member.provinsi,
            'negara': member.negara,
            'kode_pos': member.kode_pos,
            'nama_perusahaan': member.nama_perusahaan,
        })

    base_url = os.getenv('CRM_BRIDGE_URL', DEFAULT_CRM_BRIDGE_URL)
    headers = {'X-Api-Key': api_key, 'X-Forwarded-Proto': 'https'}
    try:
        response = requests.post(base_url, json=payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except Exception:
        logger.exception('CRM bridge: gagal sync POSSale id=%s ke CRM.', sale_id)
        return False

    if sale.synced_to_crm_at is None:
        sale.synced_to_crm_at = timezone.now()
        sale.save(update_fields=['synced_to_crm_at'])
    return True
