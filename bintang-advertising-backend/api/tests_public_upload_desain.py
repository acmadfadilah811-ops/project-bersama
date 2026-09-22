"""Uji POST /api/public/submit-design/ (PublicSubmitDesignView, AllowAny --
halaman publik pelanggan unggah desain susulan). Sebelumnya endpoint ini
tidak melakukan validasi format/ukuran file sama sekali di server -- UI
klaim "PNG/JPG/JPEG/PDF, maks 10MB" tapi itu cuma label teks, gampang
dilewati siapa pun yang POST langsung ke endpoint. Ditemukan & diperbaiki
2026-09-22 (satu paket dengan perbaikan link file pelanggan yang tidak
pernah dirender di UI kerja Editor)."""
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from api.models import Order, OrderItem

URL = "/api/public/submit-design/"


class PublicSubmitDesignValidationTests(APITestCase):
    def setUp(self):
        self.order = Order.objects.create(id="ORD-UJI-DESAIN", nama="Pelanggan Uji", nomor_wa="081234567890")
        self.item = OrderItem.objects.create(order=self.order, jenis_produk="Banner", qty=1, harga_jual=100000)

    def _post(self, file_obj=None, **extra):
        data = {"order_id": "ORD-UJI-DESAIN", "nomor_wa": "081234567890", "item_id": self.item.id, **extra}
        if file_obj:
            data["file"] = file_obj
        return self.client.post(URL, data, format="multipart")

    def test_png_valid_diterima(self):
        file_obj = SimpleUploadedFile("desain.png", b"\x89PNG fake content", content_type="image/png")
        r = self._post(file_obj)
        self.assertEqual(r.status_code, 200, r.content)
        self.item.refresh_from_db()
        self.assertTrue(self.item.desain_susulan)
        self.assertIn("desain_susulan/", self.item.gdrive_customer_link)

    def test_pdf_valid_diterima(self):
        file_obj = SimpleUploadedFile("desain.pdf", b"%PDF-1.4 fake content", content_type="application/pdf")
        r = self._post(file_obj)
        self.assertEqual(r.status_code, 200, r.content)

    def test_ekstensi_tidak_didukung_ditolak_400(self):
        file_obj = SimpleUploadedFile("desain.exe", b"MZ fake exe", content_type="application/octet-stream")
        r = self._post(file_obj)
        self.assertEqual(r.status_code, 400, r.content)
        self.item.refresh_from_db()
        self.assertFalse(self.item.desain_susulan)

    def test_ekstensi_diizinkan_tapi_content_type_palsu_ditolak_400(self):
        # Ekstensi .png tapi content_type sebenarnya bukan gambar -- upaya
        # menyamarkan file berbahaya sebagai gambar lewat nama file saja.
        file_obj = SimpleUploadedFile("desain.png", b"bukan gambar sungguhan", content_type="text/html")
        r = self._post(file_obj)
        self.assertEqual(r.status_code, 400, r.content)

    def test_file_terlalu_besar_ditolak_400(self):
        konten_besar = b"a" * (10 * 1024 * 1024 + 1)  # 10MB + 1 byte
        file_obj = SimpleUploadedFile("besar.png", konten_besar, content_type="image/png")
        r = self._post(file_obj)
        self.assertEqual(r.status_code, 400, r.content)

    def test_link_drive_tanpa_file_tetap_berfungsi(self):
        r = self._post(gdrive_link="https://drive.google.com/file/d/abc123")
        self.assertEqual(r.status_code, 200, r.content)
        self.item.refresh_from_db()
        self.assertEqual(self.item.gdrive_customer_link, "https://drive.google.com/file/d/abc123")

    def test_nomor_wa_salah_ditolak_403(self):
        data = {"order_id": "ORD-UJI-DESAIN", "nomor_wa": "089999999999", "item_id": self.item.id,
                "gdrive_link": "https://drive.google.com/file/d/xyz"}
        r = self.client.post(URL, data, format="multipart")
        self.assertEqual(r.status_code, 403, r.content)
