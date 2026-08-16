"""Email Resi (POSSale) — pakai django.core.mail.send_mail, SMTP yang sama
dengan fitur keamanan (OTP login/reset password di users/views.py)."""
from unittest.mock import patch
from datetime import datetime, timezone as datetime_timezone

from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase

from api.pos_models import POSSale, POSSaleItem
from api.models import Contact, JobBoard, SystemConfig
from api.services.pos_receipt_whatsapp import (
    format_waktu_dokumen, kirim_resi_pos_whatsapp, jadwalkan_resi_pos_otomatis,
    sale_siap_diambil, susun_resi, susun_resi_pdf,
)

User = get_user_model()


class EmailResiTests(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_email_resi', password='secret', role='kasir')
        self.staff = User.objects.create_user(username='staff_email_resi', password='secret', role='staff')
        self.sale = POSSale.objects.create(
            nomor='POS-EMAIL-TEST-001', kasir=self.kasir,
            subtotal=50000, diskon=0, pajak=0, total=50000,
            metode_bayar='Cash', dibayar=50000, kembalian=0, status='paid',
        )
        POSSaleItem.objects.create(
            sale=self.sale, nama_snapshot='Banner', harga_snapshot=50000, qty=1, subtotal=50000,
        )

    def test_format_waktu_dokumen_menggunakan_wib_bukan_utc(self):
        waktu_utc = datetime(2026, 8, 9, 5, 5, tzinfo=datetime_timezone.utc)

        self.assertEqual(format_waktu_dokumen(waktu_utc), '09-08-2026 12:05')

    def test_kirim_email_resi_berhasil(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/email-resi/', {'email': 'pelanggan@test.com'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.sale.nomor, mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ['pelanggan@test.com'])

    def test_email_tidak_valid_ditolak(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/email-resi/', {'email': 'bukan-email'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_staff_role_ditolak(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/email-resi/', {'email': 'pelanggan@test.com'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kegagalan_smtp_mengembalikan_pesan_jelas_bukan_500(self):
        self.client.force_authenticate(self.kasir)
        with patch('django.core.mail.send_mail', side_effect=Exception('SMTP down')):
            response = self.client.post(
                f'/api/pos/sales/{self.sale.id}/email-resi/', {'email': 'pelanggan@test.com'}, format='json'
            )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('api.services.pos_receipt_whatsapp.whatsapp_client.send_media_message', return_value={'key': {'id': 'wa-test'}})
    def test_kirim_whatsapp_resi_menggunakan_gateway(self, send_media_message):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/whatsapp-resi/', {'number': '081234567890'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(send_media_message.call_args.args[0], '6281234567890')
        self.assertEqual(send_media_message.call_args.args[2], 'document')
        self.assertEqual(send_media_message.call_args.args[3], 'application/pdf')
        self.assertIn(self.sale.nomor, send_media_message.call_args.args[4])

    @patch('api.services.pos_receipt_whatsapp.whatsapp_client.send_media_message', return_value=None)
    def test_kegagalan_gateway_whatsapp_dilaporkan(self, _send_media_message):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/whatsapp-resi/', {'number': '081234567890'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('api.services.pos_receipt_whatsapp.whatsapp_client.send_media_message', return_value={'key': {'id': 'wa-auto'}})
    def test_resi_otomatis_pelanggan_terkirim_satu_kali(self, send_media_message):
        contact = Contact.objects.create(nomor_wa='081234567890', nama='Pelanggan POS')
        self.sale.pelanggan = contact
        self.sale.save(update_fields=['pelanggan'])

        first = kirim_resi_pos_whatsapp(sale_id=self.sale.id, otomatis=True)
        second = kirim_resi_pos_whatsapp(sale_id=self.sale.id, otomatis=True)

        self.assertTrue(first['ok'])
        self.assertEqual(first['status'], 'sent')
        self.assertTrue(second['ok'])
        self.assertTrue(second['duplicate'])
        self.assertEqual(send_media_message.call_count, 1)
        self.assertEqual(send_media_message.call_args.args[0], '6281234567890')
        self.assertEqual(send_media_message.call_args.args[2], 'document')
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.whatsapp_resi_status, 'sent')
        self.assertEqual(self.sale.whatsapp_resi_number, '6281234567890')
        self.assertIsNotNone(self.sale.whatsapp_resi_sent_at)

    @patch('api.services.pos_receipt_whatsapp.whatsapp_client.send_media_message')
    def test_resi_otomatis_dilewati_tanpa_nomor_pelanggan(self, send_media_message):
        result = kirim_resi_pos_whatsapp(sale_id=self.sale.id, otomatis=True)

        self.assertFalse(result['ok'])
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'invalid_number')
        send_media_message.assert_not_called()
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.whatsapp_resi_status, 'skipped')

    def test_resi_otomatis_dilewati_saat_dimatikan_sementara(self):
        SystemConfig.objects.create(key='pos_resi_wa_otomatis_aktif', value='false')
        with patch('api.services.pos_receipt_whatsapp.kirim_resi_pos_whatsapp') as mock_kirim:
            with self.captureOnCommitCallbacks(execute=True):
                jadwalkan_resi_pos_otomatis(self.sale.id)
        mock_kirim.assert_not_called()

    def test_resi_otomatis_tetap_jalan_tanpa_toggle_diset(self):
        # Key belum pernah dibuat -> default AKTIF, tidak mengubah perilaku lama.
        with patch('api.services.pos_receipt_whatsapp.kirim_resi_pos_whatsapp') as mock_kirim:
            with self.captureOnCommitCallbacks(execute=True):
                jadwalkan_resi_pos_otomatis(self.sale.id)
        mock_kirim.assert_called_once_with(sale_id=self.sale.id, otomatis=True)

    def test_susun_resi_mencetak_catatan_item(self):
        # catatan sudah berisi ukuran/finishing/diskon-item (dirangkai
        # frontend saat checkout) tapi dulu tidak pernah ikut dicetak di resi
        # sama sekali (bug ditemukan & diperbaiki 2026-08-12).
        item = self.sale.items.first()
        item.catatan = 'Ukuran 2 m × 3 m | Finishing: Mata Ayam (Rp 5.000)'
        item.save(update_fields=['catatan'])

        teks = susun_resi(self.sale)

        self.assertIn('Ukuran 2 m × 3 m', teks)
        self.assertIn('Finishing: Mata Ayam', teks)

    def test_susun_resi_tanpa_catatan_tidak_ada_baris_kosong_aneh(self):
        teks = susun_resi(self.sale)
        self.assertNotIn('_None_', teks)
        self.assertNotIn('  _', teks)

    def test_susun_resi_pdf_dengan_catatan_tidak_error(self):
        item = self.sale.items.first()
        item.catatan = 'Ukuran 2 m × 3 m | Finishing: Mata Ayam'
        item.save(update_fields=['catatan'])

        pdf_bytes = susun_resi_pdf(self.sale)

        self.assertTrue(pdf_bytes)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))


class ResiSiapDiambilTests(APITestCase):
    """Bug ditemukan 2026-08-13: kasir kirim ulang resi WA dari panel Pesanan
    & Pelunasan tanpa cara memberi tahu pelanggan pesanannya sudah selesai
    diproduksi — sekarang otomatis ditambahkan di caption WA & banner di PDF
    kalau seluruh SPK transaksi POS sudah 'selesai' (padanan
    Order.status_global == 'ready')."""

    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_siap_diambil', password='secret', role='kasir')
        self.sale = POSSale.objects.create(
            nomor='POS-SIAP-TEST-001', kasir=self.kasir,
            subtotal=50000, diskon=0, pajak=0, total=50000,
            metode_bayar='Cash', dibayar=50000, kembalian=0, status='paid',
        )
        self.item = POSSaleItem.objects.create(
            sale=self.sale, nama_snapshot='Banner', harga_snapshot=50000, qty=1, subtotal=50000,
        )

    def test_tanpa_spk_tidak_dianggap_siap_diambil(self):
        self.assertFalse(sale_siap_diambil(self.sale))

    def test_spk_masih_antrean_belum_siap_diambil(self):
        JobBoard.objects.create(pos_sale_item=self.item, status_pekerjaan='antrean')

        self.assertFalse(sale_siap_diambil(self.sale))

    def test_semua_spk_selesai_dianggap_siap_diambil(self):
        JobBoard.objects.create(pos_sale_item=self.item, status_pekerjaan='selesai')

        self.assertTrue(sale_siap_diambil(self.sale))

    def test_satu_spk_belum_selesai_belum_siap_diambil(self):
        item_kedua = POSSaleItem.objects.create(
            sale=self.sale, nama_snapshot='Stiker', harga_snapshot=20000, qty=1, subtotal=20000,
        )
        JobBoard.objects.create(pos_sale_item=self.item, status_pekerjaan='selesai')
        JobBoard.objects.create(pos_sale_item=item_kedua, status_pekerjaan='dikerjakan')

        self.assertFalse(sale_siap_diambil(self.sale))

    def test_susun_resi_pdf_siap_diambil_tetap_pdf_valid(self):
        JobBoard.objects.create(pos_sale_item=self.item, status_pekerjaan='selesai')

        pdf_bytes = susun_resi_pdf(self.sale)

        self.assertTrue(pdf_bytes)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))

    @patch('api.services.pos_receipt_whatsapp.whatsapp_client.send_media_message', return_value={'key': {'id': 'wa-siap'}})
    def test_caption_wa_menyertakan_keterangan_siap_diambil(self, send_media_message):
        JobBoard.objects.create(pos_sale_item=self.item, status_pekerjaan='selesai')

        result = kirim_resi_pos_whatsapp(sale_id=self.sale.id, number='081234567890')

        self.assertTrue(result['ok'])
        caption = send_media_message.call_args.kwargs.get('caption')
        self.assertIn('SIAP DIAMBIL', caption)

    @patch('api.services.pos_receipt_whatsapp.whatsapp_client.send_media_message', return_value={'key': {'id': 'wa-belum-siap'}})
    def test_caption_wa_tanpa_spk_tidak_menyertakan_keterangan(self, send_media_message):
        result = kirim_resi_pos_whatsapp(sale_id=self.sale.id, number='081234567890')

        self.assertTrue(result['ok'])
        caption = send_media_message.call_args.kwargs.get('caption')
        self.assertNotIn('SIAP DIAMBIL', caption)
