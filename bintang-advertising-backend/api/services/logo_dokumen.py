"""Logo StarPhoto & Advertising utk dokumen PDF (invoice, resi) yang dibangun
dgn reportlab -- file: api/assets/logo-starfoto.png (sama dgn aset frontend
src/assets/logo-starfoto.png)."""
import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

LOGO_PATH = Path(__file__).resolve().parent.parent / 'assets' / 'logo-starfoto.png'


def _logo_bisnis():
    """Byte logo yang diunggah di Pengaturan Toko, atau None bila belum ada/gagal dibaca."""
    from django.core.files.storage import default_storage

    from ..models import SystemConfig

    try:
        path = (SystemConfig.objects.filter(key='bisnis_logo_url').values_list('value', flat=True).first() or '').strip()
        if not path or path.startswith(('http://', 'https://')):
            return None
        with default_storage.open(path, 'rb') as f:
            return f.read()
    except Exception:
        logger.warning('Logo bisnis tidak bisa dibaca; memakai logo bawaan.', exc_info=True)
        return None


def logo_flowable(tinggi, align='LEFT'):
    """Logo sbg flowable reportlab dgn tinggi tetap, lebar mengikuti rasio asli.

    Logo yang diunggah di Pengaturan Toko dipakai lebih dulu; bila tidak ada
    atau tidak terbaca, dipakai logo bawaan.

    Kegagalan memuat logo TIDAK boleh menggagalkan pembuatan/pengiriman
    dokumen ke pelanggan -- lebih baik terkirim tanpa logo daripada tidak
    terkirim. Kembalikan None kalau gagal."""
    from reportlab.lib.utils import ImageReader
    from reportlab.platypus import Image

    data = _logo_bisnis()
    if data:
        try:
            lebar_asli, tinggi_asli = ImageReader(io.BytesIO(data)).getSize()
            logo = Image(io.BytesIO(data), width=tinggi * lebar_asli / tinggi_asli, height=tinggi)
            logo.hAlign = align
            return logo
        except Exception:
            logger.warning('Logo bisnis bukan gambar yang valid; memakai logo bawaan.', exc_info=True)
    try:
        lebar_asli, tinggi_asli = ImageReader(str(LOGO_PATH)).getSize()
        logo = Image(str(LOGO_PATH), width=tinggi * lebar_asli / tinggi_asli, height=tinggi)
        logo.hAlign = align
        return logo
    except Exception:
        logger.warning('Logo dokumen tidak bisa dimuat dari %s', LOGO_PATH, exc_info=True)
        return None
