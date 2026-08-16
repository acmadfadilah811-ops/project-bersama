"""Transaksi POS Lunas + SPK harus tampil di panel "Pesanan & Pelunasan"
(SiapDiambilPanel.jsx) supaya kasir bisa memberi tahu pelanggan pesanan
siap diambil atau masih diproses — bukan cuma pesanan dari alur DP/Order.

Bug ditemukan 2026-08-13: halaman itu cuma baca `/orders/`, dan logic
auto-ready di views/jobs.py sengaja cuma menangani job asal `order_item`
(job dari POS dilewati karena "tidak punya Order induk") — jadi transaksi
POS Lunas dengan SPK produksi tidak pernah punya representasi status
"siap diambil"/"sudah diambil" sama sekali. Diperbaiki dengan endpoint
`/pos/sales/produksi/` (status dihitung langsung dari JobBoard, tidak
disimpan) dan `/pos/sales/{id}/selesaikan/` (padanan POSSale.diambil_pada
dari Order.status_global='selesai')."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Divisi, JobBoard, TahapProses
from .pos_models import POSSale, POSSaleItem
from .product_models import Product

User = get_user_model()


class PosPesananProduksiTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_pesanan_pos', password='x', role='owner')
        self.divisi = Divisi.objects.create(nama='Produksi Test')
        self.tahap = TahapProses.objects.create(nama='Cetak Test', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(nama='Spanduk Test', harga_beli=10000, harga_jual_toko=50000)
        self.client.force_authenticate(self.owner)

    def _buat_sale_dengan_job(self):
        sale = POSSale.objects.create(nomor='POS-PESANAN-1', total=Decimal('50000'), status='paid')
        item = POSSaleItem.objects.create(
            sale=sale, product=self.produk, nama_snapshot='Spanduk 2x1',
            harga_snapshot=Decimal('50000'), qty=Decimal('1'), subtotal=Decimal('50000'),
        )
        res = self.client.post(
            f'/api/pos/sales/{sale.id}/terbitkan-spk/', {'divisi_id': self.divisi.id}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        job = JobBoard.objects.get(pos_sale_item=item)
        return sale, item, job

    def test_job_belum_selesai_muncul_di_produksi_proses_bukan_ready(self):
        sale, _item, _job = self._buat_sale_dengan_job()

        proses = self.client.get('/api/pos/sales/produksi/', {'status_produksi': 'proses'})
        self.assertEqual(proses.status_code, 200, proses.content)
        self.assertIn(sale.id, [row['id'] for row in proses.data])

        ready = self.client.get('/api/pos/sales/produksi/', {'status_produksi': 'ready'})
        self.assertNotIn(sale.id, [row['id'] for row in ready.data])

    def test_semua_job_selesai_muncul_di_produksi_ready(self):
        sale, _item, job = self._buat_sale_dengan_job()
        job.status_pekerjaan = 'selesai'
        job.save()

        ready = self.client.get('/api/pos/sales/produksi/', {'status_produksi': 'ready'})
        self.assertEqual(ready.status_code, 200, ready.content)
        baris = next(row for row in ready.data if row['id'] == sale.id)
        self.assertEqual(baris['status_produksi'], 'ready')
        self.assertEqual(len(baris['items'][0]['jobs']), 1)
        self.assertEqual(baris['items'][0]['jobs'][0]['status_pekerjaan'], 'selesai')

    def test_sale_tanpa_job_tidak_muncul_di_produksi(self):
        sale = POSSale.objects.create(nomor='POS-TANPA-JOB', total=Decimal('10000'), status='paid')
        POSSaleItem.objects.create(
            sale=sale, product=self.produk, nama_snapshot='Item Biasa',
            harga_snapshot=Decimal('10000'), qty=Decimal('1'), subtotal=Decimal('10000'),
        )
        res = self.client.get('/api/pos/sales/produksi/')
        self.assertNotIn(sale.id, [row['id'] for row in res.data])

    def test_selesaikan_pos_menandai_diambil_pada_dan_hilang_dari_produksi(self):
        sale, _item, job = self._buat_sale_dengan_job()
        job.status_pekerjaan = 'selesai'
        job.save()

        res = self.client.post(f'/api/pos/sales/{sale.id}/selesaikan/')
        self.assertEqual(res.status_code, 200, res.content)
        sale.refresh_from_db()
        self.assertIsNotNone(sale.diambil_pada)

        masih_ada = self.client.get('/api/pos/sales/produksi/')
        self.assertNotIn(sale.id, [row['id'] for row in masih_ada.data])

    def test_selesaikan_pos_dengan_job_belum_selesai_ditolak(self):
        sale, _item, _job = self._buat_sale_dengan_job()
        res = self.client.post(f'/api/pos/sales/{sale.id}/selesaikan/')
        self.assertEqual(res.status_code, 400, res.content)
        sale.refresh_from_db()
        self.assertIsNone(sale.diambil_pada)

    def test_selesaikan_pos_tanpa_job_ditolak(self):
        sale = POSSale.objects.create(nomor='POS-TANPA-JOB-2', total=Decimal('10000'), status='paid')
        res = self.client.post(f'/api/pos/sales/{sale.id}/selesaikan/')
        self.assertEqual(res.status_code, 400, res.content)

    def test_selesaikan_dua_kali_ditolak(self):
        sale, _item, job = self._buat_sale_dengan_job()
        job.status_pekerjaan = 'selesai'
        job.save()
        self.client.post(f'/api/pos/sales/{sale.id}/selesaikan/')
        res = self.client.post(f'/api/pos/sales/{sale.id}/selesaikan/')
        self.assertEqual(res.status_code, 400, res.content)
