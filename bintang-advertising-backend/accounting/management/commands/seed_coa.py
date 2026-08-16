"""
Management command: seed_coa
Seed Chart of Accounts default mengikuti struktur Olsera, plus 1 akun sistem
"Saldo Awal" (penyeimbang otomatis untuk fitur Sesuaikan Saldo Awal).
Idempotent — aman dijalankan berkali-kali (get_or_create per kode akun).
Jalankan: python manage.py seed_coa
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.models import Account, AccountClassification, AccountingSettings, AccountType

# (account_type, nama_klasifikasi, urutan, kode_awal, kode_akhir) — rentang resmi dari
# panduan import Olsera (templateGuideAccount / sheet "ruleAccountNo")
CLASSIFICATIONS = [
    (AccountType.ASSET, "Kas & Bank", 1, 11101, 11199),
    (AccountType.ASSET, "Investasi", 2, 11200, 11299),
    (AccountType.ASSET, "Piutang", 3, 11300, 11399),
    (AccountType.ASSET, "Persediaan", 4, 11400, 11499),
    (AccountType.ASSET, "Perlengkapan", 5, 11500, 11599),
    (AccountType.ASSET, "Akumulasi penyusutan perlengkapan", 6, 11600, 11699),
    (AccountType.ASSET, "Harta lancar lainnya", 7, 11700, 11799),
    (AccountType.ASSET, "Aktiva Tetap", 8, 12000, 12999),
    (AccountType.ASSET, "Aset Tak Berwujud", 9, 13000, 13999),
    (AccountType.ASSET, "Akumulasi penyusutan aset tetap", 10, 14000, 14999),
    (AccountType.ASSET, "Akumulasi penyusutan aset tak berwujud", 11, 15000, 15999),
    (AccountType.ASSET, "Investasi jangka panjang", 12, 16000, 16499),
    (AccountType.LIABILITY, "Kewajiban Jangka Pendek", 1, 21000, 21999),
    (AccountType.LIABILITY, "Kewajiban Jangka Panjang", 2, 22000, 22999),
    (AccountType.LIABILITY, "Kewajiban lain", 3, 23000, 23999),
    (AccountType.EQUITY, "Ekuitas", 1, 30000, 39999),
    (AccountType.REVENUE, "Pendapatan", 1, 40000, 49999),
    (AccountType.EXPENSE, "Harga Pokok Penjualan", 1, 50000, 59999),
    (AccountType.EXPENSE, "Pengeluaran", 2, 60000, 69999),
    (AccountType.REVENUE, "Pendapatan Lain", 2, 70000, 79999),
    (AccountType.EXPENSE, "Pengeluaran Lain", 3, 80000, 89999),
]

OPENING_BALANCE_ACCOUNT_CODE = "34000"

OPENING_BALANCE_DESCRIPTION = (
    "Akun sistem — penyeimbang otomatis saat mengisi Saldo Awal di Daftar Akun "
    "(menu gerigi > Sesuaikan Saldo Awal). Dipakai untuk migrasi saldo dari "
    "pembukuan lama, bukan untuk transaksi normal sehari-hari. Bisa diarahkan "
    "ke akun lain lewat Pengaturan Akuntansi tanpa perlu ubah kode ini."
)

# (kode, nama, nama_klasifikasi, account_type, is_contra, description)
ACCOUNTS = [
    ("11101", "Kas", "Kas & Bank", AccountType.ASSET, False, ""),
    ("11102", "Bank", "Kas & Bank", AccountType.ASSET, False, ""),
    ("11103", "Kas in register", "Kas & Bank", AccountType.ASSET, False, ""),
    ("11104", "Giro", "Kas & Bank", AccountType.ASSET, False, ""),
    ("11200", "Investasi jangka pendek dan surat berharga", "Investasi", AccountType.ASSET, False, ""),
    ("11300", "Piutang dagang", "Piutang", AccountType.ASSET, False, ""),
    ("11400", "Persediaan barang dagang", "Persediaan", AccountType.ASSET, False, ""),
    ("11500", "Peralatan", "Perlengkapan", AccountType.ASSET, False, ""),
    ("11600", "Akumulasi penyusutan peralatan", "Akumulasi penyusutan perlengkapan", AccountType.ASSET, True, ""),
    ("11700", "Beban dibayar dimuka", "Harta lancar lainnya", AccountType.ASSET, False, ""),
    ("11710", "Uang muka pembelian", "Harta lancar lainnya", AccountType.ASSET, False, ""),
    ("11750", "PPN Masukan", "Harta lancar lainnya", AccountType.ASSET, False, ""),
    ("12000", "Aset Tetap", "Aktiva Tetap", AccountType.ASSET, False, ""),
    ("13000", "Aset tak berwujud", "Aset Tak Berwujud", AccountType.ASSET, False, ""),
    ("14000", "Akumulasi penyusutan aset tetap", "Akumulasi penyusutan aset tetap", AccountType.ASSET, True, ""),
    ("15000", "Akumulasi penyusutan aset tak berwujud", "Akumulasi penyusutan aset tak berwujud", AccountType.ASSET, True, ""),
    ("21000", "Hutang dagang", "Kewajiban Jangka Pendek", AccountType.LIABILITY, False, ""),
    ("22000", "Hutang bank", "Kewajiban Jangka Panjang", AccountType.LIABILITY, False, ""),
    ("23000", "Pendapatan di terima dimuka", "Kewajiban lain", AccountType.LIABILITY, False, ""),
    ("23500", "PPN Keluaran", "Kewajiban lain", AccountType.LIABILITY, False, ""),
    ("31000", "Modal", "Ekuitas", AccountType.EQUITY, False, ""),
    ("32000", "Prive", "Ekuitas", AccountType.EQUITY, True, ""),
    ("33000", "Laba rugi ditahan", "Ekuitas", AccountType.EQUITY, False, ""),
    (OPENING_BALANCE_ACCOUNT_CODE, "Saldo Awal", "Ekuitas", AccountType.EQUITY, False, OPENING_BALANCE_DESCRIPTION),
    ("40000", "Penjualan", "Pendapatan", AccountType.REVENUE, False, ""),
    ("41000", "Penjualan antar cabang", "Pendapatan", AccountType.REVENUE, False, ""),
    ("42000", "Layanan biaya penjualan", "Pendapatan", AccountType.REVENUE, False, ""),
    ("44000", "Pengiriman penjualan", "Pendapatan", AccountType.REVENUE, False, ""),
    ("46100", "Potongan penjualan", "Pendapatan", AccountType.REVENUE, True, ""),
    ("46200", "Loyalitas penjualan", "Pendapatan", AccountType.REVENUE, False, ""),
    ("46300", "Return penjualan", "Pendapatan", AccountType.REVENUE, True, ""),
    ("50000", "Pembelian", "Harga Pokok Penjualan", AccountType.EXPENSE, False, ""),
    ("50100", "Pembelian antar cabang", "Harga Pokok Penjualan", AccountType.EXPENSE, False, ""),
    ("50300", "Biaya pengiriman", "Harga Pokok Penjualan", AccountType.EXPENSE, False, ""),
    ("50400", "Return pembelian", "Harga Pokok Penjualan", AccountType.EXPENSE, True, ""),
    ("50500", "Potongan pembelian", "Harga Pokok Penjualan", AccountType.EXPENSE, True, ""),
    ("51000", "Harga pokok penjualan", "Harga Pokok Penjualan", AccountType.EXPENSE, False, ""),
    ("60100", "Biaya gaji", "Pengeluaran", AccountType.EXPENSE, False, ""),
    ("60200", "Biaya air listrik telephone", "Pengeluaran", AccountType.EXPENSE, False, ""),
    ("60300", "Biaya perlengkapan", "Pengeluaran", AccountType.EXPENSE, False, ""),
    ("60400", "Biaya penyusutan", "Pengeluaran", AccountType.EXPENSE, False, ""),
    ("60500", "Biaya transfer", "Pengeluaran", AccountType.EXPENSE, False, ""),
    ("70000", "Pendapatan lain lain", "Pendapatan Lain", AccountType.REVENUE, False, ""),
    ("70001", "Pembulatan", "Pendapatan Lain", AccountType.REVENUE, False, ""),
    ("70002", "Code Uniq Penjualan", "Pendapatan Lain", AccountType.REVENUE, False, ""),
    ("70003", "Layanan Penjualan", "Pendapatan Lain", AccountType.REVENUE, False, ""),
    ("80000", "Pengeluaran lain lain", "Pengeluaran Lain", AccountType.EXPENSE, False, ""),
    ("81000", "Penyesuaian Barang", "Pengeluaran Lain", AccountType.EXPENSE, False, ""),
]


class Command(BaseCommand):
    help = "Seed Chart of Accounts default mengikuti struktur Olsera (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        # update_or_create (bukan get_or_create): data rentang kode ini otoritatif dari
        # panduan resmi Olsera, jadi re-run seed_coa harus backfill klasifikasi lama juga.
        classification_map = {}
        created_cls = 0
        for account_type, name, order, code_start, code_end in CLASSIFICATIONS:
            obj, created = AccountClassification.objects.update_or_create(
                name=name,
                defaults={
                    "account_type": account_type,
                    "order": order,
                    "code_range_start": code_start,
                    "code_range_end": code_end,
                },
            )
            classification_map[name] = obj
            created_cls += created

        created_acc = 0
        for code, name, classification_name, account_type, is_contra, description in ACCOUNTS:
            _, created = Account.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": description,
                    "account_type": account_type,
                    "classification": classification_map[classification_name],
                    "is_contra": is_contra,
                },
            )
            created_acc += created

        self.stdout.write(self.style.SUCCESS(
            f"Selesai. Klasifikasi baru: {created_cls}/{len(CLASSIFICATIONS)}, "
            f"Akun baru: {created_acc}/{len(ACCOUNTS)}."
        ))

        settings_row = AccountingSettings.objects.first()
        if settings_row and not settings_row.opening_balance_equity_account_id:
            opening_account = Account.objects.filter(code=OPENING_BALANCE_ACCOUNT_CODE).first()
            settings_row.opening_balance_equity_account = opening_account
            settings_row.save(update_fields=["opening_balance_equity_account"])
            self.stdout.write(self.style.SUCCESS(
                f"AccountingSettings.opening_balance_equity_account diarahkan ke {opening_account}."
            ))

        if settings_row:
            mapping_defaults = {
                "purchase_inventory_account": Account.objects.filter(code="11400", is_active=True).first(),
                "purchase_payable_account": Account.objects.filter(code="21000", is_active=True).first(),
                "purchase_advance_account": Account.objects.filter(code="11710", is_active=True).first(),
            }
            update_fields = []
            for field, account in mapping_defaults.items():
                if account and not getattr(settings_row, f"{field}_id"):
                    setattr(settings_row, field, account)
                    update_fields.append(field)
            if update_fields:
                settings_row.save(update_fields=update_fields)
                self.stdout.write(self.style.SUCCESS("Mapping akun Pembelian standar telah disiapkan."))
