"""Tes CRUD admin prompt & tools bot WA (api/services/wa_bot_config_admin.py
+ api/views/wa_bot_config.py) -- halaman Kasir > Pengaturan WA Bot
(permintaan user 2026-09-18)."""
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import SystemConfig
from api.services import wa_bot_config_admin as svc
from api.services.wa_ai_tools import TOOL_SCHEMAS

User = get_user_model()


class WaBotConfigServiceTests(APITestCase):
    def test_get_prompt_belum_diset_kembalikan_template_default(self):
        from api.wa_logic import default_system_prompt
        self.assertEqual(svc.get_prompt(), default_system_prompt())
        self.assertNotEqual(svc.get_prompt(), '')

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

    def test_get_ai_credentials_kasir_forbidden(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.get('/api/wa-bot-config/ai-credentials/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_ai_credentials_owner_ok(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/wa-bot-config/ai-credentials/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('api_key_masked', response.data)
        self.assertIn('base_url', response.data)
        self.assertIn('model', response.data)

    def test_patch_ai_credentials_hanya_field_terisi_yang_diupdate(self):
        self.client.force_authenticate(self.owner)
        r1 = self.client.patch('/api/wa-bot-config/ai-credentials/', {
            'api_key': 'sk-rahasia123456', 'model': 'gpt-4o-mini',
        }, format='json')
        self.assertEqual(r1.status_code, status.HTTP_200_OK, r1.data)
        self.assertEqual(r1.data['api_key_sumber'], 'database')
        self.assertTrue(r1.data['api_key_masked'].endswith('3456'))
        self.assertEqual(r1.data['model'], 'gpt-4o-mini')

        # PATCH kedua tanpa api_key -- key lama TIDAK boleh hilang/tertimpa kosong.
        r2 = self.client.patch('/api/wa-bot-config/ai-credentials/', {
            'base_url': 'https://api.contoh.com/v1',
        }, format='json')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertTrue(r2.data['api_key_masked'].endswith('3456'))
        self.assertEqual(r2.data['base_url'], 'https://api.contoh.com/v1')


class WaBotAiTestConnectionViewTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_aitest', password='secret', role='owner')

    def test_tanpa_api_key_gagal_dgn_baik(self):
        self.client.force_authenticate(self.owner)
        with patch.dict('os.environ', {'KOBOI_API_KEY': ''}, clear=False):
            response = self.client.post('/api/wa-bot-config/ai-credentials/test/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['ok'])

    def test_koneksi_sukses_dgn_mock(self):
        self.client.force_authenticate(self.owner)
        with patch('openai.OpenAI') as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = object()
            response = self.client.post('/api/wa-bot-config/ai-credentials/test/', {
                'api_key': 'sk-test123', 'base_url': 'https://api.contoh.com/v1', 'model': 'gpt-4o-mini',
            }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'], response.data)

    def test_koneksi_gagal_dgn_mock(self):
        self.client.force_authenticate(self.owner)
        with patch('openai.OpenAI') as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.side_effect = Exception('Unauthorized')
            response = self.client.post('/api/wa-bot-config/ai-credentials/test/', {
                'api_key': 'sk-salah', 'base_url': 'https://api.contoh.com/v1', 'model': 'gpt-4o-mini',
            }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['ok'])
        self.assertIn('Unauthorized', response.data['detail'])
