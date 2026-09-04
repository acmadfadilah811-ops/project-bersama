"""
Proteksi media privat (kontrak HR, dokumen PKWT, lampiran transaksi kas,
lampiran pembelian, dokumen catatan pelanggan).

Sebelumnya nginx serve seluruh /media/ tanpa autentikasi - siapa pun yang
tahu/menebak URL file bisa mengunduhnya tanpa login. Modul ini mengganti URL
publik untuk prefix sensitif dengan link bertanda tangan (Django
`TimestampSigner`) yang kedaluwarsa dalam SIGNED_URL_MAX_AGE detik, dan hanya
bisa ditukar jadi file asli lewat endpoint /api/media-protected/<token>/ yang
wajib login (IsAuthenticated - sama seperti default akses API lain di
project ini). Foto produk/kategori/varian/paket dan avatar TETAP publik
seperti sebelumnya (dipakai bot WA katalog & tampilan publik lain).
"""
import mimetypes
import os

import boto3
from botocore.client import Config
from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404, HttpResponse, HttpResponseRedirect
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

_SIGNING_SALT = "protected-media"
SIGNED_URL_MAX_AGE = 600  # 10 menit

PROTECTED_PREFIXES = (
    "kontrak/",
    "dokumen_hr/",
    "customer_notes/",
    "cash_transactions/",
    "purchase_attachments/",
)


def is_protected_path(name):
    return bool(name) and any(name.startswith(p) for p in PROTECTED_PREFIXES)


def protected_media_url(file_field, request=None):
    """Ganti URL file sensitif dengan link bertanda tangan; file lain (foto
    produk dkk) tetap memakai URL publik seperti biasa."""
    if not file_field:
        return None
    name = file_field.name
    if not is_protected_path(name):
        url = file_field.url
        return request.build_absolute_uri(url) if request else url
    # signing.dumps() base64-urlsafe-encode payload-nya - path asli tidak
    # tampil apa adanya di URL, dan tidak mengandung karakter "/" sehingga
    # aman dipakai sebagai satu segmen path Django (<str:token>).
    token = signing.dumps(name, salt=_SIGNING_SALT, compress=True)
    path = f"/api/media-protected/{token}/"
    return request.build_absolute_uri(path) if request else path


@extend_schema(exclude=True)  # internal redirect, bukan endpoint API konsumen
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def serve_protected_media(request, token):
    try:
        relative_path = signing.loads(token, salt=_SIGNING_SALT, max_age=SIGNED_URL_MAX_AGE)
    except signing.BadSignature:
        raise Http404("Link tidak valid atau sudah kedaluwarsa.")

    if not is_protected_path(relative_path):
        raise Http404()

    if settings.USE_R2_MEDIA:
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )
        key = f"{settings.AWS_LOCATION}/{relative_path}"
        signed_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
            ExpiresIn=120,
        )
        return HttpResponseRedirect(signed_url)

    media_root = os.path.normpath(str(settings.MEDIA_ROOT))
    full_path = os.path.normpath(os.path.join(media_root, relative_path))
    if not (full_path + os.sep).startswith(media_root + os.sep):
        raise Http404()
    if not os.path.isfile(full_path):
        raise Http404()

    if settings.DEBUG:
        return FileResponse(open(full_path, "rb"))

    # Produksi: biar Nginx yang serve file-nya lewat internal redirect (lebih
    # efisien daripada baca file lewat proses Django), dari location yang
    # tidak bisa diakses langsung dari luar - lihat deploy/nginx.conf.
    response = HttpResponse()
    content_type, _ = mimetypes.guess_type(full_path)
    if content_type:
        response["Content-Type"] = content_type
    response["X-Accel-Redirect"] = f"/protected-media-internal/{relative_path}"
    return response
