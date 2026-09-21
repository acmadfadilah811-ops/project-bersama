"""Aturan kata sandi baru yang dipakai bersama oleh Lupa Password, Ganti Password,
dan Reset Password oleh owner/manager. Checklist di frontend
(features/auth/utils/kriteriaSandi.js) harus sejalan dengan aturan ini."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError


def cek_sandi_baru(password, user=None):
    """Mengembalikan daftar pesan kekurangan; daftar kosong berarti sandi diterima."""
    password = str(password or "")
    kurang = []
    if not any(c.isalpha() for c in password):
        kurang.append("Kata sandi harus mengandung huruf.")
    if not any(c.isdigit() for c in password):
        kurang.append("Kata sandi harus mengandung angka.")
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        kurang.extend(exc.messages)
    return kurang
