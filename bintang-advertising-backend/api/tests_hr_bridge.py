"""Uji jembatan HR (Horilla) -> Bintang: endpoint POST /api/bridge/hr-employee/
yang dipanggil server-ke-server oleh sistem HR untuk auto-provision akun
karyawan begitu HR membuat karyawan baru/approve rekrutmen."""
import os
from unittest import mock

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import CustomUser, UnitBisnis

URL = "/api/bridge/hr-employee/"


class HRBridgeAuthTests(APITestCase):
    def test_tanpa_api_key_dikonfigurasi_di_server_ditolak_500(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("HR_BRIDGE_API_KEY", None)
            response = self.client.post(
                URL, {"hr_employee_id": 1}, format="json", HTTP_X_FORWARDED_PROTO="https"
            )
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_api_key_salah_ditolak_401(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": "kunci-benar"}):
            response = self.client.post(
                URL, {"hr_employee_id": 1}, format="json", HTTP_X_API_KEY="kunci-salah",
                HTTP_X_FORWARDED_PROTO="https",
            )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tanpa_header_api_key_ditolak_401(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": "kunci-benar"}):
            response = self.client.post(
                URL, {"hr_employee_id": 1}, format="json", HTTP_X_FORWARDED_PROTO="https"
            )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class HRBridgeCreateAccountTests(APITestCase):
    def setUp(self):
        self.env_patch = mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": "kunci-uji"})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)
        UnitBisnis.objects.get_or_create(nama="StarFoto")
        UnitBisnis.objects.get_or_create(nama="Star Advertising")

    def _post(self, payload):
        # HTTP_X_FORWARDED_PROTO: production (DEBUG=False) punya
        # SECURE_SSL_REDIRECT=True, sama seperti panggilan sungguhan dari
        # HR (lihat _sinkron_ke() -- mengirim header yang sama persis),
        # jadi request test tanpa ini kena redirect 301 saat dites langsung
        # di container produksi.
        return self.client.post(
            URL, payload, format="json", HTTP_X_API_KEY="kunci-uji",
            HTTP_X_FORWARDED_PROTO="https",
        )

    def test_job_position_kordiv_a3_dipetakan_role_kordiv_dan_unit_star_advertising(self):
        response = self._post({
            "hr_employee_id": 101, "first_name": "Budi", "last_name": "Santoso",
            "email": "budi@contoh.com", "job_position": "Kordiv A3",
            "department": "Digital Printing",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn("temp_password", response.data)
        user = CustomUser.objects.get(hr_employee_id=101)
        self.assertEqual(user.role, "kordiv")
        self.assertEqual(user.unit_bisnis.nama, "Star Advertising")
        self.assertTrue(user.check_password(response.data["temp_password"]))

    def test_job_position_ceo_dipetakan_manager_bukan_owner(self):
        response = self._post({
            "hr_employee_id": 102, "first_name": "Andi", "last_name": "Wijaya",
            "job_position": "CEO", "department": "Manajemen",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = CustomUser.objects.get(hr_employee_id=102)
        self.assertEqual(user.role, "manager")

    def test_departemen_marketing_di_skip_tanpa_buat_akun(self):
        response = self._post({
            "hr_employee_id": 103, "first_name": "Sinta", "last_name": "Marketing",
            "job_position": "Tim Sales Marketing & Creative",
            "department": "Sales Marketing & Creative",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("skipped"))
        self.assertFalse(CustomUser.objects.filter(hr_employee_id=103).exists())

    def test_departemen_hr_ga_di_skip_tanpa_buat_akun(self):
        response = self._post({
            "hr_employee_id": 104, "first_name": "Rina", "last_name": "HR",
            "job_position": "HR & GA", "department": "HR & GA",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("skipped"))
        self.assertFalse(CustomUser.objects.filter(hr_employee_id=104).exists())

    def test_panggilan_kedua_hr_employee_id_sama_update_bukan_duplikat(self):
        self._post({
            "hr_employee_id": 105, "first_name": "Dedi", "last_name": "Kordiv",
            "job_position": "Kordiv Banner", "department": "Digital Printing",
        })
        response2 = self._post({
            "hr_employee_id": 105, "first_name": "Dedi", "last_name": "Kordiv",
            "job_position": "SPV Digital Printing", "department": "Digital Printing",
        })
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertFalse(response2.data.get("created"))
        self.assertNotIn("temp_password", response2.data)
        self.assertEqual(CustomUser.objects.filter(hr_employee_id=105).count(), 1)
        user = CustomUser.objects.get(hr_employee_id=105)
        self.assertEqual(user.role, "spv")

    def test_username_otomatis_tidak_bentrok_kalau_nama_sama(self):
        self._post({
            "hr_employee_id": 106, "first_name": "Budi", "last_name": "Santoso",
            "job_position": "Fotografer", "department": "Fotografi",
        })
        response2 = self._post({
            "hr_employee_id": 107, "first_name": "Budi", "last_name": "Santoso",
            "job_position": "Fotografer", "department": "Fotografi",
        })
        u1 = CustomUser.objects.get(hr_employee_id=106)
        u2 = CustomUser.objects.get(hr_employee_id=107)
        self.assertNotEqual(u1.username, u2.username)

    def test_field_wajib_hr_employee_id_kosong_ditolak_400(self):
        response = self._post({"first_name": "Tanpa", "last_name": "Id"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_atasan_terisi_lewat_hr_employee_id_reporting_manager(self):
        self._post({
            "hr_employee_id": 200, "first_name": "Boss", "last_name": "Fotografi",
            "job_position": "SPV Fotografi", "department": "Fotografi",
        })
        response = self._post({
            "hr_employee_id": 201, "first_name": "Anak", "last_name": "Buah",
            "job_position": "Fotografer", "department": "Fotografi",
            "reporting_manager_hr_employee_id": 200,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        boss = CustomUser.objects.get(hr_employee_id=200)
        anak_buah = CustomUser.objects.get(hr_employee_id=201)
        self.assertEqual(anak_buah.atasan_id, boss.id)

    def test_atasan_belum_ter_bridge_tidak_error_dan_dibiarkan_kosong(self):
        response = self._post({
            "hr_employee_id": 202, "first_name": "Yatim", "last_name": "Piatu",
            "job_position": "Fotografer", "department": "Fotografi",
            "reporting_manager_hr_employee_id": 9999,  # tidak pernah ada
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = CustomUser.objects.get(hr_employee_id=202)
        self.assertIsNone(user.atasan_id)

    def test_update_tidak_menghapus_atasan_yang_sudah_ada_kalau_gagal_resolve(self):
        self._post({
            "hr_employee_id": 210, "first_name": "Boss2", "last_name": "Digital",
            "job_position": "SPV Digital Printing", "department": "Digital Printing",
        })
        self._post({
            "hr_employee_id": 211, "first_name": "Staff2", "last_name": "Digital",
            "job_position": "Operator", "department": "Digital Printing",
            "reporting_manager_hr_employee_id": 210,
        })
        boss = CustomUser.objects.get(hr_employee_id=210)
        staff = CustomUser.objects.get(hr_employee_id=211)
        self.assertEqual(staff.atasan_id, boss.id)

        # Panggilan kedua tanpa reporting_manager_hr_employee_id (mis. HR
        # simpan ulang data lain, atasan tidak ikut dikirim) tidak boleh
        # menghapus atasan yang sudah benar tersimpan.
        response2 = self._post({
            "hr_employee_id": 211, "first_name": "Staff2", "last_name": "Digital",
            "job_position": "Operator", "department": "Digital Printing",
        })
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        staff.refresh_from_db()
        self.assertEqual(staff.atasan_id, boss.id)


class HRBridgeRoleMappingFinanceTests(APITestCase):
    """Regresi 2026-09-18: role admin_finance/spv_finance ditambahkan ke
    ROLE_CHOICES, dan _map_job_position_ke_role() masih peninggalan lama --
    'admin finance' dipetakan ke 'kordiv', 'spv finance' akan salah
    kepetakan ke 'spv' biasa (startswith('spv') menangkap keduanya kalau
    urutan cek exact-match tidak didahulukan)."""

    def setUp(self):
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
            format="json", HTTP_X_API_KEY="kunci-uji", HTTP_X_FORWARDED_PROTO="https",
        )

    def test_admin_finance_dipetakan_ke_role_admin_finance(self):
        response = self._post("Admin Finance", 501)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["role"], "admin_finance")

    def test_spv_finance_dipetakan_ke_role_spv_finance_bukan_spv_biasa(self):
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


class AbsensiStatusViewTests(APITestCase):
    """GET /api/bridge/absensi-status/ -- dipanggil HR mobile saat karyawan
    mau logout, buat cek apakah sesi kerja Bintang-nya hari ini masih
    terbuka (belum Selesai Kerja)."""
    URL = "/api/bridge/absensi-status/"

    def setUp(self):
        self.env_patch = mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": "kunci-uji"})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def _get(self, hr_employee_id):
        return self.client.get(
            self.URL, {"hr_employee_id": hr_employee_id},
            HTTP_X_API_KEY="kunci-uji", HTTP_X_FORWARDED_PROTO="https",
        )

    def test_tanpa_api_key_ditolak(self):
        response = self.client.get(self.URL, {"hr_employee_id": 1}, HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_hr_employee_id_kosong_ditolak_400(self):
        response = self.client.get(self.URL, HTTP_X_API_KEY="kunci-uji", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_karyawan_belum_ter_bridge_applicable_false(self):
        response = self._get(999999)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["applicable"])

    def test_role_kasir_applicable_false(self):
        CustomUser.objects.create_user(
            username="kasir_absensi_status", password="pw", role="kasir", hr_employee_id=601,
        )
        response = self._get(601)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["applicable"])

    def test_staff_belum_clock_in_hari_ini_no_open_session(self):
        CustomUser.objects.create_user(
            username="staff_absensi_status_1", password="pw", role="staff", hr_employee_id=602,
        )
        response = self._get(602)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["applicable"])
        self.assertFalse(response.data["has_open_session"])

    def test_staff_sudah_clock_in_belum_clock_out_has_open_session(self):
        from django.utils import timezone
        from hr.models import Absensi

        user = CustomUser.objects.create_user(
            username="staff_absensi_status_2", password="pw", role="staff", hr_employee_id=603,
        )
        Absensi.objects.create(staff=user, tanggal=timezone.localdate(), jam_masuk=timezone.now())
        response = self._get(603)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_open_session"])

    def test_staff_sudah_clock_out_no_open_session(self):
        from django.utils import timezone
        from hr.models import Absensi

        user = CustomUser.objects.create_user(
            username="staff_absensi_status_3", password="pw", role="staff", hr_employee_id=604,
        )
        Absensi.objects.create(
            staff=user, tanggal=timezone.localdate(),
            jam_masuk=timezone.now(), jam_keluar=timezone.now(),
        )
        response = self._get(604)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["has_open_session"])
