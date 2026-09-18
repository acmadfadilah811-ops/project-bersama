"""Statistik snapshot (kondisi SEKARANG, bukan riwayat/time-series --
Bintang belum punya log pesan per-baris, cuma Evolution API yang simpan
histori chat mentah & itu tidak bisa membedakan "dibalas bot" vs "dibalas
staff manual dari HP", lihat diskusi 2026-09-18) untuk tab Statistik di
Pengaturan WA Bot."""
import logging
import os

from django.core.cache import cache

from ..models import Contact, Order

logger = logging.getLogger(__name__)


def _hitung_handover_sementara():
    """Jumlah kontak dgn auto-pause 15 menit aktif (cache 'wa_handover_*')
    -- cuma jalan di Redis (django-redis punya cache.keys()), None kalau
    backend cache tidak mendukung (mis. LocMemCache di dev)."""
    try:
        return len(cache.keys('wa_handover_*'))
    except (AttributeError, NotImplementedError):
        return None
    except Exception as e:
        logger.warning(f"Gagal menghitung handover sementara: {e}")
        return None


def _ambil_evolution_counts():
    """messageCount/chatCount dari instance Evolution API -- endpoint sama
    persis dgn yang dipakai WhatsAppStatusView (views/whatsapp.py), murni
    baca metadata instance, bukan panggilan berat."""
    from ..whatsapp_client import whatsapp_client
    if whatsapp_client._is_offline():
        return {'chatCount': None, 'messageCount': None}

    import requests as req_lib
    base_url = os.getenv("EVOLUTION_API_URL", "http://localhost:8080").rstrip('/')
    api_key = os.getenv("EVOLUTION_API_KEY", "LocalTestingApiKey123")
    instance = os.getenv("EVOLUTION_INSTANCE_NAME", "bintang_instance")
    try:
        r = req_lib.get(
            f"{base_url}/instance/fetchInstances", headers={"apikey": api_key}, timeout=5,
        )
        if r.ok:
            for inst in (r.json() if isinstance(r.json(), list) else []):
                if inst.get("name") == instance:
                    count = inst.get("_count", {})
                    return {'chatCount': count.get('Chat', 0), 'messageCount': count.get('Message', 0)}
    except Exception as e:
        logger.warning(f"Gagal mengambil instance count Evolution: {e}")
    return {'chatCount': None, 'messageCount': None}


def get_snapshot_stats():
    evolution_counts = _ambil_evolution_counts()
    return {
        'total_kontak': Contact.objects.count(),
        'handover_permanen': Contact.objects.filter(handover_to_staff=True).count(),
        'handover_sementara': _hitung_handover_sementara(),
        'chat_tersimpan': evolution_counts['chatCount'],
        'pesan_tersimpan': evolution_counts['messageCount'],
        'order_dari_bot_wa': Order.objects.filter(sumber='wa').count(),
    }
