"""
Management command: seed_payment_methods
Seed Cara Pembayaran default mengikuti struktur Olsera — semua default ke akun
11101 Kas, CASH dikunci (is_locked) karena harus selalu ke akun kas fisik.
Idempotent. Jalankan: python manage.py seed_payment_methods
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.models import Account, PaymentMethod, PaymentMethodAuditLog

# (nama, tipe, is_locked)
PAYMENT_METHODS = [
    ("CASH", "Tunai", True),
    ("Cashlez", "Cashlez", False),
    ("Go-Pay", "Go-Pay", False),
    ("Grab Cash", "Grab Cash", False),
    ("Grab Cashlez", "Grab Cashlez", False),
    ("Marketplace Tokopedia", "Tokopedia", False),
    ("Marketplace Shopee", "Shopee", False),
    ("Marketplace Lazada", "Lazada", False),
    ("Marketplace Blibli", "Blibli", False),
    ("Marketplace Bukalapak", "Bukalapak", False),
    ("Marketplace TikTok", "TikTok", False),
    ("Qris by Netzme", "Olsera-Qris", False),
    ("QRIS by BCA", "BCA-Qris", False),
]

DEFAULT_ACCOUNT_CODE = "11101"


class Command(BaseCommand):
    help = "Seed Cara Pembayaran default mengikuti struktur Olsera (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        kas = Account.objects.get(code=DEFAULT_ACCOUNT_CODE)

        created_count = 0
        for name, payment_type, is_locked in PAYMENT_METHODS:
            method, created = PaymentMethod.objects.get_or_create(
                name=name,
                defaults={"payment_type": payment_type, "account": kas, "is_locked": is_locked},
            )
            if created:
                created_count += 1
                PaymentMethodAuditLog.objects.create(
                    payment_method=method,
                    action=PaymentMethodAuditLog.Action.CREATE,
                    account_code=kas.code,
                    account_name=kas.name,
                )

        self.stdout.write(self.style.SUCCESS(
            f"Selesai. Cara Pembayaran baru: {created_count}/{len(PAYMENT_METHODS)}."
        ))
