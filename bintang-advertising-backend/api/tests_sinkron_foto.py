"""Sinkron foto profil ERP <-> HR <-> CRM (2026-10-05)."""
import base64
import io
import os
import shutil
import tempfile
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from .models import CustomUser
from .services import sinkron_foto as svc

URL = '/api/bridge/hr-employee-foto/'


def gambar(fmt='PNG', ukuran=(1600, 1200)):
    buf = io.BytesIO()
    Image.new('RGB', ukuran, (200, 30, 30)).save(buf, format=fmt)
    return buf.getvalue()


class _MediaSementara(APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        ov = override_settings(MEDIA_ROOT=self.media)
        ov.enable()
        self.addCleanup(ov.disable)
        env = mock.patch.dict(os.environ, {'INSIGHTS_BRIDGE_API_KEY': 'kunci-insights', 'HR_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)


class KirimFotoKeHrTests(_MediaSementara):
    def setUp(self):
        super().setUp()
        self.user = CustomUser.objects.create_user(username='u.foto', password='lama12345', role='staff', hr_employee_id=970)

    def _simpan(self, **atribut):
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                for k, v in atribut.items():
                    setattr(self.user, k, v)
                self.user.save()
        return post

    def test_ganti_foto_mengirim_jpeg_kecil_ke_hr(self):
        post = self._simpan(foto_profil=SimpleUploadedFile('a.png', gambar(), content_type='image/png'))
        post.assert_called_once()
        payload = post.call_args.kwargs['json']
        self.assertEqual((payload['hr_employee_id'], payload['sumber']), (970, 'bintang'))
        with Image.open(io.BytesIO(base64.b64decode(payload['foto']))) as img:
            self.assertEqual(img.format, 'JPEG')
            self.assertLessEqual(max(img.size), svc.SISI_MAKS)
        self.assertEqual(post.call_args.kwargs['headers']['X-Api-Key'], 'kunci-insights')

    def test_hapus_foto_mengirim_hapus(self):
        self._simpan(foto_profil=SimpleUploadedFile('a.png', gambar(), content_type='image/png'))
        post = self._simpan(foto_profil=None)
        self.assertEqual(post.call_args.kwargs['json'], {'hr_employee_id': 970, 'hapus': True, 'sumber': 'bintang'})

    def test_simpan_lain_tidak_mengirim(self):
        post = self._simpan(bio='halo')
        post.assert_not_called()
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                self.user.save(update_fields=['last_login'])
        post.assert_not_called()

    def test_akun_tanpa_hr_tidak_mengirim(self):
        lokal = CustomUser.objects.create_user(username='u.lokal', password='lama12345', role='staff')
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                lokal.foto_profil = SimpleUploadedFile('a.png', gambar(), content_type='image/png')
                lokal.save()
        post.assert_not_called()

    def test_hr_gagal_tidak_menggagalkan_simpan_foto(self):
        with mock.patch.object(svc.requests, 'post', side_effect=Exception('putus')):
            with self.captureOnCommitCallbacks(execute=True):
                self.user.foto_profil = SimpleUploadedFile('a.png', gambar(), content_type='image/png')
                self.user.save()
        self.user.refresh_from_db()
        self.assertTrue(self.user.foto_profil.name)


class TerimaFotoDariHrTests(_MediaSementara):
    def setUp(self):
        super().setUp()
        self.user = CustomUser.objects.create_user(username='u.terima', password='lama12345', role='staff', hr_employee_id=971)

    def kirim(self, payload, key='kunci-uji'):
        return APIClient().post(URL, payload, format='json', HTTP_X_API_KEY=key)

    def test_foto_diterapkan_tanpa_kirim_balik(self):
        data = gambar('JPEG', (300, 300))
        with mock.patch.object(svc.requests, 'post') as post:
            with self.captureOnCommitCallbacks(execute=True):
                res = self.kirim({'hr_employee_id': 971, 'foto': base64.b64encode(data).decode()})
        self.assertEqual(res.status_code, 200, res.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.foto_profil.name.startswith('avatars/hr_971'))
        with self.user.foto_profil.open('rb') as f:
            self.assertEqual(f.read(), data)
        post.assert_not_called()

    def test_hapus_mengosongkan_foto(self):
        self.kirim({'hr_employee_id': 971, 'foto': base64.b64encode(gambar('JPEG', (50, 50))).decode()})
        self.assertEqual(self.kirim({'hr_employee_id': 971, 'hapus': True}).status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.foto_profil)

    def test_bukan_gambar_atau_terlalu_besar_ditolak(self):
        besar = os.urandom(svc.MAKS_BYTE + 10)
        for isi in ('bukan-base64!!', base64.b64encode(b'teks biasa').decode(), base64.b64encode(besar).decode()):
            self.assertEqual(self.kirim({'hr_employee_id': 971, 'foto': isi}).status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.foto_profil)

    def test_kunci_salah_ditolak_dan_tak_dikenal_dilewati(self):
        foto = base64.b64encode(gambar('JPEG', (50, 50))).decode()
        self.assertEqual(self.kirim({'hr_employee_id': 971, 'foto': foto}, key='x').status_code, 401)
        self.assertTrue(self.kirim({'hr_employee_id': 99999, 'foto': foto}).data.get('skipped'))
