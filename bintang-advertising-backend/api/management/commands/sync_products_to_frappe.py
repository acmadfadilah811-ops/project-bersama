"""
Sinkronisasi terjadwal Product -> Frappe Item (satu arah, fase 1, 2026-09-09).
Jalankan berkala (mis. cron tiap malam) -- BUKAN dipanggil otomatis tiap
Product disimpan (keputusan user: mulai dari terjadwal, bukan real-time).

Kandidat sync: Product yang belum pernah disinkronkan (FrappeProductSync
belum ada), atau berubah (updated_at) setelah last_synced_at terakhir.
"""
from django.core.management.base import BaseCommand
from django.db.models import F, Q

from api.product_models import Product
from api.frappe_client import FrappeClient
from api.services.frappe_product_sync import sync_product_to_frappe


class Command(BaseCommand):
    help = "Sinkronisasi Product -> Frappe Item (satu arah, master data saja, fase 1)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Hanya tampilkan kandidat tanpa mengirim.")
        parser.add_argument("--limit", type=int, default=None, help="Batasi jumlah produk yang diproses.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        limit = options["limit"]
        client = FrappeClient()

        if not dry_run and not client.is_configured():
            self.stdout.write(self.style.WARNING(
                "FrappeClient belum dikonfigurasi (FRAPPE_API_KEY/FRAPPE_API_SECRET kosong) "
                "atau DISABLE_FRAPPE_SYNC=true -- dibatalkan. Set env var dulu sebelum menjalankan sync sungguhan."
            ))
            return

        qs = Product.objects.filter(
            Q(frappe_sync__isnull=True)
            | Q(frappe_sync__last_synced_at__isnull=True)
            | Q(updated_at__gt=F("frappe_sync__last_synced_at"))
        ).order_by("id")
        if limit:
            qs = qs[:limit]
        candidates = list(qs)

        self.stdout.write(f"Kandidat sync: {len(candidates)}")
        if dry_run:
            for product in candidates:
                self.stdout.write(f"  [DRY RUN] #{product.id} {product.nama} (SKU: {product.sku or '-'})")
            self.stdout.write(self.style.WARNING("DRY RUN -- tidak ada yang benar-benar dikirim."))
            return

        success, failed = 0, 0
        for product in candidates:
            row = sync_product_to_frappe(product, client=client)
            if row.last_error:
                failed += 1
                self.stdout.write(self.style.ERROR(f"GAGAL #{product.id} {product.nama}: {row.last_error}"))
            else:
                success += 1

        self.stdout.write(self.style.SUCCESS(f"Selesai. Berhasil: {success}, Gagal: {failed}."))
