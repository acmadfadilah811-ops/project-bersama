from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Order, OrderActivityLog, OrderItem, Product, SystemConfig
from api.services.order_invoice_whatsapp import (
    _ambil_finishing,
    _label_item_invoice,
    hitung_ringkasan_invoice_dp,
    jadwalkan_invoice_dp_otomatis,
    kirim_invoice_dp_whatsapp,
    kirim_invoice_pesanan_whatsapp,
    susun_invoice_dp_pdf,
)


class InvoiceDpWhatsAppTests(APITestCase):
    def setUp(self):
        self.kasir = get_user_model().objects.create_user(
            username='kasir_invoice_dp', password='secret', role='kasir',
        )
        self.order = Order.objects.create(
            nama='Pelanggan Invoice DP',
            nomor_wa='081234567890',
            sumber='pos',
            metode_pembayaran='tunai',
            dp_dibayar=10000,
            jatuh_tempo=timezone.localdate() + timedelta(days=7),
            dilayani_oleh=self.kasir,
        )
        OrderItem.objects.create(
            order=self.order,
            jenis_produk='Banner',
            qty=1,
            harga_jual=50000,
            detail=[{
                'harga_sebelum_diskon': 60000,
                'diskon_nominal': 10000,
                'diskon': 10000,
                'tipe_diskon': 'nominal',
            }],
        )
        self.order.refresh_from_db()
        self.product = Product.objects.create(
            nama='Produk Invoice Tracking', harga_jual_toko=50000,
        )

    @patch(
        'api.services.order_invoice_whatsapp.whatsapp_client.send_media_message',
        return_value={'key': {'id': 'invoice-dp-test'}},
    )
    def test_invoice_dp_dikirim_ke_whatsapp_dengan_ringkasan_tagihan(self, send_media_message):
        result = kirim_invoice_dp_whatsapp(order_id=self.order.id, otomatis=True)

        self.assertTrue(result['ok'])
        self.assertEqual(result['status'], 'sent')
        self.assertEqual(send_media_message.call_args.args[0], '6281234567890')
        self.assertEqual(send_media_message.call_args.args[2], 'document')
        self.assertEqual(send_media_message.call_args.args[3], 'application/pdf')
        self.assertIn(self.order.id, send_media_message.call_args.args[4])
        self.assertTrue(send_media_message.call_args.args[1])
        self.assertTrue(OrderActivityLog.objects.filter(
            order=self.order,
            tindakan='KIRIM_INVOICE_DP_WA',
            keterangan__contains='6281234567890',
        ).exists())

    def test_invoice_dp_otomatis_dilewati_saat_dimatikan_sementara(self):
        SystemConfig.objects.create(key='order_invoice_dp_wa_otomatis_aktif', value='false')
        with patch('api.services.order_invoice_whatsapp.kirim_invoice_dp_whatsapp') as mock_kirim:
            with self.captureOnCommitCallbacks(execute=True):
                jadwalkan_invoice_dp_otomatis(self.order.id)
        mock_kirim.assert_not_called()

    def test_invoice_dp_otomatis_tetap_jalan_tanpa_toggle_diset(self):
        # Key belum pernah dibuat -> default AKTIF, tidak mengubah perilaku lama.
        with patch('api.services.order_invoice_whatsapp.kirim_invoice_dp_whatsapp') as mock_kirim:
            with self.captureOnCommitCallbacks(execute=True):
                jadwalkan_invoice_dp_otomatis(self.order.id)
        mock_kirim.assert_called_once_with(order_id=self.order.id, otomatis=True)

    @patch('api.services.order_invoice_whatsapp.whatsapp_client.send_media_message', return_value=None)
    def test_gagal_kirim_invoice_tidak_mengubah_order_dp(self, send_media_message):
        result = kirim_invoice_dp_whatsapp(order_id=self.order.id, otomatis=True)

        self.assertFalse(result['ok'])
        self.assertEqual(result['status'], 'failed')
        send_media_message.assert_called_once()
        self.order.refresh_from_db()
        self.assertEqual(self.order.dp_dibayar, 10000)
        self.assertEqual(self.order.sisa_tagihan, 40000)
        self.assertTrue(OrderActivityLog.objects.filter(
            order=self.order,
            tindakan='GAGAL_KIRIM_INVOICE_DP_WA',
        ).exists())

    def test_ringkasan_invoice_menampilkan_diskon_item(self):
        ringkasan = hitung_ringkasan_invoice_dp(self.order)

        self.assertEqual(ringkasan['subtotal_item'], 60000)
        self.assertEqual(ringkasan['diskon_item'], 10000)
        self.assertEqual(ringkasan['diskon_nota'], 0)
        self.assertEqual(ringkasan['diskon_total'], 10000)

    @patch(
        'api.services.order_invoice_whatsapp.whatsapp_client.send_media_message',
        return_value={'key': {'id': 'invoice-pesanan-test'}},
    )
    def test_invoice_pesanan_manual_memuat_id_produk_dan_dapat_dikirim(self, send_media_message):
        item = self.order.items.first()
        item.product = self.product
        item.save(update_fields=['product'])

        result = kirim_invoice_pesanan_whatsapp(order_id=self.order.id)

        self.assertTrue(result['ok'])
        self.assertEqual(send_media_message.call_args.args[0], '6281234567890')
        self.assertIn('Invoice-Pesanan-', send_media_message.call_args.args[4])
        self.assertIn(str(self.product.id), _label_item_invoice(item))
        self.assertTrue(OrderActivityLog.objects.filter(
            order=self.order,
            tindakan='KIRIM_INVOICE_WA',
        ).exists())

    @patch(
        'api.services.order_invoice_whatsapp.whatsapp_client.send_media_message',
        return_value={'key': {'id': 'invoice-siap-diambil-test'}},
    )
    def test_invoice_pesanan_ready_menyertakan_keterangan_siap_diambil(self, send_media_message):
        # Bug ditemukan 2026-08-13: kasir kirim faktur WA tanpa cara memberi
        # tahu pelanggan pesanannya sudah selesai — sekarang otomatis
        # ditambahkan di caption pesan WA & banner di PDF saat
        # status_global='ready' (ditandai otomatis oleh views/jobs.py setelah
        # semua item selesai diproduksi).
        self.order.status_global = 'ready'
        self.order.save(update_fields=['status_global'])

        result = kirim_invoice_pesanan_whatsapp(order_id=self.order.id)

        self.assertTrue(result['ok'])
        caption = send_media_message.call_args.kwargs.get('caption')
        self.assertIn('SIAP DIAMBIL', caption)

    @patch(
        'api.services.order_invoice_whatsapp.whatsapp_client.send_media_message',
        return_value={'key': {'id': 'invoice-belum-siap-test'}},
    )
    def test_invoice_pesanan_belum_ready_tidak_menyertakan_keterangan(self, send_media_message):
        result = kirim_invoice_pesanan_whatsapp(order_id=self.order.id)

        self.assertTrue(result['ok'])
        caption = send_media_message.call_args.kwargs.get('caption')
        self.assertNotIn('SIAP DIAMBIL', caption)

    def test_susun_invoice_pdf_status_ready_tetap_pdf_valid(self):
        self.order.status_global = 'ready'
        self.order.save(update_fields=['status_global'])
        self.order.refresh_from_db()

        pdf_bytes = susun_invoice_dp_pdf(self.order)

        self.assertTrue(pdf_bytes)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))

    @patch(
        'api.services.order_invoice_whatsapp.whatsapp_client.send_media_message',
        return_value={'key': {'id': 'invoice-endpoint-test'}},
    )
    def test_endpoint_invoice_pesanan_diizinkan_untuk_kasir(self, send_media_message):
        self.client.force_authenticate(self.kasir)

        response = self.client.post(f'/api/orders/{self.order.id}/invoice-whatsapp/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['ok'])
        send_media_message.assert_called_once()


class FinishingInvoiceTests(APITestCase):
    """Finishing yang pelanggan/kasir isi tersimpan di `OrderItem.detail`,
    tapi dulu tidak pernah ikut tercetak di invoice (bug ditemukan &
    diperbaiki 2026-08-12). `detail` punya DUA bentuk tergantung asal order:
    form WA lama (list of {"key","value"}) atau checkout POS kasir (satu
    dict bernama field langsung)."""

    def setUp(self):
        self.kasir = get_user_model().objects.create_user(
            username='kasir_finishing_invoice', password='secret', role='kasir',
        )
        self.order = Order.objects.create(
            nama='Pelanggan Finishing', nomor_wa='081234500000', sumber='wa',
        )

    def test_ambil_finishing_dari_form_wa(self):
        item = OrderItem.objects.create(
            order=self.order, jenis_produk='Banner', qty=1, harga_jual=50000,
            detail=[
                {'key': 'Ukuran', 'value': '2x3 meter'},
                {'key': 'Finishing', 'value': 'Mata Ayam'},
                {'key': 'Bahan', 'value': 'Flexi Korea'},
            ],
        )
        self.assertEqual(_ambil_finishing(item), 'Mata Ayam')

    def test_ambil_finishing_dari_checkout_pos(self):
        item = OrderItem.objects.create(
            order=self.order, jenis_produk='Banner', qty=1, harga_jual=50000,
            detail=[{
                'tipe_hitung': 'meteran', 'finishing': 'Laminating Glossy',
                'biaya_finishing': 5000,
            }],
        )
        self.assertEqual(_ambil_finishing(item), 'Laminating Glossy')

    def test_ambil_finishing_polosan_dianggap_kosong(self):
        item = OrderItem.objects.create(
            order=self.order, jenis_produk='Kartu Nama', qty=1, harga_jual=50000,
            detail=[{'tipe_hitung': 'pcs', 'finishing': 'Polosan'}],
        )
        self.assertEqual(_ambil_finishing(item), '')

    def test_ambil_finishing_tanpa_detail_tidak_error(self):
        item = OrderItem.objects.create(
            order=self.order, jenis_produk='Item Custom', qty=1, harga_jual=10000,
        )
        self.assertEqual(_ambil_finishing(item), '')

    def test_susun_invoice_pdf_dengan_finishing_tidak_error(self):
        OrderItem.objects.create(
            order=self.order, jenis_produk='Banner', qty=1, harga_jual=50000,
            detail=[{'key': 'Finishing', 'value': 'Mata Ayam'}],
        )
        self.order.refresh_from_db()

        pdf_bytes = susun_invoice_dp_pdf(self.order)

        self.assertTrue(pdf_bytes)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))
