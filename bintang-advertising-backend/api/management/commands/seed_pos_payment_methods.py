"""
Management command: seed_pos_payment_methods
Seed POSPaymentMethod default — daftar metode bayar yang muncul di layar Kasir
(beda dari accounting.PaymentMethod "Cara Pembayaran" di modul Akuntansi, dan
beda juga dari Order.accounting_payment_method langsung). Tanpa seed ini,
instalasi baru punya 0 baris POSPaymentMethod sehingga kasir tidak punya
pilihan metode bayar sama sekali saat checkout.

"Tunai" dipetakan otomatis ke accounting.PaymentMethod "CASH" (aman, sama-sama
akun kas fisik). Metode lain (QRIS/Debit/Kredit/Transfer/E-Wallet) SENGAJA
dibiarkan belum terhubung ke accounting.PaymentMethod (None) - itu keputusan
bisnis pemilik toko mau dipetakan ke gateway mana, diatur manual lewat
Pengaturan Toko > Point of Sale. Sale dengan metode belum terhubung tetap bisa
diproses (fallback akun transit, lihat T-618), cuma belum otomatis
terekonsiliasi ke akun spesifik sampai dipetakan.

Idempotent (get_or_create per nama). Jalankan: python manage.py seed_pos_payment_methods
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from api.pos_models import POSPaymentMethod
from accounting.models import PaymentMethod as AccountingPaymentMethod

# (nama, tipe, urutan)
POS_PAYMENT_METHODS = [
    ("CASH", POSPaymentMethod.TIPE_CHOICES[0][0], 0),   # 'Tunai'
    ("QRIS", "QRIS", 1),
    ("Kartu Debit", "Debit", 2),
    ("Kartu Kredit", "Kredit", 3),
    ("Transfer Bank", "Transfer", 4),
    ("E-Wallet", "E-Wallet", 5),
]


class Command(BaseCommand):
    help = "Seed POSPaymentMethod default untuk layar Kasir (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        cash_account = AccountingPaymentMethod.objects.filter(name="CASH").first()

        created_count = 0
        for nama, tipe, urutan in POS_PAYMENT_METHODS:
            defaults = {"tipe": tipe, "urutan": urutan}
            if nama == "CASH" and cash_account:
                defaults["accounting_payment_method"] = cash_account
            _, created = POSPaymentMethod.objects.get_or_create(nama=nama, defaults=defaults)
            created_count += created

        self.stdout.write(self.style.SUCCESS(
            f"Selesai. Metode bayar POS baru: {created_count}/{len(POS_PAYMENT_METHODS)}."
        ))
