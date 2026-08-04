import base64
import json
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
                signed_request = json.dumps(
                    {'call': 'print', 'params': {}, 'timestamp': 1760000000000}, separators=(',', ':'),
                )
                sign_response = self.client.post('/api/integrations/qz/sign/', {'request': signed_request}, format='json')

        self.assertEqual(certificate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(certificate_response.data['certificate'], 'QZ TEST CERTIFICATE')
        self.assertEqual(sign_response.status_code, status.HTTP_200_OK)
        private_key.public_key().verify(
            base64.b64decode(sign_response.data['signature']),
            signed_request.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA512(),
        )

    def test_staff_cannot_fetch_certificate_or_request_signature(self):
        self.client.force_authenticate(self.staff)

        certificate_response = self.client.get('/api/integrations/qz/certificate/')
        sign_response = self.client.post('/api/integrations/qz/sign/', {'request': '{}'}, format='json')

        self.assertEqual(certificate_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(sign_response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(QZ_TRAY_CERTIFICATE_PATH='', QZ_TRAY_PRIVATE_KEY_PATH='')
    def test_supported_role_cannot_sign_non_print_operation(self):
        self.client.force_authenticate(self.kasir)

        response = self.client.post(
            '/api/integrations/qz/sign/',
            {'request': json.dumps({'call': 'file.write', 'params': {}, 'timestamp': 1760000000000})},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('tidak diizinkan', response.data['detail'])
