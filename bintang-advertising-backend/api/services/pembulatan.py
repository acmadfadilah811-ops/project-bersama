"""Pembulatan total penjualan kasir (Pengaturan POS > Pembulatan), 2026-10-27.

Contoh: total Rp 29.920 dengan kelipatan Rp 1.000 arah "terdekat" jadi Rp 30.000, selisih (pembulatan)
+Rp 80. Selisih disimpan di POSSale.pembulatan (boleh negatif) dan masuk jurnal ke akun "Pembulatan
penjualan" (lihat accounting/services/pos_posting.py). Kelipatan 0/1 = pembulatan mati.
"""
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal

ARAH_TERDEKAT = 'terdekat'
ARAH_ATAS = 'atas'
ARAH_BAWAH = 'bawah'
ARAH_VALID = (ARAH_TERDEKAT, ARAH_ATAS, ARAH_BAWAH)


def bulatkan(total, kelipatan, arah=ARAH_TERDEKAT):
    """Total setelah dibulatkan ke kelipatan `kelipatan` (Rupiah) menurut `arah`."""
    total = Decimal(str(total or 0))
    kelipatan = Decimal(str(kelipatan or 0))
    if total <= 0 or kelipatan <= 1:
        return total
    rasio = total / kelipatan
    mode = {ARAH_ATAS: ROUND_CEILING, ARAH_BAWAH: ROUND_FLOOR}.get(arah, ROUND_HALF_UP)
    return rasio.quantize(Decimal('1'), rounding=mode) * kelipatan


def hitung_pembulatan(total, kelipatan=None, arah=None):
    """Selisih pembulatan (positif = pelanggan membayar lebih). Tanpa argumen = ikut pengaturan POS."""
    if kelipatan is None:
        from .. import pos_settings
        kelipatan, arah = pos_settings.pembulatan_kelipatan(), pos_settings.pembulatan_arah()
    total = Decimal(str(total or 0))
    return bulatkan(total, kelipatan, arah or ARAH_TERDEKAT) - total
