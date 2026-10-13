"""Satu pembaca pengaturan cetak resi/invoice (2026-10-13).

Sebelumnya tiap dokumen (resi PDF WA, invoice PDF WA, resi email, resi digital)
membaca SystemConfig sendiri-sendiri dengan nilai bawaan karangan -- alamat
"Jl. Produksi No. 123, Kota", telepon "0812-3456-7890", dan rekening "Transfer
BCA: 1234567890" -- sehingga pelanggan menerima dokumen berisi data palsu selama
pengaturan toko belum diisi. Sekarang semua dokumen memakai fungsi ini, dan
isian yang kosong berarti barisnya tidak dicetak.

Aturan nilai bawaan: kunci BELUM pernah disimpan -> pakai bawaan sistem; kunci
sudah disimpan (walau kosong) -> hormati pilihan pengguna.
"""

import json

from ..models import SystemConfig

BAWAAN = {
    'bisnis_nama': 'StarPhoto & Advertising',
    'bisnis_alamat': '',
    'bisnis_no_telepon': '',
    'bisnis_deskripsi': '',
    'bisnis_tagline': 'Solusi Cetak & Promosi Terpercaya',
    'bisnis_info_pembayaran': '',
    'bisnis_invoice_terms': '',
    'bisnis_logo_url': '',
    'pos_resi_judul': 'Resi Pembelian',
    'pos_resi_judul_email': 'Resi Pembelian',
    'pos_resi_catatan': 'Terima Kasih Atas Kunjungan Anda',
}


def _benar(nilai):
    return str(nilai).strip().lower() == 'true'


def ambil():
    """Kamus pengaturan cetak yang sudah dibersihkan."""
    kunci = list(BAWAAN) + ['pos_resi_sembunyikan_no_pesanan', 'pos_ext_settings']
    tersimpan = dict(SystemConfig.objects.filter(key__in=kunci).values_list('key', 'value'))
    nilai = {k: (tersimpan[k] if k in tersimpan else v) for k, v in BAWAAN.items()}
    nilai = {k: (v or '').strip() for k, v in nilai.items()}
    try:
        ext = json.loads(tersimpan.get('pos_ext_settings') or '{}')
        ext = ext if isinstance(ext, dict) else {}
    except (TypeError, ValueError):
        ext = {}
    return {
        'nama': nilai['bisnis_nama'] or BAWAAN['bisnis_nama'],
        'alamat': nilai['bisnis_alamat'],
        'telepon': nilai['bisnis_no_telepon'],
        'deskripsi': nilai['bisnis_deskripsi'],
        'tagline': nilai['bisnis_tagline'],
        'info_pembayaran': nilai['bisnis_info_pembayaran'] or nilai['bisnis_deskripsi'],
        'syarat': nilai['bisnis_invoice_terms'],
        'logo_url': nilai['bisnis_logo_url'],
        # Judul tidak boleh kosong (UI: "Jika kosong, akan berjudul Resi Pembelian").
        'judul': nilai['pos_resi_judul'] or BAWAAN['pos_resi_judul'],
        'judul_email': nilai['pos_resi_judul_email'] or BAWAAN['pos_resi_judul_email'],
        'catatan': nilai['pos_resi_catatan'],
        'sembunyikan_nomor': _benar(tersimpan.get('pos_resi_sembunyikan_no_pesanan', 'false')),
        'ext': ext,
    }


def judul_dengan_nomor(judul, nomor, sembunyikan_nomor, pemisah=' - '):
    """'Resi Pembelian - POS-001'; nomor dibuang bila pengaturan menyembunyikannya."""
    judul = (judul or '').strip()
    if sembunyikan_nomor or not nomor:
        return judul or 'Resi'
    return f'{judul}{pemisah}{nomor}' if judul else str(nomor)
