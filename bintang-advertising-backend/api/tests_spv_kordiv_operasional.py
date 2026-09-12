"""Uji kemampuan operasional SPV/Kordiv di Papan Kerja: buat order (dengan
pengaman uang yang sama seperti staff), assign/forward job HANYA ke bawahan
sendiri (bukan divisi/cabang lain), dan visibilitas JobBoard yang diperluas
ke seluruh bawahan (bukan cuma ringkasan). Insentif tetap eksklusif Manager."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import Divisi, JobBoard, Order, OrderItem, TahapProses

User = get_user_model()


class OrderCreateSpvKordivTests(APITestCase):
    """OrderViewSet.perform_create -- SPV/Kordiv diperlakukan sama seperti
    staff: sumber dipaksa 'staff', status_global 'review', tanpa DP/diskon."""

    def setUp(self):
        self.spv = User.objects.create_user(username='spv_buat_order', password='pw12345', role='spv')

    def test_spv_buat_order_dipaksa_review_tanpa_dp_diskon(self):
        self.client.force_authenticate(self.spv)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '08155555555', 'nama': 'Pelanggan SPV Test',
            'status_global': 'selesai',  # dikirim client, HARUS diabaikan
            'dp_dibayar': 999999, 'diskon_persen': 50,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.sumber, 'staff')
        self.assertEqual(order.status_global, 'review')
        self.assertEqual(order.dp_dibayar, 0)
        self.assertEqual(order.diskon_persen, 0)
        self.assertEqual(order.dilayani_oleh_id, self.spv.id)


class ResolveStaffSubordinateTests(APITestCase):
    """api/spk.py::resolve_staff -- SPV/Kordiv hanya boleh menunjuk staff
    yang merupakan bawahannya sendiri di struktur organisasi."""

    def setUp(self):
        self.spv_a = User.objects.create_user(username='spv_a_resolve', password='pw12345', role='spv')
        self.staff_a = User.objects.create_user(username='staff_a_resolve', password='pw12345', role='staff', atasan=self.spv_a)
        self.spv_b = User.objects.create_user(username='spv_b_resolve', password='pw12345', role='spv')
        self.staff_b = User.objects.create_user(username='staff_b_resolve', password='pw12345', role='staff', atasan=self.spv_b)

    def test_spv_bisa_tunjuk_bawahan_sendiri(self):
        from . import spk
        staff = spk.resolve_staff(self.staff_a.id, pemohon=self.spv_a)
        self.assertEqual(staff.id, self.staff_a.id)

    def test_spv_tidak_bisa_tunjuk_bawahan_spv_lain(self):
        from . import spk
        with self.assertRaises(spk.SpkError) as ctx:
            spk.resolve_staff(self.staff_b.id, pemohon=self.spv_a)
        self.assertEqual(ctx.exception.status_code, 403)


class AssignOrderViewSpvKordivTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Assign Test')
        self.tahap = TahapProses.objects.create(nama='Tahap Assign Test', divisi=self.divisi, urutan=1)
        self.spv = User.objects.create_user(username='spv_assign_test', password='pw12345', role='spv')
        self.staff_bawahan = User.objects.create_user(
            username='staff_bawahan_assign', password='pw12345', role='staff', atasan=self.spv,
        )
        self.staff_bukan_bawahan = User.objects.create_user(
            username='staff_lain_assign', password='pw12345', role='staff',
        )
        self.order = Order.objects.create(id='ORD-ASSIGN-1', nomor_wa='08166666666', nama='Pelanggan Assign Test')
        OrderItem.objects.create(order=self.order, jenis_produk='Item Assign Test', qty=1, harga_jual=10000)
        self.client.force_authenticate(self.spv)

    def test_spv_assign_ke_bawahan_berhasil_insentif_dipaksa_nol(self):
        res = self.client.post(f'/api/orders/{self.order.id}/assign/', {
            'staff_id': self.staff_bawahan.id, 'tahap_id': self.tahap.id, 'insentif': 500000,
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        job = JobBoard.objects.get(order_item__order=self.order)
        self.assertEqual(job.pic_staff_id, self.staff_bawahan.id)
        self.assertEqual(job.insentif, 0)

    def test_spv_assign_ke_bukan_bawahan_ditolak(self):
        res = self.client.post(f'/api/orders/{self.order.id}/assign/', {
            'staff_id': self.staff_bukan_bawahan.id, 'tahap_id': self.tahap.id,
        }, format='json')
        self.assertEqual(res.status_code, 403, res.content)
        self.assertFalse(JobBoard.objects.filter(order_item__order=self.order).exists())


class ForwardJobViewSpvKordivTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Forward Test')
        self.tahap_1 = TahapProses.objects.create(nama='Tahap Forward 1', divisi=self.divisi, urutan=1)
        self.tahap_2 = TahapProses.objects.create(nama='Tahap Forward 2', divisi=self.divisi, urutan=2)
        self.spv = User.objects.create_user(username='spv_forward_test', password='pw12345', role='spv')
        self.staff_bawahan = User.objects.create_user(
            username='staff_bawahan_forward', password='pw12345', role='staff', atasan=self.spv,
        )
        self.staff_bukan_bawahan = User.objects.create_user(
            username='staff_lain_forward', password='pw12345', role='staff',
        )
        Absensi.objects.create(staff=self.spv, tanggal=timezone.localdate(), jam_masuk=timezone.now())
        order = Order.objects.create(id='ORD-FWD-1', nomor_wa='08177777777', nama='Pelanggan Forward Test')
        item = OrderItem.objects.create(order=order, jenis_produk='Item Forward Test', qty=1, harga_jual=10000)
        self.job_bawahan = JobBoard.objects.create(
            order_item=item, tahap=self.tahap_1, pic_staff=self.staff_bawahan, status_pekerjaan='dikerjakan',
        )
        item2 = OrderItem.objects.create(order=order, jenis_produk='Item Forward Test 2', qty=1, harga_jual=10000)
        self.job_bukan_bawahan = JobBoard.objects.create(
            order_item=item2, tahap=self.tahap_1, pic_staff=self.staff_bukan_bawahan, status_pekerjaan='dikerjakan',
        )
        self.client.force_authenticate(self.spv)

    def test_spv_forward_job_bawahan_berhasil(self):
        res = self.client.post(f'/api/jobs/{self.job_bawahan.id}/forward/', {
            'aksi': 'forward', 'tahap_id': self.tahap_2.id,
        }, format='json')
        # 201 karena job di tahap_2 belum ada (job baru dibuat) -- bukan 200
        # (yang dipakai kalau job di tahap tujuan sudah ada dan tinggal di-reset).
        self.assertIn(res.status_code, (200, 201), res.content)
        self.job_bawahan.refresh_from_db()
        self.assertEqual(self.job_bawahan.status_pekerjaan, 'selesai')

    def test_spv_forward_job_bukan_bawahan_ditolak(self):
        res = self.client.post(f'/api/jobs/{self.job_bukan_bawahan.id}/forward/', {
            'aksi': 'forward', 'tahap_id': self.tahap_2.id,
        }, format='json')
        self.assertEqual(res.status_code, 403, res.content)

    def test_spv_forward_dengan_reassign_ke_bukan_bawahan_ditolak(self):
        res = self.client.post(f'/api/jobs/{self.job_bawahan.id}/forward/', {
            'aksi': 'forward', 'tahap_id': self.tahap_2.id, 'pic_staff_id': self.staff_bukan_bawahan.id,
        }, format='json')
        self.assertEqual(res.status_code, 403, res.content)
        # Job asal TIDAK boleh ter-commit sebagian (rollback penuh -- lihat
        # komentar di ForwardJobView soal validasi pic_staff SEBELUM atomic()).
        self.job_bawahan.refresh_from_db()
        self.assertEqual(self.job_bawahan.status_pekerjaan, 'dikerjakan')


class JobBoardQuerysetSpvKordivTests(APITestCase):
    """JobBoardViewSet.get_queryset() -- SPV melihat seluruh bawahannya
    (rekursif), TIDAK pernah cabang/SPV lain."""

    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Queryset Test')
        self.tahap = TahapProses.objects.create(nama='Tahap Queryset Test', divisi=self.divisi, urutan=1)
        self.spv_a = User.objects.create_user(username='spv_a_qs', password='pw12345', role='spv')
        self.kordiv_a = User.objects.create_user(username='kordiv_a_qs', password='pw12345', role='kordiv', atasan=self.spv_a)
        self.staff_a = User.objects.create_user(username='staff_a_qs', password='pw12345', role='staff', atasan=self.kordiv_a)
        self.spv_b = User.objects.create_user(username='spv_b_qs', password='pw12345', role='spv')
        self.staff_b = User.objects.create_user(username='staff_b_qs', password='pw12345', role='staff', atasan=self.spv_b)
        Absensi.objects.create(staff=self.spv_a, tanggal=timezone.localdate(), jam_masuk=timezone.now())

        order = Order.objects.create(id='ORD-QS-1', nomor_wa='08188888888', nama='Pelanggan Queryset Test')
        item_a = OrderItem.objects.create(order=order, jenis_produk='Item A', qty=1, harga_jual=10000)
        self.job_a = JobBoard.objects.create(order_item=item_a, tahap=self.tahap, pic_staff=self.staff_a, status_pekerjaan='antrean')
        item_b = OrderItem.objects.create(order=order, jenis_produk='Item B', qty=1, harga_jual=10000)
        self.job_b = JobBoard.objects.create(order_item=item_b, tahap=self.tahap, pic_staff=self.staff_b, status_pekerjaan='antrean')

    def test_spv_lihat_job_bawahan_2_level_tidak_lihat_cabang_lain(self):
        self.client.force_authenticate(self.spv_a)
        res = self.client.get('/api/jobs/')
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_a.id, ids)
        self.assertNotIn(self.job_b.id, ids)
