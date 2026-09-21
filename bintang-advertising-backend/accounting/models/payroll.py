"""Model Posting Gaji: pemetaan komponen slip HR ke akun, dan catatan hasil
posting (snapshot + hash) per periode. Lihat services/payroll_posting.py."""

from django.conf import settings as django_settings
from django.db import models
from django.db.models import Q

from .coa import Account
from .journal import JournalEntry


class PayrollComponentMapping(models.Model):
    """Judul komponen potongan di slip HR -> perlakuan akuntansinya.

    Judul yang belum dipetakan membuat Posting Gaji DITOLAK (fail-closed),
    supaya tidak ada potongan yang jatuh ke akun yang salah diam-diam."""

    class Jenis(models.TextChoices):
        KEWAJIBAN = "kewajiban", "Kewajiban ke pihak ketiga (mis. BPJS, pajak)"
        PIUTANG = "piutang", "Piutang karyawan (mis. kasbon/cicilan)"
        PENGURANG_BEBAN = "pengurang_beban", "Pengurang biaya gaji (mis. denda telat)"

    judul = models.CharField(max_length=200, unique=True)
    jenis = models.CharField(max_length=20, choices=Jenis.choices)
    akun = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun yang dikredit untuk potongan ini. Kosong hanya untuk 'pengurang beban'.",
    )
    akun_iuran_perusahaan = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun hutang yang dikredit untuk iuran perusahaan atas komponen ini (jika ada).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["judul"]

    def __str__(self):
        return f"{self.judul} -> {self.get_jenis_display()}"


class PayrollPosting(models.Model):
    """Satu posting gaji per periode (bulan). Koreksi = versi baru; versi lama 'dibalik'."""

    class Status(models.TextChoices):
        AKTIF = "aktif", "Aktif"
        DIBALIK = "dibalik", "Dibalik (dikoreksi)"

    tahun = models.PositiveSmallIntegerField()
    bulan = models.PositiveSmallIntegerField()
    versi = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.AKTIF)

    payload_hash = models.CharField(max_length=64, help_text="Sidik jari data HR saat diposting.")
    payload = models.JSONField(help_text="Snapshot data HR yang diposting (audit).")
    total_gross = models.DecimalField(max_digits=16, decimal_places=2)
    total_net = models.DecimalField(max_digits=16, decimal_places=2)

    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.PROTECT, related_name="+")
    payment_journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    posted_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )
    posted_at = models.DateTimeField(auto_now_add=True)
    dibalik_oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    dibalik_pada = models.DateTimeField(null=True, blank=True)
    dibayar_oleh = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    dibayar_pada = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-tahun", "-bulan", "-versi"]
        constraints = [
            # Satu posting AKTIF per periode -- jaga terakhir terhadap klik ganda/balapan.
            models.UniqueConstraint(
                fields=["tahun", "bulan"], condition=Q(status="aktif"),
                name="uniq_payroll_posting_aktif_per_periode",
            ),
            models.UniqueConstraint(fields=["tahun", "bulan", "versi"], name="uniq_payroll_posting_versi"),
        ]

    def __str__(self):
        return f"Gaji {self.tahun}-{self.bulan:02d} v{self.versi} ({self.status})"
