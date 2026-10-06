"""Struk online + survei kepuasan pelanggan (2026-10-06), padanan e-receipt Olsera.

Setiap transaksi POS dan pesanan punya tautan struk publik (bertanda tangan, lihat
services/resi_digital.py). Di halaman itu pelanggan bisa mengisi survei SEKALI:
nilai 1-5 per aspek + catatan. Aspek bisa diatur Owner/Manager.
"""
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class AspekSurvei(models.Model):
    nama = models.CharField(max_length=100, unique=True)
    urutan = models.PositiveSmallIntegerField(default=0)
    aktif = models.BooleanField(default=True)

    class Meta:
        ordering = ['urutan', 'id']

    def __str__(self):
        return self.nama


class SurveiKepuasan(models.Model):
    """Satu tanggapan survei untuk satu transaksi (POS atau pesanan)."""
    pos_sale = models.OneToOneField(
        'api.POSSale', on_delete=models.CASCADE, null=True, blank=True, related_name='survei_kepuasan',
    )
    order = models.OneToOneField(
        'api.Order', on_delete=models.CASCADE, null=True, blank=True, related_name='survei_kepuasan',
    )
    nama_pelanggan = models.CharField(max_length=255, blank=True, default='')
    nomor_wa = models.CharField(max_length=20, blank=True, default='')
    catatan = models.TextField(blank=True, default='')
    rata_rata = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    dibuat_pada = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-dibuat_pada']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(pos_sale__isnull=False, order__isnull=True)
                | models.Q(pos_sale__isnull=True, order__isnull=False),
                name='survei_tepat_satu_transaksi',
            ),
        ]

    @property
    def nomor_transaksi(self):
        return self.pos_sale.nomor if self.pos_sale_id else self.order_id


class NilaiSurvei(models.Model):
    survei = models.ForeignKey(SurveiKepuasan, on_delete=models.CASCADE, related_name='nilai')
    aspek = models.ForeignKey(AspekSurvei, on_delete=models.PROTECT, related_name='nilai')
    nilai = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])

    class Meta:
        unique_together = [('survei', 'aspek')]
