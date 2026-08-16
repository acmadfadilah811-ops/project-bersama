"""Resolusi harga produk sesuai `Product.price_type` ('flat'/'tier'/'per_m2')
dan `Product.tiers` — satu sumber kebenaran dipakai kalkulator bot WA (lihat
`wa_ai_tools.py`) supaya konsisten dengan harga yang dilihat kasir di menu
Produk & Inventori, bukan tabel `ProductPrice` legacy terpisah yang dipakai
alur rule-based lama di wa_logic.py.

TIDAK PERNAH menaksir: kalau data yang dibutuhkan (panjang/lebar untuk
per_m2, tiers untuk tier) tidak tersedia, melempar HargaProdukError — bukan
mengembalikan harga tebakan.
"""

from decimal import Decimal, InvalidOperation


class HargaProdukError(Exception):
    pass


def _to_decimal(value, field_name):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HargaProdukError(f"{field_name} tidak valid.")


def _base_harga(product, variant=None, kanal='toko'):
    if variant is not None:
        if kanal == 'online' and variant.harga_jual_online is not None:
            return Decimal(str(variant.harga_jual_online))
        if variant.harga_jual_toko is not None:
            return Decimal(str(variant.harga_jual_toko))
    if kanal == 'online':
        return Decimal(str(product.harga_jual_online or 0))
    return Decimal(str(product.harga_jual_toko or 0))


def _pilih_tier_qty(kandidat, qty):
    terpilih = None
    for t in kandidat:
        try:
            min_qty = Decimal(str(t.get('min_qty', 0)))
            harga = Decimal(str(t.get('price', 0)))
        except (TypeError, ValueError, AttributeError):
            continue
        if qty >= min_qty and (terpilih is None or min_qty > terpilih[0]):
            terpilih = (min_qty, harga)
    return terpilih


def _harga_tier(product, qty, customer_group_nama=None):
    tiers = product.tiers or []
    if not isinstance(tiers, list) or not tiers:
        raise HargaProdukError(f"Produk '{product.nama}' bertipe tier tapi belum ada data tiers.")

    # Tier dengan `tipe_pelanggan` diisi (mis. "Reseller") cuma berlaku utk
    # pelanggan bertipe itu; tier dengan `tipe_pelanggan` kosong/tidak ada
    # berlaku umum. Kalau pelanggan (customer_group_nama) punya tier khusus
    # yang qty-nya memenuhi, itu didahulukan dari tier umum — supaya harga
    # per tipe pelanggan benar-benar beda, bukan cuma metadata kosmetik
    # (bug ditemukan & diperbaiki 2026-08-13, lihat tests_product_pricing.py).
    if customer_group_nama:
        khusus = [
            t for t in tiers
            if isinstance(t, dict) and str(t.get('tipe_pelanggan') or '').strip().lower() == customer_group_nama.strip().lower()
        ]
        terpilih = _pilih_tier_qty(khusus, qty)
        if terpilih is not None:
            return terpilih[1]

    umum = [t for t in tiers if isinstance(t, dict) and not str(t.get('tipe_pelanggan') or '').strip()]
    terpilih = _pilih_tier_qty(umum, qty)
    if terpilih is None:
        raise HargaProdukError(f"Qty {qty} tidak memenuhi tier harga produk '{product.nama}'.")
    return terpilih[1]


def hitung_harga(product, *, qty=1, panjang=None, lebar=None, variant=None, kanal='toko', paksa_per_m2=False, customer_group_nama=None):
    """Hitung harga_satuan & total sesuai price_type produk.

    `paksa_per_m2=True` (opt-in eksplisit, default False — tidak mengubah
    perilaku caller lama seperti bot WA) memaksa perhitungan luas x tarif
    WALAUPUN `product.price_type` bukan 'per_m2' — dipakai kasir Antrean WA
    yang mau P x L selalu jadi pengali harga apa pun tipe produknya di
    katalog (instruksi eksplisit user 2026-08-12, katalog belum semuanya
    dikonfigurasi price_type='per_m2' dengan benar). Tarif yang dipakai
    tetap field harga yang sama (`_base_harga`) — bukan field terpisah.

    Return dict siap-JSON: {price_type, harga_satuan, qty, total, ...}.
    Melempar HargaProdukError kalau data yang dibutuhkan tidak tersedia.
    """
    # `qty if qty is not None else 1` (bukan `qty or 1`) — qty=0 harus tetap
    # ditolak di bawah, bukan diam-diam jadi 1 karena 0 falsy di Python.
    qty = _to_decimal(qty if qty is not None else 1, 'Qty')
    if qty <= 0:
        raise HargaProdukError("Qty harus lebih dari nol.")

    price_type = product.price_type or 'flat'
    pakai_per_m2 = paksa_per_m2 or price_type == 'per_m2'

    if pakai_per_m2:
        if not panjang or not lebar:
            raise HargaProdukError(
                f"Produk '{product.nama}' dihitung per meter persegi — butuh panjang & lebar (meter)."
            )
        panjang_d = _to_decimal(panjang, 'Panjang')
        lebar_d = _to_decimal(lebar, 'Lebar')
        if panjang_d <= 0 or lebar_d <= 0:
            raise HargaProdukError("Panjang dan lebar harus lebih dari nol.")
        harga_per_m2 = _base_harga(product, variant, kanal)
        luas = panjang_d * lebar_d
        harga_satuan = (luas * harga_per_m2).quantize(Decimal('1'))
        total = harga_satuan * qty
        return {
            'price_type': 'per_m2' if price_type == 'per_m2' else 'per_m2_manual',
            'panjang_m': float(panjang_d), 'lebar_m': float(lebar_d), 'luas_m2': float(luas),
            'harga_per_m2': float(harga_per_m2),
            'harga_satuan': float(harga_satuan), 'qty': float(qty), 'total': float(total),
        }

    if price_type == 'tier':
        harga_satuan = _harga_tier(product, qty, customer_group_nama=customer_group_nama)
        total = harga_satuan * qty
        return {
            'price_type': 'tier',
            'harga_satuan': float(harga_satuan), 'qty': float(qty), 'total': float(total),
        }

    # flat
    harga_satuan = _base_harga(product, variant, kanal)
    total = harga_satuan * qty
    return {
        'price_type': 'flat',
        'harga_satuan': float(harga_satuan), 'qty': float(qty), 'total': float(total),
    }
