"""Tes CRUD admin pricelist bot WA (api/services/wa_pricelist_admin.py +
api/views/wa_pricelist.py) -- halaman Pengaturan > Pengaturan Bisnis >
sub-tab Pricelist WA Bot (permintaan user 2026-09-18)."""
import json

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import SystemConfig
from api.services import wa_pricelist_admin as svc

User = get_user_model()


def _seed_dasar():
    SystemConfig.objects.update_or_create(
        key='wa_pricelist_kategori',
        defaults={'value': json.dumps({
            'banner': 'Teks banner lama',
            'brosur': 'Teks brosur lama',
        }, ensure_ascii=False)},
    )
    SystemConfig.objects.update_or_create(
        key='wa_kalkulator_bahan',
        defaults={'value': json.dumps({
            'banner': {
                'satuan': 'm2', 'tiers': [],
                'bahan': [{'nama': 'Banner 240', 'harga': 18000}],
            },
            'stiker': {
                'satuan': 'lembar', 'tiers': [25, 50, 100],
                'bahan': [{'nama': 'Chromo', 'harga': [7000, 6800, 6500, 6200]}],
            },
        }, ensure_ascii=False)},
    )


class WaPricelistAdminServiceTests(APITestCase):
    def setUp(self):
        _seed_dasar()

    def test_get_semua_kategori_urutan_dan_terstruktur(self):
        kategori = svc.get_semua_kategori()
        slugs = [k['slug'] for k in kategori]
        self.assertEqual(slugs[0], 'banner')
        banner = next(k for k in kategori if k['slug'] == 'banner')
        self.assertTrue(banner['terstruktur'])
        self.assertEqual(banner['bahan'], [{'nama': 'Banner 240', 'harga': 18000}])
        brosur = next(k for k in kategori if k['slug'] == 'brosur')
        self.assertFalse(brosur['terstruktur'])
        self.assertNotIn('bahan', brosur)

    def test_update_kategori_non_terstruktur_hanya_teks(self):
        hasil = svc.update_kategori('brosur', 'Teks brosur baru')
        self.assertEqual(hasil['teks'], 'Teks brosur baru')
        teks_map = json.loads(SystemConfig.objects.get(key='wa_pricelist_kategori').value)
        self.assertEqual(teks_map['brosur'], 'Teks brosur baru')

    def test_update_kategori_terstruktur_tanpa_tier(self):
        hasil = svc.update_kategori('banner', 'Teks banner baru', bahan=[
            {'nama': 'Banner 240', 'harga': 19000},
            {'nama': 'Banner 300', 'harga': 26000},
        ])
        self.assertEqual(hasil['bahan'], [
            {'nama': 'Banner 240', 'harga': 19000},
            {'nama': 'Banner 300', 'harga': 26000},
        ])

    def test_update_kategori_terstruktur_dengan_tier(self):
        hasil = svc.update_kategori('stiker', 'Teks stiker baru', bahan=[
            {'nama': 'Chromo', 'harga': [7500, 7300, 7000, 6700]},
        ])
        self.assertEqual(hasil['bahan'][0]['harga'], [7500, 7300, 7000, 6700])

    def test_update_kategori_terstruktur_jumlah_harga_salah_ditolak(self):
        with self.assertRaises(svc.PricelistAdminError):
            svc.update_kategori('stiker', 'Teks', bahan=[{'nama': 'Chromo', 'harga': [7000, 6800]}])

    def test_update_kategori_teks_kosong_ditolak(self):
        with self.assertRaises(svc.PricelistAdminError):
            svc.update_kategori('brosur', '   ')

    def test_bahan_ke_csv_kolom_sesuai_tier(self):
        csv_text = svc.bahan_ke_csv('stiker')
        header = csv_text.splitlines()[0]
        self.assertEqual(header, 'nama,harga_1-25,harga_26-50,harga_51-100,harga_101+')
        self.assertIn('Chromo,7000,6800,6500,6200', csv_text)

    def test_bahan_ke_csv_kategori_non_terstruktur_error(self):
        with self.assertRaises(svc.PricelistAdminError):
            svc.bahan_ke_csv('brosur')

    def test_csv_ke_bahan_import_berhasil(self):
        import io
        csv_content = 'nama,harga\nBanner 240,20000\nBanner 300,27000\n'
        f = io.BytesIO(csv_content.encode('utf-8'))
        hasil = svc.csv_ke_bahan('banner', f)
        self.assertEqual(hasil['bahan'], [
            {'nama': 'Banner 240', 'harga': 20000},
            {'nama': 'Banner 300', 'harga': 27000},
        ])

    def test_csv_ke_bahan_header_salah_ditolak(self):
        import io
        f = io.BytesIO(b'nama,harga_salah\nBanner 240,20000\n')
        with self.assertRaises(svc.PricelistAdminError):
            svc.csv_ke_bahan('banner', f)


class WaPricelistAdminViewTests(APITestCase):
    def setUp(self):
        _seed_dasar()
        self.owner = User.objects.create_user(username='owner_pricelist', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_pricelist', password='secret', role='kasir')

    def test_list_owner_ok(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/wa-pricelist/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data['kategori']) >= 2)

    def test_list_kasir_forbidden(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.get('/api/wa-pricelist/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_kategori_terstruktur(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch('/api/wa-pricelist/banner/', {
            'teks': 'Teks banner via API',
            'bahan': [{'nama': 'Banner 240', 'harga': 21000}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['bahan'][0]['harga'], 21000)

    def test_patch_kategori_invalid_returns_400(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch('/api/wa-pricelist/stiker/', {
            'teks': 'Teks',
            'bahan': [{'nama': 'Chromo', 'harga': [1, 2]}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_template_download(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/wa-pricelist/banner/template/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response['Content-Type'])
        self.assertIn(b'nama,harga', response.content)

    def test_template_non_terstruktur_400(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/wa-pricelist/brosur/template/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_import_csv(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(self.owner)
        csv_content = b'nama,harga\nBanner 240,22000\n'
        upload = SimpleUploadedFile('pricelist.csv', csv_content, content_type='text/csv')
        response = self.client.post('/api/wa-pricelist/banner/import/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['bahan'], [{'nama': 'Banner 240', 'harga': 22000}])


class WaPricelistKategoriTambahHapusTests(APITestCase):
    """Tambah & hapus kategori dari layar Pengaturan WA Bot (2026-09-28)."""

    def setUp(self):
        _seed_dasar()
        self.owner = User.objects.create_user(username='owner_kat', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_kat', password='secret', role='kasir')
        self.client.force_authenticate(self.owner)

    def _teks_map(self):
        return json.loads(SystemConfig.objects.get(key='wa_pricelist_kategori').value)

    def test_tambah_kategori_teks_dipakai_bot(self):
        res = self.client.post('/api/wa-pricelist/', {'label': 'Stempel & Cap', 'teks': '*Stempel* mulai 50rb'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual((res.data['slug'], res.data['label'], res.data['terstruktur']), ('stempel_cap', 'Stempel & Cap', False))
        self.assertEqual(self._teks_map()['stempel_cap'], '*Stempel* mulai 50rb')
        daftar = self.client.get('/api/wa-pricelist/').data['kategori']
        self.assertEqual(daftar[-1]['label'], 'Stempel & Cap')

    def test_tambah_kategori_dobel_atau_kosong_ditolak(self):
        self.assertEqual(self.client.post('/api/wa-pricelist/', {'label': 'Brosur', 'teks': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/wa-pricelist/', {'label': '', 'teks': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/wa-pricelist/', {'label': 'Baru', 'teks': ''}, format='json').status_code, 400)

    def test_hapus_kategori_teks_dan_tidak_muncul_lagi(self):
        res = self.client.delete('/api/wa-pricelist/brosur/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertNotIn('brosur', self._teks_map())
        slugs = [k['slug'] for k in self.client.get('/api/wa-pricelist/').data['kategori']]
        self.assertNotIn('brosur', slugs)
        self.assertIn('banner', slugs)

    def _kalkulator_map(self):
        return json.loads(SystemConfig.objects.get(key='wa_kalkulator_bahan').value)

    def test_kategori_berkalkulator_bisa_dihapus_beserta_kalkulatornya(self):
        res = self.client.delete('/api/wa-pricelist/banner/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertNotIn('banner', self._teks_map())
        self.assertNotIn('banner', self._kalkulator_map())

    def test_tambah_kalkulator_ke_kategori_teks_dan_dipakai_bot(self):
        from api.services.wa_ai_tools import daftar_kategori_produk, hitung_harga_pricelist

        res = self.client.patch('/api/wa-pricelist/brosur/', {
            'teks': 'Teks brosur',
            'kalkulator': {'mode': 'qty', 'satuan': 'rim', 'tiers': [5],
                           'bahan': [{'nama': 'Brosur A5', 'harga': [300000, 250000]}]},
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual((res.data['terstruktur'], res.data['mode'], res.data['tiers']), (True, 'qty', [5]))
        self.assertIn('brosur', daftar_kategori_produk()['kategori_berkalkulator'])
        hasil = hitung_harga_pricelist('brosur', qty=6)
        self.assertEqual(hasil['rincian'][0]['subtotal'], 1500000)

    def test_tambah_kategori_dengan_kalkulator_luas(self):
        from api.services.wa_ai_tools import hitung_harga_pricelist

        res = self.client.post('/api/wa-pricelist/', {
            'label': 'Neon Box', 'teks': 'Neon box per m2',
            'kalkulator': {'mode': 'luas', 'bahan': [{'nama': 'Neon Box Akrilik', 'harga': 1200000}]},
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual((res.data['mode'], res.data['satuan']), ('luas', 'm2'))
        hasil = hitung_harga_pricelist('neon_box', qty=1, panjang=2, lebar=1)
        self.assertEqual(hasil['rincian'][0]['subtotal'], 2400000)

    def test_kalkulator_per_jumlah_tanpa_tingkatan(self):
        from api.services.wa_ai_tools import hitung_harga_pricelist

        self.client.post('/api/wa-pricelist/', {
            'label': 'Pin', 'teks': 'Pin',
            'kalkulator': {'mode': 'qty', 'satuan': 'pcs', 'tiers': [], 'bahan': [{'nama': 'Pin 44mm', 'harga': 3500}]},
        }, format='json')
        self.assertEqual(hitung_harga_pricelist('pin', qty=10)['rincian'][0]['subtotal'], 35000)

    def test_hapus_kalkulator_saja_kategori_tetap(self):
        res = self.client.patch('/api/wa-pricelist/stiker/', {'teks': 'Teks stiker', 'kalkulator': None}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(res.data['terstruktur'])
        self.assertNotIn('stiker', self._kalkulator_map())
        self.assertEqual(self._teks_map()['stiker'], 'Teks stiker')

    def test_tingkatan_tidak_naik_atau_satuan_kosong_ditolak(self):
        for kalk in ({'mode': 'qty', 'satuan': 'pcs', 'tiers': [50, 25], 'bahan': [{'nama': 'A', 'harga': [1, 2, 3]}]},
                     {'mode': 'qty', 'satuan': '', 'tiers': [], 'bahan': [{'nama': 'A', 'harga': 1}]},
                     {'mode': 'lain', 'bahan': [{'nama': 'A', 'harga': 1}]}):
            res = self.client.patch('/api/wa-pricelist/brosur/', {'teks': 'x', 'kalkulator': kalk}, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, kalk)
        self.assertNotIn('brosur', self._kalkulator_map())

    def test_kalkulator_lama_banner_terbaca_per_luas(self):
        banner = next(k for k in self.client.get('/api/wa-pricelist/').data['kategori'] if k['slug'] == 'banner')
        self.assertEqual(banner['mode'], 'luas')
        stiker = next(k for k in self.client.get('/api/wa-pricelist/').data['kategori'] if k['slug'] == 'stiker')
        self.assertEqual(stiker['mode'], 'qty')

    def test_kasir_tidak_boleh_tambah_hapus(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.post('/api/wa-pricelist/', {'label': 'X', 'teks': 'y'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete('/api/wa-pricelist/brosur/').status_code, 403)
