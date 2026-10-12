"""Order kasir (StarFoto & Advertising) dikirim ke CRM (2026-10-12): Open saat
belum lunas, Closed Won saat lunas, tidak pernah mengganggu checkout."""
import os
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.utils import timezone

from .crm_order_models import OrderAsalCRM
from .crm_push_models import OrderKeCRM
from .models import Order
from .tests_starfoto import _Dasar


def _respons(data=None):
    r = mock.Mock()
    r.raise_for_status.return_value = None
    r.content = b'{}'
    r.json.return_value = data or {'opportunity_id': 7}
    return r


def _requests_palsu(side_effect=None):
    """Ganti modul `requests` HANYA di crm_order_kasir (klien WA memakai requests.post global)."""
    return mock.patch('api.services.crm_order_kasir.requests', **{
        'post.return_value': _respons(),
        'post.side_effect': side_effect,
    })


@mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
class OrderKasirKeCrmTests(_Dasar):
    def setUp(self):
        super().setUp()
        self.kasir.hr_employee_id = 21
        self.kasir.save(update_fields=['hr_employee_id'])

    def _buat_order(self, bayar=150000):
        with self.captureOnCommitCallbacks(execute=True):
            res = self._checkout(bayar=bayar)
        self.assertEqual(res.status_code, 201, res.content)
        return Order.objects.get(pk=res.json()['id'])

    def test_order_baru_terkirim_open_dengan_penjual_unit_dan_total(self):
        with _requests_palsu() as req:
            post = req.post
            order = self._buat_order()
        self.assertEqual(post.call_count, 1)
        kirim = post.call_args.kwargs['json']
        self.assertEqual(kirim['nomor_wa'], '081234567890')
        self.assertEqual(kirim['penjual_hr_employee_id'], 21)
        self.assertEqual(kirim['sale']['id'], order.pk)
        self.assertEqual(kirim['sale']['unit_bisnis'], 'StarFoto')
        self.assertEqual(kirim['sale']['total'], 290000.0)
        self.assertFalse(kirim['sale']['lunas'])
        self.assertEqual(post.call_args.kwargs['headers']['X-Api-Key'], 'kunci-uji')
        ke_crm = OrderKeCRM.objects.get(order=order)
        self.assertIsNotNone(ke_crm.terkirim_pada)
        self.assertIsNone(ke_crm.lunas_terkirim_pada)
        self.assertEqual((ke_crm.total_terkirim, ke_crm.crm_opportunity_id), (290000, 7))

    def test_lunas_mengabari_crm_sekali_saja(self):
        with _requests_palsu() as req:
            post = req.post
            order = self._buat_order()
            with self.captureOnCommitCallbacks(execute=True):
                res = self.client.post(f'/api/orders/{order.pk}/bayar/', {
                    'jumlah_bayar': 140000, 'metode_pembayaran': 'tunai', 'idempotency_key': 'bayar-uji-1',
                }, format='json')
            self.assertEqual(res.status_code, 200, res.content)
            self.assertEqual(post.call_count, 2)
            self.assertTrue(post.call_args.kwargs['json']['sale']['lunas'])
            self.assertIsNotNone(OrderKeCRM.objects.get(order=order).lunas_terkirim_pada)
            # Simpan lagi order yang sudah lunas & terkirim -> tidak memanggil CRM.
            with self.captureOnCommitCallbacks(execute=True):
                Order.objects.get(pk=order.pk).save()
            self.assertEqual(post.call_count, 2)

    def test_crm_down_checkout_tetap_berhasil_dan_bisa_dikirim_ulang(self):
        with _requests_palsu(side_effect=OSError('crm mati')):
            order = self._buat_order()
        self.assertIsNone(OrderKeCRM.objects.get(order=order).terkirim_pada)
        out = StringIO()
        with _requests_palsu() as req:
            post = req.post
            call_command('sinkron_order_crm', '--dry-run', stdout=out)
            self.assertEqual(post.call_count, 0)
            self.assertIn('1 order tertunda', out.getvalue())
            call_command('sinkron_order_crm', stdout=StringIO())
            self.assertEqual(post.call_count, 1)
        self.assertIsNotNone(OrderKeCRM.objects.get(order=order).terkirim_pada)

    def test_order_asal_crm_dan_tanpa_nomor_wa_tidak_dikirim(self):
        with _requests_palsu() as req:
            post = req.post
            order = self._buat_order()
            self.assertEqual(post.call_count, 1)
            OrderKeCRM.objects.filter(order=order).delete()
            OrderAsalCRM.objects.create(order=order, kunci='k-uji')
            from .services.crm_order_kasir import kirim_order_ke_crm
            kirim_order_ke_crm(order.pk)
            self.assertEqual(post.call_count, 1)
            OrderAsalCRM.objects.all().delete()
            Order.objects.filter(pk=order.pk).update(nomor_wa='')
            kirim_order_ke_crm(order.pk)
            self.assertEqual(post.call_count, 1)

    def test_tanpa_api_key_tidak_memanggil_crm(self):
        with mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': ''}), _requests_palsu() as req:
            self._buat_order()
        req.post.assert_not_called()
