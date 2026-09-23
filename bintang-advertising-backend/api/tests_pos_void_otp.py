"""Keamanan void transaksi POS Lunas: kasir wajib minta persetujuan OTP
owner sebelum bisa void (instruksi user 2026-08-14, padanan
tests_order_void_otp.py). Owner/manager/admin tetap bisa langsung /void/
tanpa alur OTP ini. Void juga ditolak sejak awal kalau transaksi sudah
ditandai diambil pelanggan (POSSale.diambil_pada)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.pos_models import POSSale, POSVoidRequest

User = get_user_model()


class PosVoidOtpTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pos_void_otp', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_pos_void_otp', password='secret', role='kasir')
        self.kasir_lain = User.objects.create_user(username='kasir_pos_void_otp_2', password='secret', role='kasir')
        self.sale = POSSale.objects.create(nomor='POS-VOID-OTP-0001', kasir=self.kasir, status='paid')

    def test_kasir_void_langsung_ditolak_tanpa_otp(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/void/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.sale.refresh_from_db()
        self.assertNotEqual(self.sale.status, 'void')

    def test_owner_pun_ditolak_void_transaksi_yang_sudah_diambil(self):
        """Guard `diambil_pada` di void_sale() berlaku untuk semua role —
        padanan batalkan_order() yang menolak status_global='selesai' tanpa
        peduli siapa pemanggilnya (bukan cuma dicek di alur OTP kasir)."""
        self.sale.diambil_pada = timezone.now()
        self.sale.save(update_fields=['diambil_pada'])
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/void/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.sale.refresh_from_db()
        self.assertNotEqual(self.sale.status, 'void')

    def test_owner_tetap_bisa_void_langsung_tanpa_otp(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/void/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, 'void')

    def test_kasir_ajukan_otp_membuat_permintaan_pending(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': 'salah input produk'}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['otp_code'], '')
        self.assertTrue(POSVoidRequest.objects.filter(sale=self.sale, diminta_oleh=self.kasir).exists())

    def test_ajukan_otp_tanpa_alasan_ditolak(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': '  '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ajukan_otp_kedua_kali_ditolak_selagi_masih_pending(self):
        self.client.force_authenticate(self.kasir)
        self.client.post(f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': 'alasan pertama'})
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': 'alasan kedua'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(POSVoidRequest.objects.filter(sale=self.sale).count(), 1)

    def test_ajukan_otp_ditolak_jika_sudah_ditandai_diambil(self):
        self.sale.diambil_pada = timezone.now()
        self.sale.save(update_fields=['diambil_pada'])
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': 'salah input produk'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(POSVoidRequest.objects.filter(sale=self.sale).exists())

    def test_owner_setujui_menghasilkan_kode_otp(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        self.client.force_authenticate(self.owner)

        response = self.client.post(f'/api/pos-void-requests/{void_request.id}/setujui/')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'disetujui')
        self.assertEqual(len(response.data['otp_code']), 6)
        void_request.refresh_from_db()
        self.assertEqual(void_request.status, 'disetujui')
        self.assertTrue(void_request.otp_code)
        self.assertIsNotNone(void_request.kadaluarsa_pada)

    def test_kasir_tidak_bisa_menyetujui_permintaan_sendiri(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        self.client.force_authenticate(self.kasir)

        response = self.client.post(f'/api/pos-void-requests/{void_request.id}/setujui/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        void_request.refresh_from_db()
        self.assertEqual(void_request.status, 'pending')

    def test_alur_lengkap_kasir_disetujui_lalu_void_berhasil(self):
        self.client.force_authenticate(self.kasir)
        ajukan = self.client.post(
            f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': 'salah input produk'}
        )
        void_request_id = ajukan.data['id']

        self.client.force_authenticate(self.owner)
        setujui = self.client.post(f'/api/pos-void-requests/{void_request_id}/setujui/')
        otp_code = setujui.data['otp_code']

        self.client.force_authenticate(self.kasir)
        void_resp = self.client.post(f'/api/pos/sales/{self.sale.id}/void/', {
            'void_request_id': void_request_id, 'otp_code': otp_code,
        })

        self.assertEqual(void_resp.status_code, status.HTTP_200_OK, void_resp.data)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, 'void')
        void_request = POSVoidRequest.objects.get(pk=void_request_id)
        self.assertEqual(void_request.status, 'digunakan')

    def test_kode_otp_salah_ditolak(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        void_request.status = 'disetujui'
        void_request.otp_code = '123456'
        void_request.disetujui_pada = timezone.now()
        void_request.kadaluarsa_pada = timezone.now() + timedelta(minutes=15)
        void_request.save()

        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/void/', {
            'void_request_id': void_request.id, 'otp_code': '000000',
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.sale.refresh_from_db()
        self.assertNotEqual(self.sale.status, 'void')

    def test_kode_otp_kadaluarsa_ditolak(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        void_request.status = 'disetujui'
        void_request.otp_code = '123456'
        void_request.disetujui_pada = timezone.now() - timedelta(minutes=20)
        void_request.kadaluarsa_pada = timezone.now() - timedelta(minutes=5)
        void_request.save()

        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/void/', {
            'void_request_id': void_request.id, 'otp_code': '123456',
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kasir_lain_tidak_bisa_pakai_otp_milik_kasir_lain(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        void_request.status = 'disetujui'
        void_request.otp_code = '123456'
        void_request.disetujui_pada = timezone.now()
        void_request.kadaluarsa_pada = timezone.now() + timedelta(minutes=15)
        void_request.save()

        self.client.force_authenticate(self.kasir_lain)
        response = self.client.post(f'/api/pos/sales/{self.sale.id}/void/', {
            'void_request_id': void_request.id, 'otp_code': '123456',
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_tolak_permintaan(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            f'/api/pos-void-requests/{void_request.id}/tolak/', {'alasan_tolak': 'tidak valid'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'ditolak')
        self.assertEqual(response.data['alasan_tolak'], 'tidak valid')

    def test_setelah_ditolak_kasir_bisa_ajukan_ulang(self):
        POSVoidRequest.objects.create(
            sale=self.sale, diminta_oleh=self.kasir, alasan='alasan', status='ditolak',
        )
        self.client.force_authenticate(self.kasir)

        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/minta-otp-void/', {'alasan': 'alasan baru'}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_kasir_lain_tidak_lihat_kode_otp_milik_kasir_lain_di_list(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        void_request.status = 'disetujui'
        void_request.otp_code = '123456'
        void_request.disetujui_pada = timezone.now()
        void_request.kadaluarsa_pada = timezone.now() + timedelta(minutes=15)
        void_request.save()

        self.client.force_authenticate(self.kasir_lain)
        response = self.client.get('/api/pos-void-requests/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hasil = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(hasil), 0)  # queryset kasir lain difilter diminta_oleh=dirinya sendiri

    def test_kasir_pemilik_lihat_kode_otp_sendiri_setelah_disetujui(self):
        void_request = POSVoidRequest.objects.create(sale=self.sale, diminta_oleh=self.kasir, alasan='alasan')
        void_request.status = 'disetujui'
        void_request.otp_code = '123456'
        void_request.disetujui_pada = timezone.now()
        void_request.kadaluarsa_pada = timezone.now() + timedelta(minutes=15)
        void_request.save()

        self.client.force_authenticate(self.kasir)
        response = self.client.get('/api/pos-void-requests/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hasil = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(hasil), 1)
        self.assertEqual(hasil[0]['otp_code'], '123456')


class PosVoidOtpSpvFinanceTests(APITestCase):
    """Tahap Kordiv (2026-09-18) DIHAPUS 2026-09-23 -- void request POS
    sekarang 1 tahap langsung ke SPV/SPV Finance/owner/manager (instruksi
    user: "void request langsung ke SPV Finance saja"). Kordiv tidak lagi
    bisa melihat/memproses void request sama sekali. Permintaan LAMA yang
    kadung berstatus 'menunggu_spv' (dari sebelum perubahan ini) tetap
    harus bisa diproses final approver, tidak boleh nyangkut."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_void_sf', password='secret', role='owner')
        self.spv = User.objects.create_user(username='spv_void_sf', password='secret', role='spv')
        self.spv_finance = User.objects.create_user(username='spv_finance_void_sf', password='secret', role='spv_finance')
        self.kordiv = User.objects.create_user(username='kordiv_void_sf', password='secret', role='kordiv')
        self.kasir = User.objects.create_user(username='kasir_void_sf', password='secret', role='kasir')
        self.sale = POSSale.objects.create(nomor='POS-VOID-SF-0001', kasir=self.kasir, status='paid')
        self.void_request = POSVoidRequest.objects.create(
            sale=self.sale, diminta_oleh=self.kasir, alasan='salah input produk',
        )

    def test_spv_finance_bisa_setujui_langsung_dari_pending(self):
        self.client.force_authenticate(self.spv_finance)
        response = self.client.post(f'/api/pos-void-requests/{self.void_request.id}/setujui/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'disetujui')
        self.assertEqual(len(response.data['otp_code']), 6)

    def test_spv_finance_bisa_tolak(self):
        self.client.force_authenticate(self.spv_finance)
        response = self.client.post(
            f'/api/pos-void-requests/{self.void_request.id}/tolak/', {'alasan_tolak': 'tidak valid'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'ditolak')

    def test_kordiv_tidak_lagi_bisa_setujui_atau_tolak(self):
        self.client.force_authenticate(self.kordiv)
        response = self.client.post(f'/api/pos-void-requests/{self.void_request.id}/setujui/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(f'/api/pos-void-requests/{self.void_request.id}/tolak/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_endpoint_tahap_kordiv_sudah_tidak_ada(self):
        self.client.force_authenticate(self.kordiv)
        response = self.client.post(f'/api/pos-void-requests/{self.void_request.id}/setujui-kordiv/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_kordiv_tidak_lagi_melihat_antrean_void_sama_sekali(self):
        # Kordiv bukan pengaju (`diminta_oleh`), dan tidak lagi termasuk role
        # "lihat semua" -- queryset-nya jadi kosong (filter diminta_oleh=diri
        # sendiri, yang tidak pernah cocok untuk Kordiv).
        self.client.force_authenticate(self.kordiv)
        response = self.client.get('/api/pos-void-requests/')
        hasil = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(hasil), 0)

    def test_permintaan_lama_menunggu_spv_tetap_bisa_diproses_final_approver(self):
        """Kompatibilitas mundur: request yang kadung 'menunggu_spv' dari
        sebelum tahap Kordiv dihapus tidak boleh nyangkut selamanya."""
        self.void_request.status = 'menunggu_spv'
        self.void_request.save(update_fields=['status'])

        self.client.force_authenticate(self.spv_finance)
        response = self.client.post(f'/api/pos-void-requests/{self.void_request.id}/setujui/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'disetujui')

    def test_owner_spv_dan_spv_finance_melihat_semua_permintaan(self):
        for user in (self.owner, self.spv, self.spv_finance):
            self.client.force_authenticate(user)
            res = self.client.get('/api/pos-void-requests/')
            hasil = res.data['results'] if isinstance(res.data, dict) else res.data
            self.assertEqual(len(hasil), 1, f'gagal untuk role {user.role}')

    def test_filter_status_boleh_daftar_dipisah_koma(self):
        request_lain = POSVoidRequest.objects.create(
            sale=POSSale.objects.create(nomor='POS-VOID-SF-0002', kasir=self.kasir, status='paid'),
            diminta_oleh=self.kasir, alasan='alasan lain', status='menunggu_spv',
        )
        self.client.force_authenticate(self.spv_finance)
        response = self.client.get('/api/pos-void-requests/', {'status': 'pending,menunggu_spv'})
        hasil = response.data['results'] if isinstance(response.data, dict) else response.data
        ids = {row['id'] for row in hasil}
        self.assertEqual(ids, {self.void_request.id, request_lain.id})
