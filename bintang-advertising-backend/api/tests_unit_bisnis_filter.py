"""Pengelompokan per unit bisnis di Pesanan & Papan Kerja (owner/manager/admin, 2026-10-14):
?unit_bisnis=<id>|none pada /orders/, /orders/stats/ dan /jobs/."""
from rest_framework.test import APITestCase

from .models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses, UnitBisnis


def _daftar(response):
    data = response.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class PengelompokanUnitBisnisTests(APITestCase):
    def setUp(self):
        self.foto = UnitBisnis.objects.get_or_create(nama='StarFoto')[0]
        self.adv = UnitBisnis.objects.get_or_create(nama='Star Advertising')[0]
        self.owner = CustomUser.objects.create_user(username='own_unit', password='x12345678', role='owner', email='own_unit@uji.test')

        self.o_foto = Order.objects.create(id='ORD-U-FOTO', nama='A', nomor_wa='628111', sumber='manual', unit_bisnis=self.foto)
        self.o_adv = Order.objects.create(id='ORD-U-ADV', nama='B', nomor_wa='628222', sumber='manual', unit_bisnis=self.adv)
        self.o_adv2 = Order.objects.create(id='ORD-U-ADV2', nama='C', nomor_wa='628333', sumber='manual', unit_bisnis=self.adv)
        self.o_kosong = Order.objects.create(id='ORD-U-KOSONG', nama='D', nomor_wa='628444', sumber='manual')

        self.div_foto = Divisi.objects.create(nama='Studio Uji Unit', unit_bisnis=self.foto)
        self.div_adv = Divisi.objects.create(nama='Cetak Uji Unit', unit_bisnis=self.adv)
        self.div_umum = Divisi.objects.create(nama='Umum Uji Unit')
        self.t_foto = TahapProses.objects.create(nama='Foto', divisi=self.div_foto)
        self.t_adv = TahapProses.objects.create(nama='Cetak A3', divisi=self.div_adv)
        self.t_umum = TahapProses.objects.create(nama='Umum', divisi=self.div_umum)

        def job(order, tahap):
            item = OrderItem.objects.create(order=order, jenis_produk='X', qty=1)
            return JobBoard.objects.create(order_item=item, tahap=tahap)

        self.j_foto = job(self.o_foto, self.t_foto)
        self.j_adv = job(self.o_adv, self.t_adv)
        # Pesanan tanpa unit tapi tahapnya milik divisi Star Advertising -> ikut unit divisi.
        self.j_divisi = job(self.o_kosong, self.t_adv)
        self.j_tanpa = job(self.o_kosong, self.t_umum)
        self.client.force_authenticate(self.owner)

    def _ids_order(self, param=''):
        return {o['id'] for o in _daftar(self.client.get(f'/api/orders/{param}'))}

    def _ids_job(self, param=''):
        return {j['id'] for j in _daftar(self.client.get(f'/api/jobs/{param}'))}

    def test_pesanan_tanpa_filter_menampilkan_semua(self):
        self.assertEqual(self._ids_order(), {'ORD-U-FOTO', 'ORD-U-ADV', 'ORD-U-ADV2', 'ORD-U-KOSONG'})

    def test_pesanan_difilter_satu_unit(self):
        self.assertEqual(self._ids_order(f'?unit_bisnis={self.adv.id}'), {'ORD-U-ADV', 'ORD-U-ADV2'})
        self.assertEqual(self._ids_order(f'?unit_bisnis={self.foto.id}'), {'ORD-U-FOTO'})

    def test_pesanan_belum_ditandai_unit(self):
        self.assertEqual(self._ids_order('?unit_bisnis=none'), {'ORD-U-KOSONG'})

    def test_nilai_tak_dikenal_diabaikan(self):
        self.assertEqual(len(self._ids_order('?unit_bisnis=abc')), 4)

    def test_filter_digabung_dengan_tab_status(self):
        Order.objects.filter(pk='ORD-U-ADV2').update(status_global='selesai')
        self.assertEqual(self._ids_order(f'?unit_bisnis={self.adv.id}&tab=completed'), {'ORD-U-ADV2'})

    def test_stats_memuat_jumlah_per_unit_dan_ikut_terfilter(self):
        data = self.client.get('/api/orders/stats/').json()
        per_unit = {(u['nama'], u['jumlah']) for u in data['per_unit']}
        self.assertEqual(per_unit, {('StarFoto', 1), ('Star Advertising', 2), (None, 1)})
        self.assertEqual(data['total_count'], 4)

        terfilter = self.client.get(f'/api/orders/stats/?unit_bisnis={self.adv.id}').json()
        self.assertEqual(terfilter['total_count'], 2)
        # jumlah per unit tetap utuh walau satu unit dipilih
        self.assertEqual({(u['nama'], u['jumlah']) for u in terfilter['per_unit']}, per_unit)

    def test_job_membawa_unit_dari_pesanan_lalu_divisi(self):
        by_id = {j['id']: j for j in _daftar(self.client.get('/api/jobs/'))}
        self.assertEqual(by_id[self.j_foto.id]['unit_bisnis_nama'], 'StarFoto')
        self.assertEqual(by_id[self.j_adv.id]['unit_bisnis'], self.adv.id)
        self.assertEqual(by_id[self.j_divisi.id]['unit_bisnis_nama'], 'Star Advertising')
        self.assertIsNone(by_id[self.j_tanpa.id]['unit_bisnis'])

    def test_job_difilter_per_unit(self):
        self.assertEqual(self._ids_job(f'?unit_bisnis={self.adv.id}'), {self.j_adv.id, self.j_divisi.id})
        self.assertEqual(self._ids_job(f'?unit_bisnis={self.foto.id}'), {self.j_foto.id})
        self.assertEqual(self._ids_job('?unit_bisnis=none'), {self.j_tanpa.id})

    def test_kasir_tidak_bisa_melebar_lewat_filter(self):
        kasir = CustomUser.objects.create_user(
            username='ksr_unit', password='x12345678', role='kasir', email='ksr_unit@uji.test', unit_bisnis=self.foto,
        )
        self.client.force_authenticate(kasir)
        # Kasir StarFoto tetap hanya melihat StarFoto + baris tanpa unit, apa pun nilai filternya.
        self.assertEqual(self._ids_order(f'?unit_bisnis={self.adv.id}'), set())
        self.assertEqual(self._ids_order(f'?unit_bisnis={self.foto.id}'), {'ORD-U-FOTO'})
