"""Leaderboard staff dashboard (2026-10-15): staff+kordiv aktif, per periode & unit."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from django.test import TestCase

from api.models import CustomUser, JobBoard, Order, OrderItem, UnitBisnis


class LeaderboardStaffTests(TestCase):
    def setUp(self):
        self.foto = UnitBisnis.objects.create(nama='StarFoto Uji')
        self.adv = UnitBisnis.objects.create(nama='Advertising Uji')
        self.owner = CustomUser.objects.create_user(username='own', password='x', role='owner', email='o@x.id')
        self.staff = CustomUser.objects.create_user(username='stf', password='x', role='staff', email='s@x.id',
                                                    first_name='Rony', last_name='D', unit_bisnis=self.foto)
        self.kordiv = CustomUser.objects.create_user(username='kdv', password='x', role='kordiv', email='k@x.id',
                                                     unit_bisnis=self.adv, posisi='Kordiv Editor ADV')
        self.nonaktif = CustomUser.objects.create_user(username='off', password='x', role='staff', email='f@x.id',
                                                       is_active=False)
        self.item = OrderItem.objects.create(
            order=Order.objects.create(id='ORD-LB-1', nomor_wa='08111', nama='Pelanggan'),
            jenis_produk='Item', qty=1, harga_jual=1000,
        )
        sekarang = timezone.now()
        self._job(self.staff, sekarang, 2)
        self._job(self.kordiv, sekarang, 3)
        self._job(self.nonaktif, sekarang, 5)
        self._job(self.staff, sekarang - timedelta(days=70), 4)
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def _job(self, user, waktu, n):
        for _ in range(n):
            JobBoard.objects.create(order_item=self.item, pic_staff=user, status_pekerjaan='selesai', waktu_selesai=waktu, insentif=1000)

    def _hasil(self, **param):
        res = self.api.get('/api/dashboard/leaderboard/', param)
        self.assertEqual(res.status_code, 200, res.content)
        return [(r['username'], r['jumlah_job_selesai']) for r in res.json()['hasil']]

    def test_bulan_ini_kordiv_masuk_nonaktif_keluar(self):
        self.assertEqual(self._hasil(), [('kdv', 3), ('stf', 2)])

    def test_semua_periode_dan_nama_asli(self):
        self.assertEqual(self._hasil(periode='semua'), [('stf', 6), ('kdv', 3)])
        res = self.api.get('/api/dashboard/leaderboard/', {'periode': 'semua'}).json()['hasil']
        self.assertEqual((res[0]['nama'], res[1]['jabatan']), ('Rony D', 'Kordiv Editor ADV'))

    def test_filter_unit(self):
        self.assertEqual(self._hasil(unit_bisnis=self.foto.id), [('stf', 2)])

    def test_staff_ditolak(self):
        self.api.force_authenticate(self.staff)
        self.assertEqual(self.api.get('/api/dashboard/leaderboard/').status_code, 403)
