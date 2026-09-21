"""Uji Permintaan Bahan (Material Requisition): izin per role, cakupan data,
alur status, dan bukti bahwa alur ini TIDAK menyentuh stok maupun jurnal."""
from decimal import Decimal

from rest_framework.test import APITestCase

from accounting.models import JournalEntry

from .models import CustomUser, Divisi, InventoryItem, MaterialRequisition, RestockHistory

URL = '/api/material-requisitions/'


def _user(username, role, **kw):
    return CustomUser.objects.create_user(username=username, password='pw12345', role=role, **kw)


class RequisitionBase(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama='Divisi MR Test')
        self.owner = _user('mr_owner', 'owner')
        self.manager = _user('mr_manager', 'manager')
        self.admin = _user('mr_admin', 'admin')
        self.spv = _user('mr_spv', 'spv')
        self.kordiv = _user('mr_kordiv', 'kordiv', atasan=self.spv, divisi=self.divisi)
        self.kordiv_lain = _user('mr_kordiv_lain', 'kordiv')          # bukan bawahan spv
        self.spv_lain = _user('mr_spv_lain', 'spv')
        self.kasir = _user('mr_kasir', 'kasir')
        self.staff = _user('mr_staff', 'staff')
        self.tinta = InventoryItem.objects.create(nama='Tinta MR', satuan='liter', kategori='Tinta', stok=5.0)
        self.kertas = InventoryItem.objects.create(nama='Kertas MR', satuan='lembar', kategori='Kertas', stok=100.0)

    def _buat(self, user=None, items=None, **extra):
        self.client.force_authenticate(user or self.kordiv)
        return self.client.post(URL, {
            'keperluan': 'Cetak banner order 1',
            'items': items if items is not None else [
                {'item_id': self.tinta.id, 'qty': '2'}, {'item_id': self.kertas.id, 'qty': '50'},
            ],
            **extra,
        }, format='json')

    def _aksi(self, user, req_id, aksi, data=None):
        self.client.force_authenticate(user)
        return self.client.post(f'{URL}{req_id}/{aksi}/', data or {}, format='json')

    def _req_disetujui(self):
        rid = self._buat().json()['id']
        self._aksi(self.spv, rid, 'setujui')
        return rid


class AksesDanPembuatanTests(RequisitionBase):
    def test_anonim_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_kasir_dan_staff_tidak_boleh_403(self):
        for u in (self.kasir, self.staff):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(URL).status_code, 403, u.role)
            self.assertEqual(self.client.get(URL + 'ringkasan/').status_code, 403, u.role)

    def test_kordiv_membuat_permintaan_201(self):
        r = self._buat()
        self.assertEqual(r.status_code, 201, r.content)
        d = r.json()
        self.assertTrue(d['nomor'].startswith('MR'))
        self.assertEqual(d['status'], 'diajukan')
        self.assertEqual(d['pemohon'], self.kordiv.id)
        self.assertEqual(d['divisi'], self.divisi.id)
        self.assertEqual(len(d['items']), 2)
        self.assertEqual(d['aksi'], ['batalkan'])  # pemohon: hanya boleh membatalkan

    def test_admin_tidak_boleh_mengajukan(self):
        r = self._buat(user=self.admin)
        self.assertEqual(r.status_code, 403)

    def test_validasi_pembuatan(self):
        for items, kata in [
            ([], 'minimal satu'),
            ([{'item_id': self.tinta.id, 'qty': '0'}], 'lebih besar dari 0'),
            ([{'item_id': self.tinta.id, 'qty': '-1'}], 'lebih besar dari 0'),
            ([{'item_id': 'INV-TIDAK-ADA', 'qty': '1'}], 'tidak ditemukan'),
            ([{'item_id': self.tinta.id, 'qty': '1'}, {'item_id': self.tinta.id, 'qty': '2'}], 'sekali per permintaan'),
        ]:
            r = self._buat(items=items)
            self.assertEqual(r.status_code, 400, (items, r.content))
            self.assertIn(kata, str(r.json()), items)
        self.assertEqual(MaterialRequisition.objects.count(), 0)

    def test_nomor_berurutan_dan_unik(self):
        n1 = self._buat().json()['nomor']
        n2 = self._buat().json()['nomor']
        self.assertNotEqual(n1, n2)
        self.assertLess(n1, n2)


class CakupanDataTests(RequisitionBase):
    def test_kordiv_hanya_melihat_miliknya(self):
        rid = self._buat().json()['id']
        self.client.force_authenticate(self.kordiv_lain)
        hasil = self.client.get(URL).json()
        hasil = hasil.get('results', hasil) if isinstance(hasil, dict) else hasil
        self.assertEqual(hasil, [])
        self.assertEqual(self.client.get(f'{URL}{rid}/').status_code, 404)

    def test_spv_melihat_bawahan_saja(self):
        rid = self._buat().json()['id']
        self.client.force_authenticate(self.spv)
        self.assertEqual(self.client.get(f'{URL}{rid}/').status_code, 200)
        self.client.force_authenticate(self.spv_lain)
        self.assertEqual(self.client.get(f'{URL}{rid}/').status_code, 404)

    def test_admin_manager_owner_melihat_semua(self):
        rid = self._buat().json()['id']
        for u in (self.admin, self.manager, self.owner):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(f'{URL}{rid}/').status_code, 200, u.role)

    def test_aksi_di_luar_cakupan_404_bukan_bocor(self):
        rid = self._buat().json()['id']
        r = self._aksi(self.spv_lain, rid, 'setujui')
        self.assertEqual(r.status_code, 404)


class AlurPersetujuanTests(RequisitionBase):
    def test_spv_menyetujui_bawahan(self):
        rid = self._buat().json()['id']
        r = self._aksi(self.spv, rid, 'setujui')
        self.assertEqual(r.status_code, 200, r.content)
        d = r.json()
        self.assertEqual(d['status'], 'disetujui')
        self.assertEqual([Decimal(i['qty_disetujui']) for i in d['items']], [Decimal('2'), Decimal('50')])
        self.assertEqual(d['disetujui_oleh_nama'], self.spv.username)

    def test_kordiv_tidak_bisa_menyetujui_miliknya_403(self):
        rid = self._buat().json()['id']
        self.assertEqual(self._aksi(self.kordiv, rid, 'setujui').status_code, 403)

    def test_manager_tidak_bisa_menyetujui_permintaannya_sendiri(self):
        rid = self._buat(user=self.manager).json()['id']
        self.assertEqual(self._aksi(self.manager, rid, 'setujui').status_code, 403)
        self.assertEqual(self._aksi(self.owner, rid, 'setujui').status_code, 200)  # owner boleh

    def test_setujui_dengan_qty_dikurangi(self):
        d = self._buat().json()
        r = self._aksi(self.spv, d['id'], 'setujui', {'qty_disetujui': {self.kertas.id: '30'}})
        self.assertEqual(r.status_code, 200, r.content)
        qty = {i['item_id']: Decimal(i['qty_disetujui']) for i in r.json()['items']}
        self.assertEqual(qty[self.kertas.id], Decimal('30'))
        self.assertEqual(qty[self.tinta.id], Decimal('2'))

    def test_qty_disetujui_melebihi_diminta_ditolak(self):
        rid = self._buat().json()['id']
        r = self._aksi(self.spv, rid, 'setujui', {'qty_disetujui': {self.tinta.id: '99'}})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(MaterialRequisition.objects.get(pk=rid).status, 'diajukan')

    def test_semua_qty_nol_diarahkan_ke_tolak(self):
        rid = self._buat().json()['id']
        r = self._aksi(self.spv, rid, 'setujui', {'qty_disetujui': {self.tinta.id: '0', self.kertas.id: '0'}})
        self.assertEqual(r.status_code, 400)
        self.assertIn('Tolak', r.json()['error'])

    def test_tolak_wajib_alasan(self):
        rid = self._buat().json()['id']
        self.assertEqual(self._aksi(self.spv, rid, 'tolak', {'alasan': '  '}).status_code, 400)
        r = self._aksi(self.spv, rid, 'tolak', {'alasan': 'Stok gudang menipis'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'ditolak')
        self.assertEqual(r.json()['catatan_penolakan'], 'Stok gudang menipis')

    def test_tidak_bisa_setujui_dua_kali(self):
        rid = self._buat().json()['id']
        self._aksi(self.spv, rid, 'setujui')
        self.assertEqual(self._aksi(self.spv, rid, 'setujui').status_code, 400)
        self.assertEqual(self._aksi(self.spv, rid, 'tolak', {'alasan': 'x'}).status_code, 400)


class SiapkanDanTerimaTests(RequisitionBase):
    def test_admin_menyiapkan_dan_stok_tidak_berubah(self):
        rid = self._req_disetujui()
        stok_sebelum = {i.id: i.stok for i in InventoryItem.objects.all()}
        riwayat_sebelum = RestockHistory.objects.count()
        jurnal_sebelum = JournalEntry.objects.count()

        r = self._aksi(self.admin, rid, 'siapkan')

        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['status'], 'disiapkan')
        self.assertEqual([Decimal(i['qty_disiapkan']) for i in r.json()['items']], [Decimal('2'), Decimal('50')])
        # Inti desain: dokumen ini TIDAK mengubah stok maupun jurnal.
        self.assertEqual({i.id: i.stok for i in InventoryItem.objects.all()}, stok_sebelum)
        self.assertEqual(RestockHistory.objects.count(), riwayat_sebelum)
        self.assertEqual(JournalEntry.objects.count(), jurnal_sebelum)

    def test_peringatan_stok_tidak_memblokir(self):
        rid = self._buat(items=[{'item_id': self.tinta.id, 'qty': '20'}]).json()['id']  # stok tercatat 5
        self._aksi(self.spv, rid, 'setujui')
        r = self._aksi(self.admin, rid, 'siapkan')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'disiapkan')
        [p] = r.json()['peringatan_stok']
        self.assertEqual(p['item_id'], self.tinta.id)
        self.assertEqual(Decimal(p['stok_tercatat']), Decimal('5'))

    def test_siapkan_dengan_qty_lebih_sedikit(self):
        rid = self._req_disetujui()
        r = self._aksi(self.admin, rid, 'siapkan', {'qty_disiapkan': {self.kertas.id: '40'}})
        qty = {i['item_id']: Decimal(i['qty_disiapkan']) for i in r.json()['items']}
        self.assertEqual(qty[self.kertas.id], Decimal('40'))

    def test_siapkan_melebihi_disetujui_ditolak(self):
        rid = self._req_disetujui()
        self.assertEqual(self._aksi(self.admin, rid, 'siapkan', {'qty_disiapkan': {self.kertas.id: '51'}}).status_code, 400)

    def test_siapkan_hanya_gudang_dan_setelah_disetujui(self):
        rid = self._buat().json()['id']
        self.assertEqual(self._aksi(self.admin, rid, 'siapkan').status_code, 400)  # belum disetujui
        self._aksi(self.spv, rid, 'setujui')
        self.assertEqual(self._aksi(self.spv, rid, 'siapkan').status_code, 403)    # spv bukan gudang
        self.assertEqual(self._aksi(self.kordiv, rid, 'siapkan').status_code, 403)
        self.assertEqual(self._aksi(self.admin, rid, 'siapkan').status_code, 200)

    def test_terima_hanya_pemohon(self):
        rid = self._req_disetujui()
        self._aksi(self.admin, rid, 'siapkan')
        self.assertEqual(self._aksi(self.spv, rid, 'terima').status_code, 403)
        self.assertEqual(self._aksi(self.admin, rid, 'terima').status_code, 403)
        r = self._aksi(self.kordiv, rid, 'terima')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'diterima')
        self.assertIsNotNone(r.json()['diterima_pada'])

    def test_terima_sebelum_disiapkan_ditolak(self):
        rid = self._req_disetujui()
        self.assertEqual(self._aksi(self.kordiv, rid, 'terima').status_code, 400)


class BatalDanRingkasanTests(RequisitionBase):
    def test_pemohon_membatalkan_saat_diajukan(self):
        rid = self._buat().json()['id']
        self.assertEqual(self._aksi(self.kordiv, rid, 'batalkan').json()['status'], 'batal')

    def test_pemohon_tidak_bisa_batal_setelah_disetujui_tetapi_manager_bisa(self):
        rid = self._req_disetujui()
        self.assertEqual(self._aksi(self.kordiv, rid, 'batalkan').status_code, 400)
        self.assertEqual(self._aksi(self.manager, rid, 'batalkan').json()['status'], 'batal')

    def test_orang_lain_tidak_bisa_membatalkan(self):
        rid = self._buat().json()['id']
        self.assertEqual(self._aksi(self.spv, rid, 'batalkan').status_code, 403)

    def test_tidak_bisa_batal_setelah_diterima(self):
        rid = self._req_disetujui()
        self._aksi(self.admin, rid, 'siapkan')
        self._aksi(self.kordiv, rid, 'terima')
        self.assertEqual(self._aksi(self.manager, rid, 'batalkan').status_code, 400)

    def _ringkasan(self, user):
        self.client.force_authenticate(user)
        return self.client.get(URL + 'ringkasan/').json()

    def test_ringkasan_per_role(self):
        a = self._buat().json()['id']       # tetap diajukan
        b = self._buat().json()['id']       # -> disetujui (menunggu gudang)
        self._aksi(self.spv, b, 'setujui')
        c = self._buat().json()['id']       # -> disiapkan (menunggu pemohon)
        self._aksi(self.spv, c, 'setujui')
        self._aksi(self.admin, c, 'siapkan')
        self.assertTrue(a and b and c)

        spv = self._ringkasan(self.spv)
        self.assertEqual(spv['menunggu_persetujuan'], 1)
        self.assertEqual(spv['menunggu_disiapkan'], 0)          # spv bukan gudang
        admin = self._ringkasan(self.admin)
        self.assertEqual(admin['menunggu_disiapkan'], 1)
        self.assertEqual(admin['menunggu_persetujuan'], 0)      # admin bukan penyetuju
        kordiv = self._ringkasan(self.kordiv)
        self.assertEqual(kordiv['siap_diterima'], 1)
        self.assertEqual(self._ringkasan(self.spv_lain)['menunggu_persetujuan'], 0)  # bukan atasan pemohon
        self.assertEqual(self._ringkasan(self.manager)['menunggu_persetujuan'], 1)
        self.assertEqual(spv['total'], 1)

    def test_filter_status(self):
        a = self._buat().json()['id']
        b = self._buat().json()['id']
        self._aksi(self.spv, b, 'setujui')
        self.client.force_authenticate(self.spv)
        hasil = self.client.get(URL + '?status=diajukan').json()
        hasil = hasil.get('results', hasil) if isinstance(hasil, dict) else hasil
        self.assertEqual([x['id'] for x in hasil], [a])
