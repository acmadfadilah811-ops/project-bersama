from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_date

from api.pos_models import POSSale
from api.pos_services import resolve_and_assign_payment_method
from accounting.models import JournalEntry
from accounting.services.pos_posting import post_pos_sale_journal, should_post_sale


class Command(BaseCommand):
    help = (
        "Backfill posting JournalEntry untuk transaksi POSSale (berstatus 'paid') "
        "yang belum memiliki jurnal."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--from",
            dest="from_date",
            help="Tanggal mulai (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--to",
            dest="to_date",
            help="Tanggal selesai (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simulasi saja tanpa menyimpan jurnal ke database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        from_d = parse_date(options["from_date"]) if options.get("from_date") else None
        to_d = parse_date(options["to_date"]) if options.get("to_date") else None

        sales_qs = POSSale.objects.filter(status="paid").order_by("id")
        if from_d:
            sales_qs = sales_qs.filter(created_at__date__gte=from_d)
        if to_d:
            sales_qs = sales_qs.filter(created_at__date__lte=to_d)

        total_scanned = sales_qs.count()
        posted_count = 0
        skipped_count = 0
        already_posted_count = 0

        self.stdout.write(f"Menjelajahi {total_scanned} transaksi POSSale paid...")

        for sale in sales_qs:
            # 1. Cek apakah sudah ada jurnal aktif
            existing = JournalEntry.objects.filter(
                source_type=JournalEntry.SourceType.POS_SALE,
                source_id=sale.id,
            ).exclude(status=JournalEntry.Status.VOID).exists()

            if existing:
                already_posted_count += 1
                continue

            # 2. Coba resolve payment method & settlement status jika belum terisi
            if not sale.accounting_payment_method_id:
                resolve_and_assign_payment_method(sale)
                if not dry_run:
                    sale.save(update_fields=["accounting_payment_method", "settlement_status"])

            # 3. Evaluasi kelayakan posting
            eligible, reason = should_post_sale(sale)
            if not eligible:
                skipped_count += 1
                self.stdout.write(
                    self.style.WARNING(f"[-] Sale #{sale.nomor} skipped: {reason}")
                )
                continue

            # 4. Posting jurnal
            if dry_run:
                posted_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"[DRY-RUN] Sale #{sale.nomor} akan diposting.")
                )
            else:
                entry = post_pos_sale_journal(sale)
                if entry:
                    posted_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"[+] Sale #{sale.nomor} -> Journal {entry.entry_number}")
                    )
                else:
                    skipped_count += 1

        self.stdout.write("\n=== RINGKASAN BACKFILL ===")
        self.stdout.write(f"Total Ditemukan  : {total_scanned}")
        self.stdout.write(f"Sudah Terposting : {already_posted_count}")
        self.stdout.write(f"Berhasil Diposting: {posted_count} {'(Simulasi)' if dry_run else ''}")
        self.stdout.write(f"Ter-skip        : {skipped_count}")
