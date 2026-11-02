"""Perintah sinkron_rincian_peluang_crm: kirim ulang rincian untuk Peluang lama (2026-11-02)."""
import os
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.utils import timezone

from .crm_order_models import OrderAsalCRM
from .crm_push_models import OrderKeCRM
from .models import Contact, Order
from .pos_models import POSSale
from .tests_crm_order_kasir import _requests_palsu
from .tests_starfoto import _Dasar


@mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
class SinkronRincianPeluangTests(_Dasar):
    def setUp(self):
        super().setUp()
        # Dekorator kelas patch.dict hanya berlaku di method test_*, bukan setUp.
        env = mock.patch.dict(os.environ, {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
        env.start()
        self.addCleanup(env.stop)
        patch_pelanggan = mock.patch('api.services.crm_pelanggan.requests')
        patch_pelanggan.start()
        self.addCleanup(patch_pelanggan.stop)
        with _requests_palsu():
            with self.captureOnCommitCallbacks(execute=True):
                res = self._checkout(bayar=290000)
        self.assertEqual(res.status_code, 201, res.content)
        self.order = Order.objects.get(pk=res.json()['id'])
        kontak = Contact.objects.create(nomor_wa='6281234567892', nama='Joko')
        self.sale = POSSale.objects.create(
            nomor='POS-TEST-0003', pelanggan=kontak, total=Decimal('50000'), status='paid',
            synced_to_crm_at=timezone.now(),
        )

    def _jalankan(self, *args):
        out = StringIO()
        call_command('sinkron_rincian_peluang_crm', *args, '--jeda', '0', stdout=out)
        return out.getvalue()

    def test_dry_run_hanya_menghitung(self):
        with _requests_palsu() as req, mock.patch('api.services.crm_bridge.requests.post') as post_sale:
            teks = self._jalankan('--dry-run')
        self.assertIn('1 order kasir + 1 penjualan POS', teks)
        self.assertEqual(req.post.call_count, 0)
        post_sale.assert_not_called()

    def test_kirim_ulang_order_dan_possale_sekali_masing_masing(self):
        self.assertIsNotNone(OrderKeCRM.objects.get(order=self.order).terkirim_pada)
        with _requests_palsu() as req, mock.patch('api.services.crm_bridge.requests.post') as post_sale:
            teks = self._jalankan()
        self.assertEqual(req.post.call_count, 1)
        self.assertEqual(post_sale.call_count, 1)
        self.assertEqual(post_sale.call_args.kwargs['json']['sale']['id'], f'possale:{self.sale.id}')
        self.assertIn('2 dari 2 terkirim ulang', teks)

    def test_order_asal_crm_dan_yang_belum_pernah_terkirim_dilewati(self):
        OrderAsalCRM.objects.create(order=self.order, kunci='kunci-uji-asal')
        teks = self._jalankan('--dry-run')
        self.assertIn('0 order kasir', teks)
        OrderAsalCRM.objects.all().delete()
        OrderKeCRM.objects.filter(order=self.order).update(terkirim_pada=None)
        self.assertIn('0 order kasir', self._jalankan('--dry-run'))

    def test_maks_membatasi(self):
        with _requests_palsu() as req, mock.patch('api.services.crm_bridge.requests.post') as post_sale:
            teks = self._jalankan('--maks', '1')
        self.assertEqual(req.post.call_count + post_sale.call_count, 1)
        self.assertIn('1 dari 1 terkirim ulang', teks)
