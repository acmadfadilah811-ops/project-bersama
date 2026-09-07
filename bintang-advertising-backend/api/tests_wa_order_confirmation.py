"""Test _bangun_balasan_konfirmasi_order (BaseWhatsAppWebhookView, api/views/whatsapp.py)
-- pesan konfirmasi WA setelah pelanggan ketik "sesuai" atas form order.

Bug ditemukan user 2026-09-07 lewat log percakapan Evolution API nyata: form
order gabungan sudah memuat konsep desain (Tulisan/Warna/Bentuk, lihat
brief_desain di _parse_form_order) dan sudah dikonfirmasi pelanggan di rekap,
tapi pesan konfirmasi tetap minta isi ulang Form Konsep Desain kosong dari
nol -- plus format **bold** ganda (bukan sintaks WA yang benar, *bold*
tunggal) dan sapaan "Pesanan Anda" yang beda nada dari "Kakak" di kalimat lain.
"""
from django.test import TestCase

from api.models import Order, OrderItem
from api.views.whatsapp import BaseWhatsAppWebhookView


class BalasanKonfirmasiOrderTest(TestCase):
    def setUp(self):
        self.view = BaseWhatsAppWebhookView()

    def _buat_order(self, order_id, keterangan_detail='', gdrive_link=''):
        order = Order.objects.create(id=order_id, nomor_wa='6281200000001', nama='Budi')
        OrderItem.objects.create(
            order=order, jenis_produk='Banner 300', qty=1,
            keterangan_detail=keterangan_detail,
            gdrive_customer_link=gdrive_link,
        )
        return order

    def test_konsep_sudah_ada_tidak_minta_form_ulang(self):
        self._buat_order(
            'ORD-TEST-0001',
            keterangan_detail='Konsep desain — Tulisan: Banner rumah dijual; Warna: kuning; Bentuk: horizontal',
        )
        jawaban = self.view._bangun_balasan_konfirmasi_order('ORD-TEST-0001', 'Kak Budi', is_desain_ready=False)

        self.assertNotIn('FORM KONSEP DESAIN', jawaban)
        self.assertIn('sudah kami catat', jawaban)

    def test_tanpa_konsep_tetap_minta_form_dengan_format_benar(self):
        self._buat_order('ORD-TEST-0002', keterangan_detail='')
        jawaban = self.view._bangun_balasan_konfirmasi_order('ORD-TEST-0002', 'Kak Budi', is_desain_ready=False)

        self.assertIn('FORM KONSEP DESAIN', jawaban)
        # Sintaks bold WA tunggal (*text*), bukan markdown ganda (**text**)
        # yang tampil sebagai bintang dobel literal di WhatsApp.
        self.assertNotIn('**Form Konsep Desain**', jawaban)
        self.assertIn('*Form Konsep Desain*', jawaban)

    def test_file_desain_sudah_ada_minta_upload_bukan_form_konsep(self):
        self._buat_order('ORD-TEST-0003', keterangan_detail='')
        jawaban = self.view._bangun_balasan_konfirmasi_order('ORD-TEST-0003', 'Kak Budi', is_desain_ready=True)

        self.assertNotIn('FORM KONSEP DESAIN', jawaban)
        self.assertIn('kirimkan file desain', jawaban)

    def test_sapaan_konsisten_pakai_kakak_bukan_anda(self):
        self._buat_order('ORD-TEST-0004', gdrive_link='https://drive.example/x')
        jawaban = self.view._bangun_balasan_konfirmasi_order('ORD-TEST-0004', 'Kak Budi', is_desain_ready=False)

        self.assertIn('Pesanan Kakak telah masuk', jawaban)
        self.assertNotIn('Pesanan Anda', jawaban)
