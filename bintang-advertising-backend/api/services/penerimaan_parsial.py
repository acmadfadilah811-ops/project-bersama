"""Penerimaan barang parsial untuk Pembelian (2026-09-26, UAT INV-05).

Satu Pembelian boleh diterima dalam beberapa kedatangan. Tiap kedatangan =
satu Stok Masuk yang barisnya tertaut ke baris pembelian (`purchase_item`),
sehingga qty diterima & sisa per item selalu bisa dihitung dari Stok Masuk
yang sudah diposting. Status penerimaan:
  - 'sebagian' : sudah ada yang masuk stok, masih ada sisa;
  - 'diterima' : semua qty sudah masuk stok (atau belum ada posting sama sekali
                 tetapi penerimaan sudah dicatat -- perilaku lama).
Jurnal per kedatangan: lihat purchase_accounting.post_stock_journal.
"""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum

ZERO = Decimal('0')


def qty_diterima(purchase):
    """{purchase_item_id: qty} dari Stok Masuk yang sudah diposting."""
    from ..product_models import StockInDocumentItem

    rows = (StockInDocumentItem.objects
            .filter(document__purchase=purchase, document__status='selesai', purchase_item__isnull=False)
            .values('purchase_item_id').annotate(q=Sum('qty')))
    return {r['purchase_item_id']: r['q'] or ZERO for r in rows}


def sisa_per_item(purchase):
    """[(purchase_item, sisa_qty)] untuk item yang masih punya sisa."""
    sudah = qty_diterima(purchase)
    hasil = []
    for it in purchase.items.select_related('product', 'variant').order_by('id'):
        sisa = (it.qty or ZERO) - sudah.get(it.id, ZERO)
        if sisa > 0:
            hasil.append((it, sisa))
    return hasil


def sudah_ada_posting(purchase):
    return purchase.stock_in_documents.filter(status='selesai').exists()


def lengkap(purchase):
    return not sisa_per_item(purchase)


def validasi_qty_dokumen(document):
    """Tolak posting bila qty baris melebihi sisa yang belum diterima."""
    from django.core.exceptions import ValidationError

    if not document.purchase_id:
        return
    sudah = qty_diterima(document.purchase)
    per_baris = defaultdict(lambda: ZERO)
    for item in document.items.select_related('purchase_item', 'product'):
        if item.purchase_item_id:
            per_baris[item.purchase_item_id] += item.qty or ZERO
    for item in document.items.select_related('purchase_item', 'product'):
        pi = item.purchase_item
        if pi is None:
            continue
        sisa = (pi.qty or ZERO) - sudah.get(pi.id, ZERO)
        if per_baris[pi.id] > sisa:
            raise ValidationError(
                f'Qty "{pi.product.nama}" di Stok Masuk ({per_baris[pi.id]:g}) melebihi sisa yang belum '
                f'diterima ({sisa:g} dari {pi.qty:g}).'
            )


def perbarui_status(purchase):
    """Dipanggil setelah Stok Masuk pembelian diposting."""
    from ..product_models import Purchase

    status = 'diterima' if lengkap(purchase) else 'sebagian'
    Purchase.objects.filter(pk=purchase.pk).exclude(receive_status=status).update(receive_status=status)
    purchase.receive_status = status
    return status


def dokumen_sebelumnya(document):
    """Stok Masuk pembelian yang sama yang sudah diposting sebelum dokumen ini."""
    if not document.purchase_id:
        return []
    return list(document.purchase.stock_in_documents.filter(status='selesai').exclude(pk=document.pk))


def qty_diterima_produk(purchase):
    """{(product_id, variant_id): qty} dari Stok Masuk pembelian yang sudah diposting."""
    from ..product_models import StockInDocumentItem

    rows = (StockInDocumentItem.objects.filter(document__purchase=purchase, document__status='selesai')
            .values('product_id', 'variant_id').annotate(q=Sum('qty')))
    return {(r['product_id'], r['variant_id']): r['q'] or ZERO for r in rows}
