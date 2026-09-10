"""Test api/views/external_bot.py -- API untuk agent/bot EKSTERNAL (n8n, dsb,
2026-09-10). Fokus: fail-closed tanpa API key, tool dispatch konsisten
dengan wa_ai_tools, dan validasi Bahan/Finishing wajib tetap berlaku
walau order datang dari luar (bukan cuma jalur form WA)."""
import os
from unittest.mock import patch

from django.test import TestCase, override_settings

from api.models import Order
from api.product_models import Product


@override_settings(ALLOWED_HOSTS=['testserver'])
class ExternalBotAuthTest(TestCase):
    def test_tool_tanpa_api_key_terkonfigurasi_ditolak_500(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('EXTERNAL_BOT_API_KEY', None)
            response = self.client.post(
                '/api/external-bot/tool/', {'tool': 'cari_produk', 'args': {}},
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 500)

    def test_tool_dengan_api_key_salah_ditolak_401(self):
        with patch.dict(os.environ, {'EXTERNAL_BOT_API_KEY': 'rahasia123'}):
            response = self.client.post(
                '/api/external-bot/tool/', {'tool': 'cari_produk', 'args': {}},
                content_type='application/json', HTTP_X_API_KEY='salah',
            )
        self.assertEqual(response.status_code, 401)

    def test_buat_order_tanpa_api_key_header_ditolak_401(self):
        with patch.dict(os.environ, {'EXTERNAL_BOT_API_KEY': 'rahasia123'}):
            response = self.client.post(
                '/api/external-bot/buat-order/', {'nomor_wa': '628111', 'items': []},
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 401)


@override_settings(ALLOWED_HOSTS=['testserver'])
class ExternalBotToolTest(TestCase):
    def setUp(self):
        self.env_patch = patch.dict(os.environ, {'EXTERNAL_BOT_API_KEY': 'rahasia123'})
        self.env_patch.start()
        Product.objects.create(
            nama='Banner Uji Eksternal', price_type='flat', harga_jual_toko=50000, is_active=True,
        )

    def tearDown(self):
        self.env_patch.stop()

    def _post(self, path, body):
        return self.client.post(path, body, content_type='application/json', HTTP_X_API_KEY='rahasia123')

    def test_tool_cari_produk_hasilnya_sama_dgn_wa_ai_tools(self):
        from api.services.wa_ai_tools import cari_produk
        expected = cari_produk('Banner Uji Eksternal')

        response = self._post('/api/external-bot/tool/', {'tool': 'cari_produk', 'args': {'kata_kunci': 'Banner Uji Eksternal'}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected)

    def test_tool_tidak_dikenal_dibalas_ok_false_bukan_500(self):
        response = self._post('/api/external-bot/tool/', {'tool': 'tool_ngawur', 'args': {}})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json().get('ok'))

    def test_tool_tanpa_nama_tool_400(self):
        response = self._post('/api/external-bot/tool/', {'args': {}})
        self.assertEqual(response.status_code, 400)


@override_settings(ALLOWED_HOSTS=['testserver'])
class ExternalBotBuatOrderTest(TestCase):
    def setUp(self):
        self.env_patch = patch.dict(os.environ, {'EXTERNAL_BOT_API_KEY': 'rahasia123'})
        self.env_patch.start()

    def tearDown(self):
        self.env_patch.stop()

    def _post(self, body):
        return self.client.post(
            '/api/external-bot/buat-order/', body, content_type='application/json', HTTP_X_API_KEY='rahasia123',
        )

    def test_buat_order_lengkap_tersimpan_sumber_agent(self):
        Product.objects.create(
            nama='Banner Order Eksternal', price_type='flat', harga_jual_toko=50000,
            is_active=True, butuh_bahan=False, butuh_finishing=False,
        )
        response = self._post({
            'nomor_wa': '628222333444',
            'nama_kontak': 'Rian',
            'items': [
                {'jenis_produk': 'Banner Order Eksternal', 'qty': 2, 'ukuran': '2x3'},
            ],
        })
        self.assertEqual(response.status_code, 201, response.content)
        order_id = response.json()['order_id']
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.sumber, 'agent')
        self.assertEqual(order.status_global, 'draft')
        self.assertEqual(order.items.first().harga_jual, 0)

    def test_buat_order_produk_butuh_bahan_finishing_kosong_ditolak(self):
        Product.objects.create(
            nama='Banner Wajib Bahan', price_type='flat', harga_jual_toko=50000,
            is_active=True, butuh_bahan=True, butuh_finishing=True,
        )
        response = self._post({
            'nomor_wa': '628222333555',
            'nama_kontak': 'Wati',
            'items': [{'jenis_produk': 'Banner Wajib Bahan', 'qty': 1}],
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.filter(nomor_wa='628222333555').exists())

    def test_buat_order_items_kosong_400(self):
        response = self._post({'nomor_wa': '628222333666', 'items': []})
        self.assertEqual(response.status_code, 400)

    def test_buat_order_qty_bukan_angka_positif_400(self):
        response = self._post({
            'nomor_wa': '628222333777',
            'items': [{'jenis_produk': 'Apa saja', 'qty': 0}],
        })
        self.assertEqual(response.status_code, 400)
