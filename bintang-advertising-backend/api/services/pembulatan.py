"""Pembulatan total penjualan kasir (Pengaturan POS > Pembulatan), 2026-10-27.

Aturan: diskon dibulatkan ke bawah, pembayaran (total yang ditagih) dibulatkan ke atas.
Contoh: total Rp 29.920 dengan kelipatan Rp 1.000 arah "atas" jadi Rp 30.000, selisih (pembulatan)
+Rp 80. Selisih disimpan di POSSale.pembulatan (boleh negatif) dan masuk jurnal ke akun "Pembulatan
penjualan" (lihat accounting/services/pos_posting.py). Kelipatan 0/1 = pembulatan mati.
"""
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal

ARAH_TERDEKAT = 'terdekat'
ARAH_ATAS = 'atas'
ARAH_BAWAH = 'bawah'
ARAH_VALID = (ARAH_TERDEKAT, ARAH_ATAS, ARAH_BAWAH)
BREAKPOINT_BAWAAN = 50  # persen dari kelipatan; sama dengan "Rounding Range Down" Olsera (bawaan 50)


def bulatkan(total, kelipatan, arah=ARAH_TERDEKAT, breakpoint_persen=BREAKPOINT_BAWAAN):
    """Total setelah dibulatkan ke kelipatan `kelipatan` (Rupiah) menurut `arah`.
    Arah 'terdekat' (mode Otomatis Olsera): sisa <= breakpoint% dari kelipatan dibulatkan ke bawah,
    lebih dari itu ke atas (mis. 9.500 dengan kelipatan 1.000 dan breakpoint 50% jadi 9.000)."""
    total = Decimal(str(total or 0))
    kelipatan = Decimal(str(kelipatan or 0))
    if total <= 0 or kelipatan <= 1:
        return total
    if arah == ARAH_TERDEKAT or arah not in ARAH_VALID:
        sisa = total % kelipatan
        if sisa == 0:
            return total
        batas = kelipatan * Decimal(str(breakpoint_persen)) / Decimal('100')
        dasar = total - sisa
        return dasar if sisa <= batas else dasar + kelipatan
    rasio = total / kelipatan
    mode = ROUND_CEILING if arah == ARAH_ATAS else ROUND_FLOOR
    return rasio.quantize(Decimal('1'), rounding=mode) * kelipatan


def hitung_pembulatan_penjualan(total, total_diskon=0, kelipatan=None, arah_bayar=None, arah_diskon=None, breakpoint_persen=None):
    """Selisih pembulatan penjualan kasir (positif = pelanggan membayar lebih), dua tahap:
    1) total diskon dibulatkan (bawaan ke bawah) -> diskon yang hilang menambah total;
    2) total yang ditagih dibulatkan (bawaan ke atas).
    Tanpa argumen pengaturan = ikut Pengaturan POS."""
    if kelipatan is None:
        from .. import pos_settings
        kelipatan = pos_settings.pembulatan_kelipatan()
        arah_bayar, arah_diskon = pos_settings.pembulatan_arah(), pos_settings.pembulatan_arah_diskon()
        breakpoint_persen = pos_settings.pembulatan_breakpoint()
    if breakpoint_persen is None:
        breakpoint_persen = BREAKPOINT_BAWAAN
    total = Decimal(str(total or 0))
    diskon = Decimal(str(total_diskon or 0))
    if total <= 0 or Decimal(str(kelipatan or 0)) <= 1:
        return Decimal('0')
    total_setelah_diskon = total
    if diskon > 0:
        selisih_diskon = diskon - bulatkan(diskon, kelipatan, arah_diskon or ARAH_BAWAH, breakpoint_persen)
        total_setelah_diskon = max(Decimal('0'), total + selisih_diskon)
    return bulatkan(total_setelah_diskon, kelipatan, arah_bayar or ARAH_ATAS, breakpoint_persen) - total


def hitung_pembulatan(total, kelipatan=None, arah=None, breakpoint_persen=None):
    """Selisih pembulatan (positif = pelanggan membayar lebih). Tanpa argumen = ikut pengaturan POS."""
    if kelipatan is None:
        from .. import pos_settings
        kelipatan, arah = pos_settings.pembulatan_kelipatan(), pos_settings.pembulatan_arah()
        breakpoint_persen = pos_settings.pembulatan_breakpoint()
    if breakpoint_persen is None:
        breakpoint_persen = BREAKPOINT_BAWAAN
    total = Decimal(str(total or 0))
    return bulatkan(total, kelipatan, arah or ARAH_TERDEKAT, breakpoint_persen) - total
