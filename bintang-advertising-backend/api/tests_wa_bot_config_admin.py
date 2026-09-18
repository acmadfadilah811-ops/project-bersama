"""Tes CRUD admin prompt & tools bot WA (api/services/wa_bot_config_admin.py
+ api/views/wa_bot_config.py) -- halaman Kasir > Pengaturan WA Bot
(permintaan user 2026-09-18)."""
import json

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import SystemConfig
from api.services import wa_bot_config_admin as svc
from api.services.wa_ai_tools import TOOL_SCHEMAS

User = get_user_model()


class WaBotConfigServiceTests(APITestCase):
    def test_get_prompt_kosong_default(self):
        self.assertEqual(svc.get_prompt(), '')

    def test_update_dan_get_prompt(self):
        svc.update_prompt('Kamu adalah asisten baru.')
        self.assertEqual(svc.get_prompt(), 'Kamu adalah asisten baru.')

    def test_update_prompt_kosong_ditolak(self):
        with self.assertRaises(svc.WaBotConfigError):
            svc.update_prompt('   ')

    def test_get_semua_tools_default_aktif_semua(self):
        tools = svc.get_semua_tools()
        self.assertEqual(len(tools), len(TOOL_SCHEMAS))
        self.assertTrue(all(t['aktif'] for t in tools))
        self.assertEqual(tools[0]['nama'], TOOL_SCHEMAS[0]['function']['name'])
        self.assertEqual(tools[0]['deskripsi'], tools[0]['deskripsi_default'])

    def test_update_tool_nonaktifkan(self):
        hasil = svc.update_tool('produk_terlaris', aktif=False, deskripsi=None)
        self.assertFalse(hasil['aktif'])
        tools = svc.get_semua_tools()
        entry = next(t for t in tools if t['nama'] == 'produk_terlaris')
        self.assertFalse(entry['aktif'])

    def test_update_tool_override_deskripsi(self):
        hasil = svc.update_tool('cek_faq', aktif=True, deskripsi='Deskripsi custom admin.')
        self.assertEqual(hasil['deskripsi'], 'Deskripsi custom admin.')

    def test_update_tool_nama_invalid_ditolak(self):
        with self.assertRaises(svc.WaBotConfigError):
            svc.update_tool('tool_tidak_ada', aktif=True, deskripsi=None)

    def test_get_active_tool_schemas_default_sama_dengan_tool_schemas(self):
        self.assertEqual(svc.get_active_tool_schemas(), TOOL_SCHEMAS)

    def test_get_active_tool_schemas_exclude_nonaktif(self):
        svc.update_tool('produk_terlaris', aktif=False, deskripsi=None)
        aktif = svc.get_active_tool_schemas()
        nama_aktif = {t['function']['name'] for t in aktif}
        self.assertNotIn('produk_terlaris', nama_aktif)
        self.assertEqual(len(aktif), len(TOOL_SCHEMAS) - 1)

    def test_get_active_tool_schemas_terapkan_override_deskripsi(self):
        svc.update_tool('cek_faq', aktif=True, deskripsi='Custom desc.')
        aktif = svc.get_active_tool_schemas()
        entry = next(t for t in aktif if t['function']['name'] == 'cek_faq')
        self.assertEqual(entry['function']['description'], 'Custom desc.')
        # TOOL_SCHEMAS asli TIDAK boleh ikut termutasi (deepcopy, bukan referensi).
        asli = next(t for t in TOOL_SCHEMAS if t['function']['name'] == 'cek_faq')
        self.assertNotEqual(asli['function']['description'], 'Custom desc.')


class WaBotConfigViewTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_botcfg', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_botcfg', password='secret', role='kasir')

    def test_get_prompt_kasir_forbidden(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.get('/api/wa-bot-config/prompt/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_prompt_owner_ok(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch('/api/wa-bot-config/prompt/', {'prompt': 'Prompt baru.'})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['prompt'], 'Prompt baru.')

    def test_list_tools_owner_ok(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/wa-bot-config/tools/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['tools']), len(TOOL_SCHEMAS))

    def test_patch_tool_owner_ok(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch('/api/wa-bot-config/tools/produk_terlaris/', {'aktif': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data['aktif'])

    def test_patch_tool_nama_invalid_400(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch('/api/wa-bot-config/tools/tidak_ada/', {'aktif': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
