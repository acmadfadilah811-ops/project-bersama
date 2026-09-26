"""Penanda order yang dibuat Sales dari CRM (2026-09-26).

Sales tidak punya akun Bintang (keputusan: Sales bekerja di CRM saja), jadi
identitas Sales & tautan ke prospek/kontak CRM disimpan di tabel terpisah,
bukan menambah kolom ke model Order (model inti)."""

from django.db import models


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

    class Meta:
        ordering = ['-dibuat']

    def __str__(self):
        return f'{self.order_id} oleh {self.sales_nama or self.crm_username}'
