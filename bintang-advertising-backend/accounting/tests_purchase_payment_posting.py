from datetime import date
from decimal import Decimal

from django.test import TestCase

from api.customer_models import Supplier
from api.product_models import Purchase, PurchasePayment

from .models import Account, AccountClassification, AccountingSettings, JournalEntry
from .services.purchase_posting import (
    post_purchase_payment_journal,
    reverse_purchase_payment_journal,
)


class PurchasePaymentPostingTests(TestCase):
    def setUp(self):
        asset = AccountClassification.objects.create(name='Kas & Bank Test', account_type='asset')
        liability = AccountClassification.objects.create(name='Hutang Test', account_type='liability')
        self.cash = Account.objects.create(
            code='11101', name='Kas Test', account_type='asset', classification=asset,
        )
        payable = Account.objects.create(
            code='21000', name='Hutang Dagang Test', account_type='liability', classification=liability,
        )
        advance = Account.objects.create(
            code='11710', name='Uang Muka Pembelian Test', account_type='asset', classification=asset,
        )
        AccountingSettings.objects.create(
            accounting_start_date=date(2026, 7, 1),
            purchase_inventory_account=self.cash,
            purchase_payable_account=payable,
            purchase_advance_account=advance,
        )
        self.advance = advance
        purchase = Purchase.objects.create(nomor='PO-PAYMENT-TEST', tanggal=date(2026, 7, 29))
        self.payment = PurchasePayment.objects.create(
            purchase=purchase,
            tanggal=date(2026, 7, 29),
            nominal=Decimal('250000'),
            metode='Kas',
        )

    def test_payment_posts_once_and_reversal_preserves_audit_trail(self):
        entry = post_purchase_payment_journal(self.payment, self.cash)
        same_entry = post_purchase_payment_journal(self.payment, self.cash)

        self.assertEqual(entry.id, same_entry.id)
        self.assertEqual(entry.source_type, JournalEntry.SourceType.PURCHASE_PAYMENT)
        self.assertEqual(entry.source_id, self.payment.id)
        self.assertEqual(entry.lines.count(), 2)

        reversal = reverse_purchase_payment_journal(self.payment)
        self.assertEqual(reversal.reversed_entry_id, entry.id)
        self.assertEqual(JournalEntry.objects.count(), 2)
        self.assertEqual(sum(line.debit for line in reversal.lines.all()), Decimal('250000'))
        self.assertEqual(sum(line.kredit for line in reversal.lines.all()), Decimal('250000'))

    def test_advance_uses_advance_account_and_remains_balanced(self):
        self.payment.jenis = PurchasePayment.Jenis.ADVANCE
        self.payment.save(update_fields=['jenis'])

        entry = post_purchase_payment_journal(self.payment, self.cash)

        self.assertTrue(entry.lines.filter(account=self.advance, debit=Decimal('250000')).exists())
        self.assertEqual(sum(line.debit for line in entry.lines.all()), sum(line.kredit for line in entry.lines.all()))

    def test_supplier_akun_hutang_dipakai_alih_alih_default_global(self):
        """Supplier.akun_hutang (Pengaturan Supplier) sebelumnya bisa diisi &
        tampil di layar tapi tidak pernah benar-benar dipakai saat posting
        jurnal - payment SELALU debit akun hutang global, terlepas dari
        pengaturan supplier (ditemukan lewat audit produksi 2026-09-05)."""
        liability = AccountClassification.objects.create(name='Hutang Supplier Test', account_type='liability')
        akun_hutang_khusus = Account.objects.create(
            code='21005', name='Hutang - Supplier Khusus', account_type='liability', classification=liability,
        )
        supplier = Supplier.objects.create(nama='CV Supplier Khusus', akun_hutang=akun_hutang_khusus)
        self.payment.purchase.supplier_ref = supplier
        self.payment.purchase.save(update_fields=['supplier_ref'])

        entry = post_purchase_payment_journal(self.payment, self.cash)

        self.assertTrue(entry.lines.filter(account=akun_hutang_khusus, debit=Decimal('250000')).exists())
        self.assertFalse(entry.lines.filter(account__code='21000').exists())
        self.assertEqual(sum(line.debit for line in entry.lines.all()), sum(line.kredit for line in entry.lines.all()))
