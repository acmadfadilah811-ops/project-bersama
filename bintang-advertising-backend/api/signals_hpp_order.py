"""Jurnal HPP mutasi stok milik Order (lihat accounting/services/order_stock_hpp.py).

Dipicu setiap mutasi disimpan: `hpp_total` baru terisi setelah
stock_fifo.consume_layers menyimpan ulang mutasinya, sedangkan pembatalan order
membuat mutasi 'pengembalian' dengan `hpp_total` langsung. Posting idempoten per
mutasi dan berjalan di transaksi yang sama dengan pemotongan stok (M5)."""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='api.ProductStockMovement')
def jurnal_hpp_mutasi_order(sender, instance, raw=False, **kwargs):
    if raw:
        return
    from accounting.services.order_stock_hpp import perlu_dijurnal, posting_hpp_mutasi_order
    if perlu_dijurnal(instance):
        posting_hpp_mutasi_order(instance, actor=instance.user)
