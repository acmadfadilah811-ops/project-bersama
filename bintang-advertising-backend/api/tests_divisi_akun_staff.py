"""Pengaturan divisi & unit bisnis akun staff (menu Karyawan): siapa yang boleh,
validasi kesesuaian divisi-unit, celah ubah-sendiri lewat /users/me/, dan bukti
ujung-ke-ujung: staff yang diberi divisi melihat SPK divisi itu."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from .models import Divisi, JobBoard, TahapProses, UnitBisnis
from .pos_models import POSSale, POSSaleItem
from .product_models import Product


class DasarAkun(APITestCase):
    def setUp(self):
        U = get_user_model()
        self.foto = UnitBisnis.objects.create(nama='StarFoto Akun')
        self.adv = UnitBisnis.objects.create(nama='Star Adv Akun')
        self.d_editor = Divisi.objects.create(nama='Editor Akun', unit_bisnis=self.foto)
        self.d_adv = Divisi.objects.create(nama='Editor ADV Akun', unit_bisnis=self.adv)
        self.d_umum = Divisi.objects.create(nama='Umum Akun', unit_bisnis=None)
        self.t_editor = TahapProses.objects.create(nama='Edit Akun', divisi=self.d_editor, urutan=1)
        self.owner = U.objects.create_user(username='own_akun', password='x', role='owner')
        self.manager = U.objects.create_user(username='mgr_akun', password='x', role='manager')
        self.admin = U.objects.create_user(username='adm_akun', password='x', role='admin')
        self.kasir = U.objects.create_user(username='ksr_akun', password='x', role='kasir', unit_bisnis=self.foto)
        self.spv = U.objects.create_user(username='spv_akun', password='x', role='spv')
        self.staff = U.objects.create_user(username='stf_akun', password='x', role='staff', unit_bisnis=self.foto)

    def ubah(self, pengubah, target, **data):
        self.client.force_authenticate(pengubah)
        return self.client.patch(f'/api/users/{target.id}/', data, format='json')


class AturDivisiTests(DasarAkun):
    def test_owner_manager_admin_bisa_mengatur_divisi(self):
        for pengubah in (self.owner, self.manager, self.admin):
            r = self.ubah(pengubah, self.staff, divisi=self.d_editor.id)
            self.assertEqual(r.status_code, 200, (pengubah.role, r.content))
            self.assertEqual(r.json()['divisi'], self.d_editor.id)
            self.assertEqual(r.json()['divisi_nama'], 'Editor Akun')
            self.ubah(pengubah, self.staff, divisi=None)  # reset utk iterasi berikut

    def test_divisi_bisa_dikosongkan(self):
        self.ubah(self.owner, self.staff, divisi=self.d_editor.id)
        r = self.ubah(self.owner, self.staff, divisi=None)
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()['divisi'])

    def test_multipart_string_kosong_dianggap_kosong_seperti_form_karyawan(self):
        # Form Karyawan mengirim FormData: divisi kosong = '' (bukan null).
        self.ubah(self.owner, self.staff, divisi=self.d_editor.id)
        self.client.force_authenticate(self.owner)
        r = self.client.patch(f'/api/users/{self.staff.id}/', {'divisi': '', 'unit_bisnis': self.foto.id}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.json()['divisi'])

    def test_peran_lain_tidak_boleh_mengubah_akun_orang(self):
        for pengubah in (self.kasir, self.spv, self.staff):
            r = self.ubah(pengubah, self.staff, divisi=self.d_editor.id)
            self.assertEqual(r.status_code, 403, pengubah.role)
        self.staff.refresh_from_db()
        self.assertIsNone(self.staff.divisi_id)

    def test_divisi_unit_lain_ditolak_400(self):
        r = self.ubah(self.owner, self.staff, divisi=self.d_adv.id)  # staff unit StarFoto
        self.assertEqual(r.status_code, 400)
        self.assertIn("tidak cocok dengan unit bisnis akun", str(r.json()))
        self.staff.refresh_from_db()
        self.assertIsNone(self.staff.divisi_id)

    def test_divisi_umum_dan_unit_sendiri_diizinkan(self):
        self.assertEqual(self.ubah(self.owner, self.staff, divisi=self.d_umum.id).status_code, 200)
        self.assertEqual(self.ubah(self.owner, self.staff, divisi=self.d_editor.id).status_code, 200)

    def test_pindah_divisi_dan_unit_bersamaan_diizinkan(self):
        r = self.ubah(self.owner, self.staff, divisi=self.d_adv.id, unit_bisnis=self.adv.id)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.json()['divisi'], r.json()['unit_bisnis']), (self.d_adv.id, self.adv.id))

    def test_ubah_unit_yang_bentrok_dengan_divisi_sekarang_ditolak(self):
        self.ubah(self.owner, self.staff, divisi=self.d_editor.id)
        r = self.ubah(self.owner, self.staff, unit_bisnis=self.adv.id)
        self.assertEqual(r.status_code, 400)

    def test_perubahan_lain_pada_akun_lama_yang_tidak_rapi_tidak_terblokir(self):
        # Akun lama: divisi Editor (StarFoto) tetapi unit Star Adv (data tidak konsisten).
        self.staff.divisi, self.staff.unit_bisnis = self.d_editor, self.adv
        self.staff.save()
        r = self.ubah(self.owner, self.staff, no_hp='0812345')
        self.assertEqual(r.status_code, 200, r.content)


class CelahUbahSendiriTests(DasarAkun):
    """/users/me/ -- pengguna biasa tidak boleh mengubah penempatan kerjanya sendiri."""

    def test_kasir_tidak_bisa_mengubah_atau_menghapus_unit_sendiri(self):
        self.client.force_authenticate(self.kasir)
        r = self.client.patch('/api/users/me/', {'unit_bisnis': self.adv.id}, format='json')
        self.assertEqual(r.status_code, 200)
        r = self.client.patch('/api/users/me/', {'unit_bisnis': None}, format='json')
        self.assertEqual(r.status_code, 200)
        self.kasir.refresh_from_db()
        self.assertEqual(self.kasir.unit_bisnis_id, self.foto.id)   # tetap StarFoto

    def test_staff_tidak_bisa_mengubah_divisi_atasan_posisi_sendiri(self):
        self.staff.posisi = 'Editor'
        self.staff.save()
        self.client.force_authenticate(self.staff)
        r = self.client.patch('/api/users/me/', {
            'divisi': self.d_editor.id, 'atasan': self.spv.id, 'posisi': 'Direktur', 'role': 'owner',
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.staff.refresh_from_db()
        self.assertIsNone(self.staff.divisi_id)
        self.assertIsNone(self.staff.atasan_id)
        self.assertEqual(self.staff.posisi, 'Editor')
        self.assertEqual(self.staff.role, 'staff')

    def test_data_diri_biasa_tetap_bisa_diubah_sendiri(self):
        self.client.force_authenticate(self.staff)
        r = self.client.patch('/api/users/me/', {'no_hp': '08123', 'kota': 'Surabaya'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.staff.refresh_from_db()
        self.assertEqual((self.staff.no_hp, self.staff.kota), ('08123', 'Surabaya'))


class BuktiUjungKeUjungTests(DasarAkun):
    def test_staff_yang_diberi_divisi_melihat_spk_divisi_itu(self):
        produk = Product.objects.create(nama='Cetak Akun', harga_beli=1000, harga_jual_toko=5000, qty_stok=5)
        sale = POSSale.objects.create(nomor='POS-AKUN-1', total=Decimal('5000'), status='paid')
        item = POSSaleItem.objects.create(sale=sale, product=produk, nama_snapshot='Cetak', harga_snapshot=Decimal('5000'),
                                          qty=Decimal('1'), subtotal=Decimal('5000'))
        self.client.force_authenticate(self.owner)
        r = self.client.post(f'/api/pos/sales/{sale.id}/terbitkan-spk/', {'divisi_id': self.d_editor.id}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        job = JobBoard.objects.get(pos_sale_item=item)

        Absensi.objects.create(staff=self.staff, tanggal=timezone.localdate(), status='hadir', jam_masuk=timezone.now())

        def terlihat():
            self.staff.refresh_from_db()   # instance test tidak ikut berubah lewat API
            self.client.force_authenticate(self.staff)
            data = self.client.get('/api/jobs/').json()
            data = data.get('results', data) if isinstance(data, dict) else data
            return job.id in {d['id'] for d in data}

        self.assertFalse(terlihat())                                   # belum berdivisi -> tidak melihat
        self.ubah(self.owner, self.staff, divisi=self.d_editor.id)
        self.assertTrue(terlihat())                                    # setelah diatur owner -> melihat
