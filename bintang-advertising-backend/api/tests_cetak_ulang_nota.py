"""UAT "Cetak ulang nota berfungsi dan ditandai sebagai salinan"
(2026-09-22): endpoint POST /api/pos/sales/{id}/tandai-cetak-ulang/ dan
/api/orders/{id}/tandai-cetak-ulang/ -- dipanggil frontend (PosHistory.jsx/
InvoiceModal.jsx) tiap kali resi/faktur dicetak ULANG, untuk jejak audit
(berapa kali & kapan terakhir). Penandaan visual "SALINAN" di kertas murni
frontend (ReceiptPrint.jsx dkk) -- tidak diuji di sini."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Order
from api.pos_models import POSSale

User = get_user_model()


class TandaiCetakUlangPosSaleTests(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_cetak_ulang', password='secret', role='kasir')
        self.sale = POSSale.objects.create(
            nomor='POS-CETAK-ULANG-001', kasir=self.kasir,
            subtotal=50000, diskon=0, pajak=0, total=50000,
            metode_bayar='Cash', dibayar=50000, kembalian=0, status='paid',
        )

    def test_tandai_cetak_ulang_menambah_hitungan_dan_waktu(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.sale.jumlah_cetak_ulang, 0)
        self.assertIsNone(self.sale.terakhir_dicetak_ulang)

        r = self.client.post(f'/api/pos/sales/{self.sale.id}/tandai-cetak-ulang/')

        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.jumlah_cetak_ulang, 1)
        self.assertIsNotNone(self.sale.terakhir_dicetak_ulang)
        self.assertEqual(r.data['jumlah_cetak_ulang'], 1)

    def test_dicetak_ulang_berkali_kali_hitungan_bertambah(self):
        self.client.force_authenticate(self.kasir)
        for _ in range(3):
            self.client.post(f'/api/pos/sales/{self.sale.id}/tandai-cetak-ulang/')
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.jumlah_cetak_ulang, 3)

    def test_tanpa_login_ditolak(self):
        r = self.client.post(f'/api/pos/sales/{self.sale.id}/tandai-cetak-ulang/')
        self.assertIn(r.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class TandaiCetakUlangOrderTests(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_cetak_ulang_order', password='secret', role='kasir')
        self.order = Order.objects.create(
            id='ORD-CETAK-ULANG-001', nama='Pelanggan Uji', nomor_wa='081234567890',
            status_global='selesai',
        )

    def test_tandai_cetak_ulang_menambah_hitungan_dan_waktu(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.order.jumlah_cetak_ulang, 0)

        r = self.client.post(f'/api/orders/{self.order.id}/tandai-cetak-ulang/')

        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.jumlah_cetak_ulang, 1)
        self.assertIsNotNone(self.order.terakhir_dicetak_ulang)

    def test_tanpa_login_ditolak(self):
        r = self.client.post(f'/api/orders/{self.order.id}/tandai-cetak-ulang/')
        self.assertIn(r.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
