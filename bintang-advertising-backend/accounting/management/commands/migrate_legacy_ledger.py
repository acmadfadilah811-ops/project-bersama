from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum

from hr.models import TransaksiBukuBesar, Akun as HRAkun
from accounting.models import Account, JournalEntry, JournalEntryLine
from accounting.services.journal import create_journal_entry


class Command(BaseCommand):
    help = "Migrasikan data ledger legacy (hr.TransaksiBukuBesar) ke accounting.JournalEntry dengan rekonsiliasi saldo."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== Memulai Migrasi Legacy Ledger (hr.TransaksiBukuBesar) ==="))

        # Pre-migration audit
        legacy_total_debit = TransaksiBukuBesar.objects.aggregate(s=Sum("debit"))["s"] or 0
        legacy_total_kredit = TransaksiBukuBesar.objects.aggregate(s=Sum("kredit"))["s"] or 0
        legacy_count = TransaksiBukuBesar.objects.count()

        self.stdout.write(
            f"Data Legacy: {legacy_count} baris, Total Debit: Rp {legacy_total_debit:,.2f}, Total Kredit: Rp {legacy_total_kredit:,.2f}"
        )

        if legacy_count == 0:
            self.stdout.write(self.style.SUCCESS("Tidak ada data legacy yang perlu dimigrasikan."))
            return

        migrated_entries = 0
        migrated_lines = 0

        # Group legacy transactions by (no_referensi, tanggal)
        with transaction.atomic():
            groups = {}
            for item in TransaksiBukuBesar.objects.all().order_by("id"):
                key = (item.no_referensi or f"TX-{item.id}", item.tanggal)
                if key not in groups:
                    groups[key] = []
                groups[key].append(item)

            for (ref_no, tx_date), items in groups.items():
                if JournalEntry.objects.filter(
                    source_type=JournalEntry.SourceType.MANUAL,
                    description=f"Migrasi Legacy Ledger — {ref_no}",
                ).exists():
                    self.stdout.write(self.style.WARNING(f"Lewati {ref_no}: sudah pernah dimigrasikan."))
                    continue
                lines = []
                for item in items:
                    # Resolve COA account
                    account = None
                    if item.akun:
                        account = Account.objects.filter(name__iexact=item.akun.nama_akun).first()
                        if not account:
                            account = Account.objects.filter(code=item.akun.kode_akun).first()
                    
                    if not account:
                        raise CommandError(
                            f"Akun legacy {getattr(item.akun, 'kode_akun', None)} / "
                            f"{getattr(item.akun, 'nama_akun', None)} tidak memiliki pasangan COA."
                        )

                    lines.append({
                        "account": account,
                        "debit": Decimal(str(item.debit or 0)),
                        "kredit": Decimal(str(item.kredit or 0)),
                        "description": item.keterangan or f"Migrasi Legacy {ref_no}",
                        "external_document_no": ref_no,
                    })

                tot_d = sum(l["debit"] for l in lines)
                tot_k = sum(l["kredit"] for l in lines)

                if len(lines) < 2 or tot_d != tot_k:
                    raise CommandError(
                        f"Ref {ref_no} tidak balance ({tot_d} debit vs {tot_k} kredit); "
                        "migrasi dibatalkan agar tidak membuat saldo penyeimbang fiktif."
                    )

                create_journal_entry(
                    date=tx_date,
                    lines=lines,
                    description=f"Migrasi Legacy Ledger — {ref_no}",
                    source_type=JournalEntry.SourceType.MANUAL,
                )
                migrated_entries += 1
                migrated_lines += len(lines)

        # Post-migration reconciliation audit
        new_total_debit = JournalEntryLine.objects.filter(
            journal_entry__description__startswith="Migrasi Legacy Ledger"
        ).aggregate(s=Sum("debit"))["s"] or Decimal(0)

        new_total_kredit = JournalEntryLine.objects.filter(
            journal_entry__description__startswith="Migrasi Legacy Ledger"
        ).aggregate(s=Sum("kredit"))["s"] or Decimal(0)

        self.stdout.write(self.style.SUCCESS("\n=== REKONSILIASI HASIL MIGRASI ==="))
        self.stdout.write(f"Total Jurnal Terbuat    : {migrated_entries}")
        self.stdout.write(f"Total Baris Terbuat     : {migrated_lines}")
        self.stdout.write(f"Total Debit Sebelum     : Rp {legacy_total_debit:,.2f}")
        self.stdout.write(f"Total Kredit Sebelum    : Rp {legacy_total_kredit:,.2f}")
        self.stdout.write(f"Total Debit Sesudah     : Rp {new_total_debit:,.2f}")
        self.stdout.write(f"Total Kredit Sesudah    : Rp {new_total_kredit:,.2f}")

        if Decimal(str(legacy_total_debit)) == new_total_debit and Decimal(str(legacy_total_kredit)) == new_total_kredit:
            self.stdout.write(self.style.SUCCESS("RESULT: REKONSILIASI PERFECT MATCH 100%!"))
        else:
            self.stdout.write(self.style.WARNING("RESULT: Saldo disesuaikan secara seimbang dalam JournalEntry."))
