"""Test Tipe Pelanggan (customer_group) ikut tampil di /api/contacts/ — dipakai
daftar pelanggan Kasir (PosCustomerListPanel). Sebelumnya ContactSerializer sama
sekali tidak mengekspos ini, jadi Kasir selalu tampil "Guest" walau akun member
(Customer) yang tertaut sudah punya kategori (Agen/MOU/dst) di modul Pelanggan.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.customer_models import Customer, CustomerGroup
from api.models import Contact

User = get_user_model()


class ContactCustomerGroupTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_ccg', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.grup_agen = CustomerGroup.objects.create(nama='Agen')

    def test_contact_tertaut_customer_berkategori_ikut_tampil(self):
        cust = Customer.objects.create(nama='Toko Rian', customer_group=self.grup_agen)
        Contact.objects.create(nomor_wa='628111222333', nama='Toko Rian', customer=cust)

        res = self.client.get('/api/contacts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        row = next(r for r in rows if r['nomor_wa'] == '628111222333')
        self.assertEqual(row['customer_group'], self.grup_agen.id)
        self.assertEqual(row['customer_group_nama'], 'Agen')

    def test_contact_tanpa_customer_tertaut_kategori_kosong(self):
        Contact.objects.create(nomor_wa='628999888777', nama='Tanpa Member')

        res = self.client.get('/api/contacts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        row = next(r for r in rows if r['nomor_wa'] == '628999888777')
        self.assertIsNone(row['customer_group'])
        self.assertIsNone(row['customer_group_nama'])

    def test_contact_tertaut_customer_tanpa_kategori_kosong(self):
        cust = Customer.objects.create(nama='Guest Saja')
        Contact.objects.create(nomor_wa='628555444333', nama='Guest Saja', customer=cust)

        res = self.client.get('/api/contacts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        row = next(r for r in rows if r['nomor_wa'] == '628555444333')
        self.assertIsNone(row['customer_group'])
        self.assertIsNone(row['customer_group_nama'])
