from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.db.models import Q
from django.utils import timezone
from hr.models import Absensi
from .models import CustomUser


def scoped_by_unit_bisnis(qs, user, field="unit_bisnis"):
    """
    Batasi `qs` ke unit bisnis milik `user`, HANYA untuk role staff/kasir.
    owner/manager/admin selalu lihat gabungan kedua unit (tidak difilter).

    Baris yang belum ditandai unit bisnis-nya (`field` IS NULL) tetap ikut
    tampil ke staff/kasir juga -- fail-open, supaya data lama yang belum
    sempat ditandai tidak mendadak hilang dari pandangan mereka. Lihat PRD
    "Pemisahan Data per Unit Bisnis" asumsi #3.
    """
    role = getattr(user, "role", None)
    unit_id = getattr(user, "unit_bisnis_id", None)
    if role in ("staff", "kasir", "spv", "kordiv") and unit_id:
        qs = qs.filter(Q(**{f"{field}__isnull": True}) | Q(**{field: unit_id}))
    return qs


def get_subordinate_user_ids(user):
    """
    Kumpulkan id `user` itu sendiri + seluruh bawahannya di struktur
    organisasi (CustomUser.atasan), rekursif turun berapa pun level-nya
    (mis. SPV -> Kordiv -> staff). Dipakai untuk scoping ringkasan kinerja
    tim di Papan Kerja (lihat JobBoardViewSet.get_queryset()).

    Django tidak punya recursive-CTE bawaan yang praktis, jadi dipakai
    pendekatan iteratif turun satu level per query -- bagan organisasi
    perusahaan ini cuma ~5 level, jadi performanya tidak masalah. Loop
    dibatasi 10 iterasi sebagai jaga-jaga kalau ada data atasan yang
    membentuk lingkaran (seharusnya tidak pernah terjadi secara normal).

    User tanpa bawahan cukup balikin {user.id} sendiri -- fail-open/no-op,
    konsisten dengan filosofi scoped_by_unit_bisnis() di atas.
    """
    collected = {user.id}
    frontier = {user.id}
    for _ in range(10):
        next_level = set(
            CustomUser.objects.filter(atasan_id__in=frontier).values_list("id", flat=True)
        )
        next_level -= collected
        if not next_level:
            break
        collected |= next_level
        frontier = next_level
    return collected


class IsOwnerOrManager(BasePermission):
    """
    Hanya Owner, Manager, atau Admin. Role kasir telah dikeluarkan.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ['owner', 'manager', 'admin']
        )

class IsStrictOwnerOrManager(BasePermission):
    """
    Hanya Owner atau Manager saja (tanpa Admin dan Kasir).
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ['owner', 'manager']
        )

# Alias for compatibility
IsOwnerManagerOrAdmin = IsOwnerOrManager

class IsOwnerManagerAdminKasirSpvKordiv(BasePermission):
    """
    Owner, Manager, Admin, Kasir, SPV, atau Kordiv -- khusus dipakai
    AssignOrderView (penerbitan/penugasan SPK). SPV/Kordiv hanya boleh
    menugaskan ke bawahannya sendiri, dibatasi terpisah di
    spk.resolve_staff(), BUKAN di permission class ini.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ['owner', 'manager', 'admin', 'kasir', 'spv', 'kordiv']
        )

class IsOwnerManagerAdminOrKasir(BasePermission):
    """
    Hanya Owner, Manager, Admin, atau Kasir (Staff dilarang).
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ['owner', 'manager', 'admin', 'kasir']
        )

class IsOwnerManagerAdminOrReadOnly(BasePermission):
    """
    Owner, Manager, Admin memiliki akses penuh (write/read).
    Kasir dan Staff hanya memiliki akses membaca (SAFE_METHODS).
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ['owner', 'manager', 'admin']
        )

class IsClockedIn(BasePermission):
    """
    Memvalidasi status clock-in staff.
    - Owner, Manager, Admin di-bypass (selalu True).
    - Staff harus mempunyai absensi hari ini dan clock-in.
    - Pengecualian yang eksplisit: owner/manager dapat menyetujui
      keterlambatan. Persetujuan itu menandai ``workspace_unlocked`` pada
      absensi staff, sehingga papan kerja dapat dibuka tanpa mengubah status
      terlambat menjadi hadir.
    - Jika sudah check-out (jam_keluar not null), hanya diperbolehkan jika
      workspace_unlocked = True.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        # Bypass for management roles
        if user.role in ['owner', 'manager', 'admin']:
            return True
            
        # Only staff (and potentially other roles, but mainly staff) require clock-in check
        today = timezone.localdate()
        absensi = Absensi.objects.filter(staff=user, tanggal=today).first()
        if not absensi:
            return False
            
        # Persetujuan keterlambatan adalah otorisasi eksplisit dari
        # owner/manager. Jangan memaksa jam_masuk diisi sebagai "hadir", karena
        # catatan kehadirannya tetap harus tercatat sebagai terlambat.
        if not absensi.jam_masuk and not absensi.workspace_unlocked:
            return False
            
        # If they clocked out, they cannot access unless the workspace was explicitly unlocked by management
        if absensi.jam_keluar is not None and not absensi.workspace_unlocked:
            return False
            
        return True
