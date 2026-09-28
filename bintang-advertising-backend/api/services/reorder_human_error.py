"""Reorder akibat human error staff (2026-09-28).

Pelanggan tetap membayar nota awalnya (100%). Pesanan pengganti (reorder)
dikerjakan ulang untuk pelanggan yang sama, tetapi 50% harga nota awal
ditanggung staff yang melakukan kesalahan:
- 'tunai'       : staff membayar di kasir saat reorder dibuat.
- 'potong_gaji' : dibayar lewat metode "Potong Gaji" (akun Piutang Karyawan),
                  lalu dipotong di slip gaji HR akhir bulan (komponen potongan
                  jenis Piutang karyawan di Posting Gaji menutup piutangnya).
Nota reorder TIDAK dikirim ke pelanggan; catatannya tampil di halaman Nota
Human Error milik staff (TanggunganReorder).

Harga 50% dihitung di server dari item nota awal (M6), bukan dari layar kasir.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError

from ..reorder_models import TanggunganReorder

PERSEN_TANGGUNGAN = Decimal('0.5')
TIPE_POTONG_GAJI = 'Potong Gaji'


def metode_potong_gaji():
    """PaymentMethod akuntansi untuk potong gaji (akun Piutang Karyawan)."""
    from accounting.models import PaymentMethod

    return PaymentMethod.objects.filter(payment_type__iexact=TIPE_POTONG_GAJI, account__isnull=False).first()


def adalah_reorder(order):
    return bool(getattr(order, 'reorder_dari_id', None))


def _item_reorder(order_asal):
    items = []
    for it in order_asal.items.all():
        if it.paket_id:
            continue
        qty = int(it.qty or 1) or 1
        harga_satuan = (Decimal(str(it.harga_jual or 0)) / qty * PERSEN_TANGGUNGAN).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP,
        )
        items.append({
            'product_id': it.product_id,
            'variant_id': it.variant_id,
            'qty': qty,
            'harga_satuan': int(harga_satuan),
            'nama': it.jenis_produk or 'Item Reorder',
            'is_custom_priced': True,
            'panjang': it.panjang or 0,
            'lebar': it.lebar or 0,
            'harga_per_m2': it.harga_per_m2 or 0,
            'catatan': it.keterangan_detail or '',
        })
    if not items:
        raise ValidationError({'error': 'Semua item pada pesanan ini berupa paket, belum didukung untuk Reorder.'})
    return items


def siapkan(data, order_asal):
    """Validasi permintaan reorder & susun item 50% dari nota awal."""
    try:
        staff_id = int(data.get('penanggung_staff_id'))
    except (TypeError, ValueError):
        raise ValidationError({'error': 'Pilih staff yang bertanggung jawab atas kesalahan ini.'})
    staff = get_user_model().objects.filter(pk=staff_id, is_active=True).first()
    if not staff:
        raise ValidationError({'error': 'Staff penanggung tidak valid atau nonaktif.'})

    metode = str(data.get('metode_tanggungan') or '').strip()
    if metode not in TanggunganReorder.Metode.values:
        raise ValidationError({'error': 'Pilih cara bayar tanggungan staff: tunai atau potong gaji.'})

    metode_pembayaran = 'tunai'
    if metode == TanggunganReorder.Metode.POTONG_GAJI:
        pm = metode_potong_gaji()
        if pm is None:
            raise ValidationError({'error': (
                "Metode bayar 'Potong Gaji' belum diatur di Akuntansi (Metode Pembayaran dengan tipe "
                "'Potong Gaji' dan akun Piutang Karyawan). Hubungi Finance."
            )})
        metode_pembayaran = pm.name

    return {
        'staff': staff,
        'metode': metode,
        'metode_pembayaran': metode_pembayaran,
        'items': _item_reorder(order_asal),
    }


def catat_tanggungan(order, rencana, alasan, actor):
    tunai = rencana['metode'] == TanggunganReorder.Metode.TUNAI
    return TanggunganReorder.objects.create(
        order=order,
        staff=rencana['staff'],
        nominal=Decimal(str(order.total_harga or 0)),
        metode=rencana['metode'],
        status=TanggunganReorder.Status.LUNAS if tunai else TanggunganReorder.Status.MENUNGGU_POTONG,
        alasan=alasan[:2000],
        dibuat_oleh=actor if getattr(actor, 'is_authenticated', False) else None,
    )
