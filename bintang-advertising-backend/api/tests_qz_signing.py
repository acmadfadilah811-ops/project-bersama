import base64
import hashlib
import tempfile
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


class QZSigningEndpointTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username='qz_owner', password='password123', role='owner',
        )
        self.kasir = get_user_model().objects.create_user(
            username='qz_kasir', password='password123', role='kasir',
        )
        self.staff = get_user_model().objects.create_user(
            username='qz_staff', password='password123', role='staff',
        )

    @override_settings(QZ_TRAY_CERTIFICATE_PATH='', QZ_TRAY_PRIVATE_KEY_PATH='')
    def test_kasir_gets_clear_error_when_qz_signing_is_not_configured(self):
        self.client.force_authenticate(self.kasir)

        response = self.client.get('/api/integrations/qz/certificate/')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('belum dikonfigurasi', response.data['detail'])

    def test_owner_can_fetch_certificate_and_verify_server_signature(self):
        # qz-tray.js TIDAK mengirim JSON mentah -- ia meng-hash SHA-256
        # {call, params, timestamp} DULU di browser, hash hex 64-karakter
        # itulah yang dikirim ke endpoint sign (lihat komentar
        # api/services/qz_signing.py). Bug asli (2026-09-22): endpoint ini
        # sebelumnya mengira menerima JSON mentah dan selalu gagal
        # json.loads() untuk request sungguhan dari qz-tray -- test lama di
        # sini ikut salah asumsi (mengirim JSON), jadi tidak pernah
        # menangkap bug-nya.
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            certificate_path = Path(temp_dir) / 'digital-certificate.txt'
            private_key_path = Path(temp_dir) / 'private-key.pem'
            certificate_path.write_text('QZ TEST CERTIFICATE', encoding='utf-8')
            private_key_path.write_bytes(private_pem)

            with override_settings(
                QZ_TRAY_CERTIFICATE_PATH=str(certificate_path),
                QZ_TRAY_PRIVATE_KEY_PATH=str(private_key_path),
            ):
                self.client.force_authenticate(self.owner)
                certificate_response = self.client.get('/api/integrations/qz/certificate/')
                # Hash SHA-256 hex -- persis format yang dikirim qz-tray.js sungguhan.
                signed_request = hashlib.sha256(b'{"call":"print","params":{},"timestamp":1760000000000}').hexdigest()
                sign_response = self.client.post('/api/integrations/qz/sign/', {'request': signed_request}, format='json')

        self.assertEqual(certificate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(certificate_response.data['certificate'], 'QZ TEST CERTIFICATE')
        self.assertEqual(sign_response.status_code, status.HTTP_200_OK, sign_response.content)
        private_key.public_key().verify(
            base64.b64decode(sign_response.data['signature']),
            signed_request.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA512(),
        )

    def test_staff_cannot_fetch_certificate_or_request_signature(self):
        self.client.force_authenticate(self.staff)

        certificate_response = self.client.get('/api/integrations/qz/certificate/')
        sign_response = self.client.post(
            '/api/integrations/qz/sign/', {'request': 'a' * 64}, format='json',
        )

        self.assertEqual(certificate_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(sign_response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(QZ_TRAY_CERTIFICATE_PATH='', QZ_TRAY_PRIVATE_KEY_PATH='')
    def test_request_bukan_hash_sha256_ditolak_400(self):
        # Server tidak bisa lagi memvalidasi 'call' (hash tidak bisa
        # dibalik) -- satu-satunya validasi masuk akal: bentuknya harus
        # hash SHA-256 hex (64 karakter). JSON mentah/string sembarang harus
        # ditolak, bukan diam-diam ditandatangani.
        self.client.force_authenticate(self.kasir)

        response = self.client.post(
            '/api/integrations/qz/sign/',
            {'request': '{"call":"print","params":{},"timestamp":1760000000000}'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('tidak valid', response.data['detail'])

    @override_settings(QZ_TRAY_CERTIFICATE_PATH='', QZ_TRAY_PRIVATE_KEY_PATH='')
    def test_request_kosong_ditolak_400(self):
        self.client.force_authenticate(self.kasir)

        response = self.client.post('/api/integrations/qz/sign/', {'request': ''}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
