"""Notifikasi stok minimum (2026-09-26, UAT INV-06).

Satu notifikasi per produk/bahan saat stoknya TURUN di bawah batas minimum
(bukan setiap mutasi). Notifikasi menjadi tidak aktif sendiri begitu stok
kembali mencapai minimum; bila turun lagi, notifikasi baru dibuat.
Logika: services/notifikasi_stok.py.
"""

from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class NotifikasiStok(models.Model):
    class Jenis(models.TextChoices):
        PRODUK = 'produk', 'Produk'
        BAHAN = 'bahan', 'Bahan baku'

    jenis = models.CharField(max_length=10, choices=Jenis.choices)
    ref_id = models.CharField(max_length=50)
    nama = models.CharField(max_length=255)
    satuan = models.CharField(max_length=30, blank=True, default='')
    stok = models.DecimalField(max_digits=14, decimal_places=2)
    minimum = models.DecimalField(max_digits=14, decimal_places=2)
    aktif = models.BooleanField(default=True, help_text='Masih di bawah minimum')
    dibuat = models.DateTimeField(auto_now_add=True)
    diperbarui = models.DateTimeField(auto_now=True)
    dibaca_oleh = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='notifikasi_stok_dibaca')

    class Meta:
        ordering = ['-dibuat', '-id']
        constraints = [
            models.UniqueConstraint(fields=['jenis', 'ref_id'], condition=models.Q(aktif=True),
                                    name='uniq_notifikasi_stok_aktif'),
        ]

    def __str__(self):
        return f'{self.nama}: {self.stok} < {self.minimum}'


@receiver(post_save, sender='api.Product')
def _cek_stok_produk(sender, instance, **kwargs):
    from .services.notifikasi_stok import periksa_produk
    periksa_produk(instance)


@receiver(post_save, sender='api.InventoryItem')
def _cek_stok_bahan(sender, instance, **kwargs):
    from .services.notifikasi_stok import periksa_bahan
    periksa_bahan(instance)
