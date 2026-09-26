"""Notifikasi keuangan dari HR (2026-09-25): gaji sebulan final, reimbursement
disetujui. Dikirim HR lewat jembatan (api/views/hr_bridge.py) dan dibaca SPV
Finance, Owner, dan Manager di Bintang."""

from django.conf import settings as django_settings
from django.db import models


class NotifikasiKeuangan(models.Model):
    class Jenis(models.TextChoices):
        PAYROLL_FINAL = "payroll_final", "Gaji siap diposting"
        REIMBURSEMENT = "reimbursement", "Reimbursement disetujui"
        PERSETUJUAN_GAJI = "persetujuan_gaji", "Persetujuan pencairan gaji"

    # Kunci dari pengirim -- kiriman ulang dengan kunci sama tidak menggandakan.
    kunci = models.CharField(max_length=120, unique=True)
    jenis = models.CharField(max_length=30, choices=Jenis.choices)
    judul = models.CharField(max_length=200)
    pesan = models.TextField(blank=True, default="")
    tautan = models.CharField(max_length=200, blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    dibuat = models.DateTimeField(auto_now_add=True)
    dibaca_oleh = models.ManyToManyField(
        django_settings.AUTH_USER_MODEL, blank=True, related_name="notifikasi_keuangan_dibaca"
    )

    class Meta:
        ordering = ["-dibuat", "-id"]

    def __str__(self):
        return self.judul
