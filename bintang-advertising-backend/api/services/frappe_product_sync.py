"""
Sinkronisasi Product (aplikasi kita) -> Item (Frappe), SATU ARAH, fase 1
(keputusan user 2026-09-09): aplikasi kita jadi sumber utama data produk,
Frappe cuma menerima (read-only di sisi Frappe -- tidak ada edit balik).
Trigger TERJADWAL (bukan real-time) lewat management command
sync_products_to_frappe, bukan otomatis tiap Product disimpan.

Cakupan fase 1 (SENGAJA minim, bertahap sesuai arahan user): master data
saja -- nama, kode (SKU), harga jual, status aktif. Item Group & UOM
sengaja di-generalisir ke default Frappe ("Products"/"Nos") dulu, belum
dipetakan granular per kategori/satuan kita -- itu fase berikutnya kalau
fase 1 ini terbukti jalan baik. TIDAK termasuk qty stok -- stok tetap
100% dikelola di aplikasi kita, mendorong angka stok ke Frappe butuh
desain terpisah lewat Stock Ledger Frappe (bukan sekadar update field),
di luar cakupan fase 1.
"""
import logging

from django.utils import timezone

from ..frappe_client import FrappeClient
from ..integration_models import FrappeProductSync

logger = logging.getLogger(__name__)

DEFAULT_ITEM_GROUP = "Products"
DEFAULT_UOM = "Nos"


def resolve_item_code(product) -> str:
    """SKU sebagai Item Code Frappe kalau ada (paling natural, sudah unique
    di sisi kita) -- fallback ke ID produk kalau SKU kosong."""
    return product.sku or f"BINTANG-{product.id}"


def build_item_payload(product) -> dict:
    """Fase 1 (2026-09-09, keputusan user): TANPA harga -- Item dengan
    standard_rate otomatis memicu Frappe membuat dokumen "Item Price"
    terpisah, yang butuh role lebih luas (Sales Master Manager) daripada
    akun integrasi minimal (Item Manager saja) yang kita pakai. Harga
    menyusul di fase berikutnya kalau memang diperlukan."""
    return {
        "item_name": product.nama,
        "item_group": DEFAULT_ITEM_GROUP,
        "stock_uom": DEFAULT_UOM,
        "is_stock_item": 0,
        "disabled": 0 if product.is_active else 1,
    }


def sync_product_to_frappe(product, client=None) -> FrappeProductSync:
    """
    Kirim satu Product ke Frappe (create/update Item). SELALU mengembalikan
    FrappeProductSync yang tersimpan -- sukses ATAU gagal (last_error diisi
    kalau gagal) -- supaya histori percobaan tetap tercatat & bisa di-retry
    lewat sync berikutnya, tidak diam-diam hilang.
    """
    client = client or FrappeClient()
    item_code = resolve_item_code(product)
    sync_row, _ = FrappeProductSync.objects.get_or_create(
        product=product, defaults={"frappe_item_code": item_code},
    )
    sync_row.frappe_item_code = item_code

    try:
        payload = build_item_payload(product)
        client.upsert_item(item_code, payload)
        sync_row.last_synced_at = timezone.now()
        sync_row.last_error = ""
    except Exception as e:
        sync_row.last_error = str(e)[:2000]
        logger.warning("Sync produk #%s (%s) ke Frappe gagal: %s", product.id, item_code, e)

    sync_row.save()
    return sync_row
