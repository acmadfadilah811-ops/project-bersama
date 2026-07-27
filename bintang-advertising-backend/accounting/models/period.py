from django.conf import settings
from django.db import models


class AccountingPeriod(models.Model):
    """Periode akuntansi — dasar untuk Tutup Buku (period lock)."""

    class Status(models.TextChoices):
        OPEN = "open", "Terbuka"
        CLOSED = "closed", "Ditutup"

    fiscal_year = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accounting_periods_closed",
    )

    class Meta:
        db_table = "accounting_period"
        ordering = ["-start_date"]
        unique_together = [["start_date", "end_date"]]
        verbose_name = "Periode Akuntansi"
        verbose_name_plural = "Periode Akuntansi"

    def __str__(self):
        return f"{self.start_date:%b %Y} ({self.get_status_display()})"
