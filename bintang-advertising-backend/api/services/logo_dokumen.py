"""Logo StarPhoto & Advertising utk dokumen PDF (invoice, resi) yang dibangun
dgn reportlab -- file: api/assets/logo-starfoto.png (sama dgn aset frontend
src/assets/logo-starfoto.png)."""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

LOGO_PATH = Path(__file__).resolve().parent.parent / 'assets' / 'logo-starfoto.png'


def logo_flowable(tinggi, align='LEFT'):
    """Logo sbg flowable reportlab dgn tinggi tetap, lebar mengikuti rasio asli.

    Kegagalan memuat logo TIDAK boleh menggagalkan pembuatan/pengiriman
    dokumen ke pelanggan -- lebih baik terkirim tanpa logo daripada tidak
    terkirim. Kembalikan None kalau gagal."""
    from reportlab.lib.utils import ImageReader
    from reportlab.platypus import Image

    try:
        lebar_asli, tinggi_asli = ImageReader(str(LOGO_PATH)).getSize()
        logo = Image(str(LOGO_PATH), width=tinggi * lebar_asli / tinggi_asli, height=tinggi)
        logo.hAlign = align
        return logo
    except Exception:
        logger.warning('Logo dokumen tidak bisa dimuat dari %s', LOGO_PATH, exc_info=True)
        return None
