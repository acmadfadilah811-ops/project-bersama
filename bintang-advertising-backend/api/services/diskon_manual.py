"""Diskon custom kasir (keputusan manager 2026-10-31).

Kasir boleh memberi diskon nota sendiri dalam rupiah atau persen, sebagai pilihan ketiga di samping Kupon dan
Diskon Penjualan Otomatis (tidak ditumpuk dengan keduanya). Tanpa batas maksimal dan tanpa wajib alasan, tetapi
tidak pernah melebihi subtotal. Dibulatkan ke rupiah utuh (ROUND_HALF_UP) supaya sama dengan hitungan layar kasir.
"""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError

METODE = "manual"
TIPE = ("persen", "nominal")


def baca(data):
    """(tipe, nilai) dari payload kasir: diskon_manual_tipe + diskon_manual_nilai."""
    tipe = str(data.get("diskon_manual_tipe") or "").strip().lower()
    if tipe not in TIPE:
        raise ValidationError({"error": "Pilih jenis diskon custom: persen atau rupiah."})
    try:
        nilai = Decimal(str(data.get("diskon_manual_nilai")))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"error": "Nilai diskon custom tidak valid."})
    if not nilai.is_finite() or nilai <= 0:
        raise ValidationError({"error": "Nilai diskon custom harus lebih dari nol."})
    if tipe == "persen" and nilai > 100:
        raise ValidationError({"error": "Diskon custom maksimal 100%."})
    return tipe, nilai


def hitung(subtotal, tipe, nilai):
    """Potongan rupiah utuh untuk subtotal ini, tidak melebihi subtotal."""
    subtotal = Decimal(str(subtotal or 0))
    if subtotal <= 0:
        return Decimal("0")
    potongan = subtotal * nilai / Decimal("100") if tipe == "persen" else nilai
    potongan = potongan.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return min(potongan, subtotal)
