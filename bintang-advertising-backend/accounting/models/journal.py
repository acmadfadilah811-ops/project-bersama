from django.conf import settings
from django.db import models

from api.customer_models import Customer, Supplier

from .coa import Account
from .lookups import Department, JournalTemplate
from .period import AccountingPeriod


class SettlementStatus(models.TextChoices):
    NOT_APPLICABLE = "not_applicable", "Tidak berlaku"
    UNSETTLED = "unsettled", "Belum settle"
    SETTLED = "settled", "Sudah settle"
    VOID = "void", "Dibatalkan"


class JournalEntry(models.Model):
    """Header jurnal (Jurnal Umum) — satu transaksi akuntansi, terdiri dari beberapa baris (lines)."""

    class SourceType(models.TextChoices):
        MANUAL = "manual", "Manual"
        OPENING_BALANCE = "opening_balance", "Saldo Awal"
        POS_SALE = "pos_sale", "Penjualan POS"
        ORDER_PAYMENT = "order_payment", "Pembayaran Order"
        PURCHASE = "purchase", "Pembelian"
        PURCHASE_PAYMENT = "purchase_payment", "Pembayaran Pembelian"
        STOCK_IN = "stock_in", "Stok Masuk"
        STOCK_OUT = "stock_out", "Stok Keluar"
        STOCK_OPNAME = "stock_opname", "Opname Stok"
        PRODUCTION = "production", "Produksi"
        PAYROLL = "payroll", "Penggajian"
        CASH_TRANSACTION = "cash_transaction", "Transaksi Kas"
        CASH_TRANSFER = "cash_transfer", "Transfer Kas"
        CAPITAL_TRANSFER = "capital_transfer", "Transfer Modal"
        SETTLEMENT = "settlement", "Konfirmasi Settlement"
        ASSET_ACQUISITION = "asset_acquisition", "Perolehan Aset"
        ORDER_MATERIAL_HPP = "order_material_hpp", "HPP Bahan Baku Order (T-204)"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        POSTED = "posted", "Terposting"
        VOID = "void", "Dibatalkan"

    entry_number = models.CharField(
        max_length=30, unique=True, blank=True,
        help_text="Nomor jurnal otomatis, mis. JU-202607-0001. Dicari lewat 'Cari No. Transaksi'.",
    )
    date = models.DateField()
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="journal_entries")
    source_type = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.MANUAL)
    source_id = models.PositiveIntegerField(
        null=True, blank=True, help_text="ID dokumen sumber, sesuai source_type.",
    )
    description = models.CharField(max_length=255, blank=True, default="")
    journal_template = models.ForeignKey(
        JournalTemplate, on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries",
    )
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_entries_created",
    )
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_entries_posted",
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    reversed_entry = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reversal_of",
        help_text="Diisi kalau entry ini adalah jurnal koreksi/pembalik dari entry lain.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounting_journal_entry"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["date"], name="idx_je_date"),
            models.Index(fields=["source_type", "source_id"], name="idx_je_source"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["source_type", "source_id", "date"],
                name="uniq_je_source_date",
            )
        ]
        verbose_name = "Jurnal"
        verbose_name_plural = "Jurnal Umum"

    def __str__(self):
        return f"JE#{self.pk} {self.date} ({self.get_status_display()})"


class JournalEntryLine(models.Model):
    """Baris jurnal — debit/kredit terhadap satu akun COA."""

    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="journal_lines")
    debit = models.DecimalField(max_digits=15, decimal_places=0, default=0)
    kredit = models.DecimalField(max_digits=15, decimal_places=0, default=0)
    description = models.CharField(max_length=255, blank=True, default="")
    external_document_no = models.CharField(
        max_length=50, blank=True, default="",
        help_text="No. Dokumen — nomor referensi bukti fisik (nota/kuitansi/invoice) untuk baris ini.",
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    settlement_status = models.CharField(
        max_length=20,
        choices=SettlementStatus.choices,
        default=SettlementStatus.NOT_APPLICABLE,
    )

    class Meta:
        db_table = "accounting_journal_entry_line"
        indexes = [
            models.Index(fields=["account"], name="idx_jel_account"),
            models.Index(fields=["account", "settlement_status"], name="idx_jel_settlement"),
        ]
        verbose_name = "Baris Jurnal"
        verbose_name_plural = "Baris Jurnal"

    def __str__(self):
        return f"{self.account.code} | D:{self.debit} K:{self.kredit}"


class JournalAuditLog(models.Model):
    """Audit trail untuk aksi pada Journal Entry (Log Jurnal)."""

    class Action(models.TextChoices):
        CREATED = "created", "Dibuat"
        POSTED = "posted", "Diposting"
        VOIDED = "voided", "Dibatalkan"
        REVERSED = "reversed", "Dijurnal-balik"
        DELETED = "deleted", "Dihapus"

    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="audit_logs")
    action = models.CharField(max_length=10, choices=Action.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounting_journal_audit_log"
        ordering = ["-created_at"]
        verbose_name = "Log Jurnal"
        verbose_name_plural = "Log Jurnal"

    def __str__(self):
        return f"{self.get_action_display()} JE#{self.journal_entry_id} oleh {self.actor}"
