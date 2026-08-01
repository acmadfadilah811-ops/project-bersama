"""Email Resi (POSSale) — pakai django.core.mail.send_mail, SMTP yang sama
dengan fitur keamanan (OTP login/reset password di users/views.py)."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase

from api.pos_models import POSSale, POSSaleItem

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

    @patch('api.pos_views.whatsapp_client.send_text_message', return_value={'key': {'id': 'wa-test'}})
    def test_kirim_whatsapp_resi_menggunakan_gateway(self, send_text_message):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/whatsapp-resi/', {'number': '081234567890'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(send_text_message.call_args.args[0], '6281234567890')
        self.assertIn(self.sale.nomor, send_text_message.call_args.args[1])

    @patch('api.pos_views.whatsapp_client.send_text_message', return_value=None)
    def test_kegagalan_gateway_whatsapp_dilaporkan(self, _send_text_message):
        self.client.force_authenticate(self.kasir)
        response = self.client.post(
            f'/api/pos/sales/{self.sale.id}/whatsapp-resi/', {'number': '081234567890'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
