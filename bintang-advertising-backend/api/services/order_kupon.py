"""Kupon diskon pada Order (Antrean/Pesanan) -- satu pintu (2026-09-27).

Sebelumnya: (1) Buat Order menyimpan nilai potongan kupon dari browser tanpa
dicek server, (2) Pengaturan Diskon di detail pesanan mengabaikan kode kupon,
(3) pesanan batal tidak mengembalikan kuota kupon. Semua jalur kini lewat sini:
potongan dihitung server dari item pesanan (M6) dengan aturan yang sama seperti
kasir POS (promo_engine.evaluate_coupon_code), dan pemakaian lama pesanan ini
selalu dilepas dulu supaya kuota tidak terhitung dobel.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError


def _hitung_ulang_pemakaian(kupon):
    from ..marketing_models import CouponUsage

    if kupon is None:
        return
    kupon.penggunaan_count = CouponUsage.objects.filter(kupon=kupon).count()
    kupon.save(update_fields=['penggunaan_count'])


def lepas_kupon_order(order, actor=None, simpan=True):
    """Hapus pemakaian kupon pesanan ini (kuota kembali) dan kosongkan kuponnya."""
    from ..marketing_models import CouponUsage

    with transaction.atomic():
        pemakaian = list(CouponUsage.objects.filter(order=order).select_related('kupon'))
        kupon_terdampak = {p.kupon for p in pemakaian if p.kupon_id}
        CouponUsage.objects.filter(order=order).delete()
        for kupon in kupon_terdampak:
            _hitung_ulang_pemakaian(kupon)
        if simpan and (order.kupon_id or order.diskon_kupon):
            order.kupon = None
            order.diskon_kupon = 0
            if actor is not None:
                order._current_user = actor
            order.save()
    return bool(pemakaian)


def terapkan_kupon_order(order, kode, actor=None):
    """Nilai kupon terhadap item pesanan (server) lalu catat pemakaiannya.

    Ditolak (ValidationError, tidak ada yang berubah) bila kupon tidak memenuhi
    syarat. Mengembalikan HasilKupon."""
    from ..marketing_models import KANAL_POS, CouponUsage
    from ..models import Contact
    from ..promo_engine import BarisKeranjang, KonteksPromo, evaluate_coupon_code

    with transaction.atomic():
        # Lepas dulu pemakaian lama pesanan ini: kuota & "sekali per pelanggan"
        # tidak boleh menghitung pesanan yang sedang diubah ini sendiri.
        lepas_kupon_order(order, simpan=False)

        baris, subtotal = [], Decimal('0')
        for item in order.items.all():
            qty = Decimal(str(item.qty or 1))
            total_baris = Decimal(str(item.harga_jual or 0))
            baris.append(BarisKeranjang(product=item.product, variant=item.variant, package=item.paket,
                                        qty=qty, harga=(total_baris / qty) if qty else Decimal('0'),
                                        subtotal=total_baris))
            subtotal += total_baris
        pelanggan = Contact.objects.filter(nomor_wa=order.nomor_wa).first()
        konteks = KonteksPromo(baris=baris, subtotal=subtotal, pelanggan=pelanggan, kanal=KANAL_POS,
                               unit_bisnis_id=order.unit_bisnis_id)
        hasil = evaluate_coupon_code(kode, konteks)
        if not hasil.ok:
            raise ValidationError({'error': f'Kupon ditolak: {hasil.alasan}'})

        order.kupon = hasil.kupon
        order.diskon_kupon = int(round(hasil.diskon))
        order.metode_diskon = 'kupon'
        CouponUsage.objects.create(
            kupon=hasil.kupon, pelanggan=pelanggan, order=order, nilai_diskon=hasil.diskon,
            tanggal=timezone.localdate(), kanal=KANAL_POS,
        )
        _hitung_ulang_pemakaian(hasil.kupon)
        if actor is not None:
            order._current_user = actor
        order.save()
    return hasil
