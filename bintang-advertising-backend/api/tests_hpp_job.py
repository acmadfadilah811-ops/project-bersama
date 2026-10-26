"""HPP per SPK di Papan Kerja SPK (GET /jobs/?hpp=1, owner/manager/admin) -- 2026-10-26."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Order, OrderItem, JobBoard
from hr.models import Absensi
from api.pos_models import POSSale, POSSaleItem
from api.product_models import Product, ProductStockMovement

User = get_user_model()


class HppJobTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_hpp_job', password='pw12345', role='owner')
        self.staff = User.objects.create_user(username='staff_hpp_job', password='pw12345', role='staff')
        self.produk = Product.objects.create(nama='Cetak Banner', harga_beli=5000, harga_jual_toko=25000, lacak_inventori=True)

    def _gerakan(self, **kw):
        kw.setdefault('product', self.produk)
        kw.setdefault('qty', Decimal('1'))
        return ProductStockMovement.objects.create(**kw)

    def _jobs(self, user, hpp=True):
        self.client.force_authenticate(user)
        res = self.client.get('/api/jobs/', {'hpp': '1'} if hpp else {})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        return {row['id']: row for row in data}

    def test_job_pos_hpp_produk_dan_bahan_dicatat_di_spk_pertama_saja(self):
        sale = POSSale.objects.create(nomor='POS-HPP-1', kasir=self.owner, total=50000, dibayar=50000, status='paid')
        item = POSSaleItem.objects.create(
            sale=sale, product=self.produk, nama_snapshot='Cetak Banner', harga_snapshot=25000, qty=Decimal('2'), subtotal=50000,
        )
        self._gerakan(tipe='penjualan', qty=Decimal('2'), pos_sale=sale, hpp_total=Decimal('12000'), catatan='Penjualan POS')
        self._gerakan(
            tipe='keluar', hpp_total=Decimal('3500'),
            catatan=f'Pemakaian bahan resep | POS {sale.nomor} - Produk #{self.produk.id} | BoM Banner',
        )
        desain = JobBoard.objects.create(pos_sale_item=item, status_pekerjaan='antrean')
        cetak = JobBoard.objects.create(pos_sale_item=item, status_pekerjaan='antrean')

        baris = self._jobs(self.owner)
        self.assertEqual(baris[desain.id]['hpp'], {'produk': 12000, 'bahan': 3500, 'total': 15500})
        self.assertEqual(baris[cetak.id]['hpp'], {'produk': 0, 'bahan': 0, 'total': 0})  # tidak dobel per tahap
        self.assertEqual(baris[desain.id]['nama_produk'], 'Cetak Banner')

    def test_job_order_hpp_bahan_dari_penanda_job_persis(self):
        order = Order.objects.create(id='ORD-HPP-1', nomor_wa='08123450001', nama='Pelanggan HPP')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', product=self.produk, qty=1, harga_jual=25000)
        job = JobBoard.objects.create(order_item=item, status_pekerjaan='dikerjakan')
        lain = JobBoard.objects.create(order_item=OrderItem.objects.create(order=order, jenis_produk='Stiker', qty=1, harga_jual=1000),
                                       status_pekerjaan='dikerjakan')
        self._gerakan(tipe='penjualan', order=order, hpp_total=Decimal('6000'), catatan='Order POS')
        self._gerakan(
            tipe='keluar', hpp_total=Decimal('2000'),
            catatan=f'Pemakaian bahan resep | OrderItem #{item.id} BoM | Job #{job.id} | BoM Banner',
        )
        # Job #<id> yang mirip (mis. #1 vs #12) tidak boleh tercampur.
        self._gerakan(tipe='keluar', hpp_total=Decimal('999'), catatan=f'Pemakaian bahan produksi | Job #{job.id}9 | x')

        baris = self._jobs(self.owner)
        self.assertEqual(baris[job.id]['hpp'], {'produk': 6000, 'bahan': 2000, 'total': 8000})
        self.assertEqual(baris[lain.id]['hpp'], {'produk': 0, 'bahan': 0, 'total': 0})

    def test_hpp_hanya_untuk_owner_manager_admin_dan_hanya_bila_diminta(self):
        order = Order.objects.create(id='ORD-HPP-2', nomor_wa='08123450002', nama='Pelanggan HPP 2')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=1000)
        job = JobBoard.objects.create(order_item=item, status_pekerjaan='antrean', pic_staff=self.staff)

        self.assertIsNone(self._jobs(self.owner, hpp=False)[job.id]['hpp'])  # tanpa ?hpp=1
        Absensi.objects.create(staff=self.staff, tanggal=timezone.localdate(), jam_masuk=timezone.now())
        self.client.force_authenticate(self.staff)
        res = self.client.get('/api/jobs/', {'hpp': '1'})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        self.assertTrue(data)
        self.assertTrue(all(row['hpp'] is None for row in data))  # staff tidak melihat HPP
