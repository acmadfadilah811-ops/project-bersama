"""Nomor WA = patokan satu pelanggan (2026-10-05): tidak boleh ada dua pelanggan
dengan nomor WA yang sama (0812.. / 62812.. / +62 812-.. dianggap sama)."""
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from .customer_models import Customer
from .models import CustomUser

URL = '/api/customers/'


class PelangganWaUnikTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(username='owner.wa', password='x12345678', role='owner')
        self.client.force_authenticate(self.owner)
        self.lama = Customer.objects.create(nama='Budi Lama', handphone='0812-3456-7890')

    def buat(self, nomor, nama='Baru'):
        return self.client.post(URL, {'nama': nama, 'handphone': nomor}, format='json')

    def test_nomor_sama_format_berbeda_ditolak(self):
        for nomor in ('081234567890', '6281234567890', '+62 812 3456 7890', '81234567890'):
            res = self.buat(nomor)
            self.assertEqual(res.status_code, 400, nomor)
            self.assertIn('Budi Lama', str(res.data['handphone']))
        self.assertEqual(Customer.objects.count(), 1)

    def test_nomor_baru_diterima(self):
        self.assertEqual(self.buat('081299990000').status_code, 201)

    def test_nomor_wajib_dan_harus_valid_saat_buat(self):
        self.assertEqual(self.buat('').status_code, 400)
        self.assertEqual(self.buat('12ab').status_code, 400)

    def test_ubah_ke_nomor_milik_pelanggan_lain_ditolak(self):
        lain = Customer.objects.create(nama='Sari', handphone='6281122223333')
        res = self.client.patch(f'{URL}{lain.id}/', {'handphone': '081234567890'}, format='json')
        self.assertEqual(res.status_code, 400)
        lain.refresh_from_db()
        self.assertEqual(lain.handphone, '6281122223333')

    def test_simpan_ulang_nomor_sendiri_dan_data_lama_dobel_tetap_bisa_disunting(self):
        res = self.client.patch(f'{URL}{self.lama.id}/', {'nama': 'Budi', 'handphone': '6281234567890'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        dobel = Customer.objects.create(nama='Budi Dobel', handphone='081234567890')  # data lama
        res = self.client.patch(f'{URL}{dobel.id}/', {'nama': 'Budi Dobel 2', 'handphone': '081234567890'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    def test_impor_csv_melewati_nomor_yang_sudah_ada_dan_dobel_di_berkas(self):
        isi = (
            'name,phone\n'
            'Budi Impor,081234567890\n'   # sudah ada di sistem
            'Ani,081277778888\n'          # baru
            'Ani Lagi,6281277778888\n'    # sama dengan baris 3
            'Tanpa Nomor,\n'              # tanpa nomor tetap boleh (data lama)
        )
        berkas = SimpleUploadedFile('p.csv', isi.encode(), content_type='text/csv')
        res = self.client.post(f'{URL}import-csv/', {'file': berkas}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['created'], 2)
        baris_gagal = sorted(e['row'] for e in res.data['errors'])
        self.assertEqual(baris_gagal, [2, 4])
