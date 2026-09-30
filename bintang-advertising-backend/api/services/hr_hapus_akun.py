"""Karyawan dihapus di HR -> akun Bintang-nya ikut dihapus (2026-09-30).

Aturan (M7: riwayat transaksi/kas/audit tidak boleh hilang):
- Akun yang TIDAK punya jejak apa pun (tidak memicu hapus berantai, tidak ada
  data lain yang menunjuknya) dihapus bersih.
- Akun yang punya jejak (nota, shift kasir, permintaan bahan, log, bawahan, dst.)
  TIDAK dihapus keras: dinonaktifkan, sesinya dicabut, sandi dibuat tak bisa
  dipakai, dan data pribadi (email, HP, alamat, foto) dikosongkan. Username dan
  nama tetap supaya riwayat "siapa mengerjakan apa" masih terbaca.
- Akun Owner tidak pernah dihapus keras.
"""
from django.db import transaction
from django.db.models.deletion import Collector, ProtectedError, RestrictedError
from django.utils import timezone

from ..models import CustomUser

# Model yang boleh ikut terhapus bersama akun (bukan riwayat bisnis).
# Profile = baris profil 1:1 yang dibuat otomatis untuk tiap akun.
_BOLEH_IKUT = ('users.sessiontoken', 'users.profile')
_BOLEH_IKUT_AWALAN = ('token_blacklist.',)


def _ada_isi(x):
    if hasattr(x, 'exists'):
        return x.exists()
    try:
        return any(_ada_isi(i) for i in x)
    except TypeError:
        return True


def _model_boleh(model):
    label = model._meta.label_lower
    return (
        model is CustomUser or model._meta.auto_created
        or label in _BOLEH_IKUT or label.startswith(_BOLEH_IKUT_AWALAN)
    )


def bisa_dihapus_bersih(user):
    """(bool, alasan). True hanya bila menghapus akun ini tidak menyentuh data lain."""
    if user.role == 'owner':
        return False, 'akun Owner tidak dihapus otomatis'
    collector = Collector(using=user._state.db or 'default')
    try:
        collector.collect([user])
    except (ProtectedError, RestrictedError):
        return False, 'akun dipakai data lain yang dilindungi'
    for model in collector.data:
        if not _model_boleh(model):
            return False, f'ada data terkait ({model._meta.label})'
    for qs in collector.fast_deletes:
        if not _model_boleh(qs.model) and _ada_isi(qs):
            return False, f'ada data terkait ({qs.model._meta.label})'
    for grup in collector.field_updates.values():
        if _ada_isi(grup):
            return False, 'akun tercatat sebagai pembuat/pelaksana/atasan di data lain'
    return True, ''


def _cabut_sesi(user):
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    from users.models import SessionToken

    for sesi in SessionToken.objects.filter(user=user, is_active=True):
        sesi.revoke()
        if sesi.refresh_jti:
            token = OutstandingToken.objects.filter(jti=sesi.refresh_jti).first()
            if token:
                BlacklistedToken.objects.get_or_create(token=token)


@transaction.atomic
def hapus_akun_dari_hr(hr_employee_id):
    user = CustomUser.objects.select_for_update().filter(hr_employee_id=hr_employee_id).first()
    if user is None:
        return {'skipped': True, 'reason': 'Belum punya akun Bintang.'}

    bersih, alasan = bisa_dihapus_bersih(user)
    if bersih:
        username = user.username
        _cabut_sesi(user)
        user.delete()
        return {'mode': 'hapus', 'username': username}

    _cabut_sesi(user)
    user.is_active = False
    user.status_karyawan = 'nonaktif'
    user.set_unusable_password()
    user.email = ''
    user.no_hp = None
    user.alamat = None
    user.foto_profil = None
    user.save()
    return {'mode': 'nonaktif', 'username': user.username, 'alasan': alasan, 'waktu': timezone.now().isoformat()}
