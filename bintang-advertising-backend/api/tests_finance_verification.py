"""Verifikasi Admin Finance & agregat SPV Finance (2026-09-18):
RingkasanShift.verifikasi/pertanyakan, CashTransaction.verifikasi-admin-
finance, dan dua dashboard (AdminFinanceDashboardView, SpvFinanceDashboardView).

Semua endpoint di sini MURNI lapisan verifikasi operasional -- tidak satu
pun memanggil create_journal_entry()/post_journal(). Test T3 (debit==kredit
dsb) tidak relevan di sini karena tidak ada jurnal yang diposting; yang
diuji murni matriks role (T2) dan state transition status_verifikasi.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.finance_models import CashTransaction, CashTransactionType
from api.models import Order, OrderItem
from api.pos_models import RingkasanShift

User = get_user_model()


class RingkasanShiftVerifikasiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_verif_shift', password='secret', role='owner')
        self.admin_finance = User.objects.create_user(
            username='admin_finance_verif_shift', password='secret', role='admin_finance',
        )
        self.spv_finance = User.objects.create_user(
            username='spv_finance_verif_shift', password='secret', role='spv_finance',
        )
        self.kasir = User.objects.create_user(username='kasir_verif_shift', password='secret', role='kasir')
        self.ringkasan = RingkasanShift.objects.create(
            kasir=self.kasir, expected=Decimal('100000'), aktual=Decimal('95000'),
        )

    def test_admin_finance_bisa_verifikasi(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post(f'/api/ringkasan-shift/{self.ringkasan.id}/verifikasi/', {'catatan': 'sesuai'})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['status_verifikasi'], 'diverifikasi')
        self.ringkasan.refresh_from_db()
        self.assertEqual(self.ringkasan.diverifikasi_oleh_id, self.admin_finance.id)
        self.assertIsNotNone(self.ringkasan.diverifikasi_pada)

    def test_kasir_tidak_bisa_verifikasi(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/ringkasan-shift/{self.ringkasan.id}/verifikasi/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_spv_finance_tidak_bisa_verifikasi_individual(self):
        """SPV Finance perannya baca agregat, bukan verifikasi satu-satu
        (itu tugas Admin Finance) -- lihat IsAdminFinanceOrOwnerManager."""
        self.client.force_authenticate(self.spv_finance)
        res = self.client.post(f'/api/ringkasan-shift/{self.ringkasan.id}/verifikasi/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_tetap_bisa_verifikasi_langsung(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(f'/api/ringkasan-shift/{self.ringkasan.id}/verifikasi/')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def test_pertanyakan_wajib_catatan(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post(f'/api/ringkasan-shift/{self.ringkasan.id}/pertanyakan/', {})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.ringkasan.refresh_from_db()
        self.assertEqual(self.ringkasan.status_verifikasi, 'menunggu')

    def test_pertanyakan_dengan_catatan_berhasil(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post(
            f'/api/ringkasan-shift/{self.ringkasan.id}/pertanyakan/',
            {'catatan': 'Selisih besar, kasir belum bisa jelaskan'},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['status_verifikasi'], 'dipertanyakan')

    def test_admin_finance_bisa_lihat_list_semua_kasir(self):
        """CanAccessFinanceVerification: admin_finance bukan 'kasir', jadi
        tidak kena filter get_queryset() yang membatasi ke shift sendiri."""
        RingkasanShift.objects.create(
            kasir=self.kasir, expected=Decimal('50000'), aktual=Decimal('50000'),
        )
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/ringkasan-shift/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(rows), 2)

    def test_filter_status_verifikasi(self):
        self.client.force_authenticate(self.admin_finance)
        self.client.post(f'/api/ringkasan-shift/{self.ringkasan.id}/verifikasi/')
        res = self.client.get('/api/ringkasan-shift/', {'status_verifikasi': 'menunggu'})
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(rows), 0)


class CashTransactionVerifikasiAdminFinanceTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_verif_cash', password='secret', role='owner')
        self.admin_finance = User.objects.create_user(
            username='admin_finance_verif_cash', password='secret', role='admin_finance',
        )
        self.kasir = User.objects.create_user(username='kasir_verif_cash', password='secret', role='kasir')
        self.tipe = CashTransactionType.objects.create(nama='Listrik', tipe='pengeluaran')
        self.tx = CashTransaction.objects.create(
            arah='pengeluaran', jumlah=Decimal('50000'), tipe_transaksi=self.tipe,
            staff=self.kasir, waktu=timezone.now(),
        )

    def test_admin_finance_bisa_verifikasi_tanpa_ubah_status_posting(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post(
            f'/api/cash-transactions/{self.tx.id}/verifikasi-admin-finance/', {'catatan': 'sesuai nota'},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.diverifikasi_admin_finance_oleh_id, self.admin_finance.id)
        # Status posting (draft/selesai/batal) TIDAK ikut berubah -- itu
        # murni wewenang post_journal()/cancel_journal() (Owner/Manager, M2).
        self.assertEqual(self.tx.status, 'draft')

    def test_kasir_tidak_bisa_verifikasi(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/cash-transactions/{self.tx.id}/verifikasi-admin-finance/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_finance_tidak_bisa_post_journal(self):
        """Posting jurnal tetap eksklusif Owner/Manager (M2) -- Admin
        Finance TIDAK boleh bypass lewat endpoint post_journal biasa
        meskipun dia bisa verifikasi."""
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post(f'/api/cash-transactions/{self.tx.id}/post/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class FinanceDashboardViewTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_fin_dash', password='secret', role='owner')
        self.admin_finance = User.objects.create_user(
            username='admin_finance_fin_dash', password='secret', role='admin_finance',
        )
        self.spv_finance = User.objects.create_user(
            username='spv_finance_fin_dash', password='secret', role='spv_finance',
        )
        self.kasir = User.objects.create_user(username='kasir_fin_dash', password='secret', role='kasir')

        RingkasanShift.objects.create(
            kasir=self.kasir, expected=Decimal('100000'), aktual=Decimal('90000'),
        )
        RingkasanShift.objects.create(
            kasir=self.kasir, expected=Decimal('50000'), aktual=Decimal('50000'), status_verifikasi='diverifikasi',
        )
        # Order.save() menghitung ulang total_harga/sisa_tagihan dari
        # OrderItem-nya sendiri (bukan nilai yang dikirim langsung) -- wajib
        # buat item lalu save() ulang supaya sisa_tagihan=150000 terbentuk.
        order = Order.objects.create(
            id='ORD-FIN-DASH-1', nomor_wa='0812', nama='Pelanggan Piutang', dp_dibayar=50000,
        )
        OrderItem.objects.create(order=order, jenis_produk='Item Piutang', qty=1, harga_jual=200000)
        order.save()

    def test_admin_finance_dashboard_berisi_antrean_dan_piutang(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/finance/dashboard-admin-finance/')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['antrean_shift_count'], 1)
        self.assertEqual(res.data['piutang_count'], 1)
        self.assertEqual(res.data['piutang'][0]['sisa_tagihan'], 150000)

    def test_spv_finance_tidak_bisa_akses_dashboard_admin_finance(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/finance/dashboard-admin-finance/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_spv_finance_dashboard_berisi_agregat_tervalidasi(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/finance/dashboard-spv-finance/')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['ringkasan_kas_tervalidasi']['jumlah_shift'], 1)
        self.assertEqual(res.data['piutang_total_sisa'], 150000)

    def test_admin_finance_tidak_bisa_akses_dashboard_spv_finance(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/finance/dashboard-spv-finance/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_akses_keduanya(self):
        self.client.force_authenticate(self.owner)
        res1 = self.client.get('/api/finance/dashboard-admin-finance/')
        res2 = self.client.get('/api/finance/dashboard-spv-finance/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
