"""Terapkan tanggal potong periode akuntansi dan susun ulang periode (2026-09-29).

    python manage.py atur_periode_potong --hari 25              # dry-run
    python manage.py atur_periode_potong --hari 25 --terapkan   # jalankan

Untuk data yang sudah terlanjur dibuat sebagai bulan kalender (mis. periode
"1-30 Sep" yang berisi jurnal tanggal 26-30): setiap jurnal dipindah ke periode
yang benar menurut tanggal potong (jurnal tgl 26+ ke periode berikutnya),
periode kosong yang tersisa dihapus, lalu tanggal potong disimpan di
AccountingSettings. Jumlah/tanggal/akun jurnal TIDAK diubah -- hanya penautan
ke periodenya.

Syarat: tidak ada periode yang sudah DITUTUP (buka ulang dulu lewat servis
reopen_accounting_period). Backup DB sebelum --terapkan.
"""
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounting.models import AccountingPeriod, AccountingSettings, JournalEntry
from accounting.services.period_rules import nama_periode, rentang_menurut_aturan


class Command(BaseCommand):
    help = "Terapkan tanggal potong periode akuntansi & pindahkan jurnal ke periode yang benar."

    def add_arguments(self, parser):
        parser.add_argument("--hari", type=int, required=True, help="Tanggal potong 1-28 (0 = bulan kalender).")
        parser.add_argument("--terapkan", action="store_true", help="Jalankan perubahan (tanpa ini hanya dry-run).")

    def handle(self, *args, **opts):
        hari = opts["hari"]
        if not 0 <= hari <= 28:
            raise CommandError("--hari harus 0 (bulan kalender) atau 1-28.")

        tertutup = list(AccountingPeriod.objects.filter(status=AccountingPeriod.Status.CLOSED))
        if tertutup:
            daftar = ", ".join(f"{p.start_date}..{p.end_date}" for p in tertutup)
            raise CommandError(f"Masih ada periode DITUTUP ({daftar}). Buka ulang dulu, lalu jalankan lagi.")

        pengaturan = AccountingSettings.objects.first()
        if not pengaturan:
            raise CommandError("Pengaturan akuntansi belum ada.")

        rencana = defaultdict(list)  # (mulai, akhir) -> [id jurnal]
        pindah = 0
        for je in JournalEntry.objects.select_related("period"):
            rentang = rentang_menurut_aturan(je.date, hari)
            rencana[rentang].append(je.id)
            if (je.period.start_date, je.period.end_date) != rentang:
                pindah += 1

        self.stdout.write(f"Tanggal potong: {pengaturan.period_cutoff_day} -> {hari}")
        self.stdout.write(f"Periode tersimpan sekarang: {AccountingPeriod.objects.count()}")
        for (mulai, akhir), ids in sorted(rencana.items()):
            self.stdout.write(f"  {nama_periode(mulai, akhir):32} {mulai} s/d {akhir}: {len(ids)} jurnal")
        self.stdout.write(f"Jurnal yang berpindah periode: {pindah}")

        if not opts["terapkan"]:
            self.stdout.write(self.style.WARNING("DRY-RUN. Tambahkan --terapkan untuk menjalankan."))
            return

        with transaction.atomic():
            pengaturan.period_cutoff_day = hari
            pengaturan.save(update_fields=["period_cutoff_day"])
            target_ids = set()
            for (mulai, akhir), ids in rencana.items():
                periode, _ = AccountingPeriod.objects.get_or_create(
                    start_date=mulai, end_date=akhir,
                    defaults={"fiscal_year": akhir.year, "status": AccountingPeriod.Status.OPEN},
                )
                target_ids.add(periode.id)
                JournalEntry.objects.filter(id__in=ids).exclude(period=periode).update(period=periode)
            hapus = AccountingPeriod.objects.exclude(id__in=target_ids).filter(journal_entries__isnull=True)
            jumlah_hapus = hapus.count()
            hapus.delete()

        self.stdout.write(self.style.SUCCESS(
            f"Selesai: {pindah} jurnal dipindah, {jumlah_hapus} periode kosong dihapus, tanggal potong = {hari}."
        ))
