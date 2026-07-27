"""
Management command idempotent untuk memindahkan data Pengembalian Order dari hack
catatan_pelanggan `[PENGEMBALIAN - ...]` ke model PengembalianOrder (T-208 Revisi 2).

Catatan: nominal_refund di-default ke order.total_harga sebagai estimasi data lama
karena text-parsing data lama tidak mencatat nominal refund secara terpisah.

Mendukung --dry-run untuk mensimulasikan hasil migrasi tanpa menyimpannya ke database.
"""
import re
from datetime import datetime
from django.core.management.base import BaseCommand
from api.models import Order, PengembalianOrder


class Command(BaseCommand):
    help = "Migrasikan data pengembalian dari Order.catatan_pelanggan ke model PengembalianOrder."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Hanya tampilkan laporan simulasi migrasi tanpa menyimpan ke database.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        pattern = re.compile(
            r'\[PENGEMBALIAN - Tanggal:\s*([^\s,]*),\s*Status:\s*([^,]*),\s*Catatan:\s*([^\]]*)\]',
            re.IGNORECASE
        )
        orders = Order.objects.filter(catatan_pelanggan__icontains='[PENGEMBALIAN').only('id', 'catatan_pelanggan', 'waktu', 'total_harga')

        total = orders.count()
        processed = 0

        self.stdout.write(f"Mulai migrasi pengembalian untuk {total} pesanan...")

        for order in orders.iterator():
            match = pattern.search(order.catatan_pelanggan or '')
            if not match:
                continue

            raw_date = match.group(1).strip()
            raw_status = match.group(2).strip()
            raw_catatan = match.group(3).strip()

            # Parse date
            try:
                tgl_pengembalian = datetime.strptime(raw_date, '%Y-%m-%d').date()
            except ValueError:
                tgl_pengembalian = order.waktu.date()

            # Parse status
            valid_statuses = dict(PengembalianOrder.STATUS_CHOICES)
            status = raw_status if raw_status in valid_statuses else 'Tunda'

            # Nominal refund estimate (default: total_harga)
            nominal = order.total_harga or 0

            # Idempotency check: don't create duplicate if already migrated
            existing = PengembalianOrder.objects.filter(
                order=order,
                tanggal_pengembalian=tgl_pengembalian,
                catatan=raw_catatan
            ).exists()

            if not existing:
                if not dry_run:
                    PengembalianOrder.objects.create(
                        order=order,
                        tanggal_pengembalian=tgl_pengembalian,
                        status=status,
                        catatan=raw_catatan,
                        nominal_refund=nominal
                    )
                processed += 1

            # Clean tag from catatan_pelanggan
            clean_note = pattern.sub('', order.catatan_pelanggan).strip()
            order.catatan_pelanggan = clean_note if clean_note else None
            if not dry_run:
                order.save(update_fields=['catatan_pelanggan'])

        self.stdout.write(self.style.SUCCESS(f"Selesai! Total pengembalian dibuat: {processed}/{total} pesanan."))
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — Tidak ada perubahan yang disimpan ke database."))
