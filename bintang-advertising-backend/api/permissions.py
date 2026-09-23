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


def get_subordinate_divisi_ids(user):
    """Divisi-divisi tempat bawahan (rekursif, termasuk diri sendiri) SPV/
    Kordiv ini bekerja -- lihat get_subordinate_user_ids().

    Dipakai sebagai pengganti `user.divisi_id` untuk scoping "job/laporan
    di divisi tim saya", karena SPV lazimnya TIDAK punya `divisi` sendiri
    (mengawasi beberapa Kordiv/divisi sekaligus) -- memakai `user.divisi`
    langsung membuat SPV tidak pernah melihat job/laporan apa pun (bug
    ditemukan 2026-09-23, lihat JobBoardViewSet.get_queryset()).
    """
    subordinate_ids = get_subordinate_user_ids(user)
    return set(
        CustomUser.objects.filter(id__in=subordinate_ids, divisi__isnull=False)
        .values_list("divisi_id", flat=True)
        .distinct()
    )


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

class IsOwnerManagerAdminOrSupervisorReadOnly(BasePermission):
    """
    Owner/Manager/Admin: akses penuh (baca+tulis, dijaga lebih ketat lagi di
    CustomUserViewSet.check_permissions()). SPV/Kordiv: HANYA baca (GET) --
    dibutuhkan supaya mereka bisa memuat daftar bawahannya sendiri untuk
    dropdown pemilihan staff saat menugaskan SPK (SpkPublishModal,
    ForwardJobModal). Scoping ke bawahan-saja dilakukan di
    CustomUserViewSet.get_queryset(), BUKAN di sini -- kelas ini cuma
    menjawab "boleh baca?", bukan "baca siapa saja?" (root cause 2026-09-23:
    endpoint /api/users/ sebelumnya 403 total untuk SPV/Kordiv).
    """
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', '')
        if not (request.user and request.user.is_authenticated):
            return False
        if role in ('owner', 'manager', 'admin'):
            return True
        return request.method in SAFE_METHODS and role in ('spv', 'kordiv')

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

class CanAccessFinanceVerification(BasePermission):
    """Owner/Manager/Admin/Kasir (perilaku lama RingkasanShiftViewSet &
    CashTransactionViewSet tetap sama) DITAMBAH Admin Finance & SPV Finance
    (2026-09-18) -- dibuat class BARU, sengaja TIDAK mengubah
    IsOwnerManagerAdminOrKasir (god node dipakai 85-163 titik lain, R2)."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in (
                'owner', 'manager', 'admin', 'kasir', 'admin_finance', 'spv_finance',
            )
        )


class IsAdminFinanceOrOwnerManager(BasePermission):
    """Khusus aksi verifikasi laporan kasir (RingkasanShift/CashTransaction)
    & Papan Kerja Admin Finance -- Admin Finance adalah pelaksana utamanya,
    Owner/Manager tetap bisa override langsung. SPV Finance TIDAK termasuk
    di sini -- perannya membaca hasil agregat yang sudah diverifikasi lewat
    IsSpvFinanceOrOwnerManager, bukan verifikasi individual."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ('owner', 'manager', 'admin_finance')
        )


class IsSpvFinanceOrOwnerManager(BasePermission):
    """Khusus Papan Kerja SPV Finance (agregat kas/pengeluaran/piutang yang
    sudah diverifikasi Admin Finance) -- Owner/Manager tetap bisa akses
    langsung. Admin Finance TIDAK termasuk -- dashboard-nya sendiri
    (IsAdminFinanceOrOwnerManager) berbeda fokus (antrean verifikasi,
    bukan agregat hasil)."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ('owner', 'manager', 'spv_finance')
        )


class IsSpvOrOwnerManager(BasePermission):
    """Khusus Laporan Produksi (target & kendala operasional, 2026-09-23,
    diperluas ke Kordiv juga 2026-09-24) -- SPV/Kordiv adalah pembuat
    laporannya, Owner/Manager tetap bisa akses/override langsung untuk
    melihat semua divisi. Scoping ke divisi bawahan SPV/Kordiv sendiri
    dilakukan di get_queryset() view, BUKAN di sini."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') in ('owner', 'manager', 'spv', 'kordiv')
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


class CanUseMaterialRequisition(BasePermission):
    """Permintaan Bahan: owner, manager, admin (gudang), spv, kordiv. Kasir/staff
    tidak. Hak per aksi & scoping data ditegakkan di services/material_requisition.py."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            getattr(request.user, 'role', '') in ['owner', 'manager', 'admin', 'spv', 'kordiv']
        )
