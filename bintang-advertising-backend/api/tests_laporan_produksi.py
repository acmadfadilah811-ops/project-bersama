"""Laporan Produksi SPV & Kordiv: target & kendala operasional (input
manual) + ringkasan data produksi nyata dari JobBoard. Instruksi user
2026-09-23, 5 kriteria UAT: data nyata (bukan dummy), bisa dibuat SPV,
jumlah selesai harus cocok dengan modul produksi, filter tanggal, scoping
per divisi. Diperluas ke Kordiv 2026-09-24."""
import datetime

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Divisi, TahapProses, JobBoard, Order, OrderItem

User = get_user_model()


class LaporanTargetProduksiTests(APITestCase):
    def setUp(self):
        self.divisi_a = Divisi.objects.create(nama='Divisi A LTP')
        self.divisi_b = Divisi.objects.create(nama='Divisi B LTP')
        self.tahap_a = TahapProses.objects.create(nama='Cetak A', divisi=self.divisi_a, urutan=1)
        self.tahap_b = TahapProses.objects.create(nama='Cetak B', divisi=self.divisi_b, urutan=1)

        self.owner = User.objects.create_user(username='owner_ltp', password='secret', role='owner')
        self.spv = User.objects.create_user(username='spv_ltp', password='secret', role='spv')
        self.spv_lain = User.objects.create_user(username='spv_lain_ltp', password='secret', role='spv')
        self.staff_a = User.objects.create_user(
            username='staff_a_ltp', password='secret', role='staff', divisi=self.divisi_a, atasan=self.spv,
        )
        self.staff_b = User.objects.create_user(
            username='staff_b_ltp', password='secret', role='staff', divisi=self.divisi_b, atasan=self.spv_lain,
        )
        self.staff_biasa = User.objects.create_user(username='staff_biasa_ltp', password='secret', role='staff')

    def _buat_job_selesai(self, tahap, pic, waktu_selesai):
        order = Order.objects.create(nama='Pelanggan LTP', nomor_wa='08123456789')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=10000)
        return JobBoard.objects.create(
            order_item=item, tahap=tahap, pic_staff=pic,
            status_pekerjaan='selesai', waktu_mulai=waktu_selesai, waktu_selesai=waktu_selesai,
        )

    def test_spv_bisa_buat_laporan_untuk_divisi_tim_sendiri(self):
        self.client.force_authenticate(self.spv)
        res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_a.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23',
            'target_selesai': 10, 'kendala_operasional': 'Mesin cetak rusak setengah hari.',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['dibuat_oleh'], self.spv.id)

    def test_spv_tidak_bisa_buat_laporan_untuk_divisi_di_luar_timnya(self):
        self.client.force_authenticate(self.spv)
        res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_b.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23',
            'target_selesai': 5,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_tidak_bisa_membuat_laporan(self):
        self.client.force_authenticate(self.staff_biasa)
        res = self.client.post('/api/laporan-produksi/target/', {
            'periode_tipe': 'harian', 'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_buat_laporan_untuk_divisi_mana_pun(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_b.id, 'periode_tipe': 'bulanan',
            'tanggal_mulai': '2026-09-01', 'tanggal_selesai': '2026-09-30',
            'target_selesai': 100,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_spv_hanya_lihat_laporan_sendiri_dan_divisi_timnya(self):
        laporan_spv = self.divisi_a
        self.client.force_authenticate(self.spv)
        self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_a.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23', 'target_selesai': 10,
        }, format='json')

        self.client.force_authenticate(self.spv_lain)
        self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_b.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23', 'target_selesai': 8,
        }, format='json')

        self.client.force_authenticate(self.spv)
        res = self.client.get('/api/laporan-produksi/target/')
        hasil = res.data['results'] if isinstance(res.data, dict) else res.data
        divisi_ids = {row['divisi'] for row in hasil}
        self.assertEqual(divisi_ids, {self.divisi_a.id})

    def test_owner_lihat_semua_laporan(self):
        self.client.force_authenticate(self.spv)
        self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_a.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23', 'target_selesai': 10,
        }, format='json')
        self.client.force_authenticate(self.spv_lain)
        self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_b.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23', 'target_selesai': 8,
        }, format='json')

        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/laporan-produksi/target/')
        hasil = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(hasil), 2)

    def test_jumlah_selesai_aktual_cocok_dengan_jobboard(self):
        """Kriteria UAT paling penting: angka di laporan HARUS sama dengan
        hitungan nyata dari JobBoard, bukan angka yang diketik manual."""
        waktu = timezone.make_aware(datetime.datetime(2026, 9, 23, 10, 0))
        self._buat_job_selesai(self.tahap_a, self.staff_a, waktu)
        self._buat_job_selesai(self.tahap_a, self.staff_a, waktu)
        self._buat_job_selesai(self.tahap_b, self.staff_b, waktu)  # divisi lain, tidak boleh ikut terhitung

        self.client.force_authenticate(self.spv)
        create_res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_a.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23', 'target_selesai': 5,
        }, format='json')
        laporan_id = create_res.data['id']

        res = self.client.get(f'/api/laporan-produksi/target/{laporan_id}/')
        self.assertEqual(res.data['jumlah_selesai_aktual'], 2)
        self.assertEqual(res.data['capaian_persen'], 40.0)

    def test_spv_lain_tidak_bisa_edit_laporan_spv_lain(self):
        self.client.force_authenticate(self.spv)
        res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_a.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-23', 'tanggal_selesai': '2026-09-23', 'target_selesai': 10,
        }, format='json')
        laporan_id = res.data['id']

        self.client.force_authenticate(self.spv_lain)
        # spv_lain tidak lihat laporan ini di queryset-nya (divisi A bukan
        # timnya) -- get_object() 404, bukan 403 (tidak pernah "ditemukan").
        res_edit = self.client.patch(f'/api/laporan-produksi/target/{laporan_id}/', {'target_selesai': 999}, format='json')
        self.assertEqual(res_edit.status_code, status.HTTP_404_NOT_FOUND)


class RingkasanProduksiSpvViewTests(APITestCase):
    def setUp(self):
        self.divisi_a = Divisi.objects.create(nama='Divisi A Ringkasan')
        self.divisi_b = Divisi.objects.create(nama='Divisi B Ringkasan')
        self.tahap_a = TahapProses.objects.create(nama='Cetak A Ringkasan', divisi=self.divisi_a, urutan=1)
        self.tahap_b = TahapProses.objects.create(nama='Cetak B Ringkasan', divisi=self.divisi_b, urutan=1)

        self.owner = User.objects.create_user(username='owner_ringkasan_ltp', password='secret', role='owner')
        self.spv = User.objects.create_user(username='spv_ringkasan_ltp', password='secret', role='spv')
        self.staff_a = User.objects.create_user(
            username='staff_a_ringkasan_ltp', password='secret', role='staff', divisi=self.divisi_a, atasan=self.spv,
        )
        self.staff_b = User.objects.create_user(
            username='staff_b_ringkasan_ltp', password='secret', role='staff', divisi=self.divisi_b,
        )
        self.staff_biasa = User.objects.create_user(username='staff_biasa_ringkasan_ltp', password='secret', role='staff')

    def _buat_job_selesai(self, tahap, pic, waktu_selesai):
        order = Order.objects.create(nama='Pelanggan Ringkasan', nomor_wa='08123456780')
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=10000)
        return JobBoard.objects.create(
            order_item=item, tahap=tahap, pic_staff=pic,
            status_pekerjaan='selesai', waktu_mulai=waktu_selesai, waktu_selesai=waktu_selesai,
        )

    def test_staff_tidak_bisa_akses(self):
        self.client.force_authenticate(self.staff_biasa)
        res = self.client.get('/api/laporan-produksi/ringkasan/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_spv_hanya_lihat_data_tim_sendiri(self):
        waktu = timezone.make_aware(datetime.datetime(2026, 9, 23, 9, 0))
        self._buat_job_selesai(self.tahap_a, self.staff_a, waktu)
        self._buat_job_selesai(self.tahap_b, self.staff_b, waktu)

        self.client.force_authenticate(self.spv)
        res = self.client.get('/api/laporan-produksi/ringkasan/', {
            'tanggal_dari': '2026-09-23', 'tanggal_sampai': '2026-09-23',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['jumlah_selesai'], 1)

    def test_owner_lihat_semua_divisi(self):
        waktu = timezone.make_aware(datetime.datetime(2026, 9, 23, 9, 0))
        self._buat_job_selesai(self.tahap_a, self.staff_a, waktu)
        self._buat_job_selesai(self.tahap_b, self.staff_b, waktu)

        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/laporan-produksi/ringkasan/', {
            'tanggal_dari': '2026-09-23', 'tanggal_sampai': '2026-09-23',
        })
        self.assertEqual(res.data['jumlah_selesai'], 2)
        self.assertEqual(len(res.data['per_divisi']), 2)

    def test_default_rentang_hari_ini_kalau_tidak_diisi(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/laporan-produksi/ringkasan/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        today = timezone.localdate()
        self.assertEqual(res.data['tanggal_dari'], today)
        self.assertEqual(res.data['tanggal_sampai'], today)

    def test_job_di_luar_rentang_tanggal_tidak_ikut_terhitung(self):
        waktu_lama = timezone.make_aware(datetime.datetime(2026, 8, 1, 9, 0))
        self._buat_job_selesai(self.tahap_a, self.staff_a, waktu_lama)

        self.client.force_authenticate(self.spv)
        res = self.client.get('/api/laporan-produksi/ringkasan/', {
            'tanggal_dari': '2026-09-23', 'tanggal_sampai': '2026-09-23',
        })
        self.assertEqual(res.data['jumlah_selesai'], 0)


class ExportLaporanProduksiTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Export LTP')
        self.owner = User.objects.create_user(username='owner_export_ltp', password='secret', role='owner')
        self.spv = User.objects.create_user(username='spv_export_ltp', password='secret', role='spv')
        self.staff_biasa = User.objects.create_user(username='staff_export_ltp', password='secret', role='staff')

    def test_staff_tidak_bisa_export(self):
        self.client.force_authenticate(self.staff_biasa)
        res = self.client.get('/api/export/laporan-produksi/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_export_dapat_file_xlsx(self):
        from api.laporan_produksi_models import LaporanTargetProduksi
        LaporanTargetProduksi.objects.create(
            dibuat_oleh=self.spv, divisi=self.divisi, periode_tipe='harian',
            tanggal_mulai='2026-09-23', tanggal_selesai='2026-09-23', target_selesai=10,
            kendala_operasional='Listrik padam 2 jam.',
        )
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/export/laporan-produksi/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )


class LaporanTargetProduksiKordivTests(APITestCase):
    """Kordiv diperluas ke fitur ini 2026-09-24 (sebelumnya SPV saja) --
    perilakunya harus sama persis: dibatasi ke divisi tim bawahannya
    sendiri, lewat get_subordinate_divisi_ids() yang sama."""

    def setUp(self):
        self.divisi_a = Divisi.objects.create(nama='Divisi A LTP Kordiv')
        self.divisi_b = Divisi.objects.create(nama='Divisi B LTP Kordiv')
        self.tahap_a = TahapProses.objects.create(nama='Cetak A Kordiv', divisi=self.divisi_a, urutan=1)
        self.kordiv = User.objects.create_user(
            username='kordiv_ltp', password='secret', role='kordiv', divisi=self.divisi_a,
        )
        self.kordiv_lain = User.objects.create_user(
            username='kordiv_lain_ltp', password='secret', role='kordiv', divisi=self.divisi_b,
        )
        self.staff_a = User.objects.create_user(
            username='staff_a_ltp_kordiv', password='secret', role='staff', divisi=self.divisi_a, atasan=self.kordiv,
        )

    def test_kordiv_bisa_buat_laporan_untuk_divisinya(self):
        self.client.force_authenticate(self.kordiv)
        res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_a.id, 'periode_tipe': 'mingguan',
            'tanggal_mulai': '2026-09-21', 'tanggal_selesai': '2026-09-27', 'target_selesai': 20,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['dibuat_oleh'], self.kordiv.id)

    def test_kordiv_tidak_bisa_buat_laporan_untuk_divisi_lain(self):
        self.client.force_authenticate(self.kordiv)
        res = self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_b.id, 'periode_tipe': 'mingguan',
            'tanggal_mulai': '2026-09-21', 'tanggal_selesai': '2026-09-27', 'target_selesai': 20,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_kordiv_hanya_lihat_laporan_divisinya_sendiri(self):
        self.client.force_authenticate(self.kordiv_lain)
        self.client.post('/api/laporan-produksi/target/', {
            'divisi': self.divisi_b.id, 'periode_tipe': 'harian',
            'tanggal_mulai': '2026-09-24', 'tanggal_selesai': '2026-09-24', 'target_selesai': 5,
        }, format='json')

        self.client.force_authenticate(self.kordiv)
        res = self.client.get('/api/laporan-produksi/target/')
        hasil = res.data['results'] if isinstance(res.data, dict) else res.data
        divisi_ids = {row['divisi'] for row in hasil}
        self.assertNotIn(self.divisi_b.id, divisi_ids)

    def test_kordiv_bisa_export(self):
        self.client.force_authenticate(self.kordiv)
        res = self.client.get('/api/export/laporan-produksi/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
