"""Susulkan jurnal HPP untuk mutasi stok Order yang terlewat sebelum
accounting/services/order_stock_hpp.py ada (2026-09-28).

Default hanya simulasi (tidak ada yang ditulis). Pakai --terapkan untuk posting.
Idempoten: mutasi yang sudah punya jurnal dilewati.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.models import JournalEntry
from accounting.services.order_stock_hpp import posting_hpp_mutasi_order


class Simulasi(Exception):
    pass


class Command(BaseCommand):
    help = "Susulkan jurnal HPP mutasi stok Order (default simulasi; --terapkan untuk posting)."

    def add_arguments(self, parser):
        parser.add_argument("--terapkan", action="store_true", help="Benar-benar posting jurnal.")

    def handle(self, *args, **opts):
        from api.product_models import ProductStockMovement

        mutasi = (ProductStockMovement.objects
                  .filter(order__isnull=False, pos_sale__isnull=True,
                          tipe__in=["penjualan", "pengembalian"], hpp_total__gt=0)
                  .select_related("product").order_by("id"))
        sudah = set(JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.ORDER_STOCK_HPP,
        ).exclude(status=JournalEntry.Status.VOID).values_list("source_id", flat=True))

        dibuat = []
        try:
            with transaction.atomic():
                for m in mutasi:
                    if m.id in sudah:
                        continue
                    je = posting_hpp_mutasi_order(m, actor=None)
                    if je is not None:
                        # Nilai dibaca sebelum simulasi di-rollback.
                        nilai = sum((line.debit for line in je.lines.all()), Decimal("0"))
                        dibuat.append((m, nilai))
                if not opts["terapkan"]:
                    raise Simulasi
        except Simulasi:
            pass

        total = Decimal("0")
        for m, nilai in dibuat:
            total += nilai if m.tipe == "penjualan" else -nilai
            self.stdout.write(f"mutasi #{m.id} {m.tipe} {m.product.nama} Order {m.order_id} jurnal {nilai} ({m.tanggal})")
        mode = "DIPOSTING" if opts["terapkan"] else "SIMULASI (tidak ada yang ditulis)"
        self.stdout.write(f"{mode}: {len(dibuat)} jurnal, HPP bersih {total}")
