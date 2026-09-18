"""Bridge HR -> Bintang (api/views/hr_bridge.py): pemetaan job_position ke
role Bintang, khusus regresi untuk bug 'spv finance' salah kepetakan ke
'spv' biasa (startswith('spv') menangkap keduanya kalau urutan cek salah),
dan 'admin finance' yang sebelumnya masih dipetakan ke 'kordiv' (sisa dari
sebelum role admin_finance/spv_finance sungguhan ada, 2026-09-18)."""
import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()
URL = "/api/bridge/hr-employee/"


class HrBridgeRoleMappingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.env_patch = mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": "kunci-uji"})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def _post(self, job_position, hr_employee_id):
        return self.client.post(
            URL,
            {
                "hr_employee_id": hr_employee_id, "first_name": "Budi", "last_name": "Santoso",
                "email": f"budi{hr_employee_id}@contoh.com", "job_position": job_position,
                "department": "Digital Printing",
            },
            format="json", HTTP_X_API_KEY="kunci-uji",
        )

    def test_admin_finance_dipetakan_ke_role_admin_finance(self):
        response = self._post("Admin Finance", 501)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["role"], "admin_finance")

    def test_spv_finance_dipetakan_ke_role_spv_finance_bukan_spv_biasa(self):
        """Regresi utama: 'spv finance' juga startswith('spv') -- tanpa cek
        exact-match duluan, ini akan salah kepetakan ke role 'spv'."""
        response = self._post("SPV Finance", 502)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["role"], "spv_finance")

    def test_spv_biasa_tetap_dipetakan_ke_role_spv(self):
        response = self._post("SPV Produksi", 503)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["role"], "spv")

    def test_kordiv_tetap_dipetakan_ke_role_kordiv(self):
        response = self._post("Kordiv A3", 504)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["role"], "kordiv")
