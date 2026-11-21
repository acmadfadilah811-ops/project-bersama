"""Koreksi orientasi foto profil karyawan (2026-11-22).

Foto dari HP kerap membawa tag EXIF Orientation (potret disimpan mendatar +
tag "putar saat ditampilkan"). Browser modern sudah menghormati tag itu saat
menampilkan <img>, tapi sinkron ke HR/CRM (services/sinkron_foto.py) membuat
ulang thumbnail dari pixel mentah tanpa membaca tag tsb -- hasilnya foto bisa
terbalik di sana. Sebagian foto juga sudah tersimpan miring/terbalik di
pixel-nya sendiri (bukan cuma tag EXIF), yang tidak bisa dikoreksi otomatis.

Jadi foto dinormalisasi sekali saat upload (tag EXIF dibakar ke pixel
sungguhan, lihat koreksi_orientasi_upload) supaya tegak di mana pun
ditampilkan. Untuk foto lama yang memang miring di pixel-nya, admin bisa
putar manual lewat POST /api/users/{id}/putar-foto/ (lihat
CustomUserViewSet.putar_foto, memanggil putar_foto_profil di bawah).
"""
import io
import time

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

KUALITAS_JPEG = 90
TAG_EXIF_ORIENTATION = 0x0112


def _ke_jpeg_bytes(img):
    if img.mode in ('RGBA', 'P', 'LA'):
        img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=KUALITAS_JPEG)
    return buf.getvalue()


def koreksi_orientasi_upload(file_upload):
    """Dipakai di validate_foto_profil (UserMeSerializer & CustomUserSerializer)
    -- normalisasi tag EXIF Orientation jadi pixel sungguhan sebelum disimpan.
    Dikembalikan apa adanya bila bukan file yang perlu dikoreksi (bukan
    gambar, atau orientasi sudah normal) supaya tidak membebani upload yang
    sudah benar."""
    try:
        file_upload.seek(0)
        img = Image.open(file_upload)
        img.load()
        orientasi = img.getexif().get(TAG_EXIF_ORIENTATION, 1)
        if orientasi == 1:
            file_upload.seek(0)
            return file_upload
        img = ImageOps.exif_transpose(img)
    except Exception:
        file_upload.seek(0)
        return file_upload
    nama = f"koreksi_{int(time.time())}.jpg"
    return ContentFile(_ke_jpeg_bytes(img), name=nama)


def putar_foto_profil(user, derajat):
    """Putar manual foto profil karyawan (90/180/270 derajat searah jarum
    jam) -- dipakai admin di halaman Karyawan untuk foto yang pixelnya
    sendiri sudah terbalik/miring (bukan cuma tag EXIF yang salah)."""
    if not user.foto_profil:
        raise ValueError('Karyawan ini belum punya foto profil.')
    if derajat not in (90, 180, 270):
        raise ValueError('Derajat putar harus 90, 180, atau 270.')
    with user.foto_profil.open('rb') as f:
        img = Image.open(f)
        img.load()
        img = ImageOps.exif_transpose(img)
        img = img.rotate(-derajat, expand=True)  # PIL.rotate() berlawanan jarum jam
    nama_baru = f"avatars/user_{user.pk}_{int(time.time())}.jpg"
    user.foto_profil.save(nama_baru, ContentFile(_ke_jpeg_bytes(img)), save=True)
