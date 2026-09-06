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

from api.models import Divisi, TahapProses, JobBoard, Order, OrderItem
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
