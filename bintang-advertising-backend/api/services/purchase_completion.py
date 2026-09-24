"""Pembelian otomatis pindah ke "Telah Diproses" begitu semua syaratnya terpenuhi
(2026-09-24, instruksi user: sudah lunas + sudah diterima -> harus masuk
kategori Telah Diproses tanpa menekan "Selesai" manual).
"""
from django.db import transaction

from ..product_models import Purchase
from ..purchase_workflow_models import catat_purchase


def selesaikan_otomatis_jika_siap(purchase, actor=None):
    """Ubah status pembelian jadi 'selesai' bila SEMUA syarat ini terpenuhi:

    - masih 'draft', bukan retur, dan penerimaan sudah 'diterima';
    - lunas (pembayaran nyata `payment_status == 'lunas'` atau penanda
      administratif `payment_marked_paid`, sama dengan label "Lunas" di UI);
    - kalau "lanjut tambah stok" aktif: dokumen Stok Masuk sudah ADA dan SEMUA
      sudah diposting -- draft Stok Masuk sengaja TIDAK diposting otomatis
      (petugas gudang bisa mengubah qty/kadaluwarsa dulu di halaman Stok Masuk).

    Dipanggil setelah pembayaran tercatat, Stok Masuk diposting, penerimaan
    dicatat, atau penanda bayar diubah. Mengembalikan True bila status berubah.
    Aman dipanggil berulang (idempoten) dan harus di dalam transaksi pemanggil.
    """
    with transaction.atomic():
        purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)
        if purchase.is_retur or purchase.status != 'draft' or purchase.receive_status != 'diterima':
            return False
        if not (purchase.payment_status == 'lunas' or purchase.payment_marked_paid):
            return False
        if purchase.lanjut_tambah_stok:
            status_dokumen = list(
                purchase.stock_in_documents.exclude(status='batal').values_list('status', flat=True)
            )
            if not status_dokumen or 'draft' in status_dokumen:
                return False

        purchase.status = 'selesai'
        purchase.save(update_fields=['status', 'updated_at'])
        catat_purchase(
            purchase, actor, 'COMPLETE',
            'Pembelian otomatis dipindahkan ke Telah Diproses (sudah lunas dan sudah diterima).',
        )
        return True
