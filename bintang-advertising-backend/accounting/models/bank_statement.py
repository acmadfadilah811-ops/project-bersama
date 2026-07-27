from django.conf import settings
from django.db import models

from .coa import Account
from .journal import JournalEntryLine


class BankStatementLine(models.Model):
    """
    Baris rekening koran (bank statement) hasil import — data MENTAH dari bank,
    disimpan di tabel staging ini, BELUM jadi Journal Entry. Menunggu diproses
    di fitur Rekonsiliasi Bank (dicocokkan atau dipakai bikin entry baru).

    PENTING: mutation_type di sini pakai konvensi REKENING KORAN BANK (Debit =
    uang keluar dari rekening, Kredit = uang masuk) — KEBALIKAN dari
    JournalEntryLine.debit/kredit yang pakai konvensi buku besar perusahaan.
    Jangan disamakan langsung saat rekonsiliasi nanti.
    """

    class MutationType(models.TextChoices):
        DEBIT = "debit", "Debit (uang keluar)"
        KREDIT = "kredit", "Kredit (uang masuk)"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RECONCILED = "reconciled", "Reconciled"

    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="bank_statement_lines")
    date = models.DateField()
    description = models.CharField(max_length=255, blank=True, default="")
    mutation_amount = models.DecimalField(max_digits=15, decimal_places=0)
    mutation_type = models.CharField(max_length=10, choices=MutationType.choices)
    bank_saldo = models.DecimalField(
        max_digits=15, decimal_places=0,
        help_text="Saldo berjalan versi bank (dari file statement), bukan hasil hitung sistem.",
    )
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    matched_journal_entry_line = models.ForeignKey(
        JournalEntryLine, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
        help_text="Baris jurnal spesifik yang cocok — bukan FK ke entry, karena 1 entry (Multi "
        "Jurnal) bisa punya beberapa baris ke akun yang sama.",
    )
    imported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounting_bank_statement_line"
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["account", "date"], name="idx_bsl_account_date")]
        verbose_name = "Baris Bank Statement"
        verbose_name_plural = "Bank Statement"

    def __str__(self):
        return f"{self.date} | {self.account.code} | {self.get_mutation_type_display()} {self.mutation_amount}"
