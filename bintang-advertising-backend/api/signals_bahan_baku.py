from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='api.ProductStockMovement')
def cerminkan_stok_produk_ke_bahan_baku(sender, instance, created, **kwargs):
    if not created:
        return
    from .services.bahan_baku_sync import cerminkan_mutasi_ke_bahan_baku
    cerminkan_mutasi_ke_bahan_baku(instance)
