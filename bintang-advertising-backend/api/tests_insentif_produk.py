"""Insentif per produk & divisi (2026-10-15)."""
from django.test import TestCase
from rest_framework.test import APIClient

from api.insentif_models import InsentifProduk, JenisInsentif
from api.services import insentif_pekerjaan
from api.models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses, UnitBisnis
from api.product_models import Product


class InsentifProdukTests(TestCase):
    def setUp(self):
        self.unit = UnitBisnis.objects.create(nama='Unit Uji')
        self.divisi = Divisi.objects.create(nama='Operator Uji', unit_bisnis=self.unit)
        self.tahap = TahapProses.objects.create(divisi=self.divisi, nama='Cetak', urutan=1)
        self.produk = Product.objects.create(nama='Cetak 4R', unit_bisnis=self.unit)
        self.lain = Product.objects.create(nama='Pigura', unit_bisnis=self.unit)
        self.umum = JenisInsentif.objects.create(nama='Cetak umum', nominal_default=700)
        self.umum.divisi.add(self.divisi)
        self.order = Order.objects.create(id='ORD-INS-1', nomor_wa='08111', nama='P')

    def _job(self, produk, qty=1, panjang=0.0, lebar=0.0):
        item = OrderItem.objects.create(order=self.order, product=produk, jenis_produk=produk.nama, qty=qty,
                                        harga_jual=1000, panjang=panjang, lebar=lebar)
        return JobBoard.objects.create(order_item=item, tahap=self.tahap)

    def test_per_qty_menggantikan_insentif_umum(self):
        InsentifProduk.objects.create(product=self.produk, divisi=self.divisi, cara_hitung='qty', nominal=500)
        job = self._job(self.produk, qty=20)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 10000)
        self.assertEqual(list(job.rincian_insentif.values_list('nama', flat=True)), ['Insentif Cetak 4R'])

    def test_flat_dan_m2(self):
        InsentifProduk.objects.create(product=self.produk, divisi=self.divisi, cara_hitung='flat', nominal=3000)
        self.assertEqual(self._job(self.produk, qty=5).rincian_insentif.get().nominal, 3000)
        aturan = InsentifProduk.objects.get()
        aturan.cara_hitung, aturan.nominal = 'm2', 2000
        aturan.save()
        job = self._job(self.produk, qty=2, panjang=2.0, lebar=1.5)
        self.assertEqual(job.rincian_insentif.get().nominal, 12000)

    def test_tanpa_aturan_tetap_insentif_umum(self):
        job = self._job(self.lain, qty=3)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 700)

    def test_aturan_nonaktif_diabaikan(self):
        InsentifProduk.objects.create(product=self.produk, divisi=self.divisi, nominal=500, aktif=False)
        job = self._job(self.produk, qty=4)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 700)

    def test_persen_dari_harga_jual(self):
        InsentifProduk.objects.create(product=self.produk, divisi=self.divisi, cara_hitung='persen', persen='2.5')
        item = OrderItem.objects.create(order=self.order, product=self.produk, jenis_produk='Cetak', qty=3, harga_jual=200000)
        job = JobBoard.objects.create(order_item=item, tahap=self.tahap)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 5000)  # 2,5% x 200.000

    def test_api_persen_wajib_valid(self):
        owner = CustomUser.objects.create_user(username='own3', password='x', role='owner', email='o3@x.id')
        api = APIClient()
        api.force_authenticate(owner)
        base = {'product': self.produk.id, 'divisi': self.divisi.id, 'cara_hitung': 'persen'}
        self.assertEqual(api.post('/api/insentif-produk/', {**base, 'persen': 0}, format='json').status_code, 400)
        self.assertEqual(api.post('/api/insentif-produk/', {**base, 'persen': 120}, format='json').status_code, 400)
        res = api.post('/api/insentif-produk/', {**base, 'persen': 5, 'nominal': 999}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual((res.json()['nominal'], res.json()['persen']), (0, '5.00'))

    def test_baris_manual_tetap_bisa_ditambah(self):
        InsentifProduk.objects.create(product=self.produk, divisi=self.divisi, cara_hitung='qty', nominal=500)
        job = self._job(self.produk, qty=2)
        insentif_pekerjaan.tambah(job, None, nama='Bonus lembur', nominal=2500)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 3500)

    def test_api_crud_dan_duplikat_ditolak(self):
        owner = CustomUser.objects.create_user(username='own', password='x', role='owner', email='o@x.id')
        api = APIClient()
        api.force_authenticate(owner)
        data = {'product': self.produk.id, 'divisi': self.divisi.id, 'cara_hitung': 'qty', 'nominal': 500}
        self.assertEqual(api.post('/api/insentif-produk/', data, format='json').status_code, 201)
        self.assertEqual(api.post('/api/insentif-produk/', data, format='json').status_code, 400)
        res = api.get('/api/insentif-produk/', {'divisi': self.divisi.id}).json()
        self.assertEqual((res[0]['product_nama'], res[0]['unit_bisnis_nama']), ('Cetak 4R', 'Unit Uji'))
        staff = CustomUser.objects.create_user(username='stf', password='x', role='staff', email='s@x.id')
        api.force_authenticate(staff)
        self.assertEqual(api.get('/api/insentif-produk/').status_code, 403)
