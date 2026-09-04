"""Test proteksi media privat (T-lanjutan audit deployment 2026-08-31)."""
from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.files.base import ContentFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.protected_media import is_protected_path, protected_media_url
from hr.models import Kontrak
from hr.serializers import KontrakSerializer

User = get_user_model()


class FakeFileField:
    """Stand-in ringan untuk FieldFile tanpa perlu simpan file sungguhan."""

    def __init__(self, name, url=None):
        self.name = name
        self._url = url or f"/media/{name}"

    @property
    def url(self):
        return self._url

    def __bool__(self):
        return bool(self.name)


class ProtectedMediaHelperTests(TestCase):
    def test_public_path_returns_normal_url(self):
        field = FakeFileField("product_photos/kaos.jpg")
        self.assertEqual(protected_media_url(field), "/media/product_photos/kaos.jpg")

    def test_sensitive_path_returns_signed_endpoint(self):
        field = FakeFileField("kontrak/2026/rahasia.pdf")
        url = protected_media_url(field)
        self.assertTrue(url.startswith("/api/media-protected/"))
        # Path asli tidak boleh bocor apa adanya di URL yang dikirim ke klien.
        self.assertNotIn("kontrak", url)
        self.assertNotIn("rahasia.pdf", url)

    def test_empty_field_returns_none(self):
        self.assertIsNone(protected_media_url(None))
        self.assertIsNone(protected_media_url(FakeFileField("")))

    def test_is_protected_path(self):
        self.assertTrue(is_protected_path("kontrak/2026/x.pdf"))
        self.assertTrue(is_protected_path("dokumen_hr/pkwt/x.pdf"))
        self.assertTrue(is_protected_path("customer_notes/1/x.pdf"))
        self.assertTrue(is_protected_path("cash_transactions/x.pdf"))
        self.assertTrue(is_protected_path("purchase_attachments/2026/01/x.pdf"))
        self.assertFalse(is_protected_path("product_photos/x.jpg"))
        self.assertFalse(is_protected_path("avatars/x.jpg"))
        self.assertFalse(is_protected_path(""))


class ProtectedMediaViewTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser(
            username="pm_owner", email="pm_owner@example.com", password="password123", nip="NIP-PM-1"
        )

    def _make_kontrak_with_file(self):
        kontrak = Kontrak.objects.create(
            staff=self.owner,
            nomor_kontrak="PM-TEST-1",
            tipe="tetap",
            tanggal_mulai=date(2026, 1, 1),
        )
        kontrak.dokumen.save("rahasia.pdf", ContentFile(b"isi kontrak rahasia"), save=True)
        return kontrak

    def tearDown(self):
        for kontrak in Kontrak.objects.filter(nomor_kontrak__startswith="PM-TEST"):
            if kontrak.dokumen:
                kontrak.dokumen.delete(save=False)

    def test_unauthenticated_request_rejected(self):
        kontrak = self._make_kontrak_with_file()
        token = signing.dumps(kontrak.dokumen.name, salt="protected-media", compress=True)
        anon = APIClient()
        resp = anon.get(f"/api/media-protected/{token}/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_request_serves_actual_file(self):
        kontrak = self._make_kontrak_with_file()
        token = signing.dumps(kontrak.dokumen.name, salt="protected-media", compress=True)
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(f"/api/media-protected/{token}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        if settings.DEBUG:
            content = b"".join(resp.streaming_content)
            self.assertEqual(content, b"isi kontrak rahasia")
        else:
            self.assertIn("X-Accel-Redirect", resp)
            self.assertIn(kontrak.dokumen.name, resp["X-Accel-Redirect"])

    def test_invalid_token_returns_404(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get("/api/media-protected/bukan-token-valid/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_signed_path_outside_whitelist_returns_404(self):
        # Signature valid (ditandatangani sendiri), tapi path bukan salah satu
        # prefix sensitif yang diizinkan - harus ditolak juga (defense in depth).
        token = signing.dumps("product_photos/tidak-sensitif.jpg", salt="protected-media", compress=True)
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(f"/api/media-protected/{token}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_kontrak_serializer_hides_raw_public_url(self):
        kontrak = self._make_kontrak_with_file()
        data = KontrakSerializer(kontrak).data
        self.assertTrue(data["dokumen"].startswith("/api/media-protected/"))
