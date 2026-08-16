"""Penerbitan SPK dari transaksi POS.

Fokus: SPK dari POS setara dengan SPK dari order, papan produksi tetap bisa
membacanya, dan satu SPK tidak bisa punya dua sumber sekaligus.
"""

from decimal import Decimal
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import Divisi, JobBoard, Order, OrderItem, TahapProses
from .pos_models import POSSale, POSSaleItem
from .product_models import Product


class SpkDariPosTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner', password='x', role='owner')
        self.divisi = Divisi.objects.create(nama='Produksi')
        self.tahap = TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(nama='Spanduk', harga_beli=10000, harga_jual_toko=50000, qty_stok=10)
        self.sale = POSSale.objects.create(nomor='POS-0001', total=Decimal('50000'), status='paid')
        self.item = POSSaleItem.objects.create(
            sale=self.sale, product=self.produk, nama_snapshot='Spanduk 2x1',
            harga_snapshot=Decimal('50000'), qty=Decimal('1'), subtotal=Decimal('50000'),
        )
        self.client.force_authenticate(self.owner)

    def _terbitkan(self, **payload):
        return self.client.post(f'/api/pos/sales/{self.sale.id}/terbitkan-spk/', payload, format='json')

    def test_terbitkan_ke_divisi_membuat_job(self):
        res = self._terbitkan(divisi_id=self.divisi.id)
        self.assertEqual(res.status_code, 200, res.content)
        job = JobBoard.objects.get(pos_sale_item=self.item)
        self.assertEqual(job.tahap, self.tahap)          # tahap pertama divisi
        self.assertEqual(job.status_pekerjaan, 'antrean')
        self.assertIsNone(job.order_item)

    def test_properti_seragam_untuk_papan_produksi(self):
        self._terbitkan(divisi_id=self.divisi.id)
        job = JobBoard.objects.get(pos_sale_item=self.item)
        self.assertEqual(job.sumber, 'pos')
        self.assertEqual(job.nama_produk, 'Spanduk 2x1')
        self.assertEqual(job.nomor_sumber, 'POS-0001')

    def test_transaksi_belum_lunas_ditolak(self):
        self.sale.status = 'hold'
        self.sale.save()
        res = self._terbitkan(divisi_id=self.divisi.id)
        self.assertEqual(res.status_code, 400)
        self.assertIn('lunas', res.json()['error'])

    def test_tanpa_divisi_maupun_staff_ditolak(self):
        res = self._terbitkan()
        self.assertEqual(res.status_code, 400)
        self.assertIn('wajib diisi', res.json()['error'])

    def test_terbit_ulang_tahap_sama_tidak_menggandakan(self):
        self._terbitkan(divisi_id=self.divisi.id)
        self._terbitkan(divisi_id=self.divisi.id)
        self.assertEqual(JobBoard.objects.filter(pos_sale_item=self.item).count(), 1)

    def test_checkout_pos_lunas_menerbitkan_spk_dalam_transaksi_yang_sama(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{
                'product_id': self.produk.id,
                'qty': 1,
                'harga': 50000,
                'nama': 'Spanduk',
                'catatan': 'Finishing: Mata Ayam',
            }],
            'status': 'paid',
            'dibayar': 50000,
            'metode_bayar': 'CASH',
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        sale = POSSale.objects.get(pk=res.data['id'])
        self.assertEqual(JobBoard.objects.filter(pos_sale_item__sale=sale, tahap=self.tahap).count(), 1)

    def test_checkout_pos_hold_tidak_boleh_menerbitkan_spk(self):
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': self.produk.id, 'qty': 1, 'harga': 50000, 'nama': 'Spanduk'}],
            'status': 'hold',
            'dibayar': 0,
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('lunas', res.data['error'])

    def test_dua_sumber_sekaligus_ditolak_database(self):
        order = Order.objects.create(nama='Budi', total_harga=1000)
        order_item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                JobBoard.objects.create(order_item=order_item, pos_sale_item=self.item, tahap=self.tahap)

    def test_tanpa_sumber_sama_sekali_ditolak_database(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                JobBoard.objects.create(tahap=self.tahap)

    def test_order_item_detail_disintesis_untuk_papan_produksi(self):
        """Papan produksi membaca order_item_detail; job POS harus ikut terisi."""
        self._terbitkan(divisi_id=self.divisi.id)
        job = JobBoard.objects.get(pos_sale_item=self.item)
        res = self.client.get(f'/api/jobs/{job.id}/')
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        detail = data['order_item_detail']
        self.assertEqual(detail['jenis_produk'], 'Spanduk 2x1')
        self.assertEqual(detail['sumber'], 'pos')
        self.assertEqual(detail['nomor_nota'], 'POS-0001')
        self.assertEqual(data['nama_produk'], 'Spanduk 2x1')
        self.assertIsNone(data['order_id'])

    def test_job_dari_order_tetap_utuh(self):
        """Regresi: alur lama tidak boleh berubah bentuk responsnya."""
        order = Order.objects.create(nama='Budi', total_harga=1000)
        order_item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1)
        job = JobBoard.objects.create(order_item=order_item, tahap=self.tahap)
        data = self.client.get(f'/api/jobs/{job.id}/').json()
        self.assertEqual(data['order_item_detail']['jenis_produk'], 'Banner')
        self.assertEqual(data['order_id'], order.id)
        self.assertEqual(data['pelanggan_nama'], 'Budi')
        self.assertEqual(data['sumber'], 'order')

    @patch('api.services.order_invoice_whatsapp.jadwalkan_invoice_dp_otomatis')
    def test_checkout_pos_dp_mencatat_order_dan_spk_dalam_satu_alur(self, jadwalkan_invoice):
        """DP dari terminal bukan POSSale setengah bayar: ia menjadi Order,
        menyimpan sisa tagihan, lalu masuk antrean divisi seperti Antrean WA."""
        request_key = str(uuid.uuid4())
        payload = {
            'idempotency_key': request_key,
            'nama': 'Pelanggan DP',
            'nomor_wa': '081234567890',
            'dilayani_oleh_id': self.owner.id,
            'metode_pembayaran': 'tunai',
            'jumlah_bayar': 10000,
            'jatuh_tempo': str(timezone.localdate()),
            'items': [{
                'product_id': self.produk.id,
                'qty': 1,
                'harga_satuan': 50000,
                'nama': 'Spanduk + Mata Ayam',
                'is_custom_priced': True,
                'catatan': 'Finishing: Mata Ayam | Catatan pelanggan',
                'detail': {'finishing': 'Mata Ayam', 'biaya_finishing': 0},
            }],
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }

        res = self.client.post('/api/orders/checkout-pos/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.data['id'])
        self.assertEqual(order.sumber, 'pos')
        self.assertEqual(order.dp_dibayar, 10000)
        self.assertEqual(order.sisa_tagihan, 40000)
        self.assertEqual(order.jatuh_tempo, timezone.localdate())
        item = order.items.get()
        self.assertEqual(item.keterangan_detail, 'Finishing: Mata Ayam | Catatan pelanggan')
        self.assertEqual(JobBoard.objects.get(order_item=item).tahap, self.tahap)
        jadwalkan_invoice.assert_called_once_with(order.id)

        again = self.client.post('/api/orders/checkout-pos/', payload, format='json')
        self.assertEqual(again.status_code, 200, again.content)
        self.assertEqual(Order.objects.filter(pk=order.id).count(), 1)


class SpkPosDiprosesStaffTest(APITestCase):
    """Regresi T-716: job dari POS harus benar-benar bisa dikerjakan staff
    (klaim → mulai → selesai), bukan cuma terlihat di papan produksi."""

    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner2', password='x', role='owner')
        self.divisi = Divisi.objects.create(nama='Produksi')
        self.tahap = TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.divisi_lanjutan = Divisi.objects.create(nama='Finishing')
        self.tahap_lanjutan = TahapProses.objects.create(
            nama='Potong', divisi=self.divisi_lanjutan, urutan=2,
        )
        self.staff = User.objects.create_user(
            username='staffpos', password='x', role='staff', divisi=self.divisi,
        )
        # Clock-in hari ini supaya lolos IsClockedIn
        Absensi.objects.create(
            staff=self.staff, tanggal=timezone.localdate(),
            jam_masuk=timezone.now(), status='hadir',
        )

        self.produk = Product.objects.create(nama='Spanduk', harga_beli=10000, harga_jual_toko=50000)
        self.sale = POSSale.objects.create(nomor='POS-0002', total=Decimal('50000'), status='paid')
        self.item = POSSaleItem.objects.create(
            sale=self.sale, product=self.produk, nama_snapshot='Spanduk 2x1',
            harga_snapshot=Decimal('50000'), qty=Decimal('1'), subtotal=Decimal('50000'),
        )

        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/pos/sales/{self.sale.id}/terbitkan-spk/',
            {'divisi_id': self.divisi.id}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.job = JobBoard.objects.get(pos_sale_item=self.item)

    def test_staff_klaim_mulai_selesaikan_job_pos(self):
        self.client.force_authenticate(self.staff)

        res = self.client.post(f'/api/jobs/{self.job.id}/claim/')
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.pic_staff, self.staff)

        res = self.client.post(f'/api/jobs/{self.job.id}/start/')
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'dikerjakan')

        res = self.client.post(f'/api/jobs/{self.job.id}/complete/')
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'selesai')

    def test_staff_update_status_via_patch(self):
        self.job.pic_staff = self.staff
        self.job.save()
        self.client.force_authenticate(self.staff)

        res = self.client.patch(
            f'/api/jobs/{self.job.id}/', {'status_pekerjaan': 'dikerjakan'}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)

        res = self.client.patch(
            f'/api/jobs/{self.job.id}/', {'status_pekerjaan': 'selesai'}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'selesai')

    def test_staff_menyimpan_draf_job_pos(self):
        self.job.pic_staff = self.staff
        self.job.save()
        self.client.force_authenticate(self.staff)

        res = self.client.patch(
            f'/api/jobs/{self.job.id}/',
            {
                'gdrive_output_link': 'https://drive.google.com/file/d/hasil',
                'catatan_staff': [{'keterangan': 'Cetak sudah selesai', 'jumlah': '1'}],
            },
            format='json',
        )

        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.gdrive_output_link, 'https://drive.google.com/file/d/hasil')

    def test_staff_meneruskan_job_pos_ke_divisi_lain(self):
        self.job.pic_staff = self.staff
        self.job.status_pekerjaan = 'dikerjakan'
        self.job.save()
        self.client.force_authenticate(self.staff)

        res = self.client.post(
            f'/api/jobs/{self.job.id}/forward/',
            {'aksi': 'forward', 'tahap_id': self.tahap_lanjutan.id},
            format='json',
        )

        self.assertEqual(res.status_code, 201, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status_pekerjaan, 'selesai')
        next_job = JobBoard.objects.get(pos_sale_item=self.item, tahap=self.tahap_lanjutan)
        self.assertEqual(next_job.status_pekerjaan, 'antrean')
        self.assertIsNone(next_job.pic_staff)
