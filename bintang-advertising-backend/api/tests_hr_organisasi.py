"""Jembatan HR -> Bintang: Departemen -> Divisi, Peran Jabatan -> Tahap Proses,
dan staff baru otomatis masuk divisi departemennya (2026-09-30)."""
import os
from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import CustomUser, Divisi, TahapProses, UnitBisnis

URL = '/api/bridge/hr-organisasi/'


class HROrganisasiBridgeTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle 30/menit dibagi antar tes
        env = mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)
        self.adv, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising')

    def post(self, payload, key='kunci-uji'):
        return self.client.post(URL, payload, format='json', HTTP_X_API_KEY=key, HTTP_X_FORWARDED_PROTO='https')

    def dept(self, hr_id=3, nama='Digital Printing', **extra):
        return self.post({'jenis': 'departemen', 'hr_id': hr_id, 'nama': nama, **extra})

    def peran(self, hr_id=9, nama='Operator', **extra):
        payload = {
            'jenis': 'peran_jabatan', 'hr_id': hr_id, 'nama': nama, 'jabatan': 'Operator A3',
            'departemen': 'Digital Printing', 'departemen_hr_id': 3,
        }
        return self.post({**payload, **extra})

    def test_api_key_salah_ditolak(self):
        self.assertEqual(self.dept().status_code, 200)
        self.assertEqual(self.post({'jenis': 'departemen', 'hr_id': 1, 'nama': 'X'}, key='salah').status_code, 401)

    def test_departemen_baru_jadi_divisi_dengan_unit_bisnis(self):
        res = self.dept()
        self.assertEqual(res.status_code, 200, res.content)
        divisi = Divisi.objects.get(hr_department_id=3)
        self.assertEqual(divisi.nama, 'Digital Printing')
        self.assertEqual(divisi.unit_bisnis, self.adv)

    def test_unit_bisnis_pilihan_hr_dipakai_dan_menimpa_pemetaan_bawaan(self):
        foto, _ = UnitBisnis.objects.get_or_create(nama='StarFoto')
        res = self.dept(hr_id=30, nama='Departemen Baru', unit_bisnis='StarFoto')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(Divisi.objects.get(hr_department_id=30).unit_bisnis, foto)
        # HR mengganti pilihan -> divisi ikut pindah unit
        self.dept(hr_id=30, nama='Departemen Baru', unit_bisnis='Star Advertising')
        self.assertEqual(Divisi.objects.get(hr_department_id=30).unit_bisnis, self.adv)

    def test_tanpa_pilihan_hr_tidak_menghapus_unit_yang_ada(self):
        self.dept(hr_id=31, nama='Fotografi')  # pemetaan bawaan -> StarFoto (unit dibuat bila belum ada)
        divisi = Divisi.objects.get(hr_department_id=31)
        divisi.unit_bisnis = self.adv
        divisi.save()
        self.dept(hr_id=31, nama='Fotografi')
        self.assertEqual(Divisi.objects.get(hr_department_id=31).unit_bisnis, self.adv)

    def test_ganti_nama_di_hr_mengubah_divisi_yang_sama(self):
        self.dept()
        res = self.dept(nama='Digital Printing & Banner', nama_lama='Digital Printing')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(Divisi.objects.filter(hr_department_id=3).count(), 1)
        self.assertEqual(Divisi.objects.get(hr_department_id=3).nama, 'Digital Printing & Banner')

    def test_divisi_lama_dengan_nama_sama_diadopsi_bukan_dobel(self):
        lama = Divisi.objects.create(nama='ADV Workshop')
        res = self.dept(hr_id=7, nama='ADV Workshop')
        self.assertEqual(res.status_code, 200, res.content)
        lama.refresh_from_db()
        self.assertEqual(lama.hr_department_id, 7)
        self.assertEqual(Divisi.objects.filter(nama__iexact='ADV Workshop').count(), 1)

    def test_nama_bentrok_dengan_divisi_lain_dijawab_409(self):
        Divisi.objects.create(nama='Fotografi', hr_department_id=99)
        self.assertEqual(self.dept(hr_id=5, nama='Fotografi').status_code, 409)

    def test_departemen_sales_dan_hr_ga_dilewati(self):
        for nama in ('Sales Marketing & Creative', 'HR & GA'):
            res = self.dept(hr_id=20, nama=nama)
            self.assertTrue(res.data.get('skipped'), nama)
        self.assertFalse(Divisi.objects.filter(hr_department_id=20).exists())

    def test_peran_jabatan_jadi_tahap_di_divisi_departemennya_urutan_berlanjut(self):
        res = self.peran(hr_id=9, nama='Operator')
        self.assertEqual(res.status_code, 200, res.content)
        res = self.peran(hr_id=10, nama='Finishing')
        divisi = Divisi.objects.get(hr_department_id=3)  # dibuat otomatis oleh peran jabatan
        t1, t2 = TahapProses.objects.get(hr_job_role_id=9), TahapProses.objects.get(hr_job_role_id=10)
        self.assertEqual((t1.divisi, t1.urutan, t2.divisi, t2.urutan), (divisi, 1, divisi, 2))

    def test_nama_tahap_bentrok_diberi_nama_jabatan(self):
        TahapProses.objects.create(nama='Staff', divisi=Divisi.objects.create(nama='Lain'))
        self.peran(hr_id=11, nama='Staff')
        self.assertEqual(TahapProses.objects.get(hr_job_role_id=11).nama, 'Staff (Operator A3)')

    def test_ganti_nama_peran_jabatan_mengubah_tahap_yang_sama(self):
        self.peran(hr_id=9, nama='Operator')
        self.peran(hr_id=9, nama='Operator Cetak', nama_lama='Operator')
        self.assertEqual(TahapProses.objects.filter(hr_job_role_id=9).count(), 1)
        self.assertEqual(TahapProses.objects.get(hr_job_role_id=9).nama, 'Operator Cetak')

    def test_peran_jabatan_milik_spv_kordiv_kasir_tidak_jadi_tahap(self):
        for hr_id, jabatan in ((40, 'SPV Digital Printing'), (41, 'Kordiv A3'), (42, 'Kasir Foto'), (43, 'Manager')):
            res = self.peran(hr_id=hr_id, nama=f'Peran {jabatan}', jabatan=jabatan)
            self.assertTrue(res.data.get('skipped'), jabatan)
            self.assertFalse(TahapProses.objects.filter(hr_job_role_id=hr_id).exists(), jabatan)

    def test_peran_jabatan_departemen_sales_dilewati(self):
        res = self.peran(hr_id=12, nama='Sales', departemen='Sales Marketing & Creative')
        self.assertTrue(res.data.get('skipped'))
        self.assertFalse(TahapProses.objects.filter(hr_job_role_id=12).exists())

    def test_jenis_tidak_dikenal_ditolak(self):
        self.assertEqual(self.post({'jenis': 'x', 'hr_id': 1, 'nama': 'A'}).status_code, 400)


class StaffMasukDivisiDepartemenTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle 30/menit dibagi antar tes
        env = mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)
        self.divisi = Divisi.objects.create(nama='Digital Printing', hr_department_id=3)

    def akun(self, hr_id, jabatan, **extra):
        return self.client.post('/api/bridge/hr-employee/', {
            'hr_employee_id': hr_id, 'first_name': 'Budi', 'last_name': f'Uji{hr_id}',
            'job_position': jabatan, 'department': 'Digital Printing', **extra,
        }, format='json', HTTP_X_API_KEY='kunci-uji', HTTP_X_FORWARDED_PROTO='https')

    def test_staff_baru_otomatis_masuk_divisi_departemen(self):
        self.assertEqual(self.akun(601, 'OP Banner').status_code, 201)
        self.assertEqual(CustomUser.objects.get(hr_employee_id=601).divisi, self.divisi)

    def test_unit_bisnis_akun_mengikuti_pilihan_hr(self):
        UnitBisnis.objects.get_or_create(nama='StarFoto')
        self.akun(605, 'OP Banner', unit_bisnis='StarFoto')
        self.assertEqual(CustomUser.objects.get(hr_employee_id=605).unit_bisnis.nama, 'StarFoto')

    def test_spv_tidak_diberi_divisi(self):
        self.akun(602, 'SPV Digital Printing')
        self.assertIsNone(CustomUser.objects.get(hr_employee_id=602).divisi)

    def test_divisi_yang_sudah_diatur_manual_tidak_ditimpa(self):
        lain = Divisi.objects.create(nama='Operator A3')
        self.akun(603, 'Operator A3')
        CustomUser.objects.filter(hr_employee_id=603).update(divisi=lain)
        self.akun(603, 'Operator A3')  # simpan ulang data kerja
        self.assertEqual(CustomUser.objects.get(hr_employee_id=603).divisi, lain)

    def test_staff_lama_tanpa_divisi_terisi_saat_disinkron_ulang(self):
        self.akun(604, 'OP Banner')
        CustomUser.objects.filter(hr_employee_id=604).update(divisi=None)
        self.akun(604, 'OP Banner')
        self.assertEqual(CustomUser.objects.get(hr_employee_id=604).divisi, self.divisi)
