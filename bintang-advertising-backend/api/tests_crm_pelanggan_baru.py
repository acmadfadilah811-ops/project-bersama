"""Pelanggan baru di ERP otomatis masuk CRM sebagai Contact (2026-11-02)."""
import os
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from .customer_models import Customer
from .models import Contact

User = get_user_model()


def _requests_palsu(side_effect=None):
    """Ganti modul `requests` HANYA di crm_pelanggan."""
    respons = mock.Mock()
    respons.raise_for_status.return_value = None
    return mock.patch('api.services.crm_pelanggan.requests', **{
        'post.return_value': respons,
        'post.side_effect': side_effect,
    })


@mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
class PelangganBaruKeCrmTests(TestCase):
    def _buat(self, **isi):
        isi.setdefault('nama', 'Rina Wulandari')
        with self.captureOnCommitCallbacks(execute=True):
            return Customer.objects.create(**isi)

    def test_pelanggan_baru_dikirim_sebagai_contact_tanpa_penjualan(self):
        with _requests_palsu() as req:
            self._buat(handphone='0812-3456-0001', email='rina@contoh.com', kota='Bandung',
                       kode_pelanggan='PLG-9', nama_perusahaan='CV Maju')
        self.assertEqual(req.post.call_count, 1)
        kirim = req.post.call_args.kwargs['json']
        self.assertEqual(kirim['nomor_wa'], '6281234560001')
        self.assertEqual(kirim['nama'], 'Rina Wulandari')
        self.assertEqual(kirim['email'], 'rina@contoh.com')
        self.assertEqual(kirim['kota'], 'Bandung')
        self.assertEqual(kirim['kode_pelanggan'], 'PLG-9')
        self.assertEqual(kirim['sumber'], 'erp-pelanggan')
        self.assertNotIn('sale', kirim)
        self.assertEqual(req.post.call_args.kwargs['headers']['X-Api-Key'], 'kunci-uji')

    def test_pembuat_yang_punya_akun_hr_jadi_pemilik_di_crm(self):
        kasir = User.objects.create_user(username='kasir_plg', password='x', role='kasir')
        kasir.hr_employee_id = 21
        kasir.save(update_fields=['hr_employee_id'])
        with _requests_palsu() as req:
            self._buat(handphone='081234560002', dibuat_oleh=kasir)
        self.assertEqual(req.post.call_args.kwargs['json']['penjual_hr_employee_id'], 21)

    def test_memakai_nomor_contact_erp_yang_sudah_tertaut(self):
        with _requests_palsu():
            pelanggan = self._buat(handphone='081234560003')
        Contact.objects.create(nomor_wa='081234560003', nama='Rina', customer=pelanggan)
        from .services.crm_pelanggan import nomor_untuk_crm
        self.assertEqual(nomor_untuk_crm(pelanggan), '081234560003')

    def test_tanpa_nomor_atau_nomor_tidak_valid_tidak_dikirim(self):
        with _requests_palsu() as req:
            self._buat()
            self._buat(handphone='123')
        self.assertEqual(req.post.call_count, 0)

    def test_perubahan_pelanggan_lama_tidak_dikirim_ulang(self):
        with _requests_palsu() as req:
            pelanggan = self._buat(handphone='081234560004')
            with self.captureOnCommitCallbacks(execute=True):
                pelanggan.nama = 'Nama Baru'
                pelanggan.save()
        self.assertEqual(req.post.call_count, 1)

    def test_pelanggan_nonaktif_tidak_dikirim(self):
        with _requests_palsu() as req:
            self._buat(handphone='081234560005', is_active=False)
        self.assertEqual(req.post.call_count, 0)

    def test_crm_down_pelanggan_tetap_tersimpan(self):
        with _requests_palsu(side_effect=OSError('crm mati')):
            pelanggan = self._buat(handphone='081234560006')
        self.assertTrue(Customer.objects.filter(pk=pelanggan.pk).exists())

    def test_tanpa_kunci_jembatan_dilewati(self):
        with mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': ''}), _requests_palsu() as req:
            self._buat(handphone='081234560007')
        self.assertEqual(req.post.call_count, 0)


@mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
class SinkronPelangganCrmCommandTests(TestCase):
    def test_wajib_pilih_sejak_atau_id(self):
        with self.assertRaises(CommandError):
            call_command('sinkron_pelanggan_crm', stdout=StringIO())

    def test_dry_run_hanya_daftar_dan_sejak_membatasi(self):
        with _requests_palsu():
            lama = Customer.objects.create(nama='Lama', handphone='081234560010')
            Customer.objects.create(nama='Baru', handphone='081234560011')
        Customer.objects.filter(pk=lama.pk).update(created_at='2020-01-01T00:00:00Z')
        out = StringIO()
        with _requests_palsu() as req:
            call_command('sinkron_pelanggan_crm', '--sejak', '2026-01-01', '--dry-run', stdout=out)
        self.assertEqual(req.post.call_count, 0)
        self.assertIn('1 pelanggan punya nomor WA valid', out.getvalue())
        self.assertIn('Baru', out.getvalue())
        self.assertNotIn('Lama', out.getvalue())

    def test_kirim_nyata_mengirim_yang_dipilih(self):
        with _requests_palsu():
            a = Customer.objects.create(nama='A', handphone='081234560012')
        out = StringIO()
        with _requests_palsu() as req:
            call_command('sinkron_pelanggan_crm', '--id', str(a.pk), stdout=out)
        self.assertEqual(req.post.call_count, 1)
        self.assertIn('1 dari 1 terkirim', out.getvalue())
