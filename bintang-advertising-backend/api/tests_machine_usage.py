"""Test API Penggunaan Mesin (Mesin, PenggunaanMesin, MaintenanceMesin) --
lihat api/machine_models.py dan api/views/machine.py untuk konteks lengkap
fitur ini (disetujui user 2026-09-07)."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Divisi, JobBoard, Mesin, Order, OrderItem, PenggunaanMesin, MaintenanceMesin, TahapProses
from hr.models import Absensi

User = get_user_model()


class MesinViewSetTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_mesin', password='pw12345', role='owner')
        self.staff = User.objects.create_user(username='staff_mesin', password='pw12345', role='staff')
        self.mesin = Mesin.objects.create(nama='DocuColor 1', tipe='docucolor', ambang_servis_klik=50000)

    def test_staff_bisa_baca_daftar_mesin(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/mesin/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_dilarang_membuat_mesin(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/mesin/', {'nama': 'Banner 1', 'tipe': 'cetak_banner'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_membuat_mesin(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/mesin/', {'nama': 'Printer 1', 'tipe': 'printer'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Mesin.objects.count(), 2)

    def test_owner_bisa_daftarkan_tipe_mesin_baru_bebas(self):
        """`tipe` bebas teks (bukan choices tetap) -- owner bisa daftarkan
        tipe mesin yang belum pernah ada di kode sama sekali (bug dilaporkan
        user 2026-09-09: dulu cuma bisa pilih 3 tipe hardcode)."""
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/mesin/', {
            'nama': 'Laminating 1', 'tipe': 'Mesin Laminating', 'basis_pencatatan': 'lainnya',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['tipe'], 'Mesin Laminating')
        self.assertEqual(res.data['tipe_display'], 'Mesin Laminating')  # tidak ada preset -> apa adanya
        self.assertEqual(res.data['basis_pencatatan'], 'lainnya')

    def test_tipe_display_preset_tetap_pakai_label_rapi(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/mesin/{self.mesin.id}/')
        self.assertEqual(res.data['tipe_display'], 'Fuji Xerox DocuColor')

    def test_field_vendor_menggantikan_lokasi(self):
        """`lokasi` diganti jadi `vendor` (instruksi user 2026-09-09)."""
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/mesin/', {
            'nama': 'Printer Vendor Test', 'tipe': 'printer', 'vendor': 'PT Sumber Tinta Jaya',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['vendor'], 'PT Sumber Tinta Jaya')
        self.assertNotIn('lokasi', res.data)

    def test_jadwal_servis_bulanan_perlu_servis_setelah_sebulan(self):
        mesin = Mesin.objects.create(
            nama='DocuColor Jadwal', tipe='docucolor', jadwal_servis_interval='bulanan',
        )
        MaintenanceMesin.objects.create(
            mesin=mesin, jenis='Servis Rutin', tanggal=timezone.localdate() - timezone.timedelta(days=40),
        )
        self.assertTrue(mesin.perlu_servis_jadwal)
        self.assertTrue(mesin.perlu_servis)

    def test_jadwal_servis_belum_jatuh_tempo(self):
        mesin = Mesin.objects.create(
            nama='DocuColor Jadwal 2', tipe='docucolor', jadwal_servis_interval='bulanan',
        )
        MaintenanceMesin.objects.create(
            mesin=mesin, jenis='Servis Rutin', tanggal=timezone.localdate() - timezone.timedelta(days=5),
        )
        self.assertFalse(mesin.perlu_servis_jadwal)
        self.assertFalse(mesin.perlu_servis)

    def test_jadwal_servis_custom_bulan(self):
        mesin = Mesin.objects.create(
            nama='Banner Jadwal Custom', tipe='cetak_banner',
            jadwal_servis_interval='custom_bulan', jadwal_servis_custom_bulan=3,
        )
        MaintenanceMesin.objects.create(
            mesin=mesin, jenis='Servis Rutin', tanggal=timezone.localdate() - timezone.timedelta(days=100),
        )
        self.assertTrue(mesin.perlu_servis_jadwal)

    def test_tanpa_jadwal_servis_tidak_perlu_servis_dari_waktu(self):
        self.assertIsNone(self.mesin.jadwal_servis_berikutnya)
        self.assertFalse(self.mesin.perlu_servis_jadwal)

    def test_total_klik_dan_perlu_servis(self):
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=100, lembar_mono=200)
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=49800, lembar_mono=0)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/mesin/{self.mesin.id}/')
        self.assertEqual(res.data['total_klik'], 50100)
        self.assertTrue(res.data['perlu_servis'])

    def test_klik_sejak_servis_terakhir_reset_setelah_maintenance(self):
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=60000, lembar_mono=0)
        MaintenanceMesin.objects.create(mesin=self.mesin, jenis='Servis Rutin', counter_saat_servis=60000)
        PenggunaanMesin.objects.create(mesin=self.mesin, lembar_color=1000, lembar_mono=0)

        self.mesin.refresh_from_db()
        self.assertEqual(self.mesin.total_klik, 61000)
        self.assertEqual(self.mesin.klik_sejak_servis_terakhir, 1000)
        self.assertFalse(self.mesin.perlu_servis)


class PenggunaanMesinViewSetTest(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='staff_log', password='pw12345', role='staff')
        self.staff2 = User.objects.create_user(username='staff_log2', password='pw12345', role='staff')
        self.owner = User.objects.create_user(username='owner_log', password='pw12345', role='owner')
        self.mesin = Mesin.objects.create(nama='DocuColor 2', tipe='docucolor')

    def test_staff_bisa_mencatat_penggunaan(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/penggunaan-mesin/', {
            'mesin': self.mesin.id, 'lembar_color': 10, 'lembar_mono': 5,
            'kondisi_hasil': 'ok', 'catatan_konfirmasi': 'Sesuai pesanan',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        entri = PenggunaanMesin.objects.get(id=res.data['id'])
        self.assertEqual(entri.operator, self.staff)

    def test_staff_boleh_edit_entri_sendiri(self):
        self.client.force_authenticate(user=self.staff)
        create_res = self.client.post('/api/penggunaan-mesin/', {
            'mesin': self.mesin.id, 'lembar_color': 10, 'lembar_mono': 5,
        })
        entri_id = create_res.data['id']

        res = self.client.patch(f'/api/penggunaan-mesin/{entri_id}/', {'lembar_color': 12})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_dilarang_edit_entri_staff_lain(self):
        entri = PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff2, lembar_color=10)

        self.client.force_authenticate(user=self.staff)
        res = self.client.patch(f'/api/penggunaan-mesin/{entri.id}/', {'lembar_color': 99})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_boleh_edit_entri_siapa_pun(self):
        entri = PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=10)

        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(f'/api/penggunaan-mesin/{entri.id}/', {'lembar_color': 20})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_filter_by_mesin(self):
        mesin_lain = Mesin.objects.create(nama='Printer 3', tipe='printer')
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=1)
        PenggunaanMesin.objects.create(mesin=mesin_lain, operator=self.staff, lembar_color=2)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/penggunaan-mesin/?mesin={self.mesin.id}')
        self.assertEqual(res.data['count'] if isinstance(res.data, dict) and 'count' in res.data else len(res.data), 1)

    def test_filter_by_operator(self):
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=1)
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff2, lembar_color=2)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f'/api/penggunaan-mesin/?operator={self.staff.id}')
        rows = res.data['results'] if isinstance(res.data, dict) and 'results' in res.data else res.data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['operator'], self.staff.id)

    def test_ringkasan_staff_akurat_per_operator(self):
        mesin_banner = Mesin.objects.create(nama='Banner 3', tipe='cetak_banner', basis_pencatatan='meter')
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=10, lembar_mono=5)
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=20, lembar_mono=0)
        PenggunaanMesin.objects.create(mesin=mesin_banner, operator=self.staff2, panjang_bahan_meter=3.5)

        self.client.force_authenticate(user=self.owner)
        res = self.client.get('/api/penggunaan-mesin/ringkasan-staff/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        by_operator = {row['operator_id']: row for row in res.data}

        self.assertEqual(by_operator[self.staff.id]['total_klik'], 35)
        self.assertEqual(by_operator[self.staff.id]['jumlah_entri'], 2)
        self.assertEqual(by_operator[self.staff2.id]['total_meter'], 3.5)

    def test_ringkasan_staff_ditolak_untuk_staff(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/penggunaan-mesin/ringkasan-staff/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_excel_owner_berhasil(self):
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff, lembar_color=5, lembar_mono=2)
        self.client.force_authenticate(user=self.owner)
        res = self.client.get('/api/penggunaan-mesin/export/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

    def test_export_excel_ditolak_untuk_staff(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/penggunaan-mesin/export/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class JobBoardPenggunaanMesinRingkasTest(APITestCase):
    """penggunaan_mesin_ringkas di JobBoardSerializer -- riwayat pekerjaan
    staff (Kanban Personal, job 'selesai') harus ikut menampilkan mesin apa
    yang dipakai untuk job itu (fitur 2026-09-09)."""

    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi Mesin Ringkas')
        self.tahap = TahapProses.objects.create(nama='Tahap Mesin Ringkas', divisi=self.divisi, urutan=1)
        self.staff = User.objects.create_user(
            username='staff_ringkas_mesin', password='pw12345', role='staff', divisi=self.divisi,
        )
        Absensi.objects.create(staff=self.staff, tanggal=timezone.localdate(), jam_masuk=timezone.now())
        order = Order.objects.create(id='ORD-MESIN-RINGKAS-1', nomor_wa='08122222222', nama='Pelanggan Mesin Ringkas')
        item = OrderItem.objects.create(order=order, jenis_produk='Item Mesin Ringkas', qty=1, harga_jual=10000)
        self.job = JobBoard.objects.create(
            order_item=item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan='selesai',
        )
        self.mesin = Mesin.objects.create(nama='DocuColor Ringkas', tipe='docucolor')
        PenggunaanMesin.objects.create(
            mesin=self.mesin, job=self.job, operator=self.staff, lembar_color=15, lembar_mono=3,
        )

    def test_job_menampilkan_ringkasan_penggunaan_mesin(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(f'/api/jobs/{self.job.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ringkas = res.data['penggunaan_mesin_ringkas']
        self.assertEqual(len(ringkas), 1)
        self.assertEqual(ringkas[0]['mesin_nama'], 'DocuColor Ringkas')
        self.assertEqual(ringkas[0]['detail'], '15 color / 3 mono')

    def test_job_tanpa_penggunaan_mesin_kembalikan_list_kosong(self):
        job_kosong = JobBoard.objects.create(
            order_item=self.job.order_item, tahap=self.tahap, pic_staff=self.staff, status_pekerjaan='antrean',
        )
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(f'/api/jobs/{job_kosong.id}/')
        self.assertEqual(res.data['penggunaan_mesin_ringkas'], [])


class MaintenanceMesinViewSetTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_maint', password='pw12345', role='owner')
        self.staff = User.objects.create_user(username='staff_maint', password='pw12345', role='staff')
        self.mesin = Mesin.objects.create(nama='Banner 2', tipe='cetak_banner')

    def test_staff_bisa_baca_riwayat_maintenance(self):
        MaintenanceMesin.objects.create(mesin=self.mesin, jenis='Ganti Pisau Potong')

        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/maintenance-mesin/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_staff_dilarang_mencatat_maintenance(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/maintenance-mesin/', {'mesin': self.mesin.id, 'jenis': 'Servis Rutin'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_bisa_mencatat_maintenance(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/maintenance-mesin/', {'mesin': self.mesin.id, 'jenis': 'Servis Rutin'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MaintenanceMesin.objects.get(id=res.data['id']).dicatat_oleh, self.owner)
