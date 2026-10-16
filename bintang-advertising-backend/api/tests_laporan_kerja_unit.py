"""Laporan Kerja: staff+kordiv aktif, filter unit bisnis, rentang hari (2026-10-17)."""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses, UnitBisnis


class LaporanKerjaUnitTests(TestCase):
    def setUp(self):
        self.foto = UnitBisnis.objects.create(nama='Foto Uji')
        self.adv = UnitBisnis.objects.create(nama='Adv Uji')
        d_foto = Divisi.objects.create(nama='Editor Uji', unit_bisnis=self.foto)
        d_adv = Divisi.objects.create(nama='Banner Uji', unit_bisnis=self.adv)
        self.t_foto = TahapProses.objects.create(divisi=d_foto, nama='Edit', urutan=1)
        self.t_adv = TahapProses.objects.create(divisi=d_adv, nama='Cetak', urutan=1)
        self.owner = CustomUser.objects.create_user(username='own', password='x', role='owner', email='o@x.id')
        self.s_foto = CustomUser.objects.create_user(username='sf', password='x', role='staff', email='sf@x.id',
                                                     unit_bisnis=self.foto, divisi=d_foto, posisi='Editor')
        self.k_adv = CustomUser.objects.create_user(username='ka', password='x', role='kordiv', email='ka@x.id',
                                                    unit_bisnis=self.adv, divisi=d_adv)
        self.off = CustomUser.objects.create_user(username='off', password='x', role='staff', email='of@x.id',
                                                  unit_bisnis=self.adv, is_active=False)
        item = OrderItem.objects.create(
            order=Order.objects.create(id='ORD-LK-1', nomor_wa='08111', nama='P'),
            jenis_produk='Item', qty=1, harga_jual=1000,
        )
        now = timezone.now()
        for user, tahap in ((self.s_foto, self.t_foto), (self.k_adv, self.t_adv), (self.k_adv, self.t_adv)):
            JobBoard.objects.create(order_item=item, tahap=tahap, pic_staff=user,
                                    status_pekerjaan='selesai', waktu_selesai=now, insentif=1000)
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def _get(self, **param):
        res = self.api.get('/api/reports/staff-performance/', {'range': 'bulan_ini', **param})
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()

    def test_staff_dan_kordiv_aktif_dengan_unit(self):
        data = self._get()
        nama = {r['username']: r for r in data['data']}
        self.assertEqual(set(nama), {'sf', 'ka'})
        self.assertEqual((nama['ka']['jobs_completed'], nama['ka']['unit_bisnis_nama']), (2, 'Adv Uji'))
        self.assertEqual(nama['sf']['jabatan'], 'Editor')
        self.assertEqual({j['unit_bisnis_nama'] for j in data['detailed_jobs']}, {'Foto Uji', 'Adv Uji'})

    def test_filter_unit_membatasi_staff_dan_spk(self):
        data = self._get(unit_bisnis=self.adv.id)
        self.assertEqual([r['username'] for r in data['data']], ['ka'])
        self.assertEqual(len(data['detailed_jobs']), 2)

    def test_rentang_hari_ini_dan_tujuh_hari(self):
        self.assertEqual(len(self._get(range='hari_ini')['detailed_jobs']), 3)
        self.assertEqual(len(self._get(range='tujuh_hari')['detailed_jobs']), 3)

    def test_export_menghormati_unit(self):
        res = self.api.get('/api/export/staff-performance/', {'range': 'bulan_ini', 'unit_bisnis': self.foto.id})
        self.assertEqual(res.status_code, 200)
