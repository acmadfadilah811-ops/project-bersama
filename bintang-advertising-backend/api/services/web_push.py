"""Kirim notifikasi Web Push ke browser/HP staff (2026-10-21).

Kunci VAPID dibuat sekali lalu disimpan di SystemConfig (`webpush_vapid_private` PEM,
`webpush_vapid_public` base64url). Pengiriman berjalan di thread terpisah setelah transaksi
selesai, jadi checkout kasir tidak menunggu layanan push browser. Langganan yang sudah
tidak berlaku (404/410) dihapus otomatis.
"""
import base64
import json
import logging
import sys
import threading

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

KUNCI_PRIVAT = 'webpush_vapid_private'
KUNCI_PUBLIK = 'webpush_vapid_public'
SUBJEK = 'mailto:admin@starphotoadvertising.com'


def _buat_kunci():
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01

    from ..models import SystemConfig

    vapid = Vapid01()
    vapid.generate_keys()
    pem = vapid.private_pem().decode()
    publik = vapid.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint,
    )
    publik_b64 = base64.urlsafe_b64encode(publik).rstrip(b'=').decode()
    SystemConfig.objects.update_or_create(key=KUNCI_PRIVAT, defaults={'value': pem})
    SystemConfig.objects.update_or_create(key=KUNCI_PUBLIK, defaults={'value': publik_b64})
    return pem, publik_b64


def kunci_publik():
    """Kunci publik VAPID (applicationServerKey untuk browser); dibuat bila belum ada."""
    from ..models import SystemConfig

    baris = SystemConfig.objects.filter(key=KUNCI_PUBLIK).first()
    if baris and SystemConfig.objects.filter(key=KUNCI_PRIVAT).exists():
        return baris.value
    return _buat_kunci()[1]


def _kirim_sekarang(langganan_ids, payload):
    from py_vapid import Vapid01
    from pywebpush import WebPushException, webpush

    from ..models import SystemConfig
    from ..webpush_models import LanggananPush

    baris = SystemConfig.objects.filter(key=KUNCI_PRIVAT).first()
    if not baris:
        return 0
    vapid = Vapid01.from_pem(baris.value.encode())
    terkirim = 0
    for sub in LanggananPush.objects.filter(pk__in=langganan_ids):
        try:
            webpush(
                subscription_info={'endpoint': sub.endpoint, 'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}},
                data=payload, vapid_private_key=vapid, vapid_claims={'sub': SUBJEK}, ttl=3600, timeout=10,
            )
            sub.terakhir_dipakai = timezone.now()
            sub.save(update_fields=['terakhir_dipakai'])
            terkirim += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status in (404, 410):
                sub.delete()  # langganan kedaluwarsa / izin dicabut di perangkat
            else:
                logger.warning('Web push gagal (status=%s) user=%s.', status, sub.user_id)
        except Exception:
            logger.exception('Web push gagal user=%s.', sub.user_id)
    return terkirim


def kirim_ke_user(users, judul, pesan, url='/', tag=''):
    """Jadwalkan notifikasi ke semua perangkat milik `users` (iterable user/id).
    Tidak pernah melempar error ke pemanggil."""
    from ..webpush_models import LanggananPush

    try:
        user_ids = [getattr(u, 'pk', u) for u in users]
        ids = list(LanggananPush.objects.filter(user_id__in=user_ids, user__is_active=True).values_list('pk', flat=True))
    except Exception:
        logger.exception('Gagal menyiapkan web push.')
        return
    if not ids:
        return
    payload = json.dumps({'judul': judul, 'pesan': pesan, 'url': url, 'tag': tag})
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        return  # tes tidak mengirim ke layanan push sungguhan

    def jalan():
        threading.Thread(target=_kirim_sekarang, args=(ids, payload), daemon=True).start()

    transaction.on_commit(jalan)
