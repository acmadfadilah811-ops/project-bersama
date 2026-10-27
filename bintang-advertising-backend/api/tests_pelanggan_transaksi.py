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


class KasirKelolaPelangganTests(APITestCase):
    """Kasir boleh tambah/ubah/hapus pelanggan (2026-10-27); yang sudah bertransaksi tidak bisa dihapus."""

    def setUp(self):
        self.kasir = get_user_model().objects.create_user(username='kasir_kelola_pel', password='x', role='kasir')
        self.client.force_authenticate(self.kasir)

    def test_tambah_ubah_hapus_pelanggan_oleh_kasir(self):
        res = self.client.post('/api/customers/', {'nama': 'Pelanggan Uji', 'handphone': '081211110001'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        pk = res.json()['id']
        res = self.client.patch(f'/api/customers/{pk}/', {'nama': 'Pelanggan Uji Ubah'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        res = self.client.delete(f'/api/customers/{pk}/')
        self.assertEqual(res.status_code, 204, getattr(res, 'content', b''))
        self.assertFalse(Customer.objects.filter(pk=pk).exists())

    def test_hapus_pelanggan_ikut_hapus_kontak_tertaut_tanpa_transaksi(self):
        cust = Customer.objects.create(nama='Dengan Kontak', handphone='081211110002')
        Contact.objects.create(nomor_wa='081211110002', nama='Dengan Kontak', customer=cust)
        self.assertEqual(self.client.delete(f'/api/customers/{cust.pk}/').status_code, 204)
        self.assertFalse(Contact.objects.filter(nomor_wa='081211110002').exists())

    def test_pelanggan_dan_kontak_yang_sudah_bertransaksi_ditolak(self):
        from api.pos_models import POSSale
        cust = Customer.objects.create(nama='Sudah Beli', handphone='081211110003')
        kontak = Contact.objects.create(nomor_wa='081211110003', nama='Sudah Beli', customer=cust)
        POSSale.objects.create(nomor='POS-KELOLA-1', kasir=self.kasir, pelanggan=kontak, total=1000, dibayar=1000, status='paid')
        res = self.client.delete(f'/api/customers/{cust.pk}/')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('sudah punya transaksi', res.json()['error'])
        self.assertTrue(Customer.objects.filter(pk=cust.pk).exists())
        res = self.client.delete('/api/contacts/081211110003/')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertTrue(Contact.objects.filter(nomor_wa='081211110003').exists())


class SinkronNamaPelangganKontakTests(APITestCase):
    """Ubah nama di satu sisi (kontak/pelanggan) ikut mengubah sisi tertaut (2026-10-27)."""

    def setUp(self):
        self.kasir = get_user_model().objects.create_user(username='kasir_nama_sinkron', password='x', role='kasir')
        self.client.force_authenticate(self.kasir)
        self.cust = Customer.objects.create(nama='Bu Eni', handphone='081211110009')
        self.kontak = Contact.objects.create(nomor_wa='081211110009', nama='Bu Eni', customer=self.cust)

    def test_ubah_nama_kontak_ikut_ke_pelanggan(self):
        res = self.client.patch('/api/contacts/081211110009/', {'nama': 'Bu Eni Darsono'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.cust.refresh_from_db()
        self.assertEqual(self.cust.nama, 'Bu Eni Darsono')

    def test_ubah_nama_pelanggan_ikut_ke_kontak(self):
        res = self.client.patch(f'/api/customers/{self.cust.pk}/', {'nama': 'Ibu Eni'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.kontak.refresh_from_db()
        self.assertEqual(self.kontak.nama, 'Ibu Eni')
