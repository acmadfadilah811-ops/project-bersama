from decimal import Decimal
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from hr.models import Akun as HRAkun, TransaksiBukuBesar
from accounting.models import Account, AccountClassification, AccountType, JournalEntry, JournalEntryLine


class MigrateLegacyLedgerTestCase(TestCase):
    def setUp(self):
        self.asset_cls = AccountClassification.objects.create(
            name="Aset Test", account_type=AccountType.ASSET, code_range_start=10000, code_range_end=19999
        )
        self.rev_cls = AccountClassification.objects.create(
            name="Pendapatan Test", account_type=AccountType.REVENUE, code_range_start=40000, code_range_end=49999
        )

        self.kas_coa = Account.objects.create(code="11001", name="Kas Toko", classification=self.asset_cls)
        self.rev_coa = Account.objects.create(code="41001", name="Penjualan", classification=self.rev_cls)

        self.hr_kas = HRAkun.objects.create(kode_akun="11001", nama_akun="Kas Toko")
        self.hr_rev = HRAkun.objects.create(kode_akun="41001", nama_akun="Penjualan")

    def test_migrate_legacy_ledger_command(self):
        """Test migrasi data dari hr.TransaksiBukuBesar ke accounting.JournalEntry."""
        today = timezone.localdate()

        # Buat data legacy berpasangan (balance)
        TransaksiBukuBesar.objects.create(
            akun=self.hr_kas,
            tanggal=today,
            debit=Decimal("150000"),
            kredit=Decimal("0"),
            keterangan="Penerimaan Kas",
            no_referensi="TX-999",
        )
        TransaksiBukuBesar.objects.create(
            akun=self.hr_rev,
            tanggal=today,
            debit=Decimal("0"),
            kredit=Decimal("150000"),
            keterangan="Penjualan Barang",
            no_referensi="TX-999",
        )

        # Jalankan management command
        call_command("migrate_legacy_ledger")

        # Verifikasi JournalEntry terbuat
        entry = JournalEntry.objects.filter(
            source_type=JournalEntry.SourceType.MANUAL,
            description__contains="TX-999",
        ).first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.lines.count(), 2)

        kas_line = entry.lines.get(account=self.kas_coa)
        rev_line = entry.lines.get(account=self.rev_coa)

        self.assertEqual(kas_line.debit, Decimal("150000"))
        self.assertEqual(rev_line.kredit, Decimal("150000"))
