"""Penanda order kasir (sumber 'pos') yang sudah dikirim ke CRM (2026-10-12).

Tabel terpisah, bukan kolom baru di Order (model inti, aturan X2). Setiap order
kasir -- StarFoto maupun Advertising -- dikirim ke CRM sebagai Contact +
Opportunity (lihat services/crm_order_kasir.py)."""

from django.db import models, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


class OrderKeCRM(models.Model):
    order = models.OneToOneField('Order', on_delete=models.CASCADE, related_name='ke_crm')
    # Terakhir berhasil terkirim; null = belum pernah berhasil (akan dicoba lagi).
    terkirim_pada = models.DateTimeField(null=True, blank=True)
    # Total yang terakhir dikirim -- total berubah (mis. tambahan sesi foto
    # dikonfirmasi) memicu kirim ulang supaya amount Opportunity tetap benar.
    total_terkirim = models.IntegerField(default=0)
    # Kapan CRM dikabari order lunas (Opportunity Closed Won); null = belum.
    lunas_terkirim_pada = models.DateTimeField(null=True, blank=True)
    crm_opportunity_id = models.IntegerField(null=True, blank=True)
    dibuat = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-dibuat']

    def __str__(self):
        return f'{self.order_id} -> CRM {self.crm_opportunity_id or "-"}'


@receiver(post_save, sender='api.Order')
def kirim_order_kasir_ke_crm_saat_berubah(sender, instance, created, **kwargs):
    """Order kasir baru -> kirim ke CRM; order kasir lunas / total berubah -> perbarui.

    Dikirim setelah transaksi commit (checkout atomik, jadi total & item sudah
    final) dan tidak pernah menggagalkan penyimpanan order."""
    if instance.sumber != 'pos':
        return
    if created:
        pk = instance.pk
        transaction.on_commit(lambda: _jadwalkan(pk))
        return
    if instance.status_global == 'batal':
        return
    baris = OrderKeCRM.objects.filter(order_id=instance.pk).values('total_terkirim', 'lunas_terkirim_pada').first()
    if baris is None:
        return
    lunas = bool(instance.total_harga) and not instance.sisa_tagihan
    perlu = (lunas and baris['lunas_terkirim_pada'] is None) or (
        not lunas and instance.total_harga != baris['total_terkirim']
    )
    if perlu:
        pk = instance.pk
        transaction.on_commit(lambda: _jadwalkan(pk))


def _jadwalkan(order_id):
    from .services.crm_order_kasir import jadwalkan_kirim_order_ke_crm

    jadwalkan_kirim_order_ke_crm(order_id)
