"""
Backfill Piutang Usaha + Pendapatan (accrual) untuk Order yang SUDAH
berstatus 'selesai' dari SEBELUM fitur accrual Order aktif (keputusan
finance 2026-09-09, lihat accounting/services/order_posting.py::
post_order_revenue_recognition_journal). Order lama tidak pernah dijurnal
lewat Piutang -- ini membuat Neraca langsung mencerminkan Piutang riil yang
masih beredar dari order lama yang belum lunas, sesuai keputusan pengguna
untuk backfill (bukan cuma berlaku maju untuk order baru).

Idempotent: order yang sudah punya JournalEntry ORDER_REVENUE_RECOGNITION
(via activity log COMPLETE-nya) dilewati. Mendukung --dry-run.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Order, OrderActivityLog
from accounting.models import JournalEntry
from accounting.services.order_posting import post_order_revenue_recognition_journal


class Command(BaseCommand):
    help = "Backfill jurnal Piutang Usaha + Pendapatan (accrual) untuk Order 'selesai' lama yang belum pernah diakui."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Hanya tampilkan estimasi tanpa menyimpan ke database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        already_recognized_order_ids = set(
            OrderActivityLog.objects.filter(
                tindakan="COMPLETE",
                id__in=JournalEntry.objects.filter(
                    source_type=JournalEntry.SourceType.ORDER_REVENUE_RECOGNITION,
                ).exclude(status=JournalEntry.Status.VOID).values_list("source_id", flat=True),
            ).values_list("order_id", flat=True)
        )

        orders = Order.objects.filter(status_global="selesai").exclude(id__in=already_recognized_order_ids)
        total = orders.count()
        posted = 0
        skipped_zero = 0
        skipped_gating = 0

        self.stdout.write(f"Order 'selesai' kandidat backfill: {total}")

        for order in orders.iterator():
            total_harga = order.total_harga or 0
            if total_harga <= 0:
                skipped_zero += 1
                continue

            if dry_run:
                posted += 1
                continue

            with transaction.atomic():
                complete_log = OrderActivityLog.objects.filter(order=order, tindakan="COMPLETE").last()
                if not complete_log:
                    complete_log = OrderActivityLog.objects.create(
                        order=order, user=None, tindakan="COMPLETE",
                        keterangan=(
                            "Backfill retroaktif accrual (2026-09-09): log COMPLETE tidak "
                            "ditemukan untuk order 'selesai' ini, dibuat otomatis oleh "
                            "backfill_order_accrual_revenue supaya jurnal Piutang/Pendapatan "
                            "punya jejak audit yang jelas."
                        ),
                    )
                entry = post_order_revenue_recognition_journal(
                    order=order, actor=None, activity_log=complete_log,
                )
            if entry:
                posted += 1
            else:
                skipped_gating += 1

        self.stdout.write(self.style.SUCCESS(
            f"Selesai. {'Estimasi akan' if dry_run else ''} Diposting: {posted}, "
            f"dilewati (total_harga 0): {skipped_zero}, "
            f"dilewati (akun belum diatur / modul nonaktif): {skipped_gating}."
        ))
        if dry_run:
            self.stdout.write(self.style.WARNING(
                "DRY RUN -- tidak ada perubahan disimpan. Angka 'dilewati (akun belum diatur)' "
                "belum dihitung akurat di mode ini (gating baru dicek saat posting sungguhan)."
            ))
