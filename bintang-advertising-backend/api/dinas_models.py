"""Dinas luar staff (2026-10-11): bukti kehadiran di lokasi luar kantor.

Sesi foto outdoor wajib "Mulai Dinas" (GPS + selfie) sebelum sesi dimulai;
dinas non-sesi (tujuan bebas) hanya bila diaktifkan di Pengaturan StarFoto.
Selfie disimpan di prefix terlindung `dinas_luar/` (lihat protected_media.py).
"""
import uuid

from django.conf import settings
from django.db import models


def _path_foto(instance, filename):
    ekstensi = (filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg').lower()[:5]
    return f'dinas_luar/{instance.staff_id}/{uuid.uuid4().hex}.{ekstensi}'


class DinasLuar(models.Model):
    STATUS_CHOICES = (
        ('berjalan', 'Berjalan'),
        ('selesai', 'Selesai'),
    )

    staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='dinas_luar')
    # Terisi untuk dinas karena sesi foto outdoor; kosong = dinas non-sesi.
    sesi = models.ForeignKey('SesiFoto', on_delete=models.PROTECT, null=True, blank=True, related_name='dinas_luar')
    tujuan = models.CharField(max_length=200, blank=True, default='')
    alamat = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='berjalan', db_index=True)

    mulai_pada = models.DateTimeField(db_index=True)
    mulai_lat = models.DecimalField(max_digits=9, decimal_places=6)
    mulai_lng = models.DecimalField(max_digits=9, decimal_places=6)
    mulai_akurasi = models.PositiveIntegerField(null=True, blank=True, help_text='Akurasi GPS (meter)')
    mulai_foto = models.ImageField(upload_to=_path_foto)

    selesai_pada = models.DateTimeField(null=True, blank=True)
    selesai_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    selesai_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    selesai_akurasi = models.PositiveIntegerField(null=True, blank=True)
    selesai_foto = models.ImageField(upload_to=_path_foto, null=True, blank=True)

    # Rupiah dari Pengaturan StarFoto saat dinas dimulai (0 = fitur nonaktif).
    uang_transport = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    catatan = models.CharField(max_length=255, blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-mulai_pada']
        constraints = [
            models.UniqueConstraint(
                fields=['staff', 'sesi'], condition=models.Q(sesi__isnull=False), name='uniq_dinas_staff_sesi',
            ),
            models.UniqueConstraint(
                fields=['staff'], condition=models.Q(status='berjalan'), name='uniq_dinas_berjalan_per_staff',
            ),
        ]

    def __str__(self):
        return f'Dinas {self.staff} {self.mulai_pada:%Y-%m-%d}'
