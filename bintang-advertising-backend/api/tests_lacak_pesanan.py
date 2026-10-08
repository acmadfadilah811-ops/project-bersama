"""ID lacak pesanan (2026-10-08): ORD-... / POS-... dilacak lewat bot WA."""
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from .models import Divisi, JobBoard, Order, OrderActivityLog, OrderItem, TahapProses
from .pos_models import POSSale, POSSaleItem
from .services import lacak_pesanan as svc
from .services.wa_ai_tools import cek_status_pesanan


class _Dasar(TestCase):
    def setUp(self):
        self.tahap = TahapProses.objects.create(nama='Cetak Lacak', divisi=Divisi.objects.create(nama='Produksi Lacak'), urutan=1)
        self.order = Order.objects.create(id='ORD-20261008-AB12', nama='Budi', nomor_wa='081234567890', sumber='staff')
        self.item = OrderItem.objects.create(order=self.order, jenis_produk='Banner', qty=1, harga_jual=75000)
        self.sale = POSSale.objects.create(nomor='POS-LACAK-1', total=Decimal('50000'), status='paid')
        self.sale_item = POSSaleItem.objects.create(
            sale=self.sale, nama_snapshot='Stiker', harga_snapshot=Decimal('50000'), qty=Decimal('1'), subtotal=Decimal('50000'),
        )


class StatusDariIdTests(_Dasar):
    def test_cari_id_dari_pesan_bebas(self):
        self.assertEqual(svc.cari_id('kak cek ord-20261008-ab12 ya'), 'ORD-20261008-AB12')
        self.assertEqual(svc.cari_id('status POS-LACAK-1?'), 'POS-LACAK-1')
        self.assertIsNone(svc.cari_id('halo kak'))

    def test_pesanan_harga_hanya_untuk_nomor_pemesan(self):
        teks = svc.status_dari_id('ord-20261008-ab12', '6281234567890')
        self.assertIn('ORD-20261008-AB12', teks)
        self.assertIn('75.000', teks)
        self.assertNotIn('75.000', svc.status_dari_id('ORD-20261008-AB12', '6289999999999'))

    def test_transaksi_kasir_berspk_bisa_dilacak(self):
        JobBoard.objects.create(pos_sale_item=self.sale_item, tahap=self.tahap, status_pekerjaan='dikerjakan')
        teks = svc.status_dari_id('POS-LACAK-1')
        self.assertIn('Dalam Proses Produksi', teks)
        self.assertIn('Cetak Lacak', teks)
        self.assertTrue(cek_status_pesanan(nomor_order='pos-lacak-1')['ok'])

    def test_transaksi_kasir_tanpa_spk_atau_id_salah_tidak_ditemukan(self):
        self.assertIn('tidak ditemukan', svc.status_dari_id('POS-LACAK-1'))
        self.assertIn('tidak ditemukan', svc.status_dari_id('ORD-TIDAK-ADA'))


@patch('api.whatsapp_client.whatsapp_client.send_text_message', return_value={'ok': True})
class KirimIdLacakStaffTests(_Dasar):
    def test_pesanan_staff_dibayar_dikirimi_id_sekali(self, kirim):
        self.order.dp_dibayar = 20000
        with self.captureOnCommitCallbacks(execute=True):
            svc.jadwalkan_id_lacak_staff(self.order)
        with self.captureOnCommitCallbacks(execute=True):
            svc.jadwalkan_id_lacak_staff(self.order)
        self.assertEqual(kirim.call_count, 1)
        self.assertEqual(kirim.call_args.args[0], '6281234567890')
        self.assertIn('ID PESANAN: ORD-20261008-AB12', kirim.call_args.args[1])
        self.assertTrue(OrderActivityLog.objects.filter(order=self.order, tindakan=svc.TINDAKAN_KIRIM_ID).exists())

    def test_belum_dibayar_atau_bukan_staff_tidak_dikirim(self, kirim):
        with self.captureOnCommitCallbacks(execute=True):
            svc.jadwalkan_id_lacak_staff(self.order)  # dp 0
            self.order.dp_dibayar = 20000
            self.order.sumber = 'wa'  # bot WA sudah mengirim ID sendiri
            svc.jadwalkan_id_lacak_staff(self.order)
        kirim.assert_not_called()
