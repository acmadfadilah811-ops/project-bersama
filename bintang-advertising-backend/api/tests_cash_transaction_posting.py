"""Post/Batal Post CashTransaction (Pendapatan/Pengeluaran) ke jurnal.

Akun debit/kredit dipilih manual per transaksi lewat field akun_debit/akun_kredit.
"""
from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, JournalEntry
from api.finance_models import CashTransaction, CashTransactionAttachment, CashTransactionType

User = get_user_model()


class CashTransactionPostingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_kas', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.tipe = CashTransactionType.objects.create(nama='Tips', tipe='pendapatan', dibuat_oleh=self.owner)

        asset, _ = AccountClassification.objects.get_or_create(name='Kas Test', defaults={'account_type': 'asset'})
        revenue, _ = AccountClassification.objects.get_or_create(name='Pendapatan Test', defaults={'account_type': 'revenue'})
        self.kas = Account.objects.create(code='11101-CT', name='Kas Test', account_type='asset', classification=asset)
        self.pendapatan = Account.objects.create(code='70000-CT', name='Pendapatan Test', account_type='revenue', classification=revenue)

    def _tx(self, **extra):
        payload = {'nomor': 'KAS-TEST-001', 'arah': 'pendapatan', 'jumlah': Decimal('50000'),
                   'tipe_transaksi': self.tipe, 'waktu': timezone.make_aware(datetime(2026, 7, 30, 10, 0)),
                   'dibuat_oleh': self.owner}
        payload.update(extra)
        return CashTransaction.objects.create(**payload)

    def test_post_requires_both_accounts(self):
        tx = self._tx()
        response = self.client.post(f'/api/cash-transactions/{tx.id}/post/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_creates_balanced_journal(self):
        tx = self._tx(akun_debit=self.kas, akun_kredit=self.pendapatan)
        response = self.client.post(f'/api/cash-transactions/{tx.id}/post/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tx.refresh_from_db()
        self.assertEqual(tx.status, 'selesai')
        entry = JournalEntry.objects.get(source_type=JournalEntry.SourceType.CASH_TRANSACTION, source_id=tx.id)
        lines = list(entry.lines.all())
        self.assertEqual(len(lines), 2)
        self.assertEqual(sum(l.debit for l in lines), Decimal('50000'))
        self.assertEqual(sum(l.debit for l in lines), sum(l.kredit for l in lines))

    def test_post_twice_is_idempotent(self):
        tx = self._tx(akun_debit=self.kas, akun_kredit=self.pendapatan)
        self.client.post(f'/api/cash-transactions/{tx.id}/post/', {}, format='json')

        second = self.client.post(f'/api/cash-transactions/{tx.id}/post/', {}, format='json')

        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)  # sudah 'selesai'
        self.assertEqual(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.CASH_TRANSACTION, source_id=tx.id).count(), 1)

    def test_cancel_reverses_journal_and_locks(self):
        tx = self._tx(akun_debit=self.kas, akun_kredit=self.pendapatan)
        self.client.post(f'/api/cash-transactions/{tx.id}/post/', {}, format='json')

        response = self.client.post(f'/api/cash-transactions/{tx.id}/cancel/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tx.refresh_from_db()
        self.assertEqual(tx.status, 'batal')
        original = JournalEntry.objects.get(source_type=JournalEntry.SourceType.CASH_TRANSACTION, source_id=tx.id)
        self.assertEqual(original.status, JournalEntry.Status.POSTED)  # jurnal asli tidak diedit/dihapus (M7/L7)
        reversal = JournalEntry.objects.get(reversed_entry=original)
        self.assertEqual(sum(l.debit for l in reversal.lines.all()), Decimal('50000'))

    def test_cancel_before_post_is_rejected(self):
        tx = self._tx(akun_debit=self.kas, akun_kredit=self.pendapatan)
        response = self.client.post(f'/api/cash-transactions/{tx.id}/cancel/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_posted_transaction_cannot_be_edited(self):
        tx = self._tx(akun_debit=self.kas, akun_kredit=self.pendapatan)
        self.client.post(f'/api/cash-transactions/{tx.id}/post/', {}, format='json')

        response = self.client.patch(f'/api/cash-transactions/{tx.id}/', {'catatan': 'coba ubah'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CashTransactionKasirAccessTests(APITestCase):
    """Kasir boleh mencatat Kas Masuk/Keluar shift-nya sendiri (layar PosShift),
    tapi tidak boleh posting/batal-posting ke jurnal maupun melihat/mengubah
    transaksi kasir lain. Staff (bukan kasir) tetap tertutup total."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_kasir_test', password='secret', role='owner')
        self.kasir1 = User.objects.create_user(username='kasir1', password='secret', role='kasir')
        self.kasir2 = User.objects.create_user(username='kasir2', password='secret', role='kasir')
        self.staff = User.objects.create_user(username='staff_kas_test', password='secret', role='staff')
        self.tipe_masuk = CashTransactionType.objects.create(nama='Tips', tipe='pendapatan', dibuat_oleh=self.owner)

    def _payload(self):
        return {
            'tipe_transaksi': self.tipe_masuk.id,
            'jumlah': '20000',
            'waktu': timezone.now().isoformat(),
            'catatan': 'kas masuk shift',
        }

    def test_kasir_can_list_transaction_types(self):
        self.client.force_authenticate(self.kasir1)
        response = self.client.get('/api/cash-transaction-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_kasir_cannot_update_or_delete_transaction_type(self):
        self.client.force_authenticate(self.kasir1)
        response = self.client.patch(f'/api/cash-transaction-types/{self.tipe_masuk.id}/', {'nama': 'Ubah'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.delete(f'/api/cash-transaction-types/{self.tipe_masuk.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kasir_can_create_and_delete_own_cash_transaction(self):
        self.client.force_authenticate(self.kasir1)
        response = self.client.post('/api/cash-transactions/', self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tx_id = response.data['id']

        response = self.client.delete(f'/api/cash-transactions/{tx_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_kasir_can_attach_proof_when_creating_cash_transaction(self):
        self.client.force_authenticate(self.kasir1)
        payload = self._payload()
        payload['lampiran'] = SimpleUploadedFile(
            'bukti-kas.txt', b'bukti kas masuk', content_type='text/plain',
        )

        response = self.client.post('/api/cash-transactions/', payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            CashTransactionAttachment.objects.filter(transaction_id=response.data['id']).count(), 1,
        )

    def test_kasir_cannot_see_other_kasir_transaction(self):
        self.client.force_authenticate(self.kasir1)
        tx_id = self.client.post('/api/cash-transactions/', self._payload(), format='json').data['id']

        self.client.force_authenticate(self.kasir2)
        response = self.client.get('/api/cash-transactions/')
        rows = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        ids = [row['id'] for row in rows]
        self.assertNotIn(tx_id, ids)

        response = self.client.get(f'/api/cash-transactions/{tx_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_kasir_cannot_post_or_cancel_journal(self):
        self.client.force_authenticate(self.kasir1)
        tx_id = self.client.post('/api/cash-transactions/', self._payload(), format='json').data['id']

        response = self.client.post(f'/api/cash-transactions/{tx_id}/post/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(f'/api/cash-transactions/{tx_id}/cancel/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_role_still_fully_blocked(self):
        self.client.force_authenticate(self.staff)
        response = self.client.get('/api/cash-transactions/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post('/api/cash-transactions/', self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.get('/api/cash-transaction-types/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
