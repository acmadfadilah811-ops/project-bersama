"""
Management command: seed_cash_bank_accounts
Seed CashBankAccount — daftar terkurasi akun yang tampil di dropdown Bank
Statement (bukan otomatis semua akun klasifikasi Kas & Bank; terbukti dari
Olsera dropdown-nya juga menyertakan 23000/23500 yang klasifikasinya
Kewajiban lain). Idempotent. Jalankan: python manage.py seed_cash_bank_accounts
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.models import Account, CashBankAccount

# (kode akun, kind)
CASH_BANK_ACCOUNTS = [
    ("11101", CashBankAccount.Kind.CASH),
    ("11102", CashBankAccount.Kind.BANK),
    ("11103", CashBankAccount.Kind.CASH),
    ("11104", CashBankAccount.Kind.BANK),
    ("23000", CashBankAccount.Kind.OTHER),
    ("23500", CashBankAccount.Kind.OTHER),
]


class Command(BaseCommand):
    help = "Seed CashBankAccount — akun yang tampil di dropdown Bank Statement (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        for account_code, kind in CASH_BANK_ACCOUNTS:
            account = Account.objects.get(code=account_code)
            _, created = CashBankAccount.objects.get_or_create(
                account=account, defaults={"name": account.name, "kind": kind},
            )
            created_count += created

        self.stdout.write(self.style.SUCCESS(
            f"Selesai. Kas & Bank baru: {created_count}/{len(CASH_BANK_ACCOUNTS)}."
        ))
