"""Hapus jurnal `posted` — WAJIB jurnal pembalik + Log Jurnal (L7/M7), bukan hard delete.

Bug lama: `JournalEntryDetailView.delete()` melakukan `entry.delete()` langsung
tanpa jurnal pembalik dan tanpa mencatat apa pun ke `JournalAuditLog`. User
kasih contoh format Log Aksi Olsera dan pilih pendekatan reversal (bukan hard
delete) supaya M7/L7 tetap dipatuhi. Test ini membuktikan: jurnal asli tetap
ada (tidak terhapus), jurnal pembalik balanced, dan `JournalAuditLog.note`
berisi rincian "Debit/Kredit akun ... IDR x" persis format yang diminta.
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from accounting.models import Account, AccountClassification, JournalAuditLog, JournalEntry
from accounting.services.journal import create_journal_entry
from api.customer_models import Supplier

User = get_user_model()


class JournalEntryDeleteAuditTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='del_owner', password='pw12345', role='owner')
        self.kasir = User.objects.create_user(username='del_kasir', password='pw12345', role='kasir')
        self.client = APIClient()

        expense_cls = AccountClassification.objects.create(
            name='HPP Test Del', account_type='expense', code_range_start=50000, code_range_end=59999,
        )
        liability_cls = AccountClassification.objects.create(
            name='Kewajiban Test Del', account_type='liability', code_range_start=20000, code_range_end=29999,
        )
        self.pembelian = Account.objects.create(code='50991', name='Pembelian Del', account_type='expense', classification=expense_cls)
        self.hutang = Account.objects.create(code='21991', name='Hutang Del', account_type='liability', classification=liability_cls)
        self.supplier = Supplier.objects.create(nama='Jaya Sentosa, CV')

        self.entry = create_journal_entry(
            date=date.today(),
            lines=[
                {'account': self.pembelian, 'debit': Decimal('79950'), 'kredit': 0,
                 'description': 'Pembelian dari Jaya Sentosa, CV', 'supplier': self.supplier},
                {'account': self.hutang, 'debit': 0, 'kredit': Decimal('79950'),
                 'description': 'Pembelian dari Jaya Sentosa, CV', 'supplier': self.supplier},
            ],
            description='Pembelian dari Jaya Sentosa, CV',
            source_type='purchase',
        )

    def test_delete_creates_reversal_not_hard_delete(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(
            f'/api/accounting/journal-entries/{self.entry.entry_number}/',
            {'reason': 'Salah input PO'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

        # Jurnal asli TIDAK terhapus (L7).
        self.entry.refresh_from_db()
        self.assertTrue(JournalEntry.objects.filter(pk=self.entry.pk).exists())

        # Jurnal pembalik dibuat, balance, dan menunjuk ke entry asli.
        reversal = JournalEntry.objects.get(reversed_entry=self.entry)
        self.assertEqual(reversal.entry_number, res.data['reversal_entry_number'])
        total_debit = sum(l.debit for l in reversal.lines.all())
        total_kredit = sum(l.kredit for l in reversal.lines.all())
        self.assertEqual(total_debit, total_kredit)
        self.assertEqual(total_debit, Decimal('79950'))

    def test_delete_writes_formatted_audit_log(self):
        self.client.force_authenticate(user=self.owner)
        self.client.delete(
            f'/api/accounting/journal-entries/{self.entry.entry_number}/',
            {'reason': 'Salah input PO'}, format='json',
        )
        log = JournalAuditLog.objects.get(journal_entry=self.entry, action=JournalAuditLog.Action.DELETED)
        self.assertIn(f'Hapus Pembelian - {self.entry.entry_number}', log.note)
        self.assertIn('Debit 50991 Pembelian Del Pembelian dari Jaya Sentosa, CV IDR 79.950', log.note)
        self.assertIn('Kredit 21991 Hutang Del Pembelian dari Jaya Sentosa, CV IDR 79.950', log.note)
        self.assertIn('Catatan: Salah input PO', log.note)
        self.assertEqual(log.actor, self.owner)

    def test_delete_requires_reason(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(f'/api/accounting/journal-entries/{self.entry.entry_number}/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_rejected_for_non_manager(self):
        self.client.force_authenticate(user=self.kasir)
        res = self.client.delete(
            f'/api/accounting/journal-entries/{self.entry.entry_number}/',
            {'reason': 'x'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_delete_same_entry_twice(self):
        self.client.force_authenticate(user=self.owner)
        self.client.delete(
            f'/api/accounting/journal-entries/{self.entry.entry_number}/',
            {'reason': 'Pertama'}, format='json',
        )
        res = self.client.delete(
            f'/api/accounting/journal-entries/{self.entry.entry_number}/',
            {'reason': 'Kedua'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class JournalAuditLogListViewTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='log_owner', password='pw12345', role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

        expense_cls = AccountClassification.objects.create(
            name='HPP Test Log', account_type='expense', code_range_start=50000, code_range_end=59999,
        )
        liability_cls = AccountClassification.objects.create(
            name='Kewajiban Test Log', account_type='liability', code_range_start=20000, code_range_end=29999,
        )
        self.pembelian = Account.objects.create(code='50992', name='Pembelian Log', account_type='expense', classification=expense_cls)
        self.hutang = Account.objects.create(code='21992', name='Hutang Log', account_type='liability', classification=liability_cls)

        self.entry = create_journal_entry(
            date=date.today(),
            lines=[
                {'account': self.pembelian, 'debit': Decimal('50000'), 'kredit': 0},
                {'account': self.hutang, 'debit': 0, 'kredit': Decimal('50000')},
            ],
            description='Pembelian Test Log', source_type='purchase',
        )
        self.client.delete(
            f'/api/accounting/journal-entries/{self.entry.entry_number}/',
            {'reason': 'Test'}, format='json',
        )

    def test_list_returns_real_deleted_log_entry(self):
        # create_journal_entry() sudah otomatis mencatat CREATED+POSTED per
        # entry (asli & pembalik); di sini fokus ke satu log 'deleted' yang
        # ditulis delete()-nya sendiri.
        res = self.client.get('/api/accounting/journal-audit-logs/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        payload = res.json()
        rows = payload['results'] if isinstance(payload, dict) else payload
        matching = [r for r in rows if r['entry_number'] == self.entry.entry_number and r['action'] == 'deleted']
        self.assertEqual(len(matching), 1)
        self.assertIn('Hapus Pembelian', matching[0]['note'])

    def test_search_matches_entry_number(self):
        res = self.client.get('/api/accounting/journal-audit-logs/', {
            'date_from': str(date.today()), 'date_to': str(date.today()),
            'search': self.entry.entry_number,
        })
        payload = res.json()
        rows = payload['results'] if isinstance(payload, dict) else payload
        # entry asli tercatat CREATED+POSTED+DELETED = 3 baris log, semuanya
        # cocok search by entry_number (bukan bug, memang 1 entry_number bisa
        # punya banyak baris Log Jurnal seiring siklus hidupnya).
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(r['entry_number'] == self.entry.entry_number for r in rows))
