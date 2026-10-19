"""Laporan Kerja kategori SPV & Kordiv (menu HR & Kepegawaian, 2026-10-19):
ringkasan per pimpinan untuk Owner/Manager/Admin (read-only), filter kategori
pada daftar laporan tertulis, dan Admin tidak boleh menulis laporan."""
import datetime

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Divisi, JobBoard, LaporanTargetProduksi, Order, OrderItem, TahapProses

User = get_user_model()
URL_RINGKASAN = '/api/laporan-produksi/ringkasan-pimpinan/'
URL_TARGET = '/api/laporan-produksi/target/'


class RingkasanPimpinanTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Pimpinan')
        self.tahap = TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.owner = User.objects.create_user(username='own_pm', password='x', role='owner')
        self.manager = User.objects.create_user(username='mgr_pm', password='x', role='manager')
        self.admin = User.objects.create_user(username='adm_pm', password='x', role='admin')
        self.spv = User.objects.create_user(username='spv_pm', password='x', role='spv')
        self.kordiv = User.objects.create_user(
            username='kor_pm', password='x', role='kordiv', divisi=self.divisi, atasan=self.spv,
        )
        self.staff = User.objects.create_user(
            username='stf_pm', password='x', role='staff', divisi=self.divisi, atasan=self.kordiv,
        )
        self.spv_nonaktif = User.objects.create_user(username='spv_off_pm', password='x', role='spv', is_active=False)
        self.hari_ini = timezone.localdate()

    def _job(self, status_pekerjaan, pic, waktu=None):
        item = OrderItem.objects.create(
            order=Order.objects.create(nama='Pelanggan PM', nomor_wa='0811'),
            jenis_produk='Banner', qty=1, harga_jual=1000,
        )
        return JobBoard.objects.create(
            order_item=item, tahap=self.tahap, pic_staff=pic,
            status_pekerjaan=status_pekerjaan, waktu_selesai=waktu,
        )

    def _baris(self, res, user):
        return next(p for p in res.data['pimpinan'] if p['user_id'] == user.id)

    # ── Matriks role ──
    def test_owner_manager_admin_boleh_baca(self):
        for akun in (self.owner, self.manager, self.admin):
            self.client.force_authenticate(akun)
            res = self.client.get(URL_RINGKASAN)
            self.assertEqual(res.status_code, status.HTTP_200_OK, akun.role)

    def test_spv_kordiv_staff_ditolak(self):
        for akun in (self.spv, self.kordiv, self.staff):
            self.client.force_authenticate(akun)
            self.assertEqual(self.client.get(URL_RINGKASAN).status_code, status.HTTP_403_FORBIDDEN, akun.role)

    def test_tanpa_login_ditolak(self):
        self.assertIn(self.client.get(URL_RINGKASAN).status_code, (401, 403))

    # ── Isi & kategori ──
    def test_kategori_memfilter_dan_akun_nonaktif_tidak_ikut(self):
        self.client.force_authenticate(self.owner)
        semua = self.client.get(URL_RINGKASAN).data['pimpinan']
        self.assertEqual({p['user_id'] for p in semua}, {self.spv.id, self.kordiv.id})
        spv = self.client.get(URL_RINGKASAN, {'kategori': 'spv'}).data['pimpinan']
        self.assertEqual([p['user_id'] for p in spv], [self.spv.id])
        kordiv = self.client.get(URL_RINGKASAN, {'kategori': 'kordiv'}).data['pimpinan']
        self.assertEqual([p['user_id'] for p in kordiv], [self.kordiv.id])

    def test_kategori_tidak_dikenal_ditolak(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(URL_RINGKASAN, {'kategori': 'staff'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_angka_cocok_dengan_dashboard_pimpinan_sendiri(self):
        """Baris SPV di menu = angka yang dilihat SPV itu di dashboard-nya
        (/laporan-produksi/ringkasan/), termasuk job staff di bawah Kordiv."""
        sekarang = timezone.now()
        self._job('selesai', self.staff, sekarang)
        self._job('selesai', self.staff, sekarang)
        self._job('gagal', self.staff, sekarang)
        self._job('kendala', self.staff)

        self.client.force_authenticate(self.owner)
        baris = self._baris(self.client.get(URL_RINGKASAN, {'kategori': 'spv'}), self.spv)
        self.assertEqual(baris['jumlah_selesai'], 2)
        self.assertEqual(baris['jumlah_gagal_batal'], 1)
        self.assertEqual(baris['jumlah_kendala_aktif'], 1)
        self.assertEqual(baris['jumlah_anggota_tim'], 2)
        self.assertEqual(baris['per_divisi'][0]['divisi_nama'], 'Divisi Pimpinan')

        self.client.force_authenticate(self.spv)
        dashboard = self.client.get('/api/laporan-produksi/ringkasan/').data
        self.assertEqual(dashboard['jumlah_selesai'], baris['jumlah_selesai'])
        self.assertEqual(dashboard['jumlah_gagal_batal'], baris['jumlah_gagal_batal'])
        self.assertEqual(dashboard['jumlah_kendala_aktif'], baris['jumlah_kendala_aktif'])

    def test_job_di_luar_rentang_tidak_dihitung(self):
        self._job('selesai', self.staff, timezone.now() - datetime.timedelta(days=10))
        self.client.force_authenticate(self.owner)
        baris = self._baris(self.client.get(URL_RINGKASAN, {'kategori': 'kordiv'}), self.kordiv)
        self.assertEqual(baris['jumlah_selesai'], 0)

    def test_rentang_terbalik_ditolak(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(URL_RINGKASAN, {'tanggal_dari': '2026-10-19', 'tanggal_sampai': '2026-10-01'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class LaporanTertulisKategoriTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Kategori')
        self.owner = User.objects.create_user(username='own_kt', password='x', role='owner')
        self.admin = User.objects.create_user(username='adm_kt', password='x', role='admin')
        self.spv = User.objects.create_user(username='spv_kt', password='x', role='spv')
        self.kordiv = User.objects.create_user(
            username='kor_kt', password='x', role='kordiv', divisi=self.divisi, atasan=self.spv,
        )
        for pembuat in (self.spv, self.kordiv):
            LaporanTargetProduksi.objects.create(
                dibuat_oleh=pembuat, divisi=self.divisi, periode_tipe='harian',
                tanggal_mulai='2026-10-19', tanggal_selesai='2026-10-19', target_selesai=5,
            )

    def test_filter_kategori_dan_field_role_pembuat(self):
        self.client.force_authenticate(self.owner)
        semua = self.client.get(URL_TARGET).data
        self.assertEqual({r['dibuat_oleh_role'] for r in semua}, {'spv', 'kordiv'})
        spv = self.client.get(URL_TARGET, {'kategori': 'spv'}).data
        self.assertEqual([r['dibuat_oleh_role'] for r in spv], ['spv'])
        kordiv = self.client.get(URL_TARGET, {'kategori': 'kordiv'}).data
        self.assertEqual([r['dibuat_oleh_role'] for r in kordiv], ['kordiv'])

    def test_admin_boleh_baca_semua_tapi_tidak_boleh_menulis(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get(URL_TARGET).data), 2)
        self.assertEqual(self.client.get('/api/export/laporan-produksi/').status_code, status.HTTP_200_OK)

        res = self.client.post(URL_TARGET, {
            'periode_tipe': 'harian', 'tanggal_mulai': '2026-10-19',
            'tanggal_selesai': '2026-10-19', 'target_selesai': 1,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        laporan = LaporanTargetProduksi.objects.first()
        self.assertEqual(self.client.patch(f'{URL_TARGET}{laporan.id}/', {'target_selesai': 99}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'{URL_TARGET}{laporan.id}/').status_code, 403)
        self.assertEqual(LaporanTargetProduksi.objects.count(), 2)
