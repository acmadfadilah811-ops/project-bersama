"""Test foto Supplier — sebelumnya cuma tersimpan di localStorage browser
(tidak ada field di backend sama sekali), jadi foto yang diupload di satu
perangkat tidak pernah muncul di perangkat lain dan hilang total kalau data
browser dibersihkan. Ditemukan & diperbaiki lewat audit modul Pelanggan &
Supplier 2026-09-05: field `foto` ditambah ke model Supplier, memakai pola
ImageField sederhana yang sama seperti ProductCategory.foto."""

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from api.customer_models import Supplier

User = get_user_model()

# PNG 1x1 minimal valid, cukup untuk lolos validasi ImageField Django.
PNG_1PX = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00'
    b'\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82'
)


class SupplierFotoTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_foto_supplier', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)

    def test_upload_foto_saat_buat_supplier(self):
        foto = SimpleUploadedFile('logo.png', PNG_1PX, content_type='image/png')
        res = self.client.post('/api/suppliers/', {
            'nama': 'CV Foto Test', 'foto': foto,
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.data['foto'])
        supplier = Supplier.objects.get(pk=res.data['id'])
        self.assertTrue(supplier.foto.name.startswith('supplier_photos/'))

    def test_update_foto_supplier_yang_sudah_ada(self):
        supplier = Supplier.objects.create(nama='CV Tanpa Foto')
        self.assertFalse(supplier.foto)

        foto = SimpleUploadedFile('logo.png', PNG_1PX, content_type='image/png')
        res = self.client.patch(f'/api/suppliers/{supplier.id}/', {'foto': foto}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        supplier.refresh_from_db()
        self.assertTrue(supplier.foto)

    def test_supplier_tanpa_foto_tetap_bisa_disimpan(self):
        res = self.client.post('/api/suppliers/', {'nama': 'CV Tanpa Foto Lain'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertFalse(res.data['foto'])
