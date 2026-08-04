"""Layanan penandatanganan server-side untuk cetak senyap QZ Tray."""

import base64
import json
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.conf import settings


class QZSigningConfigurationError(RuntimeError):
    """Dilempar bila sertifikat QZ Tray belum dipasang di server."""


_ALLOWED_QZ_CALLS = {'printers.find', 'print'}


def _read_configured_file(setting_name):
    path_value = getattr(settings, setting_name, '')
    if not path_value:
        raise QZSigningConfigurationError('Sertifikat QZ Tray belum dikonfigurasi di server.')

    path = Path(path_value)
    if not path.is_file():
        raise QZSigningConfigurationError('Berkas sertifikat QZ Tray tidak ditemukan di server.')
    return path.read_bytes()


def get_qz_certificate():
    """Mengembalikan sertifikat publik yang dipercaya QZ Tray."""
    try:
        return _read_configured_file('QZ_TRAY_CERTIFICATE_PATH').decode('utf-8')
    except UnicodeDecodeError as error:
        raise QZSigningConfigurationError('Berkas sertifikat QZ Tray tidak valid.') from error


def sign_qz_request(message):
    """Menandatangani permintaan QZ menggunakan RSA SHA-512 di server."""
    if not isinstance(message, str) or not message.strip():
        raise ValueError('Permintaan yang akan ditandatangani wajib diisi.')
    if len(message.encode('utf-8')) > 65536:
        raise ValueError('Permintaan QZ Tray terlalu besar untuk ditandatangani.')
    try:
        payload = json.loads(message)
    except json.JSONDecodeError as error:
        raise ValueError('Format permintaan QZ Tray tidak valid.') from error
    if payload.get('call') not in _ALLOWED_QZ_CALLS:
        raise ValueError('Operasi QZ Tray ini tidak diizinkan.')

    try:
        private_key = serialization.load_pem_private_key(
            _read_configured_file('QZ_TRAY_PRIVATE_KEY_PATH'),
            password=None,
        )
    except (TypeError, ValueError) as error:
        raise QZSigningConfigurationError('Private key QZ Tray tidak valid atau membutuhkan kata sandi.') from error
    signature = private_key.sign(
        message.encode('utf-8'),
        padding.PKCS1v15(),
        hashes.SHA512(),
    )
    return base64.b64encode(signature).decode('ascii')
