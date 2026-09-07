"""Test POST /api/customers/{id}/resolve-contact/ -- Terminal Kasir memilih
pelanggan dari daftar Customer (master data, bisa ratusan baris) supaya kasir
bisa cari siapa saja yang terdaftar, bukan cuma yang kebetulan sudah pernah
order lewat WA (Contact). Transaksi POS/Order tetap terikat nomor_wa (primary
key Contact), jadi endpoint ini resolusi wajib sebelum checkout.
Bug ditemukan user 2026-09-07: daftar pelanggan kasir cuma baca Contact.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.customer_models import Customer
from api.models import Contact

User = get_user_model()


class ResolveContactTest(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_rc', password='pw12345', role='kasir')
        self.client.force_authenticate(user=self.kasir)

    def test_buat_contact_baru_dari_customer_dengan_hp(self):
        cust = Customer.objects.create(nama='Toko Baru', handphone='0812-3456 (789)')

        res = self.client.post(f'/api/customers/{cust.id}/resolve-contact/')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['nomor_wa'], '08123456789')

        contact = Contact.objects.get(nomor_wa=res.data['nomor_wa'])
        self.assertEqual(contact.customer_id, cust.id)
        self.assertEqual(contact.nama, 'Toko Baru')
        # Format nomor dibersihkan dari spasi/dash/kurung, sama seperti alur
        # tambah-pelanggan-baru yang sudah ada.
        self.assertNotIn(' ', contact.nomor_wa)
        self.assertNotIn('-', contact.nomor_wa)

    def test_customer_tanpa_hp_ditolak_dengan_pesan_jelas(self):
        cust = Customer.objects.create(nama='Tanpa HP')

        res = self.client.post(f'/api/customers/{cust.id}/resolve-contact/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nomor HP', res.data['error'])
        self.assertFalse(Contact.objects.filter(customer=cust).exists())

    def test_contact_sudah_ada_tertaut_dikembalikan_bukan_duplikat(self):
        cust = Customer.objects.create(nama='Sudah Ada', handphone='6281299998888')
        existing = Contact.objects.create(nomor_wa='6281299998888', nama='Sudah Ada', customer=cust)

        res = self.client.post(f'/api/customers/{cust.id}/resolve-contact/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['nomor_wa'], existing.nomor_wa)
        self.assertEqual(Contact.objects.filter(nomor_wa='6281299998888').count(), 1)

    def test_contact_orphan_dengan_nomor_sama_ditautkan_bukan_error(self):
        """Customer.handphone kebetulan sama dengan Contact WA-only lama (belum
        tertaut ke Customer mana pun) -- harus ditautkan, bukan gagal karena
        nomor_wa adalah primary key Contact (bentrok create baru)."""
        orphan = Contact.objects.create(nomor_wa='6281200001111', nama='Kontak WA Lama')
        cust = Customer.objects.create(nama='Pelanggan Master', handphone='6281200001111')

        res = self.client.post(f'/api/customers/{cust.id}/resolve-contact/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        orphan.refresh_from_db()
        self.assertEqual(orphan.customer_id, cust.id)
        self.assertEqual(Contact.objects.filter(nomor_wa='6281200001111').count(), 1)

    def test_kasir_boleh_akses(self):
        cust = Customer.objects.create(nama='Akses Kasir', handphone='6281333334444')
        res = self.client.post(f'/api/customers/{cust.id}/resolve-contact/')
        self.assertIn(res.status_code, (200, 201))

    def test_staff_ditolak(self):
        staff = User.objects.create_user(username='staff_rc', password='pw12345', role='staff')
        self.client.force_authenticate(user=staff)
        cust = Customer.objects.create(nama='Ditolak Staff', handphone='6281555556666')

        res = self.client.post(f'/api/customers/{cust.id}/resolve-contact/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
