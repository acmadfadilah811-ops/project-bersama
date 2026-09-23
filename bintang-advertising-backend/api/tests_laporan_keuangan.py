"""Laporan Kerja Harian Admin/SPV Finance -- target & kendala operasional
lingkup keuangan (2026-09-24). Hierarki: Admin Finance eksekutor (lihat &
kelola laporan sendiri saja), SPV Finance pengawas (lihat laporan sendiri
+ semua laporan Admin Finance, tapi tidak bisa ubah/hapus milik orang
lain). Owner/Manager akses penuh."""
from datetime import date

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.finance_models import CashTransaction, CashTransactionType
from api.laporan_keuangan_models import LaporanTargetKeuangan
from api.product_models import Purchase

User = get_user_model()


class LaporanTargetKeuanganCrudTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_ltk', password='secret', role='owner')
        self.admin_finance = User.objects.create_user(username='adminfin_ltk', password='secret', role='admin_finance')
        self.admin_finance_2 = User.objects.create_user(username='adminfin2_ltk', password='secret', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='spvfin_ltk', password='secret', role='spv_finance')
        self.staff = User.objects.create_user(username='staff_ltk', password='secret', role='staff')

        self.laporan_admin = LaporanTargetKeuangan.objects.create(
            dibuat_oleh=self.admin_finance, periode_tipe='harian',
            tanggal_mulai=date(2026, 9, 24), tanggal_selesai=date(2026, 9, 24),
            target_transaksi=5,
        )
        self.laporan_admin_2 = LaporanTargetKeuangan.objects.create(
            dibuat_oleh=self.admin_finance_2, periode_tipe='harian',
            tanggal_mulai=date(2026, 9, 24), tanggal_selesai=date(2026, 9, 24),
            target_transaksi=3,
        )
        self.laporan_spv = LaporanTargetKeuangan.objects.create(
            dibuat_oleh=self.spv_finance, periode_tipe='harian',
            tanggal_mulai=date(2026, 9, 24), tanggal_selesai=date(2026, 9, 24),
            target_transaksi=1,
        )

    def test_admin_finance_bisa_buat_laporan(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.post('/api/laporan-keuangan/target/', {
            'periode_tipe': 'harian', 'tanggal_mulai': '2026-09-24',
            'tanggal_selesai': '2026-09-24', 'target_transaksi': 4,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

    def test_spv_finance_bisa_buat_laporan(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.post('/api/laporan-keuangan/target/', {
            'periode_tipe': 'harian', 'tanggal_mulai': '2026-09-24',
            'tanggal_selesai': '2026-09-24', 'target_transaksi': 2,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

    def test_staff_tidak_bisa_akses(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get('/api/laporan-keuangan/target/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_finance_hanya_lihat_laporan_sendiri(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/laporan-keuangan/target/')
        ids = [row['id'] for row in res.data]
        self.assertIn(self.laporan_admin.id, ids)
        self.assertNotIn(self.laporan_admin_2.id, ids)
        self.assertNotIn(self.laporan_spv.id, ids)

    def test_spv_finance_lihat_laporan_sendiri_dan_semua_admin_finance(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/laporan-keuangan/target/')
        ids = [row['id'] for row in res.data]
        self.assertIn(self.laporan_admin.id, ids)
        self.assertIn(self.laporan_admin_2.id, ids)
        self.assertIn(self.laporan_spv.id, ids)

    def test_owner_lihat_semua_laporan(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/laporan-keuangan/target/')
        ids = [row['id'] for row in res.data]
        self.assertIn(self.laporan_admin.id, ids)
        self.assertIn(self.laporan_admin_2.id, ids)
        self.assertIn(self.laporan_spv.id, ids)

    def test_admin_finance_tidak_bisa_ubah_laporan_admin_finance_lain(self):
        # get_queryset() sudah menyaring laporan Admin Finance lain keluar
        # dari daftar yang terlihat, jadi objeknya "tidak ditemukan" (404),
        # bukan 403 -- konsisten dengan pola scoped ViewSet lain di codebase.
        self.client.force_authenticate(self.admin_finance)
        res = self.client.patch(f'/api/laporan-keuangan/target/{self.laporan_admin_2.id}/', {'target_transaksi': 9}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_spv_finance_tidak_bisa_ubah_laporan_admin_finance(self):
        """Kritis: SPV Finance cuma pengawas (baca), bukan bisa ikut ubah
        laporan Admin Finance -- kalau tidak, dua role bisa menimpa data
        yang sama di waktu yang sama (kekhawatiran user 2026-09-24)."""
        self.client.force_authenticate(self.spv_finance)
        res = self.client.patch(f'/api/laporan-keuangan/target/{self.laporan_admin.id}/', {'target_transaksi': 9}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_finance_bisa_ubah_laporan_sendiri(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.patch(f'/api/laporan-keuangan/target/{self.laporan_admin.id}/', {'target_transaksi': 9}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)


class RingkasanKeuanganFinanceTests(APITestCase):
    def setUp(self):
        self.admin_finance = User.objects.create_user(username='adminfin_rk', password='secret', role='admin_finance')
        self.admin_finance_2 = User.objects.create_user(username='adminfin2_rk', password='secret', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='spvfin_rk', password='secret', role='spv_finance')

        tipe = CashTransactionType.objects.create(nama='Listrik', tipe='pengeluaran')
        self.trx_admin1 = CashTransaction.objects.create(
            nomor='CT-RK-0001', arah='pengeluaran', jumlah=100000, tipe_transaksi=tipe,
            waktu=timezone.now(),
            diverifikasi_admin_finance_oleh=self.admin_finance,
            diverifikasi_admin_finance_pada=timezone.now(),
        )
        self.trx_admin2 = CashTransaction.objects.create(
            nomor='CT-RK-0002', arah='pengeluaran', jumlah=50000, tipe_transaksi=tipe,
            waktu=timezone.now(),
            diverifikasi_admin_finance_oleh=self.admin_finance_2,
            diverifikasi_admin_finance_pada=timezone.now(),
        )
        Purchase.objects.create(nomor='PO-RK-0001', tanggal=date.today(), dibuat_oleh=self.admin_finance)

    def test_admin_finance_hanya_lihat_ringkasan_sendiri(self):
        self.client.force_authenticate(self.admin_finance)
        res = self.client.get('/api/laporan-keuangan/ringkasan/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['jumlah_transaksi_diverifikasi'], 1)
        self.assertEqual(res.data['jumlah_pengadaan_dibuat'], 1)

    def test_spv_finance_lihat_ringkasan_seluruh_tim(self):
        self.client.force_authenticate(self.spv_finance)
        res = self.client.get('/api/laporan-keuangan/ringkasan/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['jumlah_transaksi_diverifikasi'], 2)
        self.assertEqual(res.data['jumlah_pengadaan_dibuat'], 1)
