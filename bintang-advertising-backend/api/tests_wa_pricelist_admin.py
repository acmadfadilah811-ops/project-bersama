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
