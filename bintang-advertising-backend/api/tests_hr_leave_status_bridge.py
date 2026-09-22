"""Uji cek_status_cuti_libur() (api/services/hr_leave_status_bridge.py) --
panggilan HTTP dari Bintang KE HR (arah kebalikan dari hr_bridge.py yang
MENERIMA panggilan HR). Beda dari bridge lain di proyek ini: SENGAJA
fail-open (selalu 'boleh mulai kerja' kalau HR tidak bisa dihubungi/API
key belum dikonfigurasi) -- HR yang down tidak boleh memblokir operasional
produksi Bintang, cuma menolak kalau HR SECARA EKSPLISIT bilang cuti/libur."""
import os
from datetime import date
from unittest import mock

from django.test import TestCase

from api.services.hr_leave_status_bridge import cek_status_cuti_libur


class CekStatusCutiLiburTests(TestCase):
    def test_tanpa_hr_employee_id_aman_default(self):
        hasil = cek_status_cuti_libur(None)
        self.assertEqual(hasil, {"on_leave": False, "is_holiday": False, "reason": None})

    @mock.patch.dict(os.environ, {}, clear=True)
    def test_tanpa_api_key_dikonfigurasi_aman_default(self):
        hasil = cek_status_cuti_libur(42)
        self.assertFalse(hasil["on_leave"])
        self.assertFalse(hasil["is_holiday"])

    @mock.patch("api.services.hr_leave_status_bridge.requests.get")
    @mock.patch.dict(os.environ, {"INSIGHTS_BRIDGE_API_KEY": "kunci-uji"})
    def test_hr_gagal_dihubungi_aman_default_bukan_exception(self, mock_get):
        mock_get.side_effect = Exception("connection refused")
        hasil = cek_status_cuti_libur(42)
        self.assertFalse(hasil["on_leave"])
        self.assertFalse(hasil["is_holiday"])

    @mock.patch("api.services.hr_leave_status_bridge.requests.get")
    @mock.patch.dict(os.environ, {"INSIGHTS_BRIDGE_API_KEY": "kunci-uji"})
    def test_hr_jawab_applicable_false_aman_default(self, mock_get):
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = {"applicable": False}
        hasil = cek_status_cuti_libur(42)
        self.assertFalse(hasil["on_leave"])
        self.assertFalse(hasil["is_holiday"])

    @mock.patch("api.services.hr_leave_status_bridge.requests.get")
    @mock.patch.dict(os.environ, {"INSIGHTS_BRIDGE_API_KEY": "kunci-uji"})
    def test_hr_jawab_sedang_cuti_diteruskan(self, mock_get):
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = {
            "applicable": True, "on_leave": True, "is_holiday": False, "reason": "Sedang cuti: Tahunan (disetujui)",
        }
        hasil = cek_status_cuti_libur(42, date(2026, 9, 22))
        self.assertTrue(hasil["on_leave"])
        self.assertEqual(hasil["reason"], "Sedang cuti: Tahunan (disetujui)")

        _, kwargs = mock_get.call_args
        self.assertEqual(kwargs["params"]["hr_employee_id"], 42)
        self.assertEqual(kwargs["params"]["tanggal"], "2026-09-22")
        self.assertEqual(kwargs["headers"]["X-Api-Key"], "kunci-uji")
