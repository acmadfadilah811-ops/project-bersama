"""Pencocokan pelanggan per nomor HP/WA tanpa duplikat (2026-09-26).

Nomor pelanggan tersimpan dalam format campuran (0812..., 62812..., +62 812-...).
Dulu sinkron Contact -> Customer memakai get_or_create(handphone=nomor) yang
mencocokkan persis, sehingga '081234567890' dan '6281234567890' dianggap dua
pelanggan berbeda dan terbuat duplikat."""

from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp


def cari_customer_per_nomor(nomor, kecuali_id=None):
    from ..customer_models import Customer

    target = normalisasi_nomor_whatsapp(nomor)
    if not target:
        return None
    # Kandidat lewat 4 digit terakhir (pemisah spasi/tanda hubung jarang ada di sana),
    # lalu dicocokkan penuh setelah dinormalisasi.
    qs = Customer.objects.filter(handphone__endswith=target[-4:]).order_by('id')
    if kecuali_id:
        qs = qs.exclude(pk=kecuali_id)
    for c in qs:
        if normalisasi_nomor_whatsapp(c.handphone) == target:
            return c
    return None


def pesan_nomor_terpakai(customer):
    return (
        f'Nomor WA ini sudah dipakai pelanggan "{customer.nama}". '
        'Satu nomor WA hanya untuk satu pelanggan; pilih pelanggan tersebut, jangan buat baru.'
    )


def dapatkan_atau_buat_customer(nomor, nama, email=''):
    """Return (customer, dibuat). Nomor baru disimpan dalam format 62..."""
    from ..customer_models import Customer

    ada = cari_customer_per_nomor(nomor)
    if ada:
        return ada, False
    target = normalisasi_nomor_whatsapp(nomor) or str(nomor)
    return Customer.objects.create(nama=nama or target, handphone=target, email=email or ''), True
