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
    useful_life_months = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Umur manfaat (bulan) untuk penyusutan garis lurus. Kosongkan untuk "
        "aset yang tidak disusutkan (mis. tanah) -- accounting/services/depreciation.py "
        "melewati aset yang field ini kosong atau 0.",
    )
    last_depreciation_date = models.DateField(null=True, blank=True)
    # Tautan ke aset di HR (Horilla) bila register ini dibuat dari antrean "Aset dari HR"
    # (2026-11-10). HR = data fisik (pemegang, kondisi); ERP = data akuntansi.
    hr_asset_id = models.PositiveIntegerField(null=True, blank=True, unique=True)
    disposal_date = models.DateField(null=True, blank=True)
    disposal_proceeds = models.DecimalField(max_digits=15, decimal_places=0, null=True, blank=True)
    disposal_journal = models.OneToOneField(
        JournalEntry, on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_asset_disposal",
    )
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


class AsetHRMasuk(models.Model):
    """Antrean aset yang dipilih HR untuk masuk akuntansi (2026-11-10).

    HR mengirim lewat jembatan /api/bridge/hr-aset/; Finance melengkapi akun, umur
    manfaat, dan akun pembayaran lalu memprosesnya menjadi FixedAsset (baru saat itu
    jurnal perolehan dibuat -- kiriman HR sendiri tidak pernah menjurnal apa pun)."""

    class Status(models.TextChoices):
        MENUNGGU = "menunggu", "Menunggu diproses"
        DIPROSES = "diproses", "Sudah jadi aset tetap"
        DITOLAK = "ditolak", "Ditolak Finance"
        DITARIK = "ditarik", "Ditarik HR"

    hr_asset_id = models.PositiveIntegerField(unique=True)
    kode = models.CharField(max_length=50)
    nama = models.CharField(max_length=255)
    kategori = models.CharField(max_length=100, blank=True, default="")
    tanggal_beli = models.DateField()
    harga = models.DecimalField(max_digits=15, decimal_places=0)
    jumlah = models.PositiveIntegerField(default=1)
    pemegang = models.CharField(max_length=150, blank=True, default="")
    status_hr = models.CharField(max_length=40, blank=True, default="")
    keterangan = models.TextField(blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.MENUNGGU)
    fixed_asset = models.OneToOneField(
        FixedAsset, on_delete=models.SET_NULL, null=True, blank=True, related_name="asal_hr",
    )
    alasan_tolak = models.TextField(blank=True, default="")
    # HR melaporkan aset hilang/rusak/tidak tersedia padahal aset tetapnya masih aktif:
    # Finance perlu meninjau (pelepasan aset butuh nilai jual & jurnal, tidak otomatis).
    perlu_ditinjau = models.BooleanField(default=False)
    diterima_pada = models.DateTimeField(auto_now_add=True)
    diperbarui_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounting_aset_hr_masuk"
        ordering = ["status", "-diperbarui_pada"]
        verbose_name = "Aset dari HR"
        verbose_name_plural = "Aset dari HR"

    def __str__(self):
        return f"{self.kode} - {self.nama}"
