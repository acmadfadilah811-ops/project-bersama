"""Persetujuan pencairan gaji 5 tahap (2026-09-26) -- lihat
services/payroll_persetujuan.py.

1. HR menyusun & mengonfirmasi slip  -> pengajuan dibuat (menunggu verifikasi)
2. SPV Finance verifikasi            -> jurnal pengakuan (Posting Gaji)
3. Owner/Manager otorisasi pencairan -> siap dibayar
4. SPV/Admin Finance bayar + bukti   -> jurnal pembayaran, slip HR jadi Dibayar
5. Setor kewajiban (BPJS dll)        -> di luar model ini (pelunasan hutang biasa)

Setiap langkah dicatat di PengajuanGajiLog (jejak audit)."""

from django.conf import settings as django_settings
from django.db import models
from django.db.models import Q

from .payroll import PayrollPosting


class PengajuanGaji(models.Model):
    class Status(models.TextChoices):
        MENUNGGU_VERIFIKASI = "menunggu_verifikasi", "Menunggu verifikasi SPV Finance"
        MENUNGGU_OTORISASI = "menunggu_otorisasi", "Menunggu otorisasi Owner/Manager"
        SIAP_DIBAYAR = "siap_dibayar", "Siap dibayar"
        DIBAYAR = "dibayar", "Dibayar"
        DITOLAK = "ditolak", "Ditolak"
        DIGANTIKAN = "digantikan", "Digantikan data HR yang lebih baru"

    TERBUKA = (Status.MENUNGGU_VERIFIKASI, Status.MENUNGGU_OTORISASI, Status.SIAP_DIBAYAR)

    tahun = models.PositiveSmallIntegerField()
    bulan = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.MENUNGGU_VERIFIKASI)
    hash_hr = models.CharField(max_length=64, help_text="Sidik jari data slip HR yang diajukan.")
    ringkasan = models.JSONField(default=dict, blank=True)
    cek = models.JSONField(default=list, blank=True, help_text="Hasil pemeriksaan otomatis (peringatan).")
    payroll_posting = models.ForeignKey(
        PayrollPosting, on_delete=models.PROTECT, null=True, blank=True, related_name="pengajuan",
    )

    dibuat = models.DateTimeField(auto_now_add=True)
    diverifikasi_oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    diverifikasi_pada = models.DateTimeField(null=True, blank=True)
    diotorisasi_oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    diotorisasi_pada = models.DateTimeField(null=True, blank=True)
    dibayar_oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    dibayar_pada = models.DateTimeField(null=True, blank=True)
    bukti_transfer = models.FileField(upload_to="payroll/bukti_transfer/", null=True, blank=True)
    ditolak_oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    ditolak_pada = models.DateTimeField(null=True, blank=True)
    alasan_tolak = models.TextField(blank=True, default="")
    sinkron_hr = models.CharField(max_length=200, blank=True, default="",
                                  help_text="Hasil memberi tahu HR (dibayar/ditolak).")

    class Meta:
        ordering = ["-tahun", "-bulan", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["tahun", "bulan"],
                condition=Q(status__in=["menunggu_verifikasi", "menunggu_otorisasi", "siap_dibayar"]),
                name="uniq_pengajuan_gaji_terbuka_per_periode",
            ),
        ]

    def __str__(self):
        return f"Pengajuan gaji {self.tahun:04d}-{self.bulan:02d} ({self.get_status_display()})"


class PengajuanGajiLog(models.Model):
    class Aksi(models.TextChoices):
        DIAJUKAN = "diajukan", "Diajukan HR"
        DIVERIFIKASI = "diverifikasi", "Diverifikasi SPV Finance"
        DIOTORISASI = "diotorisasi", "Diotorisasi"
        DIBAYAR = "dibayar", "Dibayar"
        DITOLAK = "ditolak", "Ditolak"
        DIGANTIKAN = "digantikan", "Digantikan"

    pengajuan = models.ForeignKey(PengajuanGaji, on_delete=models.CASCADE, related_name="log")
    aksi = models.CharField(max_length=20, choices=Aksi.choices)
    oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    pada = models.DateTimeField(auto_now_add=True)
    catatan = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["pada", "id"]
