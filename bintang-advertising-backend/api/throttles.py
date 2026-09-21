import re
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, SimpleRateThrottle

class ExportRateThrottle(UserRateThrottle):
    scope = 'export'

class ReportRateThrottle(UserRateThrottle):
    scope = 'report'

class PasskeyRateThrottle(UserRateThrottle):
    scope = 'passkey'

class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'

class PasswordResetRequestThrottle(AnonRateThrottle):
    scope = 'password_reset_request'

class PasswordResetVerifyThrottle(SimpleRateThrottle):
    scope = 'password_reset_verify'

    def parse_rate(self, rate):
        # Rate '5/5minute' (5 percobaan per 5 menit) tidak bisa dibaca DRF: ia hanya
        # memakai huruf pertama periode ('5') -> KeyError -> setiap verifikasi OTP
        # lupa-password error 500 (ditemukan 2026-09-22, akun operatora3).
        if rate is None:
            return (None, None)
        jumlah, _, periode = rate.partition('/')
        m = re.fullmatch(r'(\d*)(second|minute|hour|day|s|m|h|d)', periode)
        if not m:
            return super().parse_rate(rate)
        satuan = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}[m.group(2)[0]]
        return (int(jumlah), int(m.group(1) or 1) * satuan)
    def get_cache_key(self, request, view):
        username = str(request.data.get('username', '')).strip().lower()
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': f'{username}:{ident}'}
