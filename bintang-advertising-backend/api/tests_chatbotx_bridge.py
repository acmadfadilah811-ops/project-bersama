"""Uji jembatan ChatbotX -> Bintang: endpoint POST /api/bridge/chatbotx-tool/
dan GET /api/bridge/chatbotx-tool-schemas/ yang membungkus 9 tool AI WA bot
di services/wa_ai_tools.py (lihat api/views/chatbotx_bridge.py)."""
import os
from unittest import mock

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from api.services.wa_ai_tools import TOOL_SCHEMAS

URL_TOOL = "/api/bridge/chatbotx-tool/"
URL_SCHEMAS = "/api/bridge/chatbotx-tool-schemas/"


class ChatbotXBridgeAuthTests(APITestCase):
    def test_tanpa_api_key_dikonfigurasi_di_server_ditolak_500(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CHATBOTX_BRIDGE_API_KEY", None)
            response = self.client.post(
                URL_TOOL, {"tool": "cek_faq"}, format="json", HTTP_X_FORWARDED_PROTO="https"
            )
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_api_key_salah_ditolak_401(self):
        with mock.patch.dict(os.environ, {"CHATBOTX_BRIDGE_API_KEY": "kunci-benar"}):
            response = self.client.post(
                URL_TOOL, {"tool": "cek_faq"}, format="json", HTTP_X_API_KEY="kunci-salah",
                HTTP_X_FORWARDED_PROTO="https",
            )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tanpa_header_api_key_ditolak_401(self):
        with mock.patch.dict(os.environ, {"CHATBOTX_BRIDGE_API_KEY": "kunci-benar"}):
            response = self.client.post(
                URL_TOOL, {"tool": "cek_faq"}, format="json", HTTP_X_FORWARDED_PROTO="https"
            )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_schemas_endpoint_juga_digerbang_api_key(self):
        response = self.client.get(URL_SCHEMAS, HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatbotXToolCallTests(APITestCase):
    def setUp(self):
        self.env_patch = mock.patch.dict(os.environ, {"CHATBOTX_BRIDGE_API_KEY": "kunci-uji"})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def _post(self, payload):
        return self.client.post(
            URL_TOOL, payload, format="json", HTTP_X_API_KEY="kunci-uji",
            HTTP_X_FORWARDED_PROTO="https",
        )

    def test_tool_tidak_dikenal_ditolak_400(self):
        response = self._post({"tool": "tool_yang_tidak_ada"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])

    def test_tool_internal_only_tidak_boleh_dipanggil_lewat_bridge(self):
        """cari_produk/hitung_harga_produk ADA di TOOL_FUNCTIONS (dipakai
        jalur internal lain) tapi SENGAJA tidak di TOOL_SCHEMAS -- bridge
        harus menolaknya juga, bukan cuma percaya nama fungsi yang valid."""
        response = self._post({"tool": "cari_produk", "arguments": {"kata_kunci": "banner"}})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])

    def test_arguments_bukan_object_ditolak_400(self):
        response = self._post({"tool": "cek_faq", "arguments": "bukan-object"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_context_bukan_object_ditolak_400(self):
        response = self._post({"tool": "cek_faq", "context": "bukan-object"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_daftar_kategori_produk_tanpa_seed_data_gagal_dgn_baik(self):
        """Tanpa SystemConfig 'wa_pricelist_kategori' ter-seed, tool ini
        HARUS balas {'ok': False, ...} yang jelas -- bukan crash 500 --
        supaya ChatbotX bisa menampilkan pesan yang masuk akal, bukan error
        generik. Status 422 (bukan 200): flow ChatbotX membedakan jalur
        success/error dari callApi lewat status HTTP, lihat docstring
        ChatbotXToolCallView.post."""
        response = self._post({"tool": "daftar_kategori_produk", "arguments": {}})
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertFalse(response.data["ok"])

    def test_produk_terlaris_tanpa_data_riwayat_balas_ok_list_kosong(self):
        response = self._post({"tool": "produk_terlaris", "arguments": {}})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["ok"])
        self.assertEqual(response.data["produk_terlaris"], [])

    def test_cek_status_pesanan_tanpa_order_tersimpan_balas_422(self):
        response = self._post({
            "tool": "cek_status_pesanan",
            "arguments": {},
            "context": {"nomor": "6281234567890"},
        })
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertFalse(response.data["ok"])

    def test_context_menang_atas_argumen_ai_utk_nomor_pengirim(self):
        """Defense-in-depth: kalau AI (client) somehow menyertakan key
        'nomor' di 'arguments' (mis. lewat prompt injection pelanggan),
        context server yang HARUS dipakai jalankan_tool(), bukan yang dari
        arguments -- endpoint ini cuma meneruskan, tapi harus tetap
        meneruskan context TERAKHIR/menang, konsisten dgn kontrak
        jalankan_tool()."""
        response = self._post({
            "tool": "cek_status_pesanan",
            "arguments": {"nomor": "6289999999999-dari-ai"},
            "context": {"nomor": "6281111111111-asli"},
        })
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        # Tidak ada order utk kedua nomor -- baik context maupun arguments
        # -- assert utamanya adalah endpoint TIDAK crash & tetap balas
        # kontrak ok:false yang konsisten (bukti argumen konflik tidak
        # membuat endpoint bingung/500).
        self.assertFalse(response.data["ok"])

    def test_arguments_sebagai_json_string_diurai_otomatis(self):
        """AIFunction.dataCollect di ChatbotX cuma bisa mengumpulkan atribut
        string datar -- utk tool yang butuh struktur nested (mis.
        buat_pesanan.items, array of object), AI dituntun mengumpulkan JSON
        terenkode sebagai SATU field string. Bridge harus mengurainya."""
        response = self._post({
            "tool": "cek_faq",
            "arguments": '{"pertanyaan": "apakah bisa COD?"}',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["ok"])

    def test_arguments_json_string_kosong_dianggap_tanpa_argumen(self):
        response = self._post({"tool": "produk_terlaris", "arguments": "  "})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["ok"])

    def test_arguments_json_string_tidak_valid_ditolak_400(self):
        response = self._post({"tool": "cek_faq", "arguments": "bukan json {{{"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])

    def test_ringkasan_selalu_ada_di_respons_sukses_maupun_gagal(self):
        """Flow ChatbotX (lihat apps/worker seed-wa-bot-tools.ts) memakai
        SATU placeholder {{ringkasan}} yang sama di semua 9 tool -- field
        ini wajib selalu ada & berupa teks non-kosong, sukses maupun gagal,
        supaya tidak pernah ada balasan kosong ke pelanggan."""
        gagal = self._post({"tool": "cek_status_pesanan", "arguments": {}, "context": {"nomor": "0812"}})
        self.assertIn("ringkasan", gagal.data)
        self.assertTrue(gagal.data["ringkasan"])

        sukses = self._post({"tool": "produk_terlaris", "arguments": {}})
        self.assertIn("ringkasan", sukses.data)
        self.assertTrue(sukses.data["ringkasan"])

    def test_ringkasan_dict_bersarang_tidak_crash(self):
        """daftar_kategori_produk balas struktur dict/list nested (mode
        browse: kategori_tersedia; mode detail: dict pricelist bebas
        bentuknya) -- _ringkas_nilai harus tetap jalan tanpa exception utk
        keduanya."""
        response = self._post({"tool": "daftar_kategori_produk", "arguments": {}})
        self.assertIn("ringkasan", response.data)


class ChatbotXToolSchemasTests(APITestCase):
    def setUp(self):
        self.env_patch = mock.patch.dict(os.environ, {"CHATBOTX_BRIDGE_API_KEY": "kunci-uji"})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def test_mengembalikan_tool_schemas_apa_adanya(self):
        response = self.client.get(
            URL_SCHEMAS, HTTP_X_API_KEY="kunci-uji", HTTP_X_FORWARDED_PROTO="https",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tools"], TOOL_SCHEMAS)
        nama_tool = {t["function"]["name"] for t in response.data["tools"]}
        self.assertEqual(
            nama_tool,
            {
                "daftar_kategori_produk", "hitung_harga_pricelist", "cek_status_pesanan",
                "produk_terlaris", "produk_sesuai_budget", "cek_faq",
                "ambil_template_form_order", "buat_pesanan", "eskalasi_admin",
            },
        )
