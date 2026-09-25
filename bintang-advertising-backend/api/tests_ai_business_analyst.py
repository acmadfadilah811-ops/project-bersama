"""AI Business Analyst.

Fokus: klasifikasi ABC/margin/stok lambat benar-benar dihitung dari data
POSSaleItem/ProductStockMovement/Product nyata, dan hanya owner/manager yang
boleh mengakses (sama seperti Dashboard Eksekutif).
"""

from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .pos_models import POSSale, POSSaleItem
from .product_models import Product, ProductCategory, ProductStockMovement

URL = '/api/ai-business-analyst/'
URL_CHAT = '/api/ai-business-analyst/chat/'


class AiBusinessAnalystTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir', password='x', role='kasir')

        self.kat_a = ProductCategory.objects.create(nama='Kategori Besar')
        self.kat_b = ProductCategory.objects.create(nama='Kategori Kecil')

        self.produk_a = Product.objects.create(
            nama='Produk Laris', kategori=self.kat_a,
            harga_beli=Decimal('40000'), harga_jual_toko=Decimal('100000'),
            qty_stok=Decimal('10'), lacak_inventori=True, stok_minimum=Decimal('2'),
        )
        self.produk_b = Product.objects.create(
            nama='Produk Sepi', kategori=self.kat_b,
            harga_beli=Decimal('5000'), harga_jual_toko=Decimal('10000'),
            qty_stok=Decimal('50'), lacak_inventori=True, stok_minimum=Decimal('2'),
        )

    def _jual(self, produk, total, hpp, hari_lalu=0):
        waktu = timezone.now() - timedelta(days=hari_lalu)
        sale = POSSale.objects.create(nomor=f'POS-{produk.id}-{total}-{hari_lalu}', total=Decimal(total), status='paid')
        POSSale.objects.filter(pk=sale.pk).update(created_at=waktu)
        POSSaleItem.objects.create(
            sale=sale, product=produk, nama_snapshot=produk.nama,
            harga_snapshot=Decimal(total), qty=Decimal('1'), subtotal=Decimal(total),
        )
        mov = ProductStockMovement.objects.create(
            product=produk, tipe='penjualan', qty=Decimal('1'),
            hpp_total=Decimal(hpp), stok_awal=Decimal('10'), stok_akhir=Decimal('9'),
        )
        ProductStockMovement.objects.filter(pk=mov.pk).update(created_at=waktu)
        return sale

    def test_kasir_tidak_boleh_melihat(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_periode_tidak_dikenal_ditolak_400(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(URL, {'period': 'sepanjang-masa'})
        self.assertEqual(res.status_code, 400)

    def test_abc_kategori_dan_margin_terhitung_benar(self):
        # Kategori Besar: 900.000 (90%) -> kelas A. Kategori Kecil: 100.000 (10%) -> kelas B/C.
        self._jual(self.produk_a, '900000', '360000')
        self._jual(self.produk_b, '100000', '50000')
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'period': 'ytd'}).json()

        modul = data['modul']['penjualan_produk']
        self.assertTrue(modul['tersedia'])
        abc = {r['kategori']: r for r in data['modul']['penjualan_produk']['abc_kategori']}
        self.assertEqual(abc['Kategori Besar']['kelas'], 'A')
        self.assertEqual(abc['Kategori Besar']['persen'], 90.0)

        margin = {r['kategori']: r for r in data['modul']['profitabilitas']['margin_kategori']}
        self.assertEqual(margin['Kategori Besar']['margin'], 540000.0)
        self.assertEqual(margin['Kategori Kecil']['margin'], 50000.0)

    def test_stok_lambat_terdeteksi_dari_tanggal_penjualan_terakhir(self):
        # Produk Sepi tidak pernah terjual sama sekali -> harus masuk stok lambat.
        # Produk Laris terjual hari ini -> tidak masuk stok lambat.
        self._jual(self.produk_a, '100000', '40000', hari_lalu=0)
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'period': 'ytd'}).json()

        stok = {r['kategori']: r for r in data['modul']['stok']['kategori']}
        self.assertEqual(stok['Kategori Kecil']['jumlah_stok_lambat'], 1)
        self.assertEqual(stok['Kategori Besar']['jumlah_stok_lambat'], 0)

    def test_modul_belum_dibangun_ditandai_jujur(self):
        self.client.force_authenticate(self.owner)
        data = self.client.get(URL, {'period': 'ytd'}).json()
        for kunci in ('pelanggan', 'keuangan', 'produksi', 'anomali', 'resep_bom', 'varian', 'tingkatan_harga'):
            self.assertFalse(data['modul'][kunci]['tersedia'])
            self.assertTrue(data['modul'][kunci]['alasan'])


def _respons_ai_palsu(teks='Jawaban AI palsu.'):
    """Bikin objek mirip response openai.chat.completions.create()."""
    choice = mock.Mock()
    choice.message.content = teks
    respons = mock.Mock()
    respons.choices = [choice]
    return respons


class AiBusinessAnalystChatTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner-chat', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir-chat', password='x', role='kasir')

    def test_anonim_ditolak_401(self):
        self.assertEqual(self.client.post(URL_CHAT, {'messages': []}, format='json').status_code, 401)

    def test_kasir_tidak_boleh_chat(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.post(URL_CHAT, {'messages': [{'role': 'user', 'content': 'halo'}]}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_messages_kosong_ditolak_400(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(URL_CHAT, {'messages': []}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_pesan_terakhir_harus_dari_user_400(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            URL_CHAT,
            {'messages': [{'role': 'assistant', 'content': 'halo'}]},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_role_tidak_dikenal_ditolak_400(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            URL_CHAT,
            {'messages': [{'role': 'system', 'content': 'halo'}]},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_ai_belum_dikonfigurasi_503(self, mock_get_client):
        mock_get_client.return_value = None
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            URL_CHAT,
            {'messages': [{'role': 'user', 'content': 'Gimana penjualan bulan ini?'}]},
            format='json',
        )
        self.assertEqual(res.status_code, 503)

    @mock.patch('api.ai_business_analyst_views.build_combined_insights')
    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_jawaban_ai_sukses_dan_konteks_data_disertakan(self, mock_get_client, mock_build_insights):
        mock_build_insights.return_value = {
            'bintang': {'pendapatan': 1000000},
            'hr': None,
            'crm': None,
        }
        client_palsu = mock.Mock()
        client_palsu.chat.completions.create.return_value = _respons_ai_palsu('Penjualan naik 10%.')
        mock_get_client.return_value = client_palsu

        self.client.force_authenticate(self.owner)
        res = self.client.post(
            URL_CHAT,
            {'messages': [{'role': 'user', 'content': 'Gimana penjualan bulan ini?'}]},
            format='json',
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['reply'], 'Penjualan naik 10%.')

        # Konteks data snapshot harus masuk ke system prompt, bukan cuma dibuang.
        kwargs = client_palsu.chat.completions.create.call_args.kwargs
        system_msg = kwargs['messages'][0]
        self.assertEqual(system_msg['role'], 'system')
        self.assertIn('1000000', system_msg['content'])
        self.assertEqual(kwargs['messages'][-1], {'role': 'user', 'content': 'Gimana penjualan bulan ini?'})
        # Tanpa batas token (model reasoning bisa habis token utk berpikir -> jawaban kosong).
        self.assertNotIn('max_tokens', kwargs)
        # Prompt minta jawaban to the point.
        self.assertIn('TO THE POINT', system_msg['content'])

    @mock.patch('api.ai_business_analyst_views.build_combined_insights')
    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_timeout_tidak_di_retry(self, mock_get_client, mock_build_insights):
        from openai import APITimeoutError
        import httpx

        mock_build_insights.return_value = {'bintang': {}, 'hr': None, 'crm': None}
        client_palsu = mock.Mock()
        client_palsu.chat.completions.create.side_effect = APITimeoutError(
            request=httpx.Request('POST', 'https://x.test')
        )
        mock_get_client.return_value = client_palsu

        self.client.force_authenticate(self.owner)
        res = self.client.post(
            URL_CHAT, {'messages': [{'role': 'user', 'content': 'halo'}]}, format='json',
        )
        self.assertEqual(res.status_code, 502)
        self.assertEqual(client_palsu.chat.completions.create.call_count, 1)

    @mock.patch('api.ai_business_analyst_views.build_combined_insights')
    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_ai_gagal_total_balas_502(self, mock_get_client, mock_build_insights):
        mock_build_insights.return_value = {'bintang': {}, 'hr': None, 'crm': None}
        client_palsu = mock.Mock()
        client_palsu.chat.completions.create.side_effect = RuntimeError('koneksi putus')
        mock_get_client.return_value = client_palsu

        self.client.force_authenticate(self.owner)
        with mock.patch('api.ai_business_analyst_views.time.sleep'):
            res = self.client.post(
                URL_CHAT,
                {'messages': [{'role': 'user', 'content': 'halo'}]},
                format='json',
            )
        self.assertEqual(res.status_code, 502)



class AiBusinessAnalystPromptTest(AiBusinessAnalystChatTest):
    """Prompt analis bisnis (2026-09-25): konteks memuat analisis bisnis
    (ABC/margin/stok), tanggal & periode, dan aturan kehati-hatian."""

    def _kirim(self, mock_get_client, mock_build_insights):
        mock_build_insights.return_value = {'bintang': {'pendapatan': 1000000}, 'hr': None, 'crm': None}
        client_palsu = mock.Mock()
        client_palsu.chat.completions.create.return_value = _respons_ai_palsu('ok')
        mock_get_client.return_value = client_palsu
        self.client.force_authenticate(self.owner)
        res = self.client.post(URL_CHAT, {'messages': [{'role': 'user', 'content': 'Kategori mana yang paling untung?'}]}, format='json')
        self.assertEqual(res.status_code, 200)
        return client_palsu.chat.completions.create.call_args.kwargs['messages'][0]['content']

    @mock.patch('api.ai_business_analyst_views.build_combined_insights')
    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_konteks_memuat_analisis_bisnis_dan_periode(self, mock_get_client, mock_build_insights):
        prompt = self._kirim(mock_get_client, mock_build_insights)
        self.assertIn('"analisis_bisnis"', prompt)
        self.assertIn('abc_kategori', prompt)
        self.assertIn('margin_kategori', prompt)
        self.assertIn('Hari ini:', prompt)
        self.assertIn('sejak awal tahun', prompt)

    @mock.patch('api.ai_business_analyst_views.build_combined_insights')
    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_prompt_memuat_aturan_bijak(self, mock_get_client, mock_build_insights):
        prompt = self._kirim(mock_get_client, mock_build_insights)
        for frasa in ('FAKTA', 'DUGAAN', 'KORELASI', 'maksimal 3', 'TO THE POINT', 'bukan nol'):
            self.assertIn(frasa, prompt)

    @mock.patch('api.ai_business_analyst.build', side_effect=RuntimeError('rusak'))
    @mock.patch('api.ai_business_analyst_views.build_combined_insights')
    @mock.patch('api.ai_business_analyst_views.get_ai_client')
    def test_analisis_gagal_chat_tetap_jalan(self, mock_get_client, mock_build_insights, _mock_build):
        prompt = self._kirim(mock_get_client, mock_build_insights)
        self.assertIn('"analisis_bisnis": null', prompt)
