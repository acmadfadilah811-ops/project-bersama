"""Langganan notifikasi Web Push per perangkat (2026-10-21).

Satu baris = satu browser/HP yang mengizinkan notifikasi. Dipakai untuk memberi tahu staff
(mis. fotografer) saat ada order baru walaupun tab ERP sedang ditutup."""
from django.conf import settings
from django.db import models


class LanggananPush(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='langganan_push')
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=255, blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)
    terakhir_dipakai = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-dibuat_pada']

    def __str__(self):
        return f'Push {self.user_id} {self.endpoint[:40]}'
