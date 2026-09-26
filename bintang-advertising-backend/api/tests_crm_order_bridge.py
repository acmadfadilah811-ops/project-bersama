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
