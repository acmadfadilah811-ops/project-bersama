"""Pengembalian pekerjaan ke tahap sebelumnya (PRD-05 UAT, 2026-09-29).

Divisi berikutnya (mis. Operator) yang menolak/meminta revisi sebuah SPK
mengajukan pengembalian dengan alasan. Pengembalian BARU berlaku setelah
staff tujuan (PIC tahap sebelumnya, mis. staff Editor) menerimanya -- tanpa
persetujuan Kordiv/SPV (revisi 2026-09-29); Kordiv/SPV/manajemen hanya
cadangan. Selama menunggu, job pengaju terkunci (tidak bisa dimulai). Dipisah dari JobBoard (X2: model besar tidak diberi kolom baru).
"""
from django.conf import settings
from django.db import models


class PengembalianJob(models.Model):
    class Status(models.TextChoices):
        MENUNGGU = 'menunggu', 'Menunggu diterima'
        DITERIMA = 'diterima', 'Diterima'
        DITOLAK = 'ditolak', 'Ditolak'

    # Job milik divisi pengaju (mis. Operator) yang dikembalikan.
    job = models.ForeignKey('JobBoard', on_delete=models.CASCADE, related_name='pengembalian')
    # Job tahap sebelumnya (mis. Editor) yang akan dibuka lagi bila diterima.
    job_tujuan = models.ForeignKey('JobBoard', on_delete=models.CASCADE, related_name='pengembalian_masuk')
    alasan = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.MENUNGGU, db_index=True)
    diajukan_oleh = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    diajukan_pada = models.DateTimeField(auto_now_add=True)
    diputuskan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    diputuskan_pada = models.DateTimeField(null=True, blank=True)
    catatan_keputusan = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-diajukan_pada']
        indexes = [models.Index(fields=['status', 'diajukan_pada'], name='idx_pengembalian_status')]

    def __str__(self):
        return f'Pengembalian job #{self.job_id} -> #{self.job_tujuan_id} [{self.status}]'
