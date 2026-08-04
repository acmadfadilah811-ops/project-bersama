"""Kontrak deadline saat SPK diterbitkan dari order maupun POS."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Divisi, JobBoard, Order, OrderItem, TahapProses
from .pos_models import POSSale, POSSaleItem
from .product_models import Product


class SpkDeadlineTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_deadline', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_deadline', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Produksi Deadline')
        self.tahap = TahapProses.objects.create(nama='Cetak Deadline', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(nama='Banner Deadline', harga_beli=10000, harga_jual_toko=50000)
        self.sale = POSSale.objects.create(nomor='POS-DEADLINE', total=Decimal('50000'), status='paid')
        self.sale_item = POSSaleItem.objects.create(
            sale=self.sale, product=self.produk, nama_snapshot='Banner deadline',
            harga_snapshot=Decimal('50000'), qty=Decimal('1'), subtotal=Decimal('50000'),
        )
        self.client.force_authenticate(self.owner)

    def test_pos_spk_menyimpan_deadline_dan_mengirimkannya_ke_papan_kerja(self):
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/terbitkan-spk/',
            {'divisi_id': self.divisi.id, 'deadline': '2026-08-20'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        job = JobBoard.objects.get(pos_sale_item=self.sale_item)
        self.assertEqual(job.deadline, date(2026, 8, 20))
        job_response = self.client.get(f'/api/jobs/{job.id}/')
        self.assertEqual(job_response.data['deadline'], '2026-08-20')

    def test_order_spk_menyimpan_deadline(self):
        order = Order.objects.create(nama='Pelanggan Deadline', total_harga=50000)
        item = OrderItem.objects.create(order=order, jenis_produk='Banner deadline', qty=1)

        response = self.client.post(
            f'/api/orders/{order.id}/assign/',
            {'order_item_id': item.id, 'divisi_id': self.divisi.id, 'deadline': '2026-08-21'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(JobBoard.objects.get(order_item=item).deadline, date(2026, 8, 21))

    def test_deadline_tidak_valid_ditolak(self):
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/terbitkan-spk/',
            {'divisi_id': self.divisi.id, 'deadline': '20/08/2026'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('YYYY-MM-DD', response.data['error'])

    def test_staff_tidak_boleh_menerbitkan_spk_dengan_deadline(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/terbitkan-spk/',
            {'divisi_id': self.divisi.id, 'deadline': '2026-08-20'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
