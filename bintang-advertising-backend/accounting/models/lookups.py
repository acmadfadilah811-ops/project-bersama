from django.db import models

from .coa import Account


class JournalTemplate(models.Model):
    """
    "Nama Jurnal" — jenis transaksi jurnal yang bisa dipilih ulang (mis. "Biaya",
    "Pembayaran"). Basic Form memetakan akun debit/kredit otomatis dari sini;
    Advance Form memakainya sebagai kategori tapi akun tetap dipilih manual.
    """

    name = models.CharField(max_length=100, unique=True)
    default_debit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    default_kredit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounting_journal_template"
        ordering = ["name"]
        verbose_name = "Nama Jurnal"
        verbose_name_plural = "Nama Jurnal"

    def __str__(self):
        return self.name


class Department(models.Model):
    """Departemen — dimensi opsional buat tag transaksi per divisi bisnis."""

    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounting_department"
        ordering = ["name"]
        verbose_name = "Departemen"
        verbose_name_plural = "Departemen"

    def __str__(self):
        return self.name
