"""HPP per SPK untuk Papan Kerja SPK (owner/manager/admin), 2026-10-26.

HPP satu SPK = HPP PRODUK yang terjual (mutasi stok 'penjualan', biaya FIFO) + HPP BAHAN
yang dipakai (resep BoM / pemakaian produksi). Semua angka dibaca dari data yang sudah
tercatat -- tidak ada perhitungan harga baru:

* Produk: ProductStockMovement tipe 'penjualan' milik nota POS / order SPK itu. Mutasi
  digabung per produk per transaksi, jadi dibagi ke item bila ada beberapa baris produk
  yang sama (porsi menurut qty).
* Bahan: ProductStockMovement tipe 'keluar' ("Pemakaian bahan ...") yang catatannya
  menyebut "Job #<id>" (order / pemakaian produksi) atau penanda nota POS
  ("POS <nomor> - Produk #<id>"). Bahan tanpa produk sumber (tidak punya FIFO) dihitung
  dari RestockHistory x InventoryItem.cost_per_unit seperti HPP bahan order yang lama.

Satu item bisa punya beberapa SPK (Desain -> Cetak -> Finishing); HPP produk/bahan nota
dicatat di SPK pertama item itu saja supaya total Papan Kerja tidak dobel.
"""
import re
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Min

from ..models import JobBoard, OrderItem, RestockHistory
from ..pos_models import POSSaleItem
from ..product_models import ProductStockMovement

_POLA_JOB = re.compile(r'Job #(\d+)(?!\d)')
_POLA_POS = re.compile(r'(POS \S+ - Produk #\d+(?:/\d+)?)')
_NOL = Decimal('0')


def _indeks_bahan(jobs):
    """({job_id: Decimal}, {penanda_pos: Decimal}) dari pemakaian bahan sejak SPK tertua."""
    tertua = min((j.dibuat_pada for j in jobs if j.dibuat_pada), default=None)
    per_job, per_pos = defaultdict(lambda: _NOL), defaultdict(lambda: _NOL)

    def catat(teks, nilai):
        if not nilai:
            return
        for m in _POLA_JOB.finditer(teks or ''):
            per_job[int(m.group(1))] += nilai
        m = _POLA_POS.search(teks or '')
        if m:
            per_pos[m.group(1)] += nilai

    batas = (tertua - timedelta(days=1)) if tertua else None
    mutasi = ProductStockMovement.objects.filter(tipe='keluar', catatan__startswith='Pemakaian bahan')
    riwayat = RestockHistory.objects.filter(
        delta__lt=0, item__product__isnull=True, keterangan__startswith='Pemakaian',
    ).select_related('item')
    if batas:
        mutasi = mutasi.filter(created_at__gte=batas)
        riwayat = riwayat.filter(waktu__gte=batas)
    for catatan, hpp in mutasi.values_list('catatan', 'hpp_total'):
        catat(catatan, Decimal(str(hpp or 0)))
    for h in riwayat:
        catat(h.keterangan, Decimal(str(abs(h.delta) * (h.item.cost_per_unit or 0))))
    return per_job, per_pos


def hitung_hpp_jobs(jobs):
    """{job_id: {'produk': Decimal, 'bahan': Decimal}} untuk daftar JobBoard."""
    jobs = list(jobs)
    hasil = {j.id: {'produk': _NOL, 'bahan': _NOL} for j in jobs}
    if not jobs:
        return hasil

    per_job, per_pos = _indeks_bahan(jobs)

    pos_item_ids = {j.pos_sale_item_id for j in jobs if j.pos_sale_item_id}
    order_item_ids = {j.order_item_id for j in jobs if j.order_item_id}
    pertama_pos = dict(
        JobBoard.objects.filter(pos_sale_item_id__in=pos_item_ids)
        .values('pos_sale_item_id').annotate(m=Min('id')).values_list('pos_sale_item_id', 'm')
    )
    pertama_order = dict(
        JobBoard.objects.filter(order_item_id__in=order_item_ids)
        .values('order_item_id').annotate(m=Min('id')).values_list('order_item_id', 'm')
    )

    # ── Nota POS ──
    pos_jobs = [j for j in jobs if j.pos_sale_item_id]
    sale_ids = {j.pos_sale_item.sale_id for j in pos_jobs}
    qty_pos, hpp_pos = defaultdict(lambda: _NOL), defaultdict(lambda: _NOL)
    for sale_id, product_id, variant_id, qty in POSSaleItem.objects.filter(sale_id__in=sale_ids).values_list(
        'sale_id', 'product_id', 'variant_id', 'qty',
    ):
        qty_pos[(sale_id, product_id, variant_id)] += Decimal(str(qty or 0))
    for sale_id, product_id, variant_id, hpp in ProductStockMovement.objects.filter(
        pos_sale_id__in=sale_ids, tipe='penjualan',
    ).values_list('pos_sale_id', 'product_id', 'variant_id', 'hpp_total'):
        hpp_pos[(sale_id, product_id, variant_id)] += Decimal(str(hpp or 0))

    for j in pos_jobs:
        hasil[j.id]['bahan'] += per_job.get(j.id, _NOL)  # pemakaian manual lewat "use-materials"
        item = j.pos_sale_item
        if pertama_pos.get(item.id) != j.id or not item.product_id:
            continue
        kunci = (item.sale_id, item.product_id, item.variant_id)
        total_qty = qty_pos.get(kunci) or _NOL
        porsi = (Decimal(str(item.qty or 0)) / total_qty) if total_qty else Decimal('1')
        marker = f"POS {item.sale.nomor} - Produk #{item.product_id}" + (f"/{item.variant_id}" if item.variant_id else '')
        hasil[j.id]['produk'] += hpp_pos.get(kunci, _NOL) * porsi
        hasil[j.id]['bahan'] += per_pos.get(marker, _NOL) * porsi

    # ── Order ──
    order_jobs = [j for j in jobs if j.order_item_id]
    order_ids = {j.order_item.order_id for j in order_jobs}
    qty_order, hpp_order = defaultdict(lambda: _NOL), defaultdict(lambda: _NOL)
    for order_id, product_id, variant_id, qty in OrderItem.objects.filter(order_id__in=order_ids).values_list(
        'order_id', 'product_id', 'variant_id', 'qty',
    ):
        qty_order[(order_id, product_id, variant_id)] += Decimal(str(qty or 0))
    for order_id, product_id, variant_id, hpp in ProductStockMovement.objects.filter(
        order_id__in=order_ids, tipe='penjualan',
    ).values_list('order_id', 'product_id', 'variant_id', 'hpp_total'):
        hpp_order[(order_id, product_id, variant_id)] += Decimal(str(hpp or 0))

    for j in order_jobs:
        hasil[j.id]['bahan'] += per_job.get(j.id, _NOL)  # sudah menyebut Job #id persis
        item = j.order_item
        if pertama_order.get(item.id) != j.id or not item.product_id:
            continue
        kunci = (item.order_id, item.product_id, item.variant_id)
        total_qty = qty_order.get(kunci) or _NOL
        porsi = (Decimal(str(item.qty or 0)) / total_qty) if total_qty else Decimal('1')
        hasil[j.id]['produk'] += hpp_order.get(kunci, _NOL) * porsi

    return hasil
