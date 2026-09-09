from django.db import models

from .product_models import Product


class FrappeProductSync(models.Model):
    """
    Jejak sinkronisasi SATU ARAH Product (aplikasi kita) -> Item (Frappe),
    fase 1 (keputusan user 2026-09-09): aplikasi kita jadi sumber utama data
    produk, Frappe cuma menerima. Dipakai management command
    sync_products_to_frappe untuk menentukan produk mana yang perlu dikirim
    ulang (belum pernah sync, atau berubah setelah last_synced_at).
    """

    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="frappe_sync")
    frappe_item_code = models.CharField(max_length=140)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        status = "OK" if not self.last_error else "GAGAL"
        return f"{self.product.nama} -> Frappe Item {self.frappe_item_code} [{status}]"
