"""Seed data demo non-operasional untuk melihat tampilan Detail Log Cara Pembayaran."""

from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounting.models import Account, PaymentMethod, PaymentMethodAuditLog
from api.models import CustomUser


DEMO_NAME = "TEST - Cashlez Detail Log"
DEMO_ROWS = [
    ("2026-07-25 10:58:26", "11101", "11101"),
    ("2026-07-25 15:35:50", "11101", "23000"),
    ("2026-07-25 16:03:22", "23000", "11103"),
    ("2026-07-25 16:07:27", "11103", "11101"),
    ("2026-07-29 13:34:57", "11101", ""),
]


class Command(BaseCommand):
    help = "Buat data demo aman untuk modal Cara Pembayaran Detail Log (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        accounts = {account.code: account for account in Account.objects.filter(code__in={"11101", "11103", "23000"})}
        missing = {"11101", "11103", "23000"} - set(accounts)
        if missing:
            raise RuntimeError(f"Akun demo belum tersedia: {', '.join(sorted(missing))}.")

        method, created = PaymentMethod.objects.get_or_create(
            name=DEMO_NAME,
            defaults={
                "payment_type": "Demo log",
                "account": accounts["11101"],
                "is_active": False,
            },
        )
        actor = CustomUser.objects.filter(email="brandydesign14@gmail.com").first()
        existing_logs = PaymentMethodAuditLog.objects.filter(payment_method=method).exists()
        if not existing_logs:
            for timestamp, account_code, previous_account_code in DEMO_ROWS:
                account = accounts[account_code]
                previous_account = accounts.get(previous_account_code)
                log = PaymentMethodAuditLog.objects.create(
                    payment_method=method,
                    action=PaymentMethodAuditLog.Action.UPDATE,
                    actor=actor,
                    account_code=account.code,
                    account_name=account.name,
                    previous_account_code=previous_account.code if previous_account else "",
                    previous_account_name=previous_account.name if previous_account else "",
                )
                log.created_at = timezone.make_aware(datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S"))
                log.save(update_fields=["created_at"])

        state = "dibuat" if created else "sudah ada"
        self.stdout.write(self.style.SUCCESS(
            f"Data demo {state}: '{DEMO_NAME}'. Buka log dari ikon dokumen pada baris tersebut."
        ))
