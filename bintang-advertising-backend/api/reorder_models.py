"""Tanggungan staff atas reorder akibat human error (2026-09-28).

Reorder (menu Riwayat Kasir > Reorder) dikerjakan ulang untuk pelanggan yang
sama, tetapi biayanya (50% harga nota awal) ditanggung staff yang melakukan
kesalahan -- BUKAN ditagihkan ke pelanggan. Invoice pelanggan tetap nota awal.
Satu baris per order reorder; dipisah dari Order (god model) supaya Order
tidak bertambah kolom (X2).
"""
from django.conf import settings
from django.db import models


class TanggunganReorder(models.Model):
    class Metode(models.TextChoices):
        TUNAI = 'tunai', 'Tunai di kasir'
        POTONG_GAJI = 'potong_gaji', 'Potong gaji'

    class Status(models.TextChoices):
        LUNAS = 'lunas', 'Lunas (tunai)'
        MENUNGGU_POTONG = 'menunggu_potong', 'Menunggu potong gaji'
        SUDAH_DIPOTONG = 'sudah_dipotong', 'Sudah dipotong gaji'

    order = models.OneToOneField('Order', on_delete=models.CASCADE, related_name='tanggungan_reorder')
    staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='tanggungan_reorder')
    nominal = models.DecimalField(max_digits=14, decimal_places=2)
    metode = models.CharField(max_length=20, choices=Metode.choices)
    status = models.CharField(max_length=20, choices=Status.choices, db_index=True)
    alasan = models.TextField()
    dibuat_oleh = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    dibuat = models.DateTimeField(auto_now_add=True, db_index=True)
    ditandai_dipotong_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    ditandai_dipotong_pada = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-dibuat']
        indexes = [models.Index(fields=['staff', 'dibuat'], name='idx_tanggungan_staff_waktu')]

    def __str__(self):
        return f'Tanggungan {self.staff} - {self.order_id} ({self.get_status_display()})'
