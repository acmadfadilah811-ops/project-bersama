"""Posting jurnal penyusutan bulanan otomatis untuk semua Aset Tetap aktif
yang punya umur manfaat -- lihat accounting/services/depreciation.py.

Dijadwalkan lewat systemd timer di VPS (project ini belum punya task
scheduler seperti Celery beat), jalan tanggal 1 tiap bulan untuk BULAN
SEBELUMNYA (supaya semua transaksi bulan itu -- termasuk aset yang baru
dibeli akhir bulan -- sudah pasti tercatat sebelum penyusutannya diposting):
    /etc/systemd/system/bintang-asset-depreciation.timer
    /etc/systemd/system/bintang-asset-depreciation.service
"""
import calendar
from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounting.services.depreciation import post_monthly_depreciation


class Command(BaseCommand):
    help = "Posting jurnal penyusutan bulanan untuk semua Aset Tetap aktif (bulan sebelumnya, kecuali --period diisi)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--period", type=str, default=None,
            help="Bulan yang diposting, format YYYY-MM. Default: bulan sebelumnya dari hari ini.",
        )

    def handle(self, *args, **options):
        period_raw = options.get("period")
        if period_raw:
            year, month = (int(part) for part in period_raw.split("-"))
        else:
            today = timezone.localdate()
            year, month = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)

        period_end_date = date(year, month, calendar.monthrange(year, month)[1])
        entries = post_monthly_depreciation(period_end_date=period_end_date)

        if not entries:
            self.stdout.write(f"Tidak ada jurnal penyusutan baru untuk periode {period_end_date:%Y-%m}.")
            return
        self.stdout.write(self.style.SUCCESS(
            f"{len(entries)} jurnal penyusutan diposting untuk periode {period_end_date:%Y-%m}."
        ))
