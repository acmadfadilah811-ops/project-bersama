"""Jembatan CRM -> Bintang: order dari Sales (2026-09-26)."""

import os
from unittest import mock

from rest_framework.test import APITestCase

from .crm_order_models import OrderAsalCRM
from .customer_models import Customer
from .models import Contact, Divisi, JobBoard, Order, TahapProses
from .product_models import Product

KUNCI = 'kunci-crm-uji'
H = {'HTTP_X_API_KEY': KUNCI}
PRODUK = '/api/bridge/crm/produk/'
ORDER = '/api/bridge/crm/order/'
STATUS = '/api/bridge/crm/order-status/'
REKAP = '/api/bridge/crm/rekap-sales/'
RIWAYAT = '/api/bridge/crm/riwayat-pelanggan/'
LAPORAN = '/api/bridge/crm/laporan-penjualan/'


@mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': KUNCI})
class CrmOrderBridgeTest(APITestCase):
    def setUp(self):
        TahapProses.objects.create(nama='Cetak', divisi=Divisi.objects.create(nama='Produksi CRM'), urutan=1)
        self.banner = Product.objects.create(nama='Banner Flexi 280gr', harga_beli=10000, harga_jual_toko=25000)
        self.stiker = Product.objects.create(nama='Stiker Vinyl', harga_beli=3000, harga_jual_toko=7500)
        self.mati = Product.objects.create(nama='Banner Lama', harga_jual_toko=1000, is_active=False)

    def _order(self, **lebih):
        data = {
            'kunci': 'opp-7-1', 'crm_user_id': 4, 'crm_username': 'tim.salesmarketingcreative',
            'sales_nama': 'Tim Sales', 'crm_opportunity_id': 7, 'crm_contact_id': 3,
            'pelanggan': {'nama': 'Budi Santoso', 'nomor_hp': '0812-3456-7890', 'email': 'budi@contoh.id'},
            'items': [{'product_id': self.banner.id, 'qty': 2, 'keterangan': '3x1 m'},
                      {'product_id': self.stiker.id, 'qty': 10}],
            'catatan': 'Butuh Jumat',
        }
        data.update(lebih)
        return self.client.post(ORDER, data, format='json', **H)

    def test_kunci_api_wajib(self):
        self.assertEqual(self.client.get(PRODUK, {'q': 'banner'}).status_code, 401)
        self.assertEqual(self.client.post(ORDER, {}, format='json', HTTP_X_API_KEY='salah').status_code, 401)
        self.assertFalse(Order.objects.exists())

    def test_cari_produk_hanya_aktif(self):
        res = self.client.get(PRODUK, {'q': 'banner'}, **H)
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['nama'] for p in res.data['hasil']], ['Banner Flexi 280gr'])
        self.assertEqual(res.data['hasil'][0]['harga'], 25000)

    def test_buat_order_draft_dengan_harga_katalog(self):
        res = self._order()
        self.assertEqual(res.status_code, 201, res.data)
        order = Order.objects.get(pk=res.data['id'])
        self.assertEqual((order.status_global, order.sumber), ('draft', 'crm'))
        self.assertEqual(order.nomor_wa, '6281234567890')
        self.assertEqual(order.total_harga, 2 * 25000 + 10 * 7500)
        self.assertEqual(sorted(i.harga_jual for i in order.items.all()), [50000, 75000])
        self.assertTrue(all(i.product_id for i in order.items.all()))
        self.assertEqual(JobBoard.objects.filter(order_item__order=order).count(), 2)
        self.assertIn('Tim Sales', order.catatan_pelanggan)
        asal = OrderAsalCRM.objects.get(order=order)
        self.assertEqual((asal.crm_opportunity_id, asal.crm_user_id), (7, 4))

    def test_harga_dari_frontend_diabaikan(self):
        res = self._order(items=[{'product_id': self.banner.id, 'qty': 1, 'harga': 1}])
        self.assertEqual(Order.objects.get(pk=res.data['id']).total_harga, 25000)

    def test_idempoten_per_kunci(self):
        a = self._order()
        b = self._order()
        self.assertEqual((a.status_code, b.status_code), (201, 200))
        self.assertEqual(a.data['id'], b.data['id'])
        self.assertEqual(Order.objects.count(), 1)

    def test_pelanggan_baru_masuk_database_tanpa_duplikat(self):
        lama = Customer.objects.create(nama='Budi (lama)', handphone='081234567890')
        self._order()
        self._order(kunci='opp-7-2')
        self.assertEqual(Customer.objects.filter(handphone__endswith='234567890').count(), 1)
        self.assertEqual(Contact.objects.get(nomor_wa='6281234567890').customer_id, lama.id)

        self._order(kunci='opp-8-1', pelanggan={'nama': 'Sari Baru', 'nomor_hp': '6285711112222'})
        self.assertTrue(Customer.objects.filter(nama='Sari Baru', handphone='6285711112222').exists())

    def test_validasi_ditolak_tanpa_order(self):
        for salah in (
            {'items': []},
            {'items': [{'product_id': self.mati.id, 'qty': 1}]},
            {'items': [{'product_id': self.banner.id, 'qty': 0}]},
            {'items': [{'product_id': 'x', 'qty': 1}]},
            {'pelanggan': {'nama': 'A', 'nomor_hp': '12'}},
            {'pelanggan': {'nama': '', 'nomor_hp': '081234567890'}},
            {'kunci': ''},
        ):
            with self.subTest(salah=salah):
                self.assertEqual(self._order(**salah).status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderAsalCRM.objects.exists())

    def test_status_hanya_order_asal_crm(self):
        res = self._order()
        Order.objects.create(id='ORD-LAIN', nomor_wa='6281', nama='Lain', status_global='proses')
        by_opp = self.client.get(STATUS, {'crm_opportunity_id': 7}, **H).data['hasil']
        self.assertEqual([o['id'] for o in by_opp], [res.data['id']])
        self.assertEqual(by_opp[0]['status'], 'draft')
        by_id = self.client.get(STATUS, {'order_ids': f"{res.data['id']},ORD-LAIN"}, **H).data['hasil']
        self.assertEqual([o['id'] for o in by_id], [res.data['id']])
        self.assertEqual(self.client.get(STATUS, **H).status_code, 400)
        by_user = self.client.get(STATUS, {'crm_user_id': 4}, **H).data['hasil']
        self.assertEqual([o['sales_nama'] for o in by_user], ['Tim Sales'])
        self.assertEqual(self.client.get(STATUS, {'crm_user_id': 5}, **H).data['hasil'], [])
        semua = self.client.get(STATUS, {'semua': '1'}, **H).data['hasil']
        self.assertEqual([o['id'] for o in semua], [res.data['id']])

    def test_rekap_sales_per_periode(self):
        a = Order.objects.get(pk=self._order().data['id'])                     # Sales 4, lunas
        b = Order.objects.get(pk=self._order(kunci='k2').data['id'])            # Sales 4, belum lunas
        c = Order.objects.get(pk=self._order(kunci='k3').data['id'])            # Sales 4, batal
        d = Order.objects.get(pk=self._order(kunci='k4', crm_user_id=9).data['id'])  # Sales 9
        lama = Order.objects.get(pk=self._order(kunci='k5').data['id'])         # di luar periode
        a.dp_dibayar = a.total_harga
        a.save()
        Order.objects.filter(pk=c.pk).update(status_global='batal')
        Order.objects.filter(pk=lama.pk).update(waktu='2026-01-15T10:00:00+07:00')
        hari_ini = a.waktu.date().isoformat()
        res = self.client.get(REKAP, {'mulai': '2026-09-01', 'selesai': hari_ini}, **H)
        self.assertEqual(res.status_code, 200, res.data)
        per = {r['crm_user_id']: r for r in res.data['hasil']}
        self.assertEqual(per[4], {'crm_user_id': 4, 'jumlah_order': 2, 'jumlah_lunas': 1,
                                  'nilai_lunas': a.total_harga, 'nilai_belum_lunas': b.total_harga})
        self.assertEqual(per[9]['jumlah_order'], 1)
        hanya_9 = self.client.get(REKAP, {'mulai': '2026-09-01', 'selesai': hari_ini, 'crm_user_ids': '9'}, **H).data['hasil']
        self.assertEqual([r['crm_user_id'] for r in hanya_9], [9])
        self.assertEqual(d.sumber, 'crm')
        for salah in ({'mulai': 'x', 'selesai': hari_ini}, {'mulai': hari_ini, 'selesai': '2026-01-01'},
                      {'mulai': '2020-01-01', 'selesai': hari_ini}):
            self.assertEqual(self.client.get(REKAP, salah, **H).status_code, 400)
        self.assertEqual(self.client.get(REKAP, {'mulai': '2026-09-01', 'selesai': hari_ini}).status_code, 401)

    def test_riwayat_pelanggan_semua_kanal(self):
        from .pos_models import POSSale

        crm = Order.objects.get(pk=self._order().data['id'])
        crm.dp_dibayar = crm.total_harga
        crm.save()
        Order.objects.create(id='ORD-WA-1', nomor_wa='081234567890', nama='Budi', status_global='batal', sumber='wa')
        Order.objects.create(id='ORD-LAIN', nomor_wa='6289999999999', nama='Lain', status_global='proses')
        POSSale.objects.create(nomor='POS-UJI-1', pelanggan=Contact.objects.get(nomor_wa='6281234567890'),
                               total=30000, status='paid')
        res = self.client.get(RIWAYAT, {'nomor': '+62 812-3456-7890'}, **H)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(sorted(e['id'] for e in res.data['riwayat']), sorted([crm.id, 'ORD-WA-1', 'POS-UJI-1']))
        self.assertEqual(res.data['jumlah_transaksi'], 2)
        self.assertEqual(res.data['total_belanja_lunas'], crm.total_harga + 30000)
        self.assertTrue(res.data['terdaftar'])
        wa = next(e for e in res.data['riwayat'] if e['id'] == 'ORD-WA-1')
        self.assertTrue(wa['batal'])
        self.assertEqual(self.client.get(RIWAYAT, {'nomor': '12'}, **H).status_code, 400)
        self.assertEqual(self.client.get(RIWAYAT, {'nomor': '081234567890'}).status_code, 401)

    def test_laporan_penjualan_sama_dengan_dashboard_eksekutif(self):
        from datetime import date

        from . import executive_dashboard
        from .pos_models import POSSale

        crm = Order.objects.get(pk=self._order().data['id'])          # pelanggan baru, belum dibayar
        Order.objects.create(id='ORD-WA-B', nomor_wa='6281234567890', nama='Budi', status_global='batal', sumber='wa')
        # Order.save() menghitung ulang total dari item; order uji tanpa item diisi lewat update().
        Order.objects.create(id='ORD-LAMA', nomor_wa='085700001111', nama='Sari', status_global='selesai', sumber='wa')
        Order.objects.filter(pk='ORD-LAMA').update(waktu='2026-01-10T10:00:00+07:00', total_harga=40000, dp_dibayar=40000)
        Order.objects.create(id='ORD-SARI', nomor_wa='6285700001111', nama='Sari', status_global='proses', sumber='wa')
        Order.objects.filter(pk='ORD-SARI').update(total_harga=60000, dp_dibayar=60000, sisa_tagihan=0)
        POSSale.objects.create(nomor='POS-L-1', pelanggan_id='6285700001111', total=30000, status='paid')
        POSSale.objects.create(nomor='POS-L-2', total=5000, status='void')
        hari_ini = crm.waktu.date()
        res = self.client.get(LAPORAN, {'mulai': '2026-09-01', 'selesai': hari_ini.isoformat()}, **H)
        self.assertEqual(res.status_code, 200, res.data)
        r = res.data['ringkasan']
        self.assertEqual(r['omzet'], crm.total_harga + 60000 + 30000)
        self.assertEqual(r['omzet'], int(executive_dashboard._pendapatan(date(2026, 9, 1), hari_ini)))
        self.assertEqual((r['dibayar'], r['belum_dibayar']), (90000, crm.total_harga))
        self.assertEqual((r['pelanggan_aktif'], r['pelanggan_baru'], r['pelanggan_kembali']), (2, 1, 1))
        per_kanal = {k['kanal']: k for k in res.data['per_kanal']}
        self.assertEqual(per_kanal['CRM / Sales']['transaksi'], 1)
        self.assertEqual(per_kanal['Kasir (POS)']['omzet'], 30000)
        self.assertEqual(sum(b['pelanggan_baru'] for b in res.data['per_bulan']), 1)
        self.assertEqual(self.client.get(LAPORAN, {'mulai': 'x', 'selesai': 'y'}, **H).status_code, 400)
        self.assertEqual(self.client.get(LAPORAN, {'mulai': '2026-09-01', 'selesai': '2026-09-30'}).status_code, 401)

    def test_jalur_bot_wa_tidak_berubah(self):
        from .services.order_actions import buat_order_dari_items

        _id, order = buat_order_dari_items('6281111', 'WA', 'WA', [{'jenis_produk': 'Banner', 'qty': 1}])
        order.refresh_from_db()
        self.assertEqual((order.sumber, order.status_global, order.total_harga), ('wa', 'draft', 0))


class PelangganNomorTest(APITestCase):
    def test_order_wa_tidak_menduplikasi_pelanggan_format_08(self):
        from .services.order_actions import buat_order_dari_items

        lama = Customer.objects.create(nama='Ani', handphone='081299998888')
        buat_order_dari_items('6281299998888', 'Ani', 'Ani', [{'jenis_produk': 'Banner', 'qty': 1}])
        self.assertEqual(Customer.objects.filter(handphone__endswith='299998888').count(), 1)
        self.assertEqual(Contact.objects.get(nomor_wa='6281299998888').customer_id, lama.id)


class OrderLunasKeCrmTest(APITestCase):
    """Order asal CRM lunas -> CRM diminta menandai Opportunity Closed Won."""

    def setUp(self):
        env = mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': KUNCI, 'CRM_BRIDGE_URL': 'http://crm.uji/api/bridge/bintang-sale/'})
        env.start()
        self.addCleanup(env.stop)
        TahapProses.objects.create(nama='Cetak', divisi=Divisi.objects.create(nama='Produksi CRM'), urutan=1)
        banner = Product.objects.create(nama='Banner Flexi 280gr', harga_beli=10000, harga_jual_toko=25000)
        res = self.client.post(ORDER, {
            'kunci': 'opp-7-1', 'crm_user_id': 4, 'crm_opportunity_id': 7,
            'pelanggan': {'nama': 'Budi', 'nomor_hp': '081234567890'},
            'items': [{'product_id': banner.id, 'qty': 2}],
        }, format='json', **H)
        self.order = Order.objects.get(pk=res.data['id'])

    def _bayar(self, jumlah):
        self.order.refresh_from_db()
        self.order.dp_dibayar = jumlah
        with self.captureOnCommitCallbacks(execute=True):
            self.order.save()

    @mock.patch('api.services.crm_order.requests.post')
    def test_lunas_dikirim_sekali(self, post):
        post.return_value = mock.Mock(status_code=200)
        self._bayar(10000)
        post.assert_not_called()
        self._bayar(50000)
        post.assert_called_once()
        self.assertEqual(post.call_args.args[0], 'http://crm.uji/api/bridge/bintang-order-lunas/')
        self.assertEqual(post.call_args.kwargs['json'],
                         {'crm_opportunity_id': 7, 'order_id': self.order.id, 'total_harga': 50000})
        self.assertEqual(post.call_args.kwargs['headers']['X-Api-Key'], KUNCI)
        self.assertIsNotNone(OrderAsalCRM.objects.get(order=self.order).crm_won_terkirim)
        self._bayar(50000)
        post.assert_called_once()

    @mock.patch('api.services.crm_order.requests.post')
    def test_crm_gagal_dicoba_lagi_saat_simpan_berikutnya(self, post):
        post.return_value = mock.Mock(status_code=502)
        self._bayar(50000)
        self.assertIsNone(OrderAsalCRM.objects.get(order=self.order).crm_won_terkirim)
        post.return_value = mock.Mock(status_code=200)
        self._bayar(50000)
        self.assertEqual(post.call_count, 2)
        self.assertIsNotNone(OrderAsalCRM.objects.get(order=self.order).crm_won_terkirim)

    @mock.patch('api.services.crm_order.requests.post')
    def test_order_bukan_crm_atau_batal_tidak_dikirim(self, post):
        lain = Order.objects.create(id='ORD-LAIN', nomor_wa='6281', nama='Lain', status_global='proses')
        lain.dp_dibayar = lain.total_harga
        with self.captureOnCommitCallbacks(execute=True):
            lain.save()
        Order.objects.filter(pk=self.order.pk).update(status_global='batal')
        self._bayar(50000)
        post.assert_not_called()
