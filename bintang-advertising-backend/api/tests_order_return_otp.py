"""Keamanan KONFIRMASI retur Order: kasir wajib minta persetujuan OTP owner
sebelum bisa mengonfirmasi retur (memicu pemulihan stok + jurnal pembalik).
Mengajukan retur berstatus 'Tunda' TETAP bebas tanpa OTP -- tidak ada efek
samping apa pun. Owner/manager/admin tetap bisa langsung konfirmasi tanpa
alur OTP ini. Padanan persis tests_order_void_otp.py (2026-09-18)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Order, OrderReturnRequest, PengembalianOrder

User = get_user_model()


class OrderReturnCreateOtpGateTests(APITestCase):
    """Gerbang OTP di POST /orders/{id}/retur/ (status='Dikonfirmasi')."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_retur_create', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_retur_create', password='secret', role='kasir')
        self.order = Order.objects.create(
            nama='Pelanggan Retur OTP', nomor_wa='081234560001', sumber='pos',
            status_global='selesai', total_harga=100000,
        )

    def test_kasir_ajukan_retur_tunda_tetap_bebas_tanpa_otp(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/orders/{self.order.id}/retur/', {'catatan': 'barang cacat'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        retur = PengembalianOrder.objects.get(order=self.order)
        self.assertEqual(retur.status, 'Tunda')

    def test_kasir_retur_langsung_dikonfirmasi_ditolak_tanpa_otp(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/orders/{self.order.id}/retur/', {
            'catatan': 'barang cacat', 'status': 'Dikonfirmasi',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(PengembalianOrder.objects.filter(order=self.order).exists())

    def test_owner_retur_langsung_dikonfirmasi_tanpa_otp(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/orders/{self.order.id}/retur/', {
            'catatan': 'barang cacat', 'status': 'Dikonfirmasi',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        retur = PengembalianOrder.objects.get(order=self.order)
        self.assertEqual(retur.status, 'Dikonfirmasi')

    def test_kasir_retur_dikonfirmasi_dengan_otp_valid_berhasil(self):
        return_request = OrderReturnRequest.objects.create(
            order=self.order, diminta_oleh=self.kasir, alasan='alasan',
            status='disetujui', otp_code='123456',
            disetujui_pada=timezone.now(), kadaluarsa_pada=timezone.now() + timedelta(minutes=15),
        )
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/orders/{self.order.id}/retur/', {
            'catatan': 'barang cacat', 'status': 'Dikonfirmasi',
            'return_request_id': return_request.id, 'otp_code': '123456',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        retur = PengembalianOrder.objects.get(order=self.order)
        self.assertEqual(retur.status, 'Dikonfirmasi')
        return_request.refresh_from_db()
        self.assertEqual(return_request.status, 'digunakan')


class OrderReturnOtpFlowTests(APITestCase):
    """Alur ajukan -> setujui -> konfirmasi PengembalianOrder yang sudah ada
    (jalur PATCH /api/pengembalian/{id}/, dipakai halaman Retur Penjualan)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_retur_otp', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_retur_otp', password='secret', role='kasir')
        self.kasir_lain = User.objects.create_user(username='kasir_retur_otp_2', password='secret', role='kasir')
        self.order = Order.objects.create(
            nama='Pelanggan Retur Flow', nomor_wa='081234560002', sumber='pos',
            status_global='selesai', total_harga=200000,
        )
        self.retur = PengembalianOrder.objects.create(
            order=self.order, status='Tunda', nominal_refund=200000, dibuat_oleh=self.kasir,
        )

    def test_kasir_patch_dikonfirmasi_ditolak_tanpa_otp(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.patch(f'/api/pengembalian/{self.retur.id}/', {'status': 'Dikonfirmasi'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.retur.refresh_from_db()
        self.assertEqual(self.retur.status, 'Tunda')

    def test_owner_patch_dikonfirmasi_tanpa_otp(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(f'/api/pengembalian/{self.retur.id}/', {'status': 'Dikonfirmasi'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.retur.refresh_from_db()
        self.assertEqual(self.retur.status, 'Dikonfirmasi')

    def test_kasir_ajukan_otp_membuat_permintaan_pending(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/orders/{self.order.id}/minta-otp-retur/', {'alasan': 'konfirmasi retur barang cacat'}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['otp_code'], '')
        self.assertTrue(OrderReturnRequest.objects.filter(order=self.order, diminta_oleh=self.kasir).exists())

    def test_ajukan_otp_tanpa_alasan_ditolak(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/orders/{self.order.id}/minta-otp-retur/', {'alasan': '  '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_setujui_menghasilkan_kode_otp(self):
        return_request = OrderReturnRequest.objects.create(order=self.order, diminta_oleh=self.kasir, alasan='alasan')
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/order-return-requests/{return_request.id}/setujui/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'disetujui')
        self.assertEqual(len(response.data['otp_code']), 6)

    def test_kasir_tidak_bisa_menyetujui_permintaan_sendiri(self):
        return_request = OrderReturnRequest.objects.create(order=self.order, diminta_oleh=self.kasir, alasan='alasan')
        self.client.force_authenticate(self.kasir)
        response = self.client.post(f'/api/order-return-requests/{return_request.id}/setujui/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_alur_lengkap_ajukan_setujui_konfirmasi_berhasil(self):
        self.client.force_authenticate(self.kasir)
        ajukan = self.client.post(
            f'/api/orders/{self.order.id}/minta-otp-retur/', {'alasan': 'konfirmasi retur'}
        )
        return_request_id = ajukan.data['id']

        self.client.force_authenticate(self.owner)
        setujui = self.client.post(f'/api/order-return-requests/{return_request_id}/setujui/')
        otp_code = setujui.data['otp_code']

        self.client.force_authenticate(self.kasir)
        konfirmasi = self.client.patch(f'/api/pengembalian/{self.retur.id}/', {
            'status': 'Dikonfirmasi',
            'return_request_id': return_request_id, 'otp_code': otp_code,
        }, format='json')

        self.assertEqual(konfirmasi.status_code, status.HTTP_200_OK, konfirmasi.data)
        self.retur.refresh_from_db()
        self.assertEqual(self.retur.status, 'Dikonfirmasi')
        return_request = OrderReturnRequest.objects.get(pk=return_request_id)
        self.assertEqual(return_request.status, 'digunakan')

    def test_kode_otp_salah_ditolak(self):
        return_request = OrderReturnRequest.objects.create(
            order=self.order, diminta_oleh=self.kasir, alasan='alasan',
            status='disetujui', otp_code='123456',
            disetujui_pada=timezone.now(), kadaluarsa_pada=timezone.now() + timedelta(minutes=15),
        )
        self.client.force_authenticate(self.kasir)
        response = self.client.patch(f'/api/pengembalian/{self.retur.id}/', {
            'status': 'Dikonfirmasi',
            'return_request_id': return_request.id, 'otp_code': '000000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.retur.refresh_from_db()
        self.assertEqual(self.retur.status, 'Tunda')

    def test_kode_otp_kadaluarsa_ditolak(self):
        return_request = OrderReturnRequest.objects.create(
            order=self.order, diminta_oleh=self.kasir, alasan='alasan',
            status='disetujui', otp_code='123456',
            disetujui_pada=timezone.now() - timedelta(minutes=20),
            kadaluarsa_pada=timezone.now() - timedelta(minutes=5),
        )
        self.client.force_authenticate(self.kasir)
        response = self.client.patch(f'/api/pengembalian/{self.retur.id}/', {
            'status': 'Dikonfirmasi',
            'return_request_id': return_request.id, 'otp_code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kasir_lain_tidak_bisa_pakai_otp_milik_kasir_lain(self):
        return_request = OrderReturnRequest.objects.create(
            order=self.order, diminta_oleh=self.kasir, alasan='alasan',
            status='disetujui', otp_code='123456',
            disetujui_pada=timezone.now(), kadaluarsa_pada=timezone.now() + timedelta(minutes=15),
        )
        self.client.force_authenticate(self.kasir_lain)
        response = self.client.patch(f'/api/pengembalian/{self.retur.id}/', {
            'status': 'Dikonfirmasi',
            'return_request_id': return_request.id, 'otp_code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_tolak_permintaan(self):
        return_request = OrderReturnRequest.objects.create(order=self.order, diminta_oleh=self.kasir, alasan='alasan')
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f'/api/order-return-requests/{return_request.id}/tolak/', {'alasan_tolak': 'tidak valid'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'ditolak')
