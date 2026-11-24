"""Regresi: operator membagi sisa qty SPK ke operator lain (2026-11-24).

Kasus: order qty besar tidak bisa dikerjakan satu operator sendirian dalam
satu waktu, jadi sisanya dilimpahkan ke operator lain satu divisi. Cek:
hanya operator yang mengerjakan boleh membagi, hanya saat 'dikerjakan', qty
harus valid, job baru lahir di 'antrean' dengan qty porsinya, dan insentif
otomatis "per qty" prorata (tidak dobel) di job asal maupun job baru.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.insentif_models import InsentifProduk
from api.models import Divisi, JobBoard, Order, OrderItem, Product, TahapProses
from hr.models import Absensi

User = get_user_model()


class BagiOperatorTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Split Operator')
        self.tahap = TahapProses.objects.create(nama='Tahap Split Operator', divisi=self.divisi, urutan=1)

        self.operator1 = User.objects.create_user(
            username='operator1_split', password='pw12345', role='staff', divisi=self.divisi,
        )
        self.operator2 = User.objects.create_user(
            username='operator2_split', password='pw12345', role='staff', divisi=self.divisi,
        )
        self.operator_divisi_lain = User.objects.create_user(
            username='operator_divisi_lain', password='pw12345', role='staff',
            divisi=Divisi.objects.create(nama='Divisi Lain Split'),
        )

        today = timezone.localdate()
        for op in (self.operator1, self.operator2, self.operator_divisi_lain):
            Absensi.objects.create(staff=op, tanggal=today, jam_masuk=timezone.now())

        order = Order.objects.create(id='ORD-SPLIT-1', nomor_wa='08122222222', nama='Pelanggan Split')
        self.product = Product.objects.create(nama='Produk Split Operator')
        self.item = OrderItem.objects.create(
            order=order, jenis_produk='Produk Split Operator', product=self.product, qty=500, harga_jual=1000000,
        )

        # Rp100/qty -- dasar cek prorata insentif otomatis.
        InsentifProduk.objects.create(
            product=self.product, divisi=self.divisi, cara_hitung=InsentifProduk.CARA_QTY, nominal=100,
        )

        self.job = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap, pic_staff=self.operator1, status_pekerjaan='dikerjakan',
            waktu_mulai=timezone.now(),
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_bagi_sisa_qty_ke_operator_lain(self):
        self.assertEqual(self.job.insentif, 500 * 100)  # otomatis saat job dibuat: qty penuh 500.

        self._login(self.operator1)
        res = self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator2.id, 'qty': '200',
        })
        self.assertEqual(res.status_code, 200, res.data)

        self.job.refresh_from_db()
        self.assertEqual(self.job.qty_dikerjakan, Decimal('300'))
        self.assertEqual(self.job.status_pekerjaan, 'dikerjakan')
        self.assertEqual(self.job.insentif, 300 * 100)  # prorata, bukan tetap 500*100.

        job_baru = JobBoard.objects.exclude(pk=self.job.pk).get(order_item=self.item)
        self.assertEqual(job_baru.pic_staff_id, self.operator2.id)
        self.assertEqual(job_baru.status_pekerjaan, 'antrean')
        self.assertEqual(job_baru.qty_dikerjakan, Decimal('200'))
        self.assertEqual(job_baru.insentif, 200 * 100)

        # Total insentif gabungan sama dengan sebelum split -- tidak dobel, tidak kurang.
        self.assertEqual(self.job.insentif + job_baru.insentif, 500 * 100)

    def test_hanya_pic_staff_sendiri_yang_boleh_membagi(self):
        # Staff lain (bukan pemilik job) tidak melihat job ini sama sekali di
        # queryset-nya (JobBoardViewSet.get_queryset()) -- 404, konsisten
        # dengan start()/complete(), bukan 403.
        self._login(self.operator2)
        res = self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator2.id, 'qty': '100',
        })
        self.assertEqual(res.status_code, 404)

    def test_tidak_bisa_membagi_job_yang_belum_dikerjakan(self):
        self.job.status_pekerjaan = 'antrean'
        self.job.save()
        self._login(self.operator1)
        res = self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator2.id, 'qty': '100',
        })
        self.assertEqual(res.status_code, 400)

    def test_operator_tujuan_harus_divisi_sama(self):
        self._login(self.operator1)
        res = self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator_divisi_lain.id, 'qty': '100',
        })
        self.assertEqual(res.status_code, 400)

    def test_qty_pindah_tidak_boleh_sama_atau_lebih_dari_qty_sekarang(self):
        self._login(self.operator1)
        res = self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator2.id, 'qty': '500',
        })
        self.assertEqual(res.status_code, 400)

    def test_split_berantai_dua_kali(self):
        """operator1 -> operator2 (200), lalu job sisa operator1 (300) -> operator2 lagi (100)."""
        self._login(self.operator1)
        self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator2.id, 'qty': '200',
        })
        res = self.client.post(f'/api/jobs/{self.job.id}/bagi-operator/', {
            'operator_id': self.operator2.id, 'qty': '100',
        })
        self.assertEqual(res.status_code, 200, res.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.qty_dikerjakan, Decimal('200'))
        self.assertEqual(self.job.insentif, 200 * 100)

        total_insentif = sum(JobBoard.objects.filter(order_item=self.item).values_list('insentif', flat=True))
        self.assertEqual(total_insentif, 500 * 100)
