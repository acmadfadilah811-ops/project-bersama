"""Mesin Loyalty Point untuk POS — perolehan (earn) & penebusan (redeem) poin.

Poin adalah milik akun member (Customer), yang ditautkan ke pelanggan POS
(Contact) lewat Contact.customer. Modul ini murni perhitungan + aturan; mutasi
saldo & pencatatan transaksi dilakukan di dalam create_sale (satu transaksi
atomik) agar konsisten dengan pemotongan stok.
"""
from decimal import Decimal, ROUND_DOWN

MONEY = Decimal('0.01')


def get_setting():
    """Pengaturan loyalty aktif (singleton — ambil baris pertama)."""
    from .marketing_models import LoyaltyPointSetting
    return LoyaltyPointSetting.objects.order_by('id').first()


def resolve_customer(contact):
    """Akun member (Customer) dari Contact pelanggan POS, atau None."""
    if contact is None:
        return None
    return getattr(contact, 'customer', None)


def _tipe_cocok(setting, customer):
    """True bila aturan 'berlaku untuk tipe pelanggan' mencakup grup customer."""
    val = (setting.berlaku_tipe_pelanggan or 'Semua').strip()
    if val == '' or val.lower() == 'semua':
        return True
    grup = customer.customer_group.nama if customer and customer.customer_group else None
    allowed = [s.strip() for s in val.split(',') if s.strip()]
    return grup in allowed


def compute_redemption_discount(redemption, subtotal):
    """Nilai diskon (Rp) dari sebuah opsi penukaran atas `subtotal`.

    - tipe '%' : persen dari subtotal, dibatasi maksimal_jumlah_diskon (bila > 0).
    - tipe lain: nominal tetap (jumlah_diskon).
    Selalu dibatasi agar tidak melebihi subtotal.
    """
    subtotal = Decimal(str(subtotal or 0))
    if redemption.tipe_diskon == '%':
        nilai = subtotal * Decimal(str(redemption.jumlah_diskon or 0)) / Decimal('100')
        maks = Decimal(str(redemption.maksimal_jumlah_diskon or 0))
        if maks > 0:
            nilai = min(nilai, maks)
    else:
        nilai = Decimal(str(redemption.jumlah_diskon or 0))
    nilai = min(nilai, subtotal)
    if nilai < 0:
        nilai = Decimal('0')
    return nilai.quantize(MONEY)


def earn_points(*, customer, setting, sale_total, items):
    """Hitung poin yang diperoleh dari sebuah transaksi.

    items: list of (product, variant, qty_base). qty_base = satuan DASAR
    (aman UOM/FIFO — tidak memakai qty satuan terpilih).
    Mengembalikan bilangan bulat poin (dibulatkan ke bawah).
    """
    if not setting or not setting.is_active:
        return 0
    if not _tipe_cocok(setting, customer):
        return 0

    poin = Decimal('0')
    if setting.cara_mendapatkan == 'order':
        minimal = Decimal(str(setting.min_total_pemesanan or 0))
        per = Decimal(str(setting.point_diperoleh or 0))
        total = Decimal(str(sale_total or 0))
        if minimal > 0 and total >= minimal:
            if setting.berlaku_kelipatan:
                kelipatan = (total / minimal).to_integral_value(rounding=ROUND_DOWN)
                poin = per * kelipatan
            else:
                poin = per
    else:  # 'product' — poin per produk (varian mengalahkan produk bila diisi)
        for product, variant, qty_base in items:
            pp = None
            if variant is not None and getattr(variant, 'loyalty_points', 0):
                pp = variant.loyalty_points
            elif product is not None:
                pp = getattr(product, 'loyalty_points', 0)
            if pp:
                poin += Decimal(str(pp)) * Decimal(str(qty_base or 0))

    return int(poin.to_integral_value(rounding=ROUND_DOWN))
