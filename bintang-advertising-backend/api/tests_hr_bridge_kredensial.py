"""Jembatan HR -> Bintang menerima username & password awal dari HR supaya
kredensial seragam dengan HR/mobile (2026-09-29)."""
import os
from unittest import mock

from rest_framework import status
from rest_framework.test import APITestCase

from api.models import CustomUser, UnitBisnis

URL = "/api/bridge/hr-employee/"


class HRBridgeKredensialSeragamTests(APITestCase):
    def setUp(self):
        env = mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": "kunci-uji"})
        env.start()
        self.addCleanup(env.stop)
        UnitBisnis.objects.get_or_create(nama="Star Advertising")

    def _post(self, **extra):
        payload = {
            "hr_employee_id": 501, "first_name": "Budi", "last_name": "Santoso",
            "email": "budi@contoh.com", "job_position": "Kordiv A3",
            "department": "Digital Printing", **extra,
        }
        return self.client.post(
            URL, payload, format="json", HTTP_X_API_KEY="kunci-uji", HTTP_X_FORWARDED_PROTO="https",
        )

    def test_username_dan_password_dari_hr_dipakai(self):
        res = self._post(username="budi.santoso", password="PasswordAwal1")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["username"], "budi.santoso")
        self.assertNotIn("temp_password", res.data)
        user = CustomUser.objects.get(hr_employee_id=501)
        self.assertTrue(user.check_password("PasswordAwal1"))

    def test_username_terpakai_dijawab_409(self):
        CustomUser.objects.create_user(username="budi.santoso", password="x12345678", role="staff")
        res = self._post(username="budi.santoso", password="PasswordAwal1")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res.data["username_terpakai"])
        self.assertFalse(CustomUser.objects.filter(hr_employee_id=501).exists())

    def test_username_format_salah_ditolak(self):
        res = self._post(username="Budi Santoso!", password="PasswordAwal1")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_terlalu_pendek_ditolak(self):
        res = self._post(username="budi.santoso", password="123")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tanpa_username_password_tetap_pakai_cara_lama(self):
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertIn("temp_password", res.data)

    def test_akun_yang_sudah_ada_tidak_diubah_passwordnya(self):
        self._post(username="budi.santoso", password="PasswordAwal1")
        res = self._post(username="budi.baru", password="PasswordLain99")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        user = CustomUser.objects.get(hr_employee_id=501)
        self.assertEqual(user.username, "budi.santoso")
        self.assertTrue(user.check_password("PasswordAwal1"))
