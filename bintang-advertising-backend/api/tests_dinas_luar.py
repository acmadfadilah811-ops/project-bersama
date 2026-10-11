"""Dinas luar staff (2026-10-11): sesi outdoor wajib Mulai Dinas (GPS + selfie),
akses tanpa absen kantor, dinas non-sesi opsional, uang transport ke insentif."""
import base64
import datetime

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from hr.models import Absensi

from .dinas_models import DinasLuar
from .models import JobBoard, SystemConfig
from .starfoto_models import PesananFoto
from .tests_starfoto import _Dasar

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')


def foto():
    return SimpleUploadedFile('selfie.png', PNG, content_type='image/png')


class DinasLuarTests(_Dasar):
    def _pesanan_outdoor(self):
        self.client.force_authenticate(self.kasir)
        mulai = (timezone.now() + datetime.timedelta(minutes=30)).replace(microsecond=0)
        res = self._checkout(sesi=[{'mulai': mulai.isoformat(), 'lokasi': 'outdoor', 'alamat': 'Pantai Teluk Penyu'}])
        self.assertEqual(res.status_code, 201, res.content)
        return PesananFoto.objects.get(order_id=res.json()['id'])

    def _mulai_dinas(self, **data):
        payload = {'lat': '-7.7262', 'lng': '109.0154', 'akurasi': '12', 'foto': foto()}
        payload.update(data)
        return self.client.post('/api/starfoto/dinas-luar/mulai/', payload, format='multipart')

    def test_sesi_outdoor_wajib_dinas_lalu_selesai(self):
        sesi = self._pesanan_outdoor().sesi.get()
        self.client.force_authenticate(self.foto)
        res = self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Mulai Dinas', res.json()['error'])

        self.assertEqual(self._mulai_dinas(sesi_id=sesi.id, foto='').status_code, 400)  # tanpa selfie
        self.assertEqual(self.client.post('/api/starfoto/dinas-luar/mulai/', {'sesi_id': sesi.id, 'foto': foto()}, format='multipart').status_code, 400)  # tanpa GPS
        res = self._mulai_dinas(sesi_id=sesi.id)
        self.assertEqual(res.status_code, 201, res.content)
        dinas_id = res.json()['id']
        self.assertEqual(res.json()['alamat'], 'Pantai Teluk Penyu')
        self.assertTrue(res.json()['mulai_foto'].startswith('http://testserver/api/media-protected/'))
        self.assertEqual(self._mulai_dinas(tujuan='lain').status_code, 400)  # satu dinas berjalan

        self.assertEqual(self.client.get('/api/starfoto/dinas-luar/aktif/').json()['aktif']['id'], dinas_id)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/').status_code, 200)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/').status_code, 200)
        res = self.client.post(f'/api/starfoto/dinas-luar/{dinas_id}/selesai/',
                               {'lat': '-7.7263', 'lng': '109.0150', 'foto': foto()}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['status'], 'selesai')
        self.assertIsNotNone(res.json()['durasi_menit'])
        self.assertIsNone(self.client.get('/api/starfoto/dinas-luar/aktif/').json()['aktif'])

    def test_akses_sesi_tanpa_absen_kantor_bila_ada_sesi_outdoor(self):
        sesi = self._pesanan_outdoor().sesi.get()
        Absensi.objects.filter(staff=self.foto).delete()
        Absensi.objects.filter(staff=self.lain).delete()
        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.get('/api/starfoto/sesi-saya/').status_code, 200)
        self.assertEqual(self._mulai_dinas(sesi_id=sesi.id).status_code, 201)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/').status_code, 200)
        self.client.force_authenticate(self.lain)
        self.assertEqual(self.client.get('/api/starfoto/sesi-saya/').status_code, 403)
        self.assertEqual(self._mulai_dinas(sesi_id=sesi.id).status_code, 403)

    def test_dinas_non_sesi_opsional(self):
        self.client.force_authenticate(self.editor)
        res = self._mulai_dinas(tujuan='Liputan acara sekolah')
        self.assertIn('belum diaktifkan', res.json()['error'])
        SystemConfig.objects.create(key='starfoto_dinas_luar_non_sesi', value='True')
        self.assertEqual(self._mulai_dinas().status_code, 400)  # tujuan wajib
        self.assertEqual(self._mulai_dinas(tujuan='Liputan acara sekolah').status_code, 201)

    def test_uang_transport_masuk_insentif_petugas(self):
        SystemConfig.objects.create(key='starfoto_uang_transport', value='True')
        SystemConfig.objects.create(key='starfoto_uang_transport_nominal', value='25000')
        pesanan = self._pesanan_outdoor()
        self.client.force_authenticate(self.foto)
        res = self._mulai_dinas(sesi_id=pesanan.sesi.get().id)
        self.assertEqual(res.json()['uang_transport'], '25000.00')
        job = JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_sesi)
        self.assertEqual(job.insentif, 25000)
        asisten_job = JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_asisten)
        self.assertEqual(asisten_job.insentif, 0)  # asisten belum dinas

    def test_rekap_hak_akses(self):
        sesi = self._pesanan_outdoor().sesi.get()
        self.client.force_authenticate(self.foto)
        self._mulai_dinas(sesi_id=sesi.id)
        self.client.force_authenticate(self.lain)
        self.assertEqual(self.client.get('/api/starfoto/dinas-luar/').json(), [])
        from django.contrib.auth import get_user_model
        owner = get_user_model().objects.create_user(username='owner.dinas', password='x', role='owner')
        self.client.force_authenticate(owner)
        rekap = self.client.get('/api/starfoto/dinas-luar/').json()
        self.assertEqual([(r['staff'], r['sesi_info']['pelanggan']) for r in rekap], [(self.foto.id, 'Dinda')])
        self.assertEqual(DinasLuar.objects.count(), 1)
