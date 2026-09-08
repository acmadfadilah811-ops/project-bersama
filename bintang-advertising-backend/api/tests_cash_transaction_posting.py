"""Post/Batal Post CashTransaction (Pendapatan/Pengeluaran) ke jurnal.

Akun debit/kredit dipilih manual per transaksi lewat field akun_debit/akun_kredit.
"""
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch

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


class CashTransactionNumberRetryTests(APITestCase):
    """`_next_number()` di finance_views.py generate nomor dari MAX+1 tanpa
    lock baris -- 2 request Kas Masuk/Keluar BERSAMAAN (hari yang sama) bisa
    dapat nomor yang sama & bentrok unique constraint. perform_create()
    sekarang retry pakai savepoint kalau itu terjadi (sama pola dengan
    accounting/services/journal.py::create_journal_entry).

    Race sungguhan disimulasikan lewat mock, bukan threading nyata --
    SQLite (dev/test) memakai whole-database lock (beda dari row-level lock
    Postgres produksi), dan retry di level test CLIENT pada POST yang TIDAK
    idempoten rawan salah (bisa bikin submit dobel beneran kalau request
    sebelumnya sebenarnya sudah sukses tapi responsnya kena "database is
    locked" belakangan). Mock memastikan retry di perform_create sendiri
    yang teruji, bukan perilaku SQLite yang kebetulan."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_kas_retry', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.tipe = CashTransactionType.objects.create(nama='Tips Retry', tipe='pendapatan', dibuat_oleh=self.owner)

    def test_create_retries_when_nomor_collides_then_succeeds(self):
        existing = CashTransaction.objects.create(
            nomor='KAS999999-COLLIDE', arah='pendapatan', jumlah=Decimal('10000'),
            tipe_transaksi=self.tipe, waktu=timezone.now(), dibuat_oleh=self.owner,
        )
        fresh_nomor = 'KAS999999-FRESH'

        with patch('api.finance_views._next_number', side_effect=[existing.nomor, fresh_nomor]):
            response = self.client.post('/api/cash-transactions/', {
                'tipe_transaksi': self.tipe.id,
                'jumlah': '15000',
                'waktu': timezone.now().isoformat(),
                'catatan': 'kas masuk setelah bentrok nomor',
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['nomor'], fresh_nomor)
        self.assertEqual(CashTransaction.objects.filter(nomor=fresh_nomor).count(), 1)
        self.assertEqual(CashTransaction.objects.count(), 2, "Retry yang bentrok tidak boleh meninggalkan baris setengah jadi.")

    def test_create_gives_up_after_max_retries_if_always_colliding(self):
        from django.db import IntegrityError
        existing = CashTransaction.objects.create(
            nomor='KAS999998-COLLIDE', arah='pendapatan', jumlah=Decimal('10000'),
            tipe_transaksi=self.tipe, waktu=timezone.now(), dibuat_oleh=self.owner,
        )
        with patch('api.finance_views._next_number', return_value=existing.nomor):
            with self.assertRaises(IntegrityError):
                self.client.post('/api/cash-transactions/', {
                    'tipe_transaksi': self.tipe.id,
                    'jumlah': '15000',
                    'waktu': timezone.now().isoformat(),
                    'catatan': 'selalu bentrok',
                }, format='json')
        self.assertEqual(CashTransaction.objects.count(), 1, "Retry yang selalu gagal tidak boleh meninggalkan baris setengah jadi.")


class CashTransactionTypeProtectedDeleteTests(APITestCase):
    """CashTransaction.tipe_transaksi pakai on_delete=PROTECT -- tanpa
    override destroy() di CashTransactionTypeViewSet, hapus tipe yang masih
    dipakai transaksi lama menghasilkan 500 mentah (ProtectedError tidak
    tertangani), bukan pesan jelas (ditemukan audit Biaya 2026-09-08)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_tipe_protect', password='secret', role='owner')
        self.client.force_authenticate(self.owner)
        self.tipe_terpakai = CashTransactionType.objects.create(nama='Listrik', tipe='pengeluaran', dibuat_oleh=self.owner)
        CashTransaction.objects.create(
            nomor='KAS-PROTECT-001', arah='pengeluaran', jumlah=Decimal('50000'),
            tipe_transaksi=self.tipe_terpakai, waktu=timezone.make_aware(datetime(2026, 7, 30, 10, 0)),
            dibuat_oleh=self.owner,
        )
        self.tipe_belum_terpakai = CashTransactionType.objects.create(nama='Air', tipe='pengeluaran', dibuat_oleh=self.owner)

    def test_hapus_tipe_yang_masih_dipakai_mengembalikan_400_bukan_500(self):
        response = self.client.delete(f'/api/cash-transaction-types/{self.tipe_terpakai.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.content)
        self.assertIn('masih dipakai', response.data['error'])
        self.assertTrue(CashTransactionType.objects.filter(pk=self.tipe_terpakai.id).exists())

    def test_hapus_tipe_yang_belum_dipakai_berhasil(self):
        response = self.client.delete(f'/api/cash-transaction-types/{self.tipe_belum_terpakai.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CashTransactionType.objects.filter(pk=self.tipe_belum_terpakai.id).exists())
