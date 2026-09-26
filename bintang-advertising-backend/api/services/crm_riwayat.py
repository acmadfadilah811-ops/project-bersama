"""Riwayat transaksi satu pelanggan untuk CRM (2026-09-26, UAT SLS-04).

CRM (detail Contact) meminta semua transaksi Bintang milik satu nomor HP/WA:
order Antrean dari kanal mana pun (WA, kasir, staf, CRM) dan penjualan POS.
Nomor dicocokkan setelah dinormalisasi karena format tersimpan campuran
(08..., 62..., +62 ...), sama seperti pelanggan_nomor.py.
"""

from .crm_order import CrmOrderError
from .pelanggan_nomor import cari_customer_per_nomor
from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp

MAKS_ENTRI = 50
MAKS_PINDAI = 500


def _cocok(qs, field, target):
    kandidat = qs.filter(**{f'{field}__endswith': target[-9:]})[:MAKS_PINDAI]
    return [x for x in kandidat if normalisasi_nomor_whatsapp(getattr(x, field)) == target]


def _ringkas(pasangan):
    return ', '.join(f'{nama} x{qty:g}' for nama, qty in pasangan[:5])


def riwayat_pelanggan(nomor):
    from ..models import Contact, Order
    from ..pos_models import POSSale

    target = normalisasi_nomor_whatsapp(nomor)
    if not target or len(target) < 9:
        raise CrmOrderError('Nomor HP/WA pelanggan tidak valid.')

    orders = _cocok(Order.objects.prefetch_related('items').order_by('-waktu'), 'nomor_wa', target)
    kontak = _cocok(Contact.objects.all(), 'nomor_wa', target)
    pos = list(
        POSSale.objects.filter(pelanggan__in=kontak).exclude(status='hold')
        .prefetch_related('items').order_by('-created_at')[:MAKS_PINDAI]
    ) if kontak else []

    entri = []
    for o in orders:
        batal = o.status_global == 'batal'
        entri.append({
            'jenis': 'order', 'id': o.id, 'waktu': o.waktu.isoformat(),
            'kanal': o.get_sumber_display(), 'status': o.get_status_global_display(),
            'total': int(o.total_harga or 0), 'sisa': 0 if batal else int(o.sisa_tagihan or 0),
            'lunas': bool(o.total_harga) and not o.sisa_tagihan and not batal, 'batal': batal,
            'ringkasan': _ringkas([(i.jenis_produk, float(i.qty or 0)) for i in o.items.all()]),
        })
    for s in pos:
        batal = s.status == 'void'
        entri.append({
            'jenis': 'pos', 'id': s.nomor, 'waktu': s.created_at.isoformat(),
            'kanal': 'Kasir (POS)', 'status': 'Void' if batal else 'Lunas',
            'total': int(s.total or 0), 'sisa': 0, 'lunas': not batal, 'batal': batal,
            'ringkasan': _ringkas([(i.nama_snapshot, float(i.qty or 0)) for i in s.items.all()]),
        })
    entri.sort(key=lambda e: e['waktu'], reverse=True)

    sah = [e for e in entri if not e['batal']]
    customer = cari_customer_per_nomor(target)
    return {
        'nomor': target,
        'pelanggan': customer.nama if customer else (kontak[0].nama if kontak else ''),
        'terdaftar': customer is not None,
        'jumlah_transaksi': len(sah),
        'total_belanja_lunas': sum(e['total'] for e in sah if e['lunas']),
        'sisa_tagihan': sum(e['sisa'] for e in sah),
        'pertama': sah[-1]['waktu'] if sah else None,
        'terakhir': sah[0]['waktu'] if sah else None,
        'riwayat': entri[:MAKS_ENTRI],
    }
