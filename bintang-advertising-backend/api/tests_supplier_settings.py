"""Test Pengaturan Supplier — field akun_hutang & jatuh_tempo_hari.

Sebelumnya PengaturanSupplier.jsx murni mock (data hardcode di state React,
tidak pernah menyentuh backend). Task ini menambah 2 field baru di model
Supplier supaya halaman tsb bisa membaca & menyimpan data asli lewat
SupplierViewSet (`/api/suppliers/`) yang sudah ada.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification
from api.customer_models import Supplier

User = get_user_model()


class SupplierSettingsTest(APITestCase):
    def setUp(self):
        classification = AccountClassification.objects.create(
            name='Hutang Usaha Test', account_type='liability', order=1,
        )
        self.akun_hutang = Account.objects.create(
            code='21000', name='Hutang Dagang Test', account_type='liability',
            classification=classification,
        )
        self.supplier = Supplier.objects.create(nama='CV Test Supplier')

        self.owner = User.objects.create_user(username='owner_supset', password='pw12345', role='owner')
        self.kasir = User.objects.create_user(username='kasir_supset', password='pw12345', role='kasir')

    def test_owner_bisa_set_akun_hutang_dan_jatuh_tempo(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f'/api/suppliers/{self.supplier.id}/',
            {'akun_hutang': self.akun_hutang.id, 'jatuh_tempo_hari': 30},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['jatuh_tempo_hari'], 30)
        self.assertEqual(res.data['akun_hutang_display'], '21000 - Hutang Dagang Test')

        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.akun_hutang_id, self.akun_hutang.id)
        self.assertEqual(self.supplier.jatuh_tempo_hari, 30)

    def test_kasir_tidak_bisa_ubah_pengaturan_supplier(self):
        self.client.force_authenticate(user=self.kasir)
        res = self.client.patch(
            f'/api/suppliers/{self.supplier.id}/',
            {'akun_hutang': self.akun_hutang.id, 'jatuh_tempo_hari': 30},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_kasir_tetap_bisa_tambah_dan_ubah_data_dasar_supplier(self):
        # Kasir DIIZINKAN create/update supplier dasar (nama/kontak) sejak
        # instruksi user 2026-08-10 — hanya field Pengaturan Supplier
        # (akun_hutang/jatuh_tempo_hari) yang dikunci (2026-08-13). Regresi
        # ini memastikan penguncian field tidak ikut memblokir kemampuan
        # dasar itu.
        self.client.force_authenticate(user=self.kasir)
        res_create = self.client.post('/api/suppliers/', {'nama': 'CV Baru Dari Kasir'}, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED, res_create.data)

        res_update = self.client.patch(
            f'/api/suppliers/{self.supplier.id}/', {'nama': 'CV Test Supplier Diubah'}, format='json',
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK, res_update.data)
        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.nama, 'CV Test Supplier Diubah')

    def test_akun_hutang_display_kosong_saat_belum_diset(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/suppliers/{self.supplier.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['akun_hutang_display'], '')
        self.assertIsNone(res.data['jatuh_tempo_hari'])
