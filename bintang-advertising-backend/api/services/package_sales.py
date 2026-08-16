"""Aturan tunggal penjualan ProductPackage pada POS dan pesanan WA/admin."""
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..product_models import ProductPackage


def _qty(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({'error': 'Qty paket tidak valid.'})
    if result <= 0:
        raise ValidationError({'error': 'Qty paket harus lebih dari nol.'})
    return result


def resolve_package_for_sale(package_id, quantity, *, channel, lock=False):
    """Validasi paket aktif dan kembalikan ``(paket, qty, harga_satuan)``.

    POS menggunakan harga offline. Pesanan dari WA/admin adalah kanal online
    dan memakai harga online bila sudah diisi, lalu fallback ke harga offline.
    Harga selalu berasal dari master, bukan dari payload browser.
    """
    queryset = ProductPackage.objects.prefetch_related('items__product', 'items__variant')
    if lock:
        queryset = queryset.select_for_update()
    package = queryset.filter(pk=package_id).first()
    if not package:
        raise ValidationError({'error': 'Paket produk tidak ditemukan.'})
    if not package.publikasi or package.habis_stok:
        raise ValidationError({'error': f"Paket '{package.nama}' sedang tidak tersedia."})

    now = timezone.now()
    if package.periode_mulai and now < package.periode_mulai:
        raise ValidationError({'error': f"Paket '{package.nama}' belum mulai dijual."})
    if package.periode_selesai and now > package.periode_selesai:
        raise ValidationError({'error': f"Paket '{package.nama}' sudah berakhir masa jualnya."})
    if channel == 'pos' and not package.tampil_pos:
        raise ValidationError({'error': f"Paket '{package.nama}' tidak ditampilkan di POS."})
    if not package.items.exists():
        raise ValidationError({'error': f"Paket '{package.nama}' belum memiliki komponen stok."})

    qty = _qty(quantity)
    if qty < package.minimal_pesanan:
        raise ValidationError({'error': f"Minimal pembelian paket '{package.nama}' adalah {package.minimal_pesanan}."})
    if package.maksimal_pesanan and qty > package.maksimal_pesanan:
        raise ValidationError({'error': f"Maksimal pembelian paket '{package.nama}' adalah {package.maksimal_pesanan}."})

    price = package.harga_jual_offline
    if channel in ('wa', 'online') and package.harga_jual_online and package.harga_jual_online > 0:
        price = package.harga_jual_online
    return package, qty, Decimal(str(price or 0))
