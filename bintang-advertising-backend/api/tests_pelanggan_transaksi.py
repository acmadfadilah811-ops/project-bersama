"""Pencarian & riwayat pelanggan di form transaksi (2026-10-19)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .customer_models import Customer
from .models import Contact, Order


class PelangganTransaksiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.kasir = User.objects.create_user(username='kasir.plg', password='x', role='kasir')
        self.staff = User.objects.create_user(username='staff.plg', password='x', role='staff')
        self.budi = Customer.objects.create(nama='Budi Santoso', handphone='081234567890', catatan='Suka laminasi doff')
        Customer.objects.create(nama='Budi Beku', handphone='081200000000', bekukan=True)
        Contact.objects.create(nomor_wa='6289999999999', nama='Budiman WA')
        # Order lama tercatat dengan format 62.., data pelanggan pakai 08..
        Order.objects.create(nomor_wa='6281234567890', nama='Budi Santoso', total_harga=Decimal('150000'))
        self.client.force_authenticate(self.kasir)

    def test_cari_menggabungkan_database_pelanggan_dan_kontak_wa(self):
        res = self.client.get('/api/customers/cari/', {'search': 'budi'})
        self.assertEqual(res.status_code, 200, res.content)
        nama = {r['nama']: r['sumber'] for r in res.json()}
        self.assertEqual(nama, {'Budi Santoso': 'customer', 'Budiman WA': 'contact'})  # yang dibekukan tidak tampil

    def test_cari_dengan_nomor_format_lain(self):
        res = self.client.get('/api/customers/cari/', {'search': '6281234567890'})
        self.assertEqual([r['nama'] for r in res.json()], ['Budi Santoso'])

    def test_riwayat_per_nomor_mencakup_format_08_dan_62(self):
        res = self.client.get('/api/customers/riwayat/', {'nomor_wa': '081234567890'})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data['ringkasan']['total_transaksi'], 1)
        self.assertEqual(data['pesanan'][0]['sumber'], 'Order')  # total dihitung ulang dari item
        self.assertEqual(data['pelanggan']['nama'], 'Budi Santoso')
        self.assertEqual(data['pelanggan']['catatan'], 'Suka laminasi doff')

    def test_riwayat_pelanggan_baru_kosong(self):
        data = self.client.get('/api/customers/riwayat/', {'nomor_wa': '085700001111'}).json()
        self.assertEqual(data['ringkasan']['total_transaksi'], 0)
        self.assertFalse(data['pelanggan']['terdaftar'])

    def test_rincian_pelanggan_tetap_jalan(self):
        res = self.client.get(f'/api/customers/{self.budi.id}/transactions/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['ringkasan']['total_transaksi'], 1)

    def test_staff_tidak_boleh_akses_database_pelanggan(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get('/api/customers/cari/', {'search': 'budi'}).status_code, 403)
        self.assertEqual(self.client.get('/api/customers/riwayat/', {'nomor_wa': '081234567890'}).status_code, 403)


class DaftarPelangganServerTests(APITestCase):
    """Daftar Pelanggan besar: paginasi + filter di server, jumlah per tipe (2026-10-19)."""

    def setUp(self):
        from .customer_models import CustomerGroup
        self.owner = get_user_model().objects.create_user(username='owner.plg', password='x', role='owner')
        self.agen = CustomerGroup.objects.create(nama='agen')
        Customer.objects.create(nama='Andi Agen', handphone='081111111111', customer_group=self.agen)
        Customer.objects.create(nama='Beni Guest', handphone='082222222222')
        Customer.objects.create(nama='Cici Beku', handphone='083333333333', bekukan=True)
        self.client.force_authenticate(self.owner)

    def _nama(self, **params):
        res = self.client.get('/api/customers/', {'page': 1, 'page_size': 50, **params})
        self.assertEqual(res.status_code, 200, res.content)
        return sorted(r['nama'] for r in res.json()['results'])

    def test_filter_tipe_dan_status(self):
        self.assertEqual(self._nama(grup_nama='agen'), ['Andi Agen'])
        self.assertEqual(self._nama(grup='tanpa'), ['Beni Guest', 'Cici Beku'])
        self.assertEqual(self._nama(status='dibekukan'), ['Cici Beku'])
        self.assertEqual(self._nama(search='6282222222222'), ['Beni Guest'])

    def test_ringkasan_grup(self):
        data = self.client.get('/api/customers/ringkasan-grup/').json()
        self.assertEqual(data['per_grup'][str(self.agen.id)], 1)
        self.assertEqual(data['tanpa_grup'], 2)
        self.assertEqual(data['total'], 3)
