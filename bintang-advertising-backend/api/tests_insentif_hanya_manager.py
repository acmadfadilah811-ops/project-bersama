"""Insentif pekerjaan HANYA boleh ditentukan Owner/Manager/Admin (2026-09-30).

Celah sebelumnya: staff yang membuat order sendiri ("Buat Order") bisa
menyertakan `insentif` di POST/PATCH /api/order-items/ dan nilainya langsung
masuk ke JobBoard (OrderItemSerializer tidak memeriksa role); kasir juga bisa
mengisinya lewat /orders/{id}/assign/ dan /pos/sales/{id}/terbitkan-spk/."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Divisi, JobBoard, Order, OrderItem, TahapProses
from .pos_models import POSSale, POSSaleItem
from .product_models import Product

User = get_user_model()


class InsentifHanyaManagerTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Insentif Test')
        self.tahap = TahapProses.objects.create(nama='Tahap Insentif Test', divisi=self.divisi, urutan=1)
        self.staff = User.objects.create_user(username='staff_insentif', password='pw12345', role='staff')
        self.kasir = User.objects.create_user(username='kasir_insentif', password='pw12345', role='kasir')
        self.manager = User.objects.create_user(username='manager_insentif', password='pw12345', role='manager')
        self.order = Order.objects.create(
            id='ORD-INSENTIF-1', nomor_wa='08177777777', nama='Pelanggan Insentif',
            dilayani_oleh=self.staff, status_global='review', sumber='staff',
        )

    def test_staff_tidak_bisa_isi_insentif_lewat_order_items_create(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post('/api/order-items/', {
            'order': self.order.id, 'jenis_produk': 'Banner', 'qty': 1, 'harga_jual': 50000,
            'insentif': 900000,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(JobBoard.objects.get(order_item_id=res.data['id']).insentif, 0)

    def test_staff_tidak_bisa_ubah_insentif_lewat_order_items_patch(self):
        item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1, harga_jual=50000)
        job = JobBoard.objects.create(order_item=item, tahap=self.tahap, insentif=10000, pic_staff=self.staff)
        self.client.force_authenticate(self.staff)
        res = self.client.patch(f'/api/order-items/{item.id}/', {'insentif': 900000}, format='json')
        self.assertIn(res.status_code, (200, 403), res.content)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 10000)

    def test_manager_tetap_bisa_isi_insentif_lewat_order_items(self):
        order = Order.objects.create(id='ORD-INSENTIF-2', nomor_wa='08177777778', nama='Pelanggan Mgr')
        self.client.force_authenticate(self.manager)
        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Banner', 'qty': 1, 'harga_jual': 50000,
            'insentif': 25000,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(JobBoard.objects.get(order_item_id=res.data['id']).insentif, 25000)

    def test_kasir_assign_order_insentif_dipaksa_nol_manager_boleh(self):
        item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1, harga_jual=50000)
        for user, harapan in ((self.kasir, 0), (self.manager, 30000)):
            self.client.force_authenticate(user)
            res = self.client.post(f'/api/orders/{self.order.id}/assign/', {
                'divisi_id': self.divisi.id, 'insentif': 30000,
            }, format='json')
            self.assertEqual(res.status_code, 200, res.content)
            self.assertEqual(JobBoard.objects.get(order_item=item, tahap=self.tahap).insentif, harapan, user.role)

    def test_terbitkan_spk_pos_insentif_dipaksa_nol_untuk_kasir_manager_boleh(self):
        produk = Product.objects.create(nama='Spanduk Uji', harga_beli=10000, harga_jual_toko=50000, qty_stok=10)
        sale = POSSale.objects.create(nomor='POS-INSENTIF-1', total=Decimal('50000'), status='paid')
        item = POSSaleItem.objects.create(
            sale=sale, product=produk, nama_snapshot='Spanduk', harga_snapshot=Decimal('50000'),
            qty=Decimal('1'), subtotal=Decimal('50000'),
        )
        for user, harapan in ((self.kasir, 0), (self.manager, 30000)):
            self.client.force_authenticate(user)
            res = self.client.post(f'/api/pos/sales/{sale.id}/terbitkan-spk/', {
                'divisi_id': self.divisi.id, 'insentif': 30000,
            }, format='json')
            self.assertEqual(res.status_code, 200, res.content)
            self.assertEqual(JobBoard.objects.get(pos_sale_item=item, tahap=self.tahap).insentif, harapan, user.role)
