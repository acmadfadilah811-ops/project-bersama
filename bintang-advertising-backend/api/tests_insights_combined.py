"""Dashboard Insight Owner -- gabungan Bintang+HR+CRM.

Fokus: (1) cuma owner/manager/admin yang boleh akses, sama seperti
dashboard eksekutif; (2) satu sistem (HR/CRM) yang gagal/timeout TIDAK
BOLEH menjatuhkan seluruh response -- absen lebih baik daripada error
500 total, prinsip sama seperti executive_dashboard.py.
"""

from unittest import mock

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

URL = "/api/insights/combined/"


class CombinedInsightsPermissionTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(
            username="insight_owner", password="x", role="owner"
        )
        self.kasir = User.objects.create_user(
            username="insight_kasir", password="x", role="kasir"
        )

    @mock.patch("api.services.insights_bridge.build_combined_insights")
    def test_owner_bisa_akses(self, mock_build):
        mock_build.return_value = {"bintang": {}, "hr": {}, "crm": {}}
        self.client.force_authenticate(self.owner)
        response = self.client.get(URL, secure=True)
        self.assertEqual(response.status_code, 200)

    def test_kasir_ditolak(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.get(URL, secure=True)
        self.assertEqual(response.status_code, 403)

    def test_tanpa_login_ditolak(self):
        response = self.client.get(URL, secure=True)
        self.assertEqual(response.status_code, 401)


class InsightsBridgeServiceTests(APITestCase):
    """Uji langsung modul service (bukan lewat view) -- fokus ke perilaku
    gagal-sebagian yang tidak boleh menjatuhkan semuanya."""

    @mock.patch.dict("os.environ", {}, clear=True)
    def test_tanpa_api_key_kembalikan_none_bukan_error(self):
        from api.services.insights_bridge import get_hr_headcount

        self.assertIsNone(get_hr_headcount())

    @mock.patch.dict("os.environ", {"INSIGHTS_BRIDGE_API_KEY": "kunci-uji"})
    @mock.patch("api.services.insights_bridge.requests.get")
    def test_hr_down_tidak_menjatuhkan_crm(self, mock_get):
        from api.services.insights_bridge import get_crm_leads, get_hr_headcount

        def _side_effect(url, **kwargs):
            if "hr" in url:
                raise ConnectionError("HR down")
            mock_response = mock.Mock()
            mock_response.json.return_value = {"months": []}
            mock_response.raise_for_status.return_value = None
            return mock_response

        mock_get.side_effect = _side_effect
        self.assertIsNone(get_hr_headcount())
        self.assertEqual(get_crm_leads(), {"months": []})

    @mock.patch.dict("os.environ", {"INSIGHTS_BRIDGE_API_KEY": "kunci-uji"})
    @mock.patch("api.services.insights_bridge.get_hr_okr")
    @mock.patch("api.services.insights_bridge.get_hr_projects")
    @mock.patch("api.services.insights_bridge.get_crm_campaigns")
    @mock.patch("api.services.insights_bridge.get_crm_pipeline")
    @mock.patch("api.services.insights_bridge.get_crm_leads")
    @mock.patch("api.services.insights_bridge.get_hr_turnover")
    @mock.patch("api.services.insights_bridge.get_hr_overtime_trend")
    @mock.patch("api.services.insights_bridge.get_hr_leave_trend")
    @mock.patch("api.services.insights_bridge.get_hr_attendance")
    @mock.patch("api.services.insights_bridge.get_hr_headcount")
    @mock.patch("api.executive_dashboard.build")
    def test_build_combined_insights_shape(
        self,
        mock_bintang,
        mock_headcount,
        mock_attendance,
        mock_leave,
        mock_overtime,
        mock_turnover,
        mock_leads,
        mock_pipeline,
        mock_campaigns,
        mock_projects,
        mock_okr,
    ):
        from api.services.insights_bridge import build_combined_insights

        mock_bintang.return_value = {"kpi": []}
        mock_headcount.return_value = {"departments": []}
        mock_attendance.return_value = None
        mock_leave.return_value = None
        mock_overtime.return_value = None
        mock_turnover.return_value = None
        mock_leads.return_value = {"months": []}
        mock_pipeline.return_value = None
        mock_campaigns.return_value = None
        mock_projects.return_value = {"ringkasan": {"total_project": 2}}
        mock_okr.return_value = None

        result = build_combined_insights("ytd")
        self.assertEqual(result["bintang"], {"kpi": []})
        self.assertEqual(result["hr"]["headcount"], {"departments": []})
        self.assertIsNone(result["hr"]["attendance"])
        self.assertEqual(result["crm"]["leads"], {"months": []})
        self.assertIsNone(result["crm"]["pipeline"])
        # Project & OKR ikut ke snapshot (bahan AI); yang gagal jadi None, bukan
        # menjatuhkan seluruh dashboard.
        self.assertEqual(result["hr"]["projects"], {"ringkasan": {"total_project": 2}})
        self.assertIsNone(result["hr"]["okr"])
