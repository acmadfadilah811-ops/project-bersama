"""Penanda order yang dibuat Sales dari CRM (2026-09-26).

Sales tidak punya akun Bintang (keputusan: Sales bekerja di CRM saja), jadi
identitas Sales & tautan ke prospek/kontak CRM disimpan di tabel terpisah,
bukan menambah kolom ke model Order (model inti)."""

from django.db import models, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


class OrderAsalCRM(models.Model):
    order = models.OneToOneField('Order', on_delete=models.CASCADE, related_name='asal_crm')
    # Kunci idempotensi dari CRM: kirim ulang permintaan yang sama tidak membuat order ganda.
    kunci = models.CharField(max_length=80, unique=True)
    crm_user_id = models.IntegerField(null=True, blank=True)
    crm_username = models.CharField(max_length=150, blank=True, default='')
    sales_nama = models.CharField(max_length=150, blank=True, default='')
    crm_opportunity_id = models.IntegerField(null=True, blank=True, db_index=True)
    crm_contact_id = models.IntegerField(null=True, blank=True)
    dibuat = models.DateTimeField(auto_now_add=True)
    # Kapan CRM mengonfirmasi Opportunity sudah Closed Won karena order lunas.
    crm_won_terkirim = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-dibuat']

    def __str__(self):
        return f'{self.order_id} oleh {self.sales_nama or self.crm_username}'


@receiver(post_save, sender='api.Order')
def kabari_crm_saat_lunas(sender, instance, **kwargs):
    """Order asal CRM lunas -> Opportunity di CRM otomatis Closed Won.

    Dikirim setelah transaksi commit, jadi pembayaran yang batal tidak ikut
    terkirim. Kegagalan hanya dicatat; tab Order Bintang di CRM ikut
    memperbaiki stage saat dibuka.
    """
    if instance.status_global == 'batal' or not instance.total_harga or instance.sisa_tagihan:
        return
    if not OrderAsalCRM.objects.filter(
        order_id=instance.pk, crm_opportunity_id__isnull=False, crm_won_terkirim__isnull=True,
    ).exists():
        return
    from .services.crm_order import kirim_order_lunas_ke_crm

    order_id = instance.pk
    transaction.on_commit(lambda: kirim_order_lunas_ke_crm(order_id))
