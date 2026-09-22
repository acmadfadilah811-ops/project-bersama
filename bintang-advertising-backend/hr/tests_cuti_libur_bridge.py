""""Mulai Kerja" (ClockInView) ditolak kalau menurut HR staff sedang cuti
disetujui atau hari ini hari libur -- HR tetap satu-satunya sumber
kebenaran utk jam kerja/shift/hari libur/kebijakan cuti, Bintang cuma
sesi kerja harian sederhana (keputusan user 2026-09-22). cek_status_cuti_libur()
sendiri (panggilan HTTP ke HR) diuji terpisah di
api/tests_hr_leave_status_bridge.py -- di sini cukup dipastikan ClockInView
MEMANGGIL & MENEGAKKAN hasilnya, jadi di-mock, bukan panggilan sungguhan."""
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Divisi
from hr.models import Absensi, DailyAttendanceSession

User = get_user_model()


class ClockInCutiLiburBridgeTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama="Operator Cuti Uji")
        self.staff = User.objects.create_user(
            username="staff_cuti_uji", password="password123", role="staff",
            divisi=self.divisi, hr_employee_id=77,
        )
        now = timezone.now()
        DailyAttendanceSession.objects.create(
            tanggal=timezone.localdate(),
            waktu_mulai=now - timedelta(hours=1),
            batas_maksimal=now + timedelta(hours=7),  # jauh di depan -- bukan skenario terlambat
            is_active=True,
        )
        self.client.force_authenticate(self.staff)

    @mock.patch("hr.views.cek_status_cuti_libur")
    def test_ditolak_kalau_sedang_cuti(self, mock_cek):
        mock_cek.return_value = {"on_leave": True, "is_holiday": False, "reason": "Sedang cuti: Cuti Tahunan (disetujui)"}
        r = self.client.post("/api/hr/absensi/clock-in/", {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.content)
        self.assertIn("Cuti Tahunan", r.data["detail"])
        self.assertFalse(Absensi.objects.filter(staff=self.staff).exists())

    @mock.patch("hr.views.cek_status_cuti_libur")
    def test_ditolak_kalau_hari_libur(self, mock_cek):
        mock_cek.return_value = {"on_leave": False, "is_holiday": True, "reason": "Hari libur: Hari Kemerdekaan"}
        r = self.client.post("/api/hr/absensi/clock-in/", {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.content)
        self.assertIn("Hari Kemerdekaan", r.data["detail"])

    @mock.patch("hr.views.cek_status_cuti_libur")
    def test_diizinkan_kalau_hari_biasa(self, mock_cek):
        mock_cek.return_value = {"on_leave": False, "is_holiday": False, "reason": None}
        r = self.client.post("/api/hr/absensi/clock-in/", {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.content)
        mock_cek.assert_called_once()
        called_hr_employee_id = mock_cek.call_args[0][0]
        self.assertEqual(called_hr_employee_id, 77)

    @mock.patch("hr.views.cek_status_cuti_libur")
    def test_tanpa_hr_employee_id_tidak_memanggil_bridge(self, mock_cek):
        self.staff.hr_employee_id = None
        self.staff.save(update_fields=["hr_employee_id"])
        r = self.client.post("/api/hr/absensi/clock-in/", {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.content)
        mock_cek.assert_not_called()
