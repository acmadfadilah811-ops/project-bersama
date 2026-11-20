"""Pindahkan saldo akun "Saldo Awal" (34000) ke akun ekuitas permanen -- SAK EP (2026-11-15).

Bawaan hanya menampilkan saldo (tidak menjurnal):
    python manage.py tutup_saldo_awal
    python manage.py tutup_saldo_awal --ke 31000 --tanggal 2026-11-15 --simpan
"""
from datetime import date

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounting.models import Account
from accounting.services.opening_balance import saldo_akun_saldo_awal, tutup_saldo_awal


class Command(BaseCommand):
    help = "Tutup akun penyeimbang Saldo Awal ke Modal/Laba Ditahan (bawaan: hanya cek)."

    def add_arguments(self, parser):
        parser.add_argument("--ke", default="31000", help="Kode akun ekuitas tujuan (bawaan 31000 Modal).")
        parser.add_argument("--tanggal", default=None, help="Tanggal jurnal YYYY-MM-DD (bawaan hari ini).")
        parser.add_argument("--simpan", action="store_true")

    def handle(self, *args, **opts):
        tanggal = date.fromisoformat(opts["tanggal"]) if opts["tanggal"] else timezone.localdate()
        akun, saldo = saldo_akun_saldo_awal(tanggal)
        if akun is None:
            raise CommandError("Akun penyeimbang Saldo Awal belum diatur.")
        self.stdout.write(f"Saldo {akun.code} {akun.name} per {tanggal}: {saldo:,.0f} (sisi kredit positif)")
        if not opts["simpan"]:
            self.stdout.write("MODE CEK: belum menjurnal. Tambahkan --simpan untuk memindahkan saldo.")
            return
        tujuan = Account.objects.filter(code=opts["ke"]).first()
        if tujuan is None:
            raise CommandError(f"Akun {opts['ke']} tidak ditemukan.")
        try:
            entry = tutup_saldo_awal(target_account=tujuan, tanggal=tanggal)
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages))
        self.stdout.write(self.style.SUCCESS(f"Jurnal {entry.entry_number} diposting: saldo dipindah ke {tujuan.code} {tujuan.name}."))
