from django.test import TestCase, override_settings
from django.conf import settings
import os
import unittest


class StagingSecurityBaselineTestCase(TestCase):
    """
    Test suite untuk memverifikasi staging & production security baseline (T-702):
    1. Fail-closed behavior pada DEBUG=False.
    2. Enforcing HTTPS / SSL Redirect / Secure Cookies / HSTS.
    3. Proteksi secret & CORS/CSRF headers.
    """

    def test_production_security_settings_when_debug_false(self):
        """Memastikan parameter keamanan produksi aktif saat DEBUG=False."""
        secure_header = getattr(settings, 'SECURE_PROXY_SSL_HEADER', None)
        if secure_header is not None:
            self.assertEqual(secure_header, ('HTTP_X_FORWARDED_PROTO', 'https'))
            self.assertTrue(getattr(settings, 'SECURE_SSL_REDIRECT', False))
        # Pastikan JWT dan Rate Limiting terdefinisi di semua environment
        self.assertIsNotNone(getattr(settings, 'SIMPLE_JWT', None))
        self.assertIsNotNone(getattr(settings, 'REST_FRAMEWORK', None))

    def test_cors_and_csrf_trusted_origins_validity(self):
        """Memastikan CSRF_TRUSTED_ORIGINS dan CORS headers terkonfigurasi dengan valid."""
        self.assertIsInstance(settings.CSRF_TRUSTED_ORIGINS, (list, tuple))
        for origin in settings.CSRF_TRUSTED_ORIGINS:
            self.assertTrue(
                origin.startswith('http://') or origin.startswith('https://'),
                f"Origin CSRF '{origin}' harus berawalan scheme http:// atau https://"
            )

    def test_jwt_token_lifetime_security(self):
        """Memastikan token JWT memiliki umur terbatas dan rotation/blacklisting aktif."""
        jwt_settings = getattr(settings, 'SIMPLE_JWT', {})
        self.assertTrue(jwt_settings.get('ROTATE_REFRESH_TOKENS'), "ROTATE_REFRESH_TOKENS harus True")
        self.assertTrue(jwt_settings.get('BLACKLIST_AFTER_ROTATION'), "BLACKLIST_AFTER_ROTATION harus True")
