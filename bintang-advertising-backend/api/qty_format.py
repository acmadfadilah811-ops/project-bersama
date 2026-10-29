"""Format qty item pesanan: kolom OrderItem.qty desimal (4 angka), tampilan & JSON tanpa nol berlebih."""
from decimal import Decimal, InvalidOperation


def _desimal(nilai):
    try:
        return Decimal(str(nilai if nilai is not None else 0))
    except (InvalidOperation, ValueError):
        return Decimal('0')


def tampil_qty(nilai):
    """Decimal('1.0000') -> '1', Decimal('2.5000') -> '2.5', 100 -> '100' (untuk teks/pesan/export)."""
    angka = _desimal(nilai)
    teks = format(angka, 'f')
    if '.' in teks:
        teks = teks.rstrip('0').rstrip('.')
    return teks or '0'


def qty_json(nilai):
    """Bilangan untuk JSON/API: int bila bulat, selain itu float (qty bukan uang, tidak dipakai untuk total uang)."""
    angka = _desimal(nilai)
    return int(angka) if angka == angka.to_integral_value() else float(angka)
