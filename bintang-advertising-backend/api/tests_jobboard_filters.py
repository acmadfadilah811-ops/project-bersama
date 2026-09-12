"""Regresi: GET /api/jobs/ sebelumnya menarik SELURUH riwayat job (semua
status, semua waktu) tanpa filter apa pun -- job 'selesai' dari bulan/tahun
lalu tetap ikut tertarik, dan tanpa page/page_size OptionalPageNumberPagination
diam-diam berhenti di 1000 baris (job lebih lama hilang tanpa peringatan).
Kolom "Selesai Hari Ini" di Kanban Personal labelnya menjanjikan cuma hari
ini, padahal datanya semua job selesai sepanjang riwayat staff itu.

Diperbaiki dengan filter opsional di JobBoardViewSet.get_queryset():
status_pekerjaan (comma-separated), unassigned=true, mine=true, tahap,
date_from/date_to (pada waktu_selesai) -- SEMUA diterapkan SETELAH scoping
role yang sudah ada, jadi staff tetap tidak bisa lihat job staff lain/divisi
lain walau filter baru ini dipasang. Fitur redesign kanban 2026-09-07.
"""

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.machine_models import Mesin, PenggunaanMesin
from api.models import Divisi, TahapProses, JobBoard, Order, OrderItem
from api.permissions import get_subordinate_user_ids
from hr.models import Absensi

User = get_user_model()


class JobBoardFiltersTests(APITestCase):
    def setUp(self):
        self.divisi_a = Divisi.objects.create(nama='Divisi Filter A')
        self.divisi_b = Divisi.objects.create(nama='Divisi Filter B')
        self.tahap_a = TahapProses.objects.create(nama='Tahap Filter A', divisi=self.divisi_a, urutan=1)
        self.tahap_b = TahapProses.objects.create(nama='Tahap Filter B', divisi=self.divisi_b, urutan=1)

        self.staff_a = User.objects.create_user(
            username='staff_filter_a', password='pw12345', role='staff', divisi=self.divisi_a,
        )
        self.staff_a2 = User.objects.create_user(
            username='staff_filter_a2', password='pw12345', role='staff', divisi=self.divisi_a,
        )
        self.staff_b = User.objects.create_user(
            username='staff_filter_b', password='pw12345', role='staff', divisi=self.divisi_b,
        )
        self.owner = User.objects.create_user(username='owner_job_filter', password='pw12345', role='owner')

        # Staff A & B perlu clock-in hari ini supaya lolos IsClockedIn.
        today = timezone.localdate()
        Absensi.objects.create(staff=self.staff_a, tanggal=today, jam_masuk=timezone.now())
        Absensi.objects.create(staff=self.staff_a2, tanggal=today, jam_masuk=timezone.now())
        Absensi.objects.create(staff=self.staff_b, tanggal=today, jam_masuk=timezone.now())

        order = Order.objects.create(id='ORD-JOBFILTER-1', nomor_wa='08111111111', nama='Pelanggan Job Filter')
        self.item = OrderItem.objects.create(order=order, jenis_produk='Item Job Filter', qty=1, harga_jual=10000)

        now = timezone.now()

        # Milik staff_a: 1 antrean, 1 dikerjakan, 1 selesai HARI INI, 1 selesai 10 HARI LALU.
        self.job_a_antrean = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_a, pic_staff=self.staff_a, status_pekerjaan='antrean',
        )
        self.job_a_dikerjakan = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_a, pic_staff=self.staff_a, status_pekerjaan='dikerjakan',
        )
        self.job_a_selesai_hari_ini = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_a, pic_staff=self.staff_a, status_pekerjaan='selesai',
            waktu_selesai=now,
        )
        self.job_a_selesai_lama = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_a, pic_staff=self.staff_a, status_pekerjaan='selesai',
            waktu_selesai=now - timezone.timedelta(days=10),
        )

        # Unassigned di divisi A (claim pool staff_a).
        self.job_unassigned_a = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_a, pic_staff=None, status_pekerjaan='antrean',
        )
        # Unassigned di divisi B (claim pool staff_b, TIDAK boleh terlihat staff_a).
        self.job_unassigned_b = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_b, pic_staff=None, status_pekerjaan='antrean',
        )
        # Milik staff_a2 (rekan satu divisi, TIDAK boleh terlihat sebagai "mine" staff_a).
        self.job_a2 = JobBoard.objects.create(
            order_item=self.item, tahap=self.tahap_a, pic_staff=self.staff_a2, status_pekerjaan='antrean',
        )

    def test_status_pekerjaan_filter_comma_separated(self):
        self.client.force_authenticate(user=self.staff_a)
        res = self.client.get('/api/jobs/', {'status_pekerjaan': 'antrean,dikerjakan', 'mine': 'true'})
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_a_antrean.id, ids)
        self.assertIn(self.job_a_dikerjakan.id, ids)
        self.assertNotIn(self.job_a_selesai_hari_ini.id, ids)

    def test_unassigned_filter_scoped_to_own_divisi_only(self):
        """Claim pool: unassigned=true HARUS tetap kena scoping divisi yang
        sudah ada -- staff_a tidak boleh lihat job unassigned divisi B."""
        self.client.force_authenticate(user=self.staff_a)
        res = self.client.get('/api/jobs/', {'unassigned': 'true'})
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_unassigned_a.id, ids)
        self.assertNotIn(self.job_unassigned_b.id, ids)
        self.assertNotIn(self.job_a_antrean.id, ids)  # sudah assigned, bukan unassigned

    def test_mine_filter_excludes_rekan_satu_divisi(self):
        """mine=true HARUS cuma job pic_staff = user sendiri, bukan seluruh
        job yang terlihat di divisinya (termasuk milik staff_a2)."""
        self.client.force_authenticate(user=self.staff_a)
        res = self.client.get('/api/jobs/', {'mine': 'true'})
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_a_antrean.id, ids)
        self.assertNotIn(self.job_a2.id, ids)

    def test_tahap_filter(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get('/api/jobs/', {'tahap': 'Tahap Filter A'})
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_a_antrean.id, ids)
        self.assertNotIn(self.job_unassigned_b.id, ids)

    def test_date_from_membatasi_kolom_selesai_ke_hari_ini(self):
        """Kolom Selesai Kanban Personal: date_from=hari ini harus menyaring
        job selesai 10 hari lalu, cuma tampilkan yang selesai hari ini."""
        self.client.force_authenticate(user=self.staff_a)
        hari_ini = timezone.localdate().strftime('%Y-%m-%d')
        res = self.client.get('/api/jobs/', {
            'mine': 'true', 'status_pekerjaan': 'selesai',
            'date_from': hari_ini, 'date_to': hari_ini,
        })
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_a_selesai_hari_ini.id, ids)
        self.assertNotIn(self.job_a_selesai_lama.id, ids)

    def test_tanpa_filter_scoping_role_lama_tetap_utuh(self):
        """Regresi inti: tanpa filter baru sama sekali, perilaku lama (scoping
        role staff: job miliknya + unassigned di divisinya) tidak berubah."""
        self.client.force_authenticate(user=self.staff_a)
        res = self.client.get('/api/jobs/')
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {r['id'] for r in rows}
        self.assertIn(self.job_a_antrean.id, ids)
        self.assertIn(self.job_unassigned_a.id, ids)
        self.assertNotIn(self.job_unassigned_b.id, ids)
        self.assertNotIn(self.job_a2.id, ids)


class GetSubordinateUserIdsTests(APITestCase):
    """Unit test murni untuk get_subordinate_user_ids() (api/permissions.py)
    -- fitur hierarki atasan/bawahan untuk ringkasan kinerja tim SPV/Kordiv."""

    def test_tanpa_bawahan_hanya_diri_sendiri(self):
        user = User.objects.create_user(username='sendirian', password='pw12345', role='staff')
        self.assertEqual(get_subordinate_user_ids(user), {user.id})

    def test_rollup_berjenjang_multi_level(self):
        spv = User.objects.create_user(username='spv_rollup', password='pw12345', role='spv')
        kordiv = User.objects.create_user(username='kordiv_rollup', password='pw12345', role='kordiv', atasan=spv)
        staff = User.objects.create_user(username='staff_rollup', password='pw12345', role='staff', atasan=kordiv)
        self.assertEqual(get_subordinate_user_ids(spv), {spv.id, kordiv.id, staff.id})
        self.assertEqual(get_subordinate_user_ids(kordiv), {kordiv.id, staff.id})
        self.assertEqual(get_subordinate_user_ids(staff), {staff.id})

    def test_rantai_atasan_melingkar_tidak_infinite_loop(self):
        """Data cacat (atasan membentuk lingkaran) tidak boleh pernah terjadi
        secara normal, tapi helper harus tetap berhenti (dijaga cap 10
        iterasi), bukan macet selamanya."""
        a = User.objects.create_user(username='lingkar_a', password='pw12345', role='spv')
        b = User.objects.create_user(username='lingkar_b', password='pw12345', role='kordiv', atasan=a)
        a.atasan_id = b.id
        a.save(update_fields=['atasan'])
        hasil = get_subordinate_user_ids(a)
        self.assertEqual(hasil, {a.id, b.id})


class RingkasanTimEndpointTests(APITestCase):
    """GET /api/jobs/ringkasan-tim/ -- ringkasan kinerja tim (jumlah job per
    status + laporan pemakaian mesin) untuk akun SPV/Kordiv, mencakup seluruh
    bawahan di cabang organisasinya, tanpa membocorkan cabang lain."""

    def setUp(self):
        self.mesin = Mesin.objects.create(nama='DocuColor Ringkasan', tipe='docucolor')
        order = Order.objects.create(id='ORD-RINGKASAN-1', nomor_wa='08122222222', nama='Pelanggan Ringkasan')
        self.item = OrderItem.objects.create(order=order, jenis_produk='Item Ringkasan', qty=1, harga_jual=10000)

        # Cabang 1: spv1 -> kordiv1 -> staff1
        self.spv1 = User.objects.create_user(username='spv1_ringkasan', password='pw12345', role='spv')
        self.kordiv1 = User.objects.create_user(
            username='kordiv1_ringkasan', password='pw12345', role='kordiv', atasan=self.spv1,
        )
        self.staff1 = User.objects.create_user(
            username='staff1_ringkasan', password='pw12345', role='staff', atasan=self.kordiv1,
        )

        # Cabang 2, independen -- TIDAK boleh ikut kelihatan oleh cabang 1.
        self.spv2 = User.objects.create_user(username='spv2_ringkasan', password='pw12345', role='spv')
        self.kordiv2 = User.objects.create_user(
            username='kordiv2_ringkasan', password='pw12345', role='kordiv', atasan=self.spv2,
        )
        self.staff2 = User.objects.create_user(
            username='staff2_ringkasan', password='pw12345', role='staff', atasan=self.kordiv2,
        )

        self.staff_polos = User.objects.create_user(username='staff_polos_ringkasan', password='pw12345', role='staff')

        today = timezone.localdate()
        for u in (self.spv1, self.kordiv1, self.staff1, self.spv2, self.kordiv2, self.staff2, self.staff_polos):
            Absensi.objects.create(staff=u, tanggal=today, jam_masuk=timezone.now())

        # Cabang 1: 2 selesai, 1 gagal.
        JobBoard.objects.create(order_item=self.item, pic_staff=self.staff1, status_pekerjaan='selesai')
        JobBoard.objects.create(order_item=self.item, pic_staff=self.staff1, status_pekerjaan='selesai')
        JobBoard.objects.create(order_item=self.item, pic_staff=self.staff1, status_pekerjaan='gagal')
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff1, lembar_color=10, lembar_mono=5)

        # Cabang 2: 1 dikerjakan -- tidak boleh ikut terhitung di cabang 1.
        JobBoard.objects.create(order_item=self.item, pic_staff=self.staff2, status_pekerjaan='dikerjakan')
        PenggunaanMesin.objects.create(mesin=self.mesin, operator=self.staff2, lembar_color=99, lembar_mono=99)

    def test_kordiv_lihat_ringkasan_staff_langsungnya(self):
        self.client.force_authenticate(user=self.kordiv1)
        res = self.client.get('/api/jobs/ringkasan-tim/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['job_per_status'].get('selesai'), 2)
        self.assertEqual(res.data['job_per_status'].get('gagal'), 1)
        self.assertNotIn('dikerjakan', res.data['job_per_status'])
        self.assertEqual(res.data['pemakaian_mesin'][0]['total_lembar_color'], 10)

    def test_spv_lihat_rollup_dua_level(self):
        """SPV harus melihat gabungan seluruh cabangnya (lewat Kordiv sampai
        ke staff pelaksana), bukan cuma bawahan langsungnya."""
        self.client.force_authenticate(user=self.spv1)
        res = self.client.get('/api/jobs/ringkasan-tim/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['job_per_status'].get('selesai'), 2)
        self.assertEqual(res.data['job_per_status'].get('gagal'), 1)

    def test_cabang_berbeda_tidak_saling_terlihat(self):
        """Syarat bisnis inti: SPV cabang 1 tidak boleh melihat data cabang 2,
        dan sebaliknya."""
        self.client.force_authenticate(user=self.spv1)
        res = self.client.get('/api/jobs/ringkasan-tim/')
        self.assertNotIn('dikerjakan', res.data['job_per_status'])

        self.client.force_authenticate(user=self.spv2)
        res2 = self.client.get('/api/jobs/ringkasan-tim/')
        self.assertEqual(res2.data['job_per_status'].get('dikerjakan'), 1)
        self.assertNotIn('selesai', res2.data['job_per_status'])
        self.assertNotIn('gagal', res2.data['job_per_status'])

    def test_staff_biasa_ditolak(self):
        self.client.force_authenticate(user=self.staff_polos)
        res = self.client.get('/api/jobs/ringkasan-tim/')
        self.assertEqual(res.status_code, 403)
