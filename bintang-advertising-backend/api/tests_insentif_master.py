"""Master Jenis Insentif + rincian insentif per SPK (2026-09-30)."""

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .insentif_models import InsentifPekerjaan, JenisInsentif
from .models import Divisi, JobBoard, Order, OrderItem, TahapProses

User = get_user_model()


class InsentifBase(APITestCase):
    def setUp(self):
        self.d_desain = Divisi.objects.create(nama='Desain Insentif')
        self.d_cetak = Divisi.objects.create(nama='Cetak Insentif')
        self.t_desain = TahapProses.objects.create(nama='Tahap Desain Ins', divisi=self.d_desain, urutan=1)
        self.t_cetak = TahapProses.objects.create(nama='Tahap Cetak Ins', divisi=self.d_cetak, urutan=2)
        self.manager = User.objects.create_user(username='mgr_ins', password='pw12345', role='manager')
        self.staff = User.objects.create_user(username='stf_ins', password='pw12345', role='staff', divisi=self.d_desain)
        self.kasir = User.objects.create_user(username='ksr_ins', password='pw12345', role='kasir')
        self.jenis = JenisInsentif.objects.create(nama='Insentif Desain', nominal_default=10000)
        self.jenis.divisi.add(self.d_desain)
        self.order = Order.objects.create(id='ORD-INS-M1', nomor_wa='08188888888', nama='Pelanggan Ins')
        self.item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1, harga_jual=50000)

    def assign(self, user=None, **data):
        self.client.force_authenticate(user or self.manager)
        return self.client.post(f'/api/orders/{self.order.id}/assign/', data, format='json')


class MasterJenisInsentifTests(InsentifBase):
    def test_matriks_role(self):
        payload = {'nama': 'Insentif Cetak', 'nominal_default': 5000, 'divisi': [self.d_cetak.id]}
        for user in (self.staff, self.kasir):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post('/api/jenis-insentif/', payload, format='json').status_code, 403)
            self.assertEqual(self.client.get('/api/jenis-insentif/').status_code, 403)
        self.client.force_authenticate(self.manager)
        res = self.client.post('/api/jenis-insentif/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['divisi_nama'], ['Cetak Insentif'])
        self.assertEqual(self.client.get('/api/jenis-insentif/').status_code, 200)

    def test_nama_unik(self):
        self.client.force_authenticate(self.manager)
        res = self.client.post('/api/jenis-insentif/', {'nama': 'Insentif Desain', 'nominal_default': 1}, format='json')
        self.assertEqual(res.status_code, 400)


class InsentifOtomatisSpkTests(InsentifBase):
    def test_spk_ke_divisi_target_otomatis_dapat_insentif(self):
        res = self.assign(divisi_id=self.d_desain.id)
        self.assertEqual(res.status_code, 200, res.content)
        job = JobBoard.objects.get(order_item=self.item, tahap=self.t_desain)
        self.assertEqual(job.insentif, 10000)
        baris = job.rincian_insentif.get()
        self.assertEqual((baris.nama, baris.nominal, baris.otomatis), ('Insentif Desain', 10000, True))

    def test_divisi_lain_dan_jenis_nonaktif_tidak_ikut(self):
        self.jenis.aktif = False
        self.jenis.save()
        self.assign(divisi_id=self.d_desain.id)
        self.assertEqual(JobBoard.objects.get(order_item=self.item, tahap=self.t_desain).insentif, 0)
        self.jenis.aktif = True
        self.jenis.save()
        self.assign(divisi_id=self.d_cetak.id)
        self.assertEqual(JobBoard.objects.get(order_item=self.item, tahap=self.t_cetak).insentif, 0)

    def test_terbit_ulang_idempotent_dan_nominal_kustom_tidak_ditimpa(self):
        self.assign(divisi_id=self.d_desain.id)
        job = JobBoard.objects.get(order_item=self.item, tahap=self.t_desain)
        baris = job.rincian_insentif.get()
        self.client.patch(f'/api/insentif-pekerjaan/{baris.id}/', {'nominal': 25000}, format='json')
        self.assign(divisi_id=self.d_desain.id)
        job.refresh_from_db()
        self.assertEqual(job.rincian_insentif.count(), 1)
        self.assertEqual(job.insentif, 25000)

    def test_angka_manual_saat_terbit_ditambah_baris_otomatis(self):
        self.assign(divisi_id=self.d_desain.id, insentif=30000)
        job = JobBoard.objects.get(order_item=self.item, tahap=self.t_desain)
        self.assertEqual(job.insentif, 40000)
        self.assertEqual(job.rincian_insentif.count(), 2)

    def test_kasir_terbitkan_spk_tetap_dapat_otomatis_tapi_tanpa_manual(self):
        self.assign(user=self.kasir, divisi_id=self.d_desain.id, insentif=30000)
        self.assertEqual(JobBoard.objects.get(order_item=self.item, tahap=self.t_desain).insentif, 10000)

    def test_staff_pic_melihat_rincian_di_data_spk(self):
        self.assign(staff_id=self.staff.id, tahap_id=self.t_desain.id)
        Absensi.objects.create(staff=self.staff, tanggal=timezone.localdate(), jam_masuk=timezone.now())
        self.client.force_authenticate(self.staff)
        job_id = JobBoard.objects.get(order_item=self.item, tahap=self.t_desain).id
        res = self.client.get(f'/api/jobs/{job_id}/')
        self.assertEqual(res.status_code, 200, res.content)
        job = res.data
        self.assertEqual([(r['nama'], r['nominal']) for r in job['rincian_insentif']], [('Insentif Desain', 10000)])


class InsentifManualTests(InsentifBase):
    def setUp(self):
        super().setUp()
        self.job = JobBoard.objects.create(order_item=self.item, tahap=self.t_cetak, pic_staff=self.staff)
        self.jenis_lain = JenisInsentif.objects.create(nama='Bonus Lembur', nominal_default=15000)

    def test_tambah_dari_master_nominal_default_lalu_kustom(self):
        self.client.force_authenticate(self.manager)
        res = self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'jenis_id': self.jenis_lain.id}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['insentif'], 15000)
        res = self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'nama': 'Kerja malam', 'nominal': 5000}, format='json')
        self.assertEqual(res.data['insentif'], 20000)
        id_baris = res.data['rincian_insentif'][0]['id']
        res = self.client.patch(f'/api/insentif-pekerjaan/{id_baris}/', {'nominal': 40000}, format='json')
        self.assertEqual(res.data['insentif'], 45000)
        res = self.client.delete(f'/api/insentif-pekerjaan/{id_baris}/')
        self.assertEqual(res.data['insentif'], 5000)
        self.job.refresh_from_db()
        self.assertEqual(self.job.insentif, 5000)

    def test_jenis_sama_dua_kali_ditolak(self):
        self.client.force_authenticate(self.manager)
        self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'jenis_id': self.jenis_lain.id}, format='json')
        res = self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'jenis_id': self.jenis_lain.id}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_staff_dan_kasir_tidak_boleh(self):
        baris = InsentifPekerjaan.objects.create(job=self.job, nama='X', nominal=1)
        for user in (self.staff, self.kasir):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'nama': 'A', 'nominal': 1}, format='json').status_code, 403)
            self.assertEqual(self.client.patch(f'/api/insentif-pekerjaan/{baris.id}/', {'nominal': 999}, format='json').status_code, 403)
            self.assertEqual(self.client.delete(f'/api/insentif-pekerjaan/{baris.id}/').status_code, 403)
        baris.refresh_from_db()
        self.assertEqual(baris.nominal, 1)

    def test_nominal_negatif_atau_bukan_angka_ditolak(self):
        self.client.force_authenticate(self.manager)
        for nilai in (-5, 'abc'):
            res = self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'nama': 'A', 'nominal': nilai}, format='json')
            self.assertEqual(res.status_code, 400, nilai)

    def test_spk_selesai_terkunci(self):
        baris = InsentifPekerjaan.objects.create(job=self.job, nama='X', nominal=100)
        JobBoard.objects.filter(pk=self.job.pk).update(status_pekerjaan='selesai', insentif=100)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.post(f'/api/jobs/{self.job.id}/insentif/', {'nama': 'A', 'nominal': 1}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/insentif-pekerjaan/{baris.id}/', {'nominal': 5}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(f'/api/insentif-pekerjaan/{baris.id}/').status_code, 400)

    def test_patch_total_insentif_lewat_jobs_jadi_baris_manual(self):
        InsentifPekerjaan.objects.create(job=self.job, nama='Otomatis', nominal=10000, otomatis=True)
        self.job.insentif = 10000
        self.job.save(update_fields=['insentif'])
        self.client.force_authenticate(self.manager)
        res = self.client.patch(f'/api/jobs/{self.job.id}/', {'insentif': 70000}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.job.refresh_from_db()
        self.assertEqual(self.job.insentif, 70000)
        self.assertEqual(self.job.rincian_insentif.get(nama='Insentif manual').nominal, 60000)

    def test_kirim_ulang_insentif_yang_sama_di_spk_selesai_tidak_error(self):
        JobBoard.objects.filter(pk=self.job.pk).update(status_pekerjaan='selesai', insentif=100)
        self.client.force_authenticate(self.manager)
        res = self.client.patch(f'/api/jobs/{self.job.id}/', {'insentif': 100, 'catatan_staff': []}, format='json')
        self.assertEqual(res.status_code, 200, res.content)

    def test_job_dibuat_langsung_dengan_insentif_tetap_konsisten(self):
        job = JobBoard.objects.create(order_item=self.item, tahap=self.t_desain, insentif=5000)
        job.refresh_from_db()
        self.assertEqual(job.insentif, 15000)  # 5000 manual + 10000 otomatis (divisi desain)
