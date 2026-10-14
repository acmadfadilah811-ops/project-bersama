"""Data absensi memuat jabatan & unit bisnis staff, bisa difilter per unit dan ikut ke Excel (2026-10-14)."""
import io

import openpyxl
from rest_framework.test import APITestCase

from api.models import CustomUser, UnitBisnis

TANGGAL = '2026-01-05'


class AbsensiUnitBisnisTests(APITestCase):
    def setUp(self):
        self.foto = UnitBisnis.objects.get_or_create(nama='StarFoto')[0]
        self.adv = UnitBisnis.objects.get_or_create(nama='Star Advertising')[0]
        self.owner = CustomUser.objects.create_user(username='own_abs', password='x12345678', role='owner', email='own_abs@uji.test')
        self.a = CustomUser.objects.create_user(
            username='ani', password='x12345678', role='staff', email='ani@uji.test',
            unit_bisnis=self.foto, posisi='Fotografer',
        )
        self.b = CustomUser.objects.create_user(
            username='budi', password='x12345678', role='staff', email='budi@uji.test',
            unit_bisnis=self.adv, posisi='Operator Cetak',
        )
        self.client.force_authenticate(self.owner)

    def _daftar(self, param=''):
        res = self.client.get(f'/api/hr/absensi/?tanggal={TANGGAL}{param}')
        self.assertEqual(res.status_code, 200)
        return {r['staff_nama']: r for r in res.json()}

    def test_baris_absensi_memuat_jabatan_dan_unit(self):
        data = self._daftar()
        self.assertEqual(data['ani']['unit_bisnis_nama'], 'StarFoto')
        self.assertEqual(data['ani']['jabatan'], 'Fotografer')
        self.assertEqual(data['ani']['staff_role'], 'staff')
        self.assertEqual(data['budi']['unit_bisnis'], self.adv.id)

    def test_filter_per_unit(self):
        self.assertEqual(set(self._daftar(f'&unit_bisnis={self.adv.id}')) & {'ani', 'budi'}, {'budi'})
        self.assertEqual(set(self._daftar(f'&unit_bisnis={self.foto.id}')) & {'ani', 'budi'}, {'ani'})

    def test_excel_memuat_kolom_jabatan_unit_dan_filter(self):
        self._daftar()  # membuat baris absensi hari itu (sama seperti halaman sebelum Export)
        res = self.client.get(f'/api/export/absensi/?tanggal={TANGGAL}&unit_bisnis={self.foto.id}')
        self.assertEqual(res.status_code, 200)
        ws = openpyxl.load_workbook(io.BytesIO(res.content)).active
        baris = list(ws.iter_rows(values_only=True))
        self.assertEqual(baris[0][:4], ('Nama Staff', 'Jabatan', 'Unit Bisnis', 'Divisi'))
        isi = {r[0]: r for r in baris[1:]}
        self.assertEqual(isi['ani'][1:3], ('Fotografer', 'StarFoto'))
        self.assertNotIn('budi', isi)
