from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from api.models import Order, OrderActivityLog

CustomUser = get_user_model()


class OrderStatusActionsTestCase(APITestCase):
    def setUp(self):
        # User dengan role kasir (diizinkan mengubah status)
        self.kasir_user = CustomUser.objects.create_user(
            username="kasir_test",
            password="password123",
            role="kasir"
        )
        # User dengan role staff (tidak diizinkan mengubah status)
        self.staff_user = CustomUser.objects.create_user(
            username="staff_test",
            password="password123",
            role="staff"
        )
        self.client.force_authenticate(user=self.kasir_user)

        self.order_review = Order.objects.create(
            id="ORD-TST-0001",
            nomor_wa="08123456789",
            nama="Pelanggan Test 1",
            status_global="review"
        )
        self.order_proses = Order.objects.create(
            id="ORD-TST-0002",
            nomor_wa="08123456789",
            nama="Pelanggan Test 2",
            status_global="proses"
        )
        self.order_selesai = Order.objects.create(
            id="ORD-TST-0003",
            nomor_wa="08123456789",
            nama="Pelanggan Test 3",
            status_global="selesai"
        )
        self.order_batal = Order.objects.create(
            id="ORD-TST-0004",
            nomor_wa="08123456789",
            nama="Pelanggan Test 4",
            status_global="batal"
        )

    def test_selesaikan_order_success(self):
        """POST /api/orders/{id}/selesaikan/ mengubah status ke 'selesai' untuk role diizinkan (kasir)."""
        url = f"/api/orders/{self.order_proses.id}/selesaikan/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order_proses.refresh_from_db()
        self.assertEqual(self.order_proses.status_global, "selesai")

        # Verifikasi log aktivitas
        log = OrderActivityLog.objects.filter(order=self.order_proses, tindakan="COMPLETE").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user, self.kasir_user)
        self.assertIn("selesai", log.keterangan)

    def test_selesaikan_denied_for_staff(self):
        """POST /api/orders/{id}/selesaikan/ ditolak (403 Forbidden) untuk user role staff."""
        self.client.force_authenticate(user=self.staff_user)
        url = f"/api/orders/{self.order_proses.id}/selesaikan/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.order_proses.refresh_from_db()
        self.assertNotEqual(self.order_proses.status_global, "selesai")

    def test_selesaikan_order_invalid_when_already_selesai(self):
        """Menyelesaikan order yang sudah selesai ditolak (400 Bad Request)."""
        url = f"/api/orders/{self.order_selesai.id}/selesaikan/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_selesaikan_order_invalid_when_batal(self):
        """Menyelesaikan order yang dibatalkan ditolak (400 Bad Request)."""
        url = f"/api/orders/{self.order_batal.id}/selesaikan/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_batalkan_order_success(self):
        """POST /api/orders/{id}/batalkan/ mengubah status ke 'batal' dengan alasan untuk role diizinkan (kasir)."""
        url = f"/api/orders/{self.order_review.id}/batalkan/"
        payload = {"alasan": "Pelanggan berubah pikiran"}
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order_review.refresh_from_db()
        self.assertEqual(self.order_review.status_global, "batal")

        # Verifikasi log aktivitas
        log = OrderActivityLog.objects.filter(order=self.order_review, tindakan="CANCEL").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user, self.kasir_user)
        self.assertIn("Pelanggan berubah pikiran", log.keterangan)

    def test_batalkan_denied_for_staff(self):
        """POST /api/orders/{id}/batalkan/ ditolak (403 Forbidden) untuk user role staff."""
        self.client.force_authenticate(user=self.staff_user)
        url = f"/api/orders/{self.order_review.id}/batalkan/"
        payload = {"alasan": "Pelanggan batal"}
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.order_review.refresh_from_db()
        self.assertNotEqual(self.order_review.status_global, "batal")

    def test_batalkan_order_invalid_when_already_batal(self):
        """Membatalkan order yang sudah batal ditolak (400 Bad Request)."""
        url = f"/api/orders/{self.order_batal.id}/batalkan/"
        response = self.client.post(url, data={"alasan": "Lagi"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_batalkan_order_invalid_when_selesai(self):
        """Membatalkan order yang sudah selesai via endpoint ini ditolak (400 Bad Request)."""
        url = f"/api/orders/{self.order_selesai.id}/batalkan/"
        response = self.client.post(url, data={"alasan": "Retur"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_actions_unauthenticated(self):
        """User tanpa autentikasi ditolak (401 Unauthorized)."""
        self.client.logout()
        url_selesai = f"/api/orders/{self.order_review.id}/selesaikan/"
        res_selesai = self.client.post(url_selesai)
        self.assertEqual(res_selesai.status_code, status.HTTP_401_UNAUTHORIZED)

        url_batal = f"/api/orders/{self.order_review.id}/batalkan/"
        res_batal = self.client.post(url_batal)
        self.assertEqual(res_batal.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pengembalian_order_api_and_metadata(self):
        """Uji endpoint GET & PATCH /api/pengembalian/ dan metadata Order asli (T-208 & T-209)."""
        from api.models import PengembalianOrder

        # 1. Test Order Native Metadata
        self.order_selesai.email_pelanggan = "pelanggan@test.com"
        self.order_selesai.alamat_pelanggan = "Jl. Merdeka No. 10"
        self.order_selesai.save()

        order_res = self.client.get(f"/api/orders/{self.order_selesai.id}/")
        self.assertEqual(order_res.status_code, status.HTTP_200_OK)
        self.assertEqual(order_res.data["email_pelanggan"], "pelanggan@test.com")
        self.assertEqual(order_res.data["alamat_pelanggan"], "Jl. Merdeka No. 10")

        # 2. Test PengembalianOrder creation & API list/patch
        retur = PengembalianOrder.objects.create(
            order=self.order_selesai,
            status="Tunda",
            catatan="Barang cacat",
            nominal_refund=50000,
            dibuat_oleh=self.kasir_user
        )

        list_res = self.client.get("/api/pengembalian/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_res.data["results"] if "results" in list_res.data else list_res.data), 1)

        patch_res = self.client.patch(f"/api/pengembalian/{retur.id}/", {"status": "Dikonfirmasi", "catatan": "Disetujui refund"})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        retur.refresh_from_db()
        self.assertEqual(retur.status, "Dikonfirmasi")
        self.assertEqual(retur.catatan, "Disetujui refund")

        # Staff user is denied write role
        self.client.force_authenticate(user=self.staff_user)
        denied_res = self.client.patch(f"/api/pengembalian/{retur.id}/", {"status": "Batal"})
        self.assertEqual(denied_res.status_code, status.HTTP_403_FORBIDDEN)

    # ── T-210 Tahap 3: POST /orders/:id/retur/ ────────────────────────────────

    def test_retur_endpoint_creates_pengembalian_order(self):
        """POST /api/orders/{id}/retur/ membuat PengembalianOrder baru (bukan get_or_create)."""
        from api.models import PengembalianOrder

        url = f"/api/orders/{self.order_selesai.id}/retur/"
        payload = {
            "catatan": "Barang tidak sesuai spesifikasi",
            "tanggal_pengembalian": "2026-07-27",
            "nominal_refund": 75000,
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verifikasi record PengembalianOrder terbuat
        retur_qs = PengembalianOrder.objects.filter(order=self.order_selesai)
        self.assertEqual(retur_qs.count(), 1)
        retur = retur_qs.first()
        self.assertEqual(retur.catatan, "Barang tidak sesuai spesifikasi")
        self.assertEqual(retur.status, "Tunda")
        self.assertEqual(int(retur.nominal_refund), 75000)
        self.assertEqual(retur.dibuat_oleh, self.kasir_user)

        # Verifikasi activity log RETURN terbuat
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.filter(order=self.order_selesai, tindakan="RETURN").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user, self.kasir_user)
        self.assertIn("Tunda", log.keterangan)

    def test_retur_creates_multiple_per_order(self):
        """POST /api/orders/{id}/retur/ bisa dipanggil lebih dari sekali (ForeignKey bukan OneToOne)."""
        from api.models import PengembalianOrder

        url = f"/api/orders/{self.order_selesai.id}/retur/"
        self.client.post(url, data={"catatan": "Retur pertama"}, format="json")
        self.client.post(url, data={"catatan": "Retur kedua"}, format="json")

        count = PengembalianOrder.objects.filter(order=self.order_selesai).count()
        self.assertEqual(count, 2)

    def test_retur_denied_when_order_not_selesai(self):
        """POST /api/orders/{id}/retur/ ditolak (400) kalau status_global bukan 'selesai'."""
        url_proses = f"/api/orders/{self.order_proses.id}/retur/"
        res = self.client.post(url_proses, data={"catatan": "Coba retur"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", res.data)
        self.assertIn("Selesai", res.data["error"])

        url_review = f"/api/orders/{self.order_review.id}/retur/"
        res2 = self.client.post(url_review, data={"catatan": "Coba retur"}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retur_denied_for_staff(self):
        """POST /api/orders/{id}/retur/ ditolak (403 Forbidden) untuk user role staff."""
        self.client.force_authenticate(user=self.staff_user)
        url = f"/api/orders/{self.order_selesai.id}/retur/"
        response = self.client.post(url, data={"catatan": "Staff coba retur"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Pastikan tidak ada PengembalianOrder yang terbuat
        from api.models import PengembalianOrder
        self.assertEqual(PengembalianOrder.objects.filter(order=self.order_selesai).count(), 0)

    def test_retur_denied_unauthenticated(self):
        """POST /api/orders/{id}/retur/ ditolak (401) tanpa autentikasi."""
        self.client.logout()
        url = f"/api/orders/{self.order_selesai.id}/retur/"
        response = self.client.post(url, data={"catatan": "Coba retur"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


