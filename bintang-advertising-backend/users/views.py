from datetime import timedelta
from datetime import timezone as dt_timezone
import os
import secrets
import uuid

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken, UntypedToken
from rest_framework_simplejwt.views import TokenObtainPairView

from api.models import CustomUser
from api.permissions import IsOwnerOrManager, IsStrictOwnerOrManager
from api.throttles import LoginRateThrottle, PasswordResetRequestThrottle, PasswordResetVerifyThrottle

from .models import Profile, SecurityAuditLog, SessionToken
from .password_rules import cek_sandi_baru
from .serializers import (
    SecurityAuditLogSerializer,
    SessionTokenSerializer,
    StaffStatusSerializer,
    UserMeSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_client_ip(request):
    """Ambil IP klien hanya dari rantai proxy yang jumlahnya dikonfigurasi."""
    remote = request.META.get("REMOTE_ADDR")
    num_proxies = int(getattr(settings, "NUM_PROXIES", 0) or 0)
    xff = [part.strip() for part in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",") if part.strip()]
    if num_proxies > 0 and len(xff) >= num_proxies:
        return xff[-num_proxies]
    return remote


def _parse_device(user_agent: str) -> str:
    """Buat label device singkat dari User-Agent string."""
    ua = user_agent.lower()
    browser = "Browser"
    if "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua:
        browser = "Safari"
    elif "edge" in ua:
        browser = "Edge"

    os_name = "Unknown OS"
    if "windows" in ua:
        os_name = "Windows"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    elif "mac" in ua:
        os_name = "macOS"

    return f"{browser} di {os_name}"


# ---------------------------------------------------------------------------
# Custom Login View — extend TokenObtainPairView
# ---------------------------------------------------------------------------

# Penguncian akun sementara (AKS-03): MAKS_GAGAL_LOGIN gagal berturut-turut dalam
# DURASI_KUNCI_LOGIN detik -> login ditolak selama sisa masa kunci. Kunci per username
# (bukan per IP) agar tebakan dari banyak IP tetap terhitung.
MAKS_GAGAL_LOGIN = 3
DURASI_KUNCI_LOGIN = 10 * 60


def kunci_login_key(username):
    return f"login_fail:{str(username).strip().lower()}"


def sisa_waktu_kunci_login(username):
    """Detik tersisa masa kunci (0 bila tidak terkunci)."""
    waktu_kunci = cache.get(f"{kunci_login_key(username)}:locked")
    if waktu_kunci is None:
        return 0
    try:
        return max(1, int(DURASI_KUNCI_LOGIN - (timezone.now().timestamp() - float(waktu_kunci))))
    except (TypeError, ValueError):
        return DURASI_KUNCI_LOGIN


def buka_kunci_login(username):
    key = kunci_login_key(username)
    cache.delete(key)
    cache.delete(f"{key}:locked")


def decode_refresh_jti(refresh_token_str):
    """JTI refresh token, dipakai SessionToken.refresh_jti agar SessionRevokeView bisa
    memblokir OutstandingToken terkait. Gagal decode -> string kosong (baris tetap
    tersimpan, hanya cabut-instan lewat menu Owner yang tidak berfungsi utk baris itu)."""
    try:
        return RefreshToken(refresh_token_str).get("jti", "") or ""
    except Exception:
        return ""


# Kunci per-IP (spray/enumeration): satu IP yang gagal login ke MAKS_AKUN_BERBEDA_PER_IP
# akun BERBEDA dalam masa DURASI_KUNCI_IP diblokir dari login akun manapun -- kunci
# per-akun saja tidak menghentikan penyerang yang mencoba banyak akun sekali per akun
# (di bawah ambang 3x per akun). OTP_UNLOCK_TTL adalah OTP terpisah (bukan reset
# password) yang membuktikan pemohon menguasai email akun yang diserang, sehingga bisa
# membuka kunci akunnya sendiri lebih cepat tanpa membuka kunci IP utk akun lain.
MAKS_AKUN_BERBEDA_PER_IP = 3
DURASI_KUNCI_IP = 10 * 60
OTP_UNLOCK_TTL = 5 * 60


def ip_fail_key(ip):
    return f"login_ip_fail:{ip}"


def catat_gagal_ip(ip, username):
    """Mencatat username yang gagal dari IP ini. True bila IP baru saja terkunci."""
    key = ip_fail_key(ip)
    usernames = cache.get(key) or set()
    usernames.add(str(username).strip().lower())
    cache.set(key, usernames, DURASI_KUNCI_IP)
    if len(usernames) >= MAKS_AKUN_BERBEDA_PER_IP:
        cache.set(f"{key}:locked", timezone.now().timestamp(), DURASI_KUNCI_IP)
        return True
    return False


def sisa_waktu_kunci_ip(ip):
    waktu_kunci = cache.get(f"{ip_fail_key(ip)}:locked")
    if waktu_kunci is None:
        return 0
    try:
        return max(1, int(DURASI_KUNCI_IP - (timezone.now().timestamp() - float(waktu_kunci))))
    except (TypeError, ValueError):
        return DURASI_KUNCI_IP


def unlock_otp_key(username):
    return f"login_unlock_otp:{str(username).strip().lower()}"


def verifikasi_unlock_otp(username, otp_input):
    """OTP sekali pakai; benar -> dihapus & True. Salah -> dihitung, habis 5x -> dihapus."""
    key = unlock_otp_key(username)
    state = cache.get(key)
    if not state:
        return False
    if not secrets.compare_digest(str(state.get("otp", "")), str(otp_input or "")):
        state["attempts"] = int(state.get("attempts", 0)) + 1
        if state["attempts"] >= 5:
            cache.delete(key)
        else:
            cache.set(key, state, OTP_UNLOCK_TTL)
        return False
    cache.delete(key)
    return True


class LoginUnlockOtpRequestView(APIView):
    """POST /api/auth/login/unlock-otp/ -- kirim OTP verifikasi ke email akun yang
    terkunci (akun atau IP), supaya pemilik akun bisa login lebih cepat daripada
    menunggu. Respons generik (anti-enumerasi), sama seperti alur lupa password."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRequestThrottle]

    def post(self, request):
        username = str(request.data.get("username") or "").strip()
        if username:
            user = CustomUser.objects.filter(username=username).first()
            if user and user.email:
                otp = str(secrets.SystemRandom().randint(100000, 999999))
                cache.set(unlock_otp_key(username), {"otp": otp, "attempts": 0}, OTP_UNLOCK_TTL)
                subject = "[StarPhoto & Advertising] Kode OTP Verifikasi Login"
                message = (
                    f"Halo {user.username},\n\nAda percobaan login yang gagal beberapa kali ke akun "
                    f"Anda (atau dari jaringan Anda). Untuk login sekarang tanpa menunggu, gunakan "
                    f"kode OTP berikut:\nKODE: {otp}\n\nBerlaku 5 menit. Kalau ini bukan Anda, "
                    "segera ganti password dan hubungi Owner."
                )
                try:
                    send_mail(subject, message, None, [user.email], fail_silently=False)
                except Exception:
                    cache.delete(unlock_otp_key(username))
        return Response({"detail": "Jika akun ada, kode OTP verifikasi login sudah dikirim ke email terdaftar."})


class CustomLoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Sama seperti JWT login biasa, tapi:
    - Deteksi IP baru & verifikasi keamanan OTP jika IP berbeda
    - Catat SecurityAuditLog
    - Buat SessionToken baru
    """

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        ip = _get_client_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")
        username_input = request.data.get("username", "")

        username_input = str(username_input or "")
        otp_input = str(request.data.get("otp", "") or "").strip()
        failure_key = kunci_login_key(username_input)

        # OTP membuka kunci AKUN INI SAJA dari percobaan INI SAJA -- tidak mencabut
        # kunci IP untuk username lain (satu email yang terbukti dikuasai tidak boleh
        # dipakai membuka jalan bagi akun lain yang sedang diserang dari IP yang sama).
        otp_verified = bool(otp_input) and verifikasi_unlock_otp(username_input, otp_input)
        if otp_verified:
            buka_kunci_login(username_input)
        else:
            sisa_ip = sisa_waktu_kunci_ip(ip)
            if sisa_ip:
                return Response({
                    "detail": "IP ini diblokir sementara karena beberapa akun berbeda gagal login dari sini.",
                    "retry_after": sisa_ip,
                    "otp_diperlukan": True,
                    "cakupan_kunci": "ip",
                }, status=429, headers={"Retry-After": str(sisa_ip)})
            sisa_kunci = sisa_waktu_kunci_login(username_input)
            if sisa_kunci:
                return Response({
                    "detail": "Akun dikunci sementara karena terlalu banyak percobaan login yang gagal.",
                    "retry_after": sisa_kunci,
                    "otp_diperlukan": True,
                    "cakupan_kunci": "akun",
                }, status=429, headers={"Retry-After": str(sisa_kunci)})
        try:
            serializer.is_valid(raise_exception=True)
        except (AuthenticationFailed, InvalidToken, TokenError):
            # Kegagalan kredensial di SimpleJWT berupa AuthenticationFailed (bukan
            # InvalidToken/TokenError): dulu tidak tertangkap sehingga hitungan gagal
            # tidak pernah naik dan akun tidak pernah terkunci (AKS-03, 2026-09-22).
            # Berlaku sama untuk username yang tidak ada (anti-enumerasi).
            attempts = int(cache.get(failure_key, 0) or 0) + 1
            cache.set(failure_key, attempts, DURASI_KUNCI_LOGIN)
            terkunci_sekarang = attempts >= MAKS_GAGAL_LOGIN
            if terkunci_sekarang:
                cache.set(f"{failure_key}:locked", timezone.now().timestamp(), DURASI_KUNCI_LOGIN)
            ip_terkunci_sekarang = catat_gagal_ip(ip, username_input)
            # --- Login GAGAL ---
            SecurityAuditLog.objects.create(
                user=CustomUser.objects.filter(username=username_input.strip()).first(),
                username_input=username_input,
                event="LOGIN_FAILED",
                ip_address=ip,
                user_agent=ua,
                keterangan=(
                    f"Gagal login ke-{attempts}"
                    + (f"; akun dikunci {DURASI_KUNCI_LOGIN // 60} menit" if terkunci_sekarang else "")
                    + ("; IP dikunci (banyak akun berbeda)" if ip_terkunci_sekarang else "")
                ),
                berhasil=False,
            )
            if ip_terkunci_sekarang:
                return Response({
                    "detail": "IP ini diblokir sementara karena beberapa akun berbeda gagal login dari sini.",
                    "retry_after": DURASI_KUNCI_IP,
                    "otp_diperlukan": True,
                    "cakupan_kunci": "ip",
                }, status=429, headers={"Retry-After": str(DURASI_KUNCI_IP)})
            if terkunci_sekarang:
                return Response({
                    "detail": "Akun dikunci sementara karena terlalu banyak percobaan login yang gagal.",
                    "retry_after": DURASI_KUNCI_LOGIN,
                    "otp_diperlukan": True,
                    "cakupan_kunci": "akun",
                }, status=429, headers={"Retry-After": str(DURASI_KUNCI_LOGIN)})
            return Response(
                {
                    "detail": "Username atau password salah.",
                    "sisa_percobaan": MAKS_GAGAL_LOGIN - attempts,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # --- Login BERHASIL (Kredensial Valid) ---
        buka_kunci_login(username_input)
        user = serializer.user

        # Deteksi Perubahan IP jika User memiliki Email terdaftar (bisa dibypass via env)
        requires_verification = False
        import os
        bypass_verification = os.getenv("SECURITY_BYPASS_IP_VERIFICATION", "False").lower() == "true"
        
        if user.email and not bypass_verification:
            last_success = SecurityAuditLog.objects.filter(
                user=user, event="LOGIN_SUCCESS", berhasil=True
            ).order_by("-waktu").first()
            if last_success and last_success.ip_address != ip:
                requires_verification = True

        if requires_verification:
            import secrets
            import uuid
            from django.core.mail import send_mail

            otp = str(secrets.SystemRandom().randint(100000, 999999))
            temp_token = uuid.uuid4().hex

            # Simpan ke cache selama 5 menit
            cache.set(
                f"login_otp_{temp_token}",
                {
                    "user_id": user.id,
                    "otp": otp,
                    "ip": ip,
                    "ua": ua,
                },
                300,
            )

            # Kirim OTP via email
            subject = "[StarPhoto & Advertising] Kode Verifikasi Keamanan Login"
            message = f"""Halo {user.username},

Sistem kami mendeteksi upaya login dari alamat IP yang berbeda ({ip}) dibandingkan dengan sesi Anda sebelumnya.

Silakan gunakan kode OTP berikut untuk memverifikasi identitas Anda:
KODE VERIFIKASI: {otp}

Kode ini hanya berlaku selama 5 menit. Jika ini bukan Anda, segera hubungi Owner atau ganti password Anda.

Terima kasih,
Tim Keamanan StarPhoto & Advertising
"""
            send_mail(
                subject,
                message,
                None,  # Menggunakan DEFAULT_FROM_EMAIL dari settings
                [user.email],
                fail_silently=True,
            )

            # Catat log percobaan verifikasi keamanan
            SecurityAuditLog.objects.create(
                user=user,
                username_input=user.username,
                event="LOGIN_FAILED",
                ip_address=ip,
                user_agent=ua,
                keterangan=f"Deteksi IP berbeda ({ip}). Meminta verifikasi OTP ke {user.email}",
                berhasil=False,
            )

            # Sembunyikan sebagian email untuk privasi di UI
            email_parts = user.email.split("@")
            masked_email = f"{email_parts[0][:3]}***@{email_parts[1]}" if len(email_parts) == 2 else user.email

            return Response(
                {
                    "detail": "VERIFICATION_REQUIRED",
                    "temp_token": temp_token,
                    "email_masked": masked_email,
                },
                status=status.HTTP_200_OK,
            )

        tokens = serializer.validated_data
        access_token = tokens["access"]
        refresh_token = tokens["refresh"]

        import uuid
        # Decode JTI dari access token
        try:
            decoded = UntypedToken(access_token)
            jti = decoded.get("jti") or uuid.uuid4().hex
            exp = decoded.get("exp", 0)
            # django.utils.timezone.utc dihapus di Django 5.0 -- baris ini SELALU
            # melempar AttributeError sebelum fix ini, membuang jti yg sudah benar
            # dihitung di atas dan diganti UUID acak (SessionToken.token_jti jadi
            # tidak pernah cocok dgn token sungguhan sejak awal). Pakai
            # datetime.timezone.utc dari stdlib (aliased dt_timezone di impor atas).
            expires_at = timezone.datetime.fromtimestamp(exp, tz=dt_timezone.utc)
        except Exception:
            jti = uuid.uuid4().hex
            expires_at = timezone.now() + timedelta(days=7)

        # Simpan SessionToken
        SessionToken.objects.create(
            user=user,
            token_jti=jti,
            refresh_jti=decode_refresh_jti(refresh_token),
            ip_address=ip,
            user_agent=ua,
            device_name=_parse_device(ua),
            expires_at=expires_at,
        )

        # Catat audit log
        SecurityAuditLog.objects.create(
            user=user,
            username_input=user.username,
            event="LOGIN_SUCCESS",
            ip_address=ip,
            user_agent=ua,
            keterangan=f"Login dari {_parse_device(ua)}",
            berhasil=True,
        )

        # Update last_seen langsung
        Profile.objects.filter(user=user).update(last_seen=timezone.now())
        
        user_data = UserMeSerializer(user, context={"request": request}).data

        return Response(
            {
                "access": str(access_token),
                "refresh": str(refresh_token),
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )


class VerifyLoginView(APIView):
    """
    POST /api/auth/verify-login/
    Body: { "temp_token": "...", "otp": "..." }
    """

    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = request.data.get("temp_token")
        otp = request.data.get("otp")

        if not temp_token or not otp:
            return Response(
                {"detail": "Token dan OTP wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cached_data = cache.get(f"login_otp_{temp_token}")

        if not cached_data or cached_data["otp"] != str(otp):
            # Catat log kegagalan OTP
            SecurityAuditLog.objects.create(
                user=None,
                username_input=f"OTP gagal (temp_token: {temp_token})",
                event="LOGIN_FAILED",
                ip_address=_get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                keterangan="Kode OTP salah atau kedaluwarsa",
                berhasil=False,
            )
            return Response(
                {"detail": "Kode verifikasi salah atau kedaluwarsa."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = CustomUser.objects.filter(id=cached_data["user_id"]).first()
        if not user:
            return Response(
                {"detail": "User tidak ditemukan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate JWT Token sukses
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        import uuid
        # Simpan SessionToken
        try:
            decoded = UntypedToken(access_token)
            jti = decoded.get("jti") or uuid.uuid4().hex
            exp = decoded.get("exp", 0)
            # Bug sama dgn CustomLoginView (lihat komentar di sana): timezone.utc
            # dihapus di Django 5.0.
            expires_at = timezone.datetime.fromtimestamp(exp, tz=dt_timezone.utc)
        except Exception:
            jti = uuid.uuid4().hex
            expires_at = timezone.now() + timedelta(days=7)

        SessionToken.objects.create(
            user=user,
            token_jti=jti,
            refresh_jti=decode_refresh_jti(refresh_token),
            ip_address=cached_data["ip"],
            user_agent=cached_data["ua"],
            device_name=_parse_device(cached_data["ua"]),
            expires_at=expires_at,
        )

        # Catat audit log sukses
        SecurityAuditLog.objects.create(
            user=user,
            username_input=user.username,
            event="LOGIN_SUCCESS",
            ip_address=cached_data["ip"],
            user_agent=cached_data["ua"],
            keterangan=f"Login terverifikasi OTP dari {_parse_device(cached_data['ua'])}",
            berhasil=True,
        )

        Profile.objects.filter(user=user).update(last_seen=timezone.now())
        user_data = UserMeSerializer(user, context={"request": request}).data

        # Hapus OTP dari cache
        cache.delete(f"login_otp_{temp_token}")

        return Response(
            {
                "access": access_token,
                "refresh": refresh_token,
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )



# ---------------------------------------------------------------------------
# Logout View
# ---------------------------------------------------------------------------

class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Body: { "refresh": "<refresh_token>" }
    Revoke session token + catat audit log.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_raw = request.data.get("refresh", "")
        ip = _get_client_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")

        try:
            RefreshToken(refresh_raw).blacklist()
        except Exception:
            pass

        # SessionToken.token_jti menyimpan JTI ACCESS token (lihat CustomLoginView),
        # bukan JTI refresh token -- dulu di sini salah pakai JTI refresh sehingga
        # tidak pernah cocok dan SessionToken tidak pernah tercabut (sesi lama tetap
        # muncul "aktif" di menu Sesi Aktif walau user sudah logout). request.auth
        # adalah AccessToken tervalidasi milik request ini (JWTAuthentication).
        access_jti = request.auth.get("jti", "") if request.auth else ""
        if access_jti:
            session = SessionToken.objects.filter(token_jti=access_jti, user=request.user).first()
            if session:
                session.revoke()

        SecurityAuditLog.objects.create(
            user=request.user,
            username_input=request.user.username,
            event="LOGOUT",
            ip_address=ip,
            user_agent=ua,
            berhasil=True,
        )

        # Force offline status
        try:
            profile = request.user.profile
            profile.last_seen = None
            profile.save(update_fields=['last_seen'])
        except Exception:
            pass

        return Response({"detail": "Logout berhasil."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Profile: Me (lihat & update profil sendiri)
# ---------------------------------------------------------------------------

class MeView(APIView):
    """GET /api/users/me/ — PATCH /api/users/me/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        # Staff tidak boleh ubah role/divisi diri sendiri
        protected = ["role", "divisi", "is_staff", "is_superuser"]
        if request.user.role != "owner":
            # Penempatan kerja & data kepegawaian hanya boleh diatur owner/HR lewat menu
            # Karyawan. unit_bisnis menentukan cakupan data & divisi SPK kasir; atasan
            # menentukan cakupan SPV/Kordiv (celah ditemukan 2026-09-21).
            protected += [
                "username", "email", "unit_bisnis", "atasan", "posisi", "nip",
                "status_karyawan", "jenis_kontrak", "kontrak_mulai", "kontrak_selesai",
                "no_kpj", "bpjs_kes", "file_pkwt",
            ]
        data = {k: v for k, v in request.data.items() if k not in protected}
        serializer = UserMeSerializer(
            request.user, data=data, partial=True, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Staff Online — untuk Owner Dashboard
# ---------------------------------------------------------------------------

class StaffOnlineView(APIView):
    """
    GET /api/users/online/
    Mengembalikan daftar semua staff dengan status online/offline.
    Hanya untuk Owner & Manager.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        staff_qs = CustomUser.objects.filter(is_active=True, role="staff").select_related(
            "profile", "divisi"
        )

        # Filter opsional per divisi
        divisi_id = request.query_params.get("divisi")
        if divisi_id:
            staff_qs = staff_qs.filter(divisi_id=divisi_id)

        online_threshold = timezone.now() - timedelta(minutes=15)
        total_online = staff_qs.filter(
            profile__last_seen__gte=online_threshold
        ).count()

        data = StaffStatusSerializer(
            staff_qs, many=True, context={"request": request}
        ).data

        return Response(
            {
                "total_staff": staff_qs.count(),
                "total_online": total_online,
                "staff": data,
            }
        )


# ---------------------------------------------------------------------------
# Security Audit Log — Owner only
# ---------------------------------------------------------------------------

class AuditLogView(APIView):
    """GET /api/security/audit-log/ — Riwayat event keamanan."""

    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        logs = SecurityAuditLog.objects.all()

        # Filter opsional
        event = request.query_params.get("event")
        if event:
            logs = logs.filter(event=event)
        berhasil = request.query_params.get("berhasil")
        if berhasil is not None:
            logs = logs.filter(berhasil=berhasil.lower() == "true")

        logs = logs[:200]  # Batasi 200 record terbaru
        serializer = SecurityAuditLogSerializer(logs, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Session Management — lihat & revoke sesi aktif
# ---------------------------------------------------------------------------

class SessionListView(APIView):
    """GET /api/security/sessions/ — Semua sesi JWT aktif (Owner only)."""

    permission_classes = [IsStrictOwnerOrManager]

    def get(self, request):
        sessions = SessionToken.objects.filter(is_active=True).select_related("user")
        serializer = SessionTokenSerializer(sessions, many=True)
        return Response(serializer.data)


class SessionRevokeView(APIView):
    """DELETE /api/security/sessions/{id}/ — Paksa logout satu sesi."""

    permission_classes = [IsStrictOwnerOrManager]

    def delete(self, request, pk):
        session = SessionToken.objects.filter(pk=pk, is_active=True).first()
        if not session:
            return Response(
                {"detail": "Sesi tidak ditemukan atau sudah tidak aktif."},
                status=status.HTTP_404_NOT_FOUND,
            )

        session.revoke()

        # Sebelumnya cuma menandai baris ini "tidak aktif" -- token JWT-nya sendiri
        # (stateless) tetap sah sampai kedaluwarsa alami, jadi tombol "Cabut Sesi"
        # tidak benar-benar menghentikan siapa pun. Blokir refresh token terkait
        # lewat token_blacklist (kita tidak menyimpan refresh token mentah, hanya
        # JTI-nya, jadi diblokir lewat OutstandingToken, bukan RefreshToken(raw)).
        # Access token yang sudah terlanjur terbit TETAP sah sampai kedaluwarsa
        # sendiri (maks. 1 jam) -- ini bukan cabut instan, tapi refresh berikutnya
        # pasti ditolak sehingga user dipaksa login ulang dalam ≤1 jam.
        blokir_berhasil = False
        if session.refresh_jti:
            try:
                outstanding = OutstandingToken.objects.get(jti=session.refresh_jti)
                BlacklistedToken.objects.get_or_create(token=outstanding)
                blokir_berhasil = True
            except OutstandingToken.DoesNotExist:
                pass

        SecurityAuditLog.objects.create(
            user=request.user,
            event="TOKEN_REVOKED",
            ip_address=_get_client_ip(request),
            keterangan=(
                f"Owner mencabut sesi milik {session.user.username}"
                + ("" if blokir_berhasil else " (refresh token tidak terblokir -- sesi lama sebelum fitur ini)")
            ),
            berhasil=True,
        )

        return Response(
            {
                "detail": (
                    f"Sesi milik {session.user.username} berhasil dicabut. "
                    + (
                        "Login berikutnya ditolak; sesi yang sedang berjalan berhenti dalam maks. 1 jam."
                        if blokir_berhasil
                        else "Catatan: sesi ini dibuat sebelum fitur cabut-instan ada, jadi refresh token-nya tidak ikut diblokir."
                    )
                ),
                "session_id": pk,
            }
        )


# ---------------------------------------------------------------------------
# Permission Denied Tracker — dipanggil oleh views lain
# ---------------------------------------------------------------------------

def log_permission_denied(request, keterangan=""):
    """Helper: catat event PERMISSION_DENIED ke audit log."""
    SecurityAuditLog.objects.create(
        user=request.user if request.user.is_authenticated else None,
        event="PERMISSION_DENIED",
        ip_address=_get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        keterangan=keterangan,
        berhasil=False,
    )


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Body: { "old_password": "...", "new_password": "..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not old_password or not new_password:
            return Response(
                {"detail": "Password lama dan baru wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(old_password):
            return Response(
                {"detail": "Password lama salah."},
                status=status.HTTP_400_BAD_REQUEST
            )

        kurang = cek_sandi_baru(new_password, user)
        if kurang:
            return Response(
                {"detail": " ".join(kurang), "errors": kurang},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        # Catat audit log
        SecurityAuditLog.objects.create(
            user=user,
            username_input=user.username,
            event="PASSWORD_CHANGED",
            ip_address=_get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            keterangan="User mengganti password mandiri",
            berhasil=True,
        )

        return Response({"detail": "Password berhasil diubah."}, status=status.HTTP_200_OK)


# OTP reset password berlaku selama jeda kirim ulang, supaya tidak ada rentang
# "OTP sudah mati tetapi belum boleh minta lagi".
RESET_OTP_TTL = 15 * 60
RESET_RESEND_COOLDOWN = 15 * 60


def _reset_cooldown_key(username):
    return f"pw_reset_cd:{username.lower()}"


class ForgotPasswordRequestView(APIView):
    """Selalu memberi respons generik untuk mencegah enumerasi username.

    Jeda kirim ulang OTP (15 menit) berlaku per username dan diterapkan sama untuk
    username yang tidak ada, sehingga jeda tidak bisa dipakai menebak akun valid."""
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRequestThrottle]

    def post(self, request):
        username = str(request.data.get("username") or "").strip()
        if not username:
            return Response({"detail": "Jika akun dan email valid, kode OTP akan dikirim."})
        cd_key = _reset_cooldown_key(username)
        waktu_kirim = cache.get(cd_key)
        if waktu_kirim is not None:
            sisa = max(1, int(RESET_RESEND_COOLDOWN - (timezone.now().timestamp() - float(waktu_kirim))))
            return Response({
                "detail": "Kode OTP sudah dikirim. Kirim ulang baru bisa dilakukan setelah jeda 15 menit.",
                "retry_after": int(sisa),
            }, status=429, headers={"Retry-After": str(int(sisa))})
        reset_token = uuid.uuid4().hex
        user = CustomUser.objects.filter(username=username).first()
        if user and user.email:
            otp = str(secrets.SystemRandom().randint(100000, 999999))
            cache.set(f"pw_reset:{reset_token}", {
                "username": user.username, "otp": otp, "attempts": 0,
            }, RESET_OTP_TTL)
            subject = "[StarPhoto & Advertising] Kode OTP Lupa Password"
            message = (
                f"Halo {user.username},\n\nKode OTP reset password Anda: {otp}\n"
                "Kode berlaku 15 menit. Abaikan bila Anda tidak meminta reset."
            )
            try:
                send_mail(subject, message, None, [user.email], fail_silently=False)
            except Exception:
                cache.delete(f"pw_reset:{reset_token}")
                return Response({"detail": "Layanan email sedang tidak tersedia. Coba lagi nanti."}, status=503)
            SecurityAuditLog.objects.create(
                user=user, username_input=username, event="PASSWORD_RESET_REQUESTED",
                ip_address=_get_client_ip(request), user_agent=request.META.get("HTTP_USER_AGENT", ""),
                keterangan="Permintaan OTP reset password", berhasil=True,
            )
        # Jeda dicatat juga untuk akun tidak valid (respons identik, anti-enumerasi).
        cache.set(cd_key, timezone.now().timestamp(), RESET_RESEND_COOLDOWN)
        # Token acak juga dikembalikan untuk akun tidak valid agar bentuk respons identik.
        return Response({
            "detail": "Jika akun dan email valid, kode OTP akan dikirim.",
            "reset_token": reset_token,
            "resend_after": RESET_RESEND_COOLDOWN,
        })


class ForgotPasswordVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetVerifyThrottle]

    def post(self, request):
        username = str(request.data.get("username") or "").strip()
        otp = str(request.data.get("otp") or "").strip()
        new_password = request.data.get("new_password")
        reset_token = str(request.data.get("reset_token") or "").strip()
        if not all((username, otp, new_password, reset_token)):
            return Response({"detail": "Data verifikasi tidak lengkap."}, status=400)
        key = f"pw_reset:{reset_token}"
        state = cache.get(key)
        if not state or state.get("username") != username:
            return Response({"detail": "Kode OTP salah atau kedaluwarsa."}, status=400)
        user = CustomUser.objects.filter(username=username).first()
        if not user:
            cache.delete(key)
            return Response({"detail": "Kode OTP salah atau kedaluwarsa."}, status=400)
        if not secrets.compare_digest(str(state.get("otp", "")), otp):
            state["attempts"] = int(state.get("attempts", 0)) + 1
            if state["attempts"] >= 5:
                cache.delete(key)
            else:
                cache.set(key, state, RESET_OTP_TTL)
            SecurityAuditLog.objects.create(
                user=user, username_input=username, event="PASSWORD_RESET_FAILED",
                ip_address=_get_client_ip(request), user_agent=request.META.get("HTTP_USER_AGENT", ""),
                keterangan="OTP reset salah", berhasil=False,
            )
            return Response({"detail": "Kode OTP salah atau kedaluwarsa."}, status=400)
        kurang = cek_sandi_baru(new_password, user)
        if kurang:
            # OTP belum dipakai: pengguna boleh memperbaiki sandi dan mencoba lagi.
            return Response({"detail": " ".join(kurang), "errors": kurang}, status=400)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        cache.delete(key)
        cache.delete(_reset_cooldown_key(username))
        SessionToken.objects.filter(user=user, is_active=True).update(is_active=False)
        SecurityAuditLog.objects.create(
            user=user, username_input=username, event="PASSWORD_RESET_SUCCEEDED",
            ip_address=_get_client_ip(request), user_agent=request.META.get("HTTP_USER_AGENT", ""),
            keterangan="Reset password via OTP berhasil", berhasil=True,
        )
        return Response({"detail": "Password berhasil diubah. Silakan login kembali."})
