"""Order dari CRM (Sales) ke Bintang (2026-09-26).

Keputusan user:
- Produk dicari LANGSUNG ke katalog Bintang (tidak disalin ke CRM).
- Harga = harga katalog dihitung server (product_pricing.hitung_harga); Sales tidak
  bisa mengubah harga. Diskon/penyesuaian dilakukan kasir saat memproses order
  (sama seperti order WA).
- Pelanggan baru dari CRM masuk ke database Pelanggan Bintang SAAT order dibuat,
  dedup nomor HP.
- Order masuk sebagai draft (sumber='crm') ke Antrean kasir lewat jalur yang sama
  dengan bot WA (order_actions.buat_order_dari_items).
"""

import logging
import os
import datetime
import re
from decimal import Decimal

import requests
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from ..crm_order_models import OrderAsalCRM
from ..models import Contact, Order
from ..product_models import Product
from .order_actions import buat_order_dari_items
from .pelanggan_nomor import dapatkan_atau_buat_customer
from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp
from .product_pricing import HargaProdukError, hitung_harga

logger = logging.getLogger(__name__)

MAKS_ITEM = 50
TIMEOUT_LUNAS = 5
MAKS_QTY = 100000


class CrmOrderError(Exception):
    """Permintaan order dari CRM ditolak (pesan untuk ditampilkan ke Sales)."""


def _rp(x):
    return int(Decimal(str(x or 0)).quantize(Decimal('1')))


def cari_produk(q, batas=20):
    q = (q or '').strip()
    qs = Product.objects.filter(is_active=True).select_related('kategori')
    if q:
        qs = qs.filter(Q(nama__icontains=q) | Q(nama_alternatif__icontains=q) | Q(sku__iexact=q))
    hasil = []
    for p in qs.order_by('nama')[:batas]:
        hasil.append({
            'id': p.id,
            'nama': p.nama,
            'kategori': p.kategori.nama if p.kategori else '',
            'satuan': p.satuan,
            'price_type': p.price_type,
            'harga': _rp(p.harga_jual_toko),
        })
    return hasil


def _pastikan_pelanggan(nama, nomor, email):
    """Contact (kontak order, pk nomor WA) + Customer (database Pelanggan) tanpa duplikat."""
    contact, _ = Contact.objects.get_or_create(nomor_wa=nomor, defaults={'nama': nama})
    customer = contact.customer
    dibuat = False
    if customer is None:
        customer, dibuat = dapatkan_atau_buat_customer(nomor, nama, email)
        contact.customer = customer
        contact.save(update_fields=['customer'])
    return contact, customer, dibuat


def buat_order(data):
    """Buat order draft dari CRM. Idempoten per `kunci`. Return (OrderAsalCRM, baru)."""
    kunci = str(data.get('kunci') or '').strip()[:80]
    if not kunci:
        raise CrmOrderError('kunci permintaan wajib diisi.')
    lama = OrderAsalCRM.objects.select_related('order').filter(kunci=kunci).first()
    if lama:
        return lama, False

    p = data.get('pelanggan') or {}
    nama = str(p.get('nama') or '').strip()[:100]
    nomor = normalisasi_nomor_whatsapp(p.get('nomor_hp'))
    if not nama:
        raise CrmOrderError('Nama pelanggan wajib diisi.')
    if not nomor:
        raise CrmOrderError('Nomor HP/WA pelanggan tidak valid.')

    items_masuk = data.get('items') or []
    if not isinstance(items_masuk, list) or not items_masuk:
        raise CrmOrderError('Order minimal berisi satu produk.')
    if len(items_masuk) > MAKS_ITEM:
        raise CrmOrderError(f'Maksimal {MAKS_ITEM} baris produk per order.')

    ids = []
    for it in items_masuk:
        try:
            ids.append(int(it.get('product_id')))
        except (TypeError, ValueError):
            raise CrmOrderError('Setiap baris wajib memilih produk dari katalog.')
    produk = {x.id: x for x in Product.objects.filter(id__in=ids, is_active=True)}

    items = []
    for it in items_masuk:
        prod = produk.get(int(it.get('product_id')))
        if prod is None:
            raise CrmOrderError('Produk tidak ditemukan atau sudah tidak aktif. Muat ulang katalog.')
        try:
            qty = int(it.get('qty'))
        except (TypeError, ValueError):
            raise CrmOrderError(f"Jumlah '{prod.nama}' harus berupa angka bulat.")
        if not 0 < qty <= MAKS_QTY:
            raise CrmOrderError(f"Jumlah '{prod.nama}' harus antara 1 dan {MAKS_QTY}.")
        try:
            harga = hitung_harga(prod, qty=qty)  # harga katalog, dihitung server (M6)
        except HargaProdukError as exc:
            raise CrmOrderError(str(exc))
        items.append({
            'jenis_produk': prod.nama,
            'product': prod,
            'qty': qty,
            'harga_jual': _rp(harga['total']),
            'keterangan': str(it.get('keterangan') or '')[:500],
        })

    sales_nama = str(data.get('sales_nama') or '').strip()[:150]
    catatan = str(data.get('catatan') or '').strip()[:2000]
    catatan_order = f"Order dari CRM oleh {sales_nama or data.get('crm_username') or 'Sales'}."
    if catatan:
        catatan_order += f"\n{catatan}"

    with transaction.atomic():
        contact, customer, _pelanggan_baru = _pastikan_pelanggan(nama, nomor, str(p.get('email') or '')[:254])
        _order_id, order = buat_order_dari_items(
            contact.nomor_wa, contact.nama, nama, items, raw_detail=catatan_order, sumber='crm',
        )
        asal = OrderAsalCRM.objects.create(
            order=order, kunci=kunci,
            crm_user_id=_int_atau_none(data.get('crm_user_id')),
            crm_username=str(data.get('crm_username') or '')[:150],
            sales_nama=sales_nama,
            crm_opportunity_id=_int_atau_none(data.get('crm_opportunity_id')),
            crm_contact_id=_int_atau_none(data.get('crm_contact_id')),
        )
    return asal, True


def _int_atau_none(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def bentuk_order(order):
    return {
        'id': order.id,
        'status': order.status_global,
        'status_label': order.get_status_global_display(),
        'total_harga': order.total_harga,
        'dp_dibayar': order.dp_dibayar,
        'sisa_tagihan': order.sisa_tagihan,
        'lunas': order.total_harga > 0 and order.sisa_tagihan == 0,
        'waktu': order.waktu.isoformat(),
        'pelanggan': order.nama,
        'items': [
            {'nama': i.jenis_produk, 'qty': i.qty, 'harga_jual': i.harga_jual}
            for i in order.items.all()
        ],
    }


def status_order(order_ids=None, crm_opportunity_id=None, crm_user_id=None, semua=False):
    """Status order asal CRM saja -- CRM tidak bisa membaca order kanal lain.
    semua=True: seluruh order asal CRM (halaman SPV), 100 terbaru."""
    qs = OrderAsalCRM.objects.select_related('order').prefetch_related('order__items')
    if order_ids:
        qs = qs.filter(order_id__in=order_ids[:100])
    elif crm_opportunity_id:
        qs = qs.filter(crm_opportunity_id=crm_opportunity_id)
    elif crm_user_id:
        qs = qs.filter(crm_user_id=crm_user_id)
    elif not semua:
        return []
    return [
        {**bentuk_order(a.order), 'sales_nama': a.sales_nama, 'crm_opportunity_id': a.crm_opportunity_id}
        for a in qs[:100]
    ]


MAKS_HARI_REKAP = 1100


def _tanggal(x, nama):
    try:
        return datetime.date.fromisoformat(str(x or ''))
    except ValueError:
        raise CrmOrderError(f'Tanggal {nama} tidak valid (format YYYY-MM-DD).')


def rekap_sales(mulai, selesai, crm_user_ids=None):
    """Realisasi per Sales CRM untuk target (UAT SLS-06).

    Order dihitung bila dibuat (Order.waktu) dalam periode dan tidak batal.
    Nilai yang mengejar target = total order yang sudah lunas; nilai order
    yang belum lunas dilaporkan terpisah.
    """
    mulai, selesai = _tanggal(mulai, 'mulai'), _tanggal(selesai, 'selesai')
    if mulai > selesai:
        raise CrmOrderError('Tanggal mulai harus sebelum tanggal selesai.')
    if (selesai - mulai).days > MAKS_HARI_REKAP:
        raise CrmOrderError('Periode rekap maksimal 3 tahun.')
    qs = (OrderAsalCRM.objects
          .filter(crm_user_id__isnull=False, order__waktu__date__gte=mulai, order__waktu__date__lte=selesai)
          .exclude(order__status_global='batal'))
    if crm_user_ids:
        qs = qs.filter(crm_user_id__in=crm_user_ids[:200])
    lunas = Q(order__total_harga__gt=0, order__sisa_tagihan=0)
    rows = qs.values('crm_user_id').annotate(
        jumlah_order=Count('id'),
        jumlah_lunas=Count('id', filter=lunas),
        nilai_lunas=Sum('order__total_harga', filter=lunas),
        nilai_belum_lunas=Sum('order__total_harga', filter=~lunas),
    ).order_by('crm_user_id')
    return [
        {
            'crm_user_id': r['crm_user_id'],
            'jumlah_order': r['jumlah_order'],
            'jumlah_lunas': r['jumlah_lunas'],
            'nilai_lunas': int(r['nilai_lunas'] or 0),
            'nilai_belum_lunas': int(r['nilai_belum_lunas'] or 0),
        }
        for r in rows
    ]


def _url_order_lunas():
    """Endpoint CRM untuk order lunas. Default diturunkan dari CRM_BRIDGE_URL
    (endpoint penjualan POS) supaya cukup satu konfigurasi host."""
    from .crm_bridge import DEFAULT_CRM_BRIDGE_URL

    url = os.getenv('CRM_BRIDGE_ORDER_LUNAS_URL')
    if url:
        return url
    dasar = os.getenv('CRM_BRIDGE_URL', DEFAULT_CRM_BRIDGE_URL)
    return dasar.rstrip('/').rsplit('/', 1)[0] + '/bintang-order-lunas/'


def kirim_order_lunas_ke_crm(order_id):
    """Minta CRM menandai Opportunity asal order ini Closed Won. Aman dipanggil
    berulang: order yang sudah dikonfirmasi CRM dilewati, CRM juga idempoten.
    Kegagalan ditelan (log saja) agar pembayaran di kasir tidak terganggu."""
    asal = (OrderAsalCRM.objects.select_related('order')
            .filter(order_id=order_id, crm_won_terkirim__isnull=True, crm_opportunity_id__isnull=False)
            .first())
    if asal is None:
        return
    order = asal.order
    if order.status_global == 'batal' or not order.total_harga or order.sisa_tagihan:
        return
    kunci = os.getenv('CRM_BRIDGE_API_KEY')
    if not kunci:
        logger.warning('CRM_BRIDGE_API_KEY belum dikonfigurasi -- order lunas %s tidak dikirim ke CRM.', order_id)
        return
    try:
        r = requests.post(
            _url_order_lunas(),
            json={'crm_opportunity_id': asal.crm_opportunity_id, 'order_id': order.id,
                  'total_harga': int(order.total_harga)},
            headers={'X-Api-Key': kunci, 'X-Forwarded-Proto': 'https'},
            timeout=TIMEOUT_LUNAS,
        )
    except requests.RequestException as exc:
        logger.warning('Kirim order lunas %s ke CRM gagal: %s', order_id, exc)
        return
    if r.status_code != 200:
        logger.warning('CRM menjawab %s untuk order lunas %s.', r.status_code, order_id)
        return
    OrderAsalCRM.objects.filter(pk=asal.pk).update(crm_won_terkirim=timezone.now())
