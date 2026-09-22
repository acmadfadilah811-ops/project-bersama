"""Layanan penandatanganan server-side untuk cetak senyap QZ Tray."""

import base64
import re
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.conf import settings


class QZSigningConfigurationError(RuntimeError):
    """Dilempar bila sertifikat QZ Tray belum dipasang di server."""


# qz-tray.js TIDAK pernah mengirim JSON permintaan mentah ke sini -- protokol
# resminya (lihat node_modules/qz-tray/qz-tray.js, fungsi _qz.websocket.setup
# ~L267-291) meng-hash {call, params, timestamp} dengan SHA-256 DULU di
# client, baru hash hex-nya yang dikirim ke setSignaturePromise() untuk
# ditandatangani -- server TIDAK PERNAH melihat isi 'call' aslinya (hash
# tidak bisa dibalik), jadi memvalidasi/whitelist nilai 'call' di sini
# (percobaan pertama, sebelum bug ini ditemukan 2026-09-22 lewat laporan
# user "failed to sign request") mustahil pernah berhasil -- json.loads()
# selalu gagal karena inputnya hash hex, bukan JSON. Satu-satunya validasi
# yang mungkin & masuk akal di sini: pastikan bentuknya memang hash SHA-256
# (64 karakter hex) sebelum ditandatangani, bukan isi sembarang.
_SHA256_HEX_RE = re.compile(r'^[0-9a-fA-F]{64}$')


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
    """Menandatangani permintaan QZ (hash SHA-256 hex dari call/params/
    timestamp, dibuat qz-tray.js di browser) menggunakan RSA SHA-512 di
    server."""
    if not isinstance(message, str) or not _SHA256_HEX_RE.match(message):
        raise ValueError('Format permintaan QZ Tray tidak valid.')

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
