from datetime import date
from decimal import Decimal

from django.test import TestCase

from api.product_models import Purchase, PurchasePayment

from .models import Account, AccountClassification, JournalEntry
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
        Account.objects.create(
            code='21000', name='Hutang Dagang Test', account_type='liability', classification=liability,
        )
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
