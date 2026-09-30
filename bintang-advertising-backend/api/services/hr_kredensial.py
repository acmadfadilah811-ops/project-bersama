"""Penyatuan kredensial akun LAMA dengan HR (2026-09-30).

HR memanggil ini untuk akun Bintang yang sudah ada supaya username dan sandi
awalnya sama dengan HR/mobile (lihat management command `satukan_kredensial` di HR).
Akun profil Sales tanpa login (tanpa sandi) hanya disamakan username-nya; akun
nonaktif dilewati.
"""
import re

from django.db import transaction

from ..models import CustomUser
from .hr_hapus_akun import _cabut_sesi

POLA_USERNAME = re.compile(r'[a-z0-9.]{3,50}')


class UsernameTerpakai(Exception):
    pass


class TidakValid(Exception):
    pass


@transaction.atomic
def satukan_kredensial(hr_employee_id, username=None, password=None, hanya_lihat=False):
    user = CustomUser.objects.select_for_update().filter(hr_employee_id=hr_employee_id).first()
    if user is None:
        return {'skipped': True, 'reason': 'Belum punya akun Bintang.'}
    if hanya_lihat:
        return {'ada': True, 'username': user.username, 'aktif': user.is_active, 'punya_sandi': user.has_usable_password()}
    if not user.is_active:
        return {'skipped': True, 'reason': 'Akun Bintang nonaktif, tidak diubah.', 'username': user.username}

    username = (username or '').strip().lower()
    if not POLA_USERNAME.fullmatch(username):
        raise TidakValid('Format username tidak valid.')
    if password is not None and len(password) < 8:
        raise TidakValid('Password awal minimal 8 karakter.')
    if CustomUser.objects.filter(username=username).exclude(pk=user.pk).exists():
        raise UsernameTerpakai(f"Username '{username}' sudah dipakai akun lain di Bintang.")

    user.username = username
    ubah = ['username']
    if password and user.has_usable_password():
        user.set_password(password)
        ubah.append('password')
        _cabut_sesi(user)
    user.save(update_fields=ubah)
    return {'username': user.username, 'sandi_diubah': 'password' in ubah}
