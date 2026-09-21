"""Unit bisnis pada Divisi: kasir hanya melihat & hanya boleh menerbitkan SPK ke
divisi unit bisnisnya sendiri (StarFoto vs Star Advertising). Ditegakkan di server
(dropdown yang tersaring saja bukan keamanan)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from . import spk
from .models import Divisi, JobBoard, TahapProses, UnitBisnis
from .pos_models import POSSale, POSSaleItem
from .product_models import Product


class KasirUnitBase(APITestCase):
    def setUp(self):
        U = get_user_model()
        self.foto = UnitBisnis.objects.create(nama='StarFoto Uji')
        self.adv = UnitBisnis.objects.create(nama='Star Advertising Uji')

        def divisi(nama, unit):
            d = Divisi.objects.create(nama=nama, unit_bisnis=unit)
            t = TahapProses.objects.create(nama=f'Tahap {nama}', divisi=d, urutan=1)
            return d, t

        self.d_editor, self.t_editor = divisi('Editor Uji', self.foto)
        self.d_operator, self.t_operator = divisi('Operator Uji', self.foto)
        self.d_edit_adv, self.t_edit_adv = divisi('Editor ADV Uji', self.adv)
        self.d_workshop, self.t_workshop = divisi('Workshop ADV Uji', self.adv)
        self.d_umum, self.t_umum = divisi('Umum Uji', None)

        self.kasir_foto = U.objects.create_user(username='k_foto', password='x', role='kasir', unit_bisnis=self.foto)
        self.kasir_adv = U.objects.create_user(username='k_adv', password='x', role='kasir', unit_bisnis=self.adv)
        self.kasir_bebas = U.objects.create_user(username='k_bebas', password='x', role='kasir')
        self.owner = U.objects.create_user(username='o_uji', password='x', role='owner')

    def nama_divisi(self, user):
        self.client.force_authenticate(user)
        data = self.client.get('/api/divisi/').json()
        data = data.get('results', data) if isinstance(data, dict) else data
        return {d['nama'] for d in data if d['nama'].endswith('Uji')}

    def nama_tahap(self, user):
        self.client.force_authenticate(user)
        data = self.client.get('/api/tahap-proses/').json()
        data = data.get('results', data) if isinstance(data, dict) else data
        return {t['nama'] for t in data if t['nama'].endswith('Uji')}


class DropdownTersaringTests(KasirUnitBase):
    def test_kasir_foto_hanya_melihat_divisi_starfoto_dan_umum(self):
        self.assertEqual(self.nama_divisi(self.kasir_foto), {'Editor Uji', 'Operator Uji', 'Umum Uji'})

    def test_kasir_adv_hanya_melihat_divisi_adv_dan_umum(self):
        self.assertEqual(self.nama_divisi(self.kasir_adv), {'Editor ADV Uji', 'Workshop ADV Uji', 'Umum Uji'})

    def test_kasir_tanpa_unit_melihat_semua(self):
        self.assertEqual(len(self.nama_divisi(self.kasir_bebas)), 5)

    def test_owner_melihat_semua_dan_unit_ikut_di_respons(self):
        self.assertEqual(len(self.nama_divisi(self.owner)), 5)
        data = self.client.get('/api/divisi/').json()
        data = data.get('results', data) if isinstance(data, dict) else data
        adv = next(d for d in data if d['nama'] == 'Editor ADV Uji')
        self.assertEqual(adv['unit_bisnis'], self.adv.id)
        self.assertEqual(adv['unit_bisnis_nama'], 'Star Advertising Uji')

    def test_tahap_proses_ikut_tersaring_untuk_kasir(self):
        self.assertEqual(self.nama_tahap(self.kasir_adv),
                         {'Tahap Editor ADV Uji', 'Tahap Workshop ADV Uji', 'Tahap Umum Uji'})
        self.assertEqual(len(self.nama_tahap(self.owner)), 5)

    def test_owner_bisa_mengubah_unit_divisi_dan_mengosongkannya(self):
        self.client.force_authenticate(self.owner)
        r = self.client.patch(f'/api/divisi/{self.d_umum.id}/', {'unit_bisnis': self.adv.id}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['unit_bisnis'], self.adv.id)
        r = self.client.patch(f'/api/divisi/{self.d_umum.id}/', {'unit_bisnis': None}, format='json')
        self.assertIsNone(r.json()['unit_bisnis'])
        # Tambah divisi baru dengan unit
        r = self.client.post('/api/divisi/', {'nama': 'Divisi Baru Uji', 'unit_bisnis': self.foto.id}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['unit_bisnis_nama'], 'StarFoto Uji')

    def test_kasir_tidak_bisa_mengubah_unit_divisi(self):
        self.client.force_authenticate(self.kasir_foto)
        r = self.client.patch(f'/api/divisi/{self.d_editor.id}/', {'unit_bisnis': self.adv.id}, format='json')
        self.assertEqual(r.status_code, 403)


class PenegakanDiServerTests(KasirUnitBase):
    def test_kasir_foto_ke_divisi_adv_ditolak_403(self):
        with self.assertRaises(spk.SpkError) as ctx:
            spk.resolve_tahap(divisi_id=self.d_edit_adv.id, pemohon=self.kasir_foto)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn('bukan milik unit bisnis Anda', ctx.exception.pesan)

    def test_tahap_eksplisit_unit_lain_ditolak(self):
        # Klien nakal mengirim tahap_id langsung, melewati dropdown.
        with self.assertRaises(spk.SpkError):
            spk.resolve_tahap(tahap_id=self.t_workshop.id, pemohon=self.kasir_foto)

    def test_unit_sendiri_dan_divisi_umum_diizinkan(self):
        self.assertEqual(spk.resolve_tahap(divisi_id=self.d_editor.id, pemohon=self.kasir_foto), self.t_editor)
        self.assertEqual(spk.resolve_tahap(divisi_id=self.d_umum.id, pemohon=self.kasir_foto), self.t_umum)
        self.assertEqual(spk.resolve_tahap(tahap_id=self.t_edit_adv.id, pemohon=self.kasir_adv), self.t_edit_adv)

    def test_kasir_tanpa_unit_dan_role_lain_tidak_dibatasi(self):
        self.assertEqual(spk.resolve_tahap(divisi_id=self.d_edit_adv.id, pemohon=self.kasir_bebas), self.t_edit_adv)
        self.assertEqual(spk.resolve_tahap(divisi_id=self.d_edit_adv.id, pemohon=self.owner), self.t_edit_adv)
        self.assertEqual(spk.resolve_tahap(divisi_id=self.d_edit_adv.id), self.t_edit_adv)  # kompatibel mundur

    def test_terbitkan_spk_pos_lewat_api_kasir_unit_lain_ditolak_sendiri_diterima(self):
        produk = Product.objects.create(nama='Spanduk Uji', harga_beli=10000, harga_jual_toko=50000, qty_stok=10)
        sale = POSSale.objects.create(nomor='POS-UNIT-1', total=Decimal('50000'), status='paid')
        item = POSSaleItem.objects.create(
            sale=sale, product=produk, nama_snapshot='Spanduk', harga_snapshot=Decimal('50000'),
            qty=Decimal('1'), subtotal=Decimal('50000'),
        )
        self.client.force_authenticate(self.kasir_foto)
        url = f'/api/pos/sales/{sale.id}/terbitkan-spk/'

        r = self.client.post(url, {'divisi_id': self.d_edit_adv.id}, format='json')
        self.assertEqual(r.status_code, 403, r.content)
        self.assertIn('bukan milik unit bisnis Anda', r.json()['error'])
        self.assertFalse(JobBoard.objects.filter(pos_sale_item=item).exists())

        r = self.client.post(url, {'divisi_id': self.d_editor.id}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(JobBoard.objects.get(pos_sale_item=item).tahap, self.t_editor)
