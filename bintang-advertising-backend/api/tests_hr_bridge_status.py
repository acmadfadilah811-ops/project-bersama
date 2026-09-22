"""Uji POST /api/bridge/hr-employee-status/ (HRBridgeSetStatusView): HR
memanggil ini saat karyawan diarsipkan/diaktifkan-kembali, supaya akun
login Bintang yang tertaut (dicari lewat hr_employee_id) ikut
nonaktif/aktif otomatis (AKS-13, celah "karyawan resign masih bisa login
ke Bintang" -- ditemukan manual oleh user 2026-09-22)."""
import os
from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase

from api.models import CustomUser

URL = "/api/bridge/hr-employee-status/"
KEY = "kunci-benar"
HEADERS = {"HTTP_X_API_KEY": KEY, "HTTP_X_FORWARDED_PROTO": "https"}


class _BersihkanThrottleMixin:
    def setUp(self):
        super().setUp()
        cache.clear()
        self.addCleanup(cache.clear)


class HRBridgeSetStatusAuthTests(_BersihkanThrottleMixin, APITestCase):
    def test_tanpa_api_key_dikonfigurasi_ditolak_500(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("HR_BRIDGE_API_KEY", None)
            r = self.client.post(URL, {"hr_employee_id": 1, "is_active": False}, format="json", **{"HTTP_X_FORWARDED_PROTO": "https"})
        self.assertEqual(r.status_code, 500)

    def test_api_key_salah_ditolak_401(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.post(URL, {"hr_employee_id": 1, "is_active": False}, format="json", HTTP_X_API_KEY="salah", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(r.status_code, 401)

    def test_tanpa_hr_employee_id_400(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.post(URL, {"is_active": False}, format="json", **HEADERS)
        self.assertEqual(r.status_code, 400)

    def test_tanpa_is_active_400(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.post(URL, {"hr_employee_id": 1}, format="json", **HEADERS)
        self.assertEqual(r.status_code, 400)


class HRBridgeSetStatusPerilakuTests(_BersihkanThrottleMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = CustomUser.objects.create_user(
            username="staff_status_bridge", password="pw12345",
            role="staff", hr_employee_id=501, is_active=True, status_karyawan="aktif",
        )

    def test_nonaktifkan_akun_lewat_hr_employee_id(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.post(URL, {"hr_employee_id": 501, "is_active": False}, format="json", **HEADERS)

        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.status_karyawan, "nonaktif")

    def test_aktifkan_kembali_akun_lewat_hr_employee_id(self):
        self.user.is_active = False
        self.user.status_karyawan = "nonaktif"
        self.user.save(update_fields=["is_active", "status_karyawan"])

        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.post(URL, {"hr_employee_id": 501, "is_active": True}, format="json", **HEADERS)

        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertEqual(self.user.status_karyawan, "aktif")

    def test_hr_employee_id_tidak_ditemukan_skip_bukan_error(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.post(URL, {"hr_employee_id": 99999, "is_active": False}, format="json", **HEADERS)

        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get("skipped"))

    def test_akun_nonaktif_tidak_bisa_login(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            self.client.post(URL, {"hr_employee_id": 501, "is_active": False}, format="json", **HEADERS)

        r = self.client.post(
            "/api/auth/login/", {"username": "staff_status_bridge", "password": "pw12345"}, format="json",
        )
        self.assertNotEqual(r.status_code, 200)
