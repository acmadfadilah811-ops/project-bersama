from django.conf import settings
from django.db import models

from .coa import Account
from .journal import JournalEntry
from .lookups import Department, JournalTemplate


class FixedAsset(models.Model):
    """Register aset tetap; jurnal perolehan selalu disimpan sebagai jejak audit."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Aktif"
        DISPOSED = "disposed", "Dilepas"

    asset_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    acquisition_date = models.DateField()
    acquisition_cost = models.DecimalField(max_digits=15, decimal_places=0)
    residual_value = models.DecimalField(max_digits=15, decimal_places=0, default=0)
    asset_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="fixed_assets")
    depreciation_expense_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="asset_depreciation_expenses",
    )
    accumulated_depreciation_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="asset_accumulated_depreciation",
    )
    counter_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="asset_counter_entries",
    )
    is_opening_balance = models.BooleanField(default=False)
    external_document_no = models.CharField(max_length=50, blank=True, default="")
    description = models.TextField(blank=True, default="")
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_assets",
    )
    journal_template = models.ForeignKey(
        JournalTemplate, on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_assets",
    )
    acquisition_journal = models.OneToOneField(
        JournalEntry, on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_asset_acquisition",
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    last_depreciation_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="fixed_assets_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounting_fixed_asset"
        ordering = ["-acquisition_date", "-id"]
        indexes = [
            models.Index(fields=["acquisition_date"], name="idx_asset_acquisition_date"),
            models.Index(fields=["status"], name="idx_asset_status"),
        ]

    def __str__(self):
        return f"{self.asset_code} - {self.name}"
