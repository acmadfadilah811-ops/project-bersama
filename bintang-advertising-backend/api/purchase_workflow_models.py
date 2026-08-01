from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


class PurchaseActivityLog(models.Model):
    purchase = models.ForeignKey('Purchase', on_delete=models.CASCADE, related_name='workflow_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    tindakan = models.CharField(max_length=50)
    keterangan = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']


def catat_purchase(purchase, user, tindakan, keterangan):
    return PurchaseActivityLog.objects.create(
        purchase=purchase, user=user, tindakan=tindakan, keterangan=keterangan,
    )


@receiver(post_save, sender='api.StockInDocument')
def tandai_pembelian_diterima_setelah_stok_masuk(sender, instance, created, **kwargs):
    if created or not instance.purchase_id or instance.status != 'selesai':
        return
    purchase = instance.purchase
    if purchase.status != 'draft' or purchase.receive_status == 'diterima':
        return
    purchase.receive_status = 'diterima'
    purchase.tanggal_diterima = instance.tanggal
    purchase.no_terima = purchase.no_terima or instance.nomor
    purchase.save(update_fields=['receive_status', 'tanggal_diterima', 'no_terima', 'updated_at'])
    catat_purchase(purchase, instance.dibuat_oleh, 'STOCK_POSTED', f'Stok masuk {instance.nomor} diposting; pembelian menjadi Diterima.')


@receiver(post_save, sender='api.PurchasePayment')
def catat_pembayaran_pembelian(sender, instance, created, **kwargs):
    if created:
        catat_purchase(instance.purchase, instance.dibuat_oleh, 'PAYMENT_ADDED', f'Pembayaran Rp {instance.nominal:,.0f} ditambahkan.')


@receiver(post_delete, sender='api.PurchasePayment')
def catat_pembatalan_pembayaran(sender, instance, **kwargs):
    catat_purchase(instance.purchase, instance.dibuat_oleh, 'PAYMENT_REMOVED', f'Pembayaran Rp {instance.nominal:,.0f} dihapus; status pembayaran dihitung ulang.')


@receiver(post_save, sender='api.PurchaseItem')
def catat_item_pembelian_ditambah(sender, instance, created, **kwargs):
    if created:
        prod_nama = instance.variant.nama_varian if (instance.variant and getattr(instance.variant, 'nama_varian', None)) else getattr(instance.product, 'nama', 'Produk')
        catat_purchase(
            instance.purchase,
            None,
            'ITEM_ADDED',
            f'Produk {prod_nama} (qty: {instance.qty}) ditambahkan ke pesanan.'
        )


@receiver(post_delete, sender='api.PurchaseItem')
def catat_item_pembelian_dihapus(sender, instance, **kwargs):
    prod_nama = instance.variant.nama_varian if (instance.variant and getattr(instance.variant, 'nama_varian', None)) else getattr(instance.product, 'nama', 'Produk')
    catat_purchase(
        instance.purchase,
        None,
        'ITEM_REMOVED',
        f'Produk {prod_nama} dihapus dari pesanan.'
    )

