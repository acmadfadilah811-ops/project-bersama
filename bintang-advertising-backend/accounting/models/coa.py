from django.db import models


class AccountType(models.TextChoices):
    ASSET = "asset", "Aset"
    LIABILITY = "liability", "Kewajiban"
    EQUITY = "equity", "Ekuitas"
    REVENUE = "revenue", "Pendapatan"
    EXPENSE = "expense", "Beban"


class AccountClassification(models.Model):
    """
    Klasifikasi akun (mis. Kas & Bank, Investasi, Piutang, Persediaan) — level
    pengelompokan antara account_type (5 kategori besar) dan akun individual,
    dipakai untuk subtotal di laporan (Neraca/Laba Rugi).
    """

    name = models.CharField(max_length=100, unique=True)
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    order = models.PositiveIntegerField(default=0, help_text="Urutan tampil di laporan.")
    code_range_start = models.PositiveIntegerField(
        null=True, blank=True, help_text="Batas bawah kode akun yang valid untuk klasifikasi ini.",
    )
    code_range_end = models.PositiveIntegerField(
        null=True, blank=True, help_text="Batas atas kode akun yang valid untuk klasifikasi ini.",
    )

    class Meta:
        db_table = "accounting_account_classification"
        ordering = ["account_type", "order"]
        verbose_name = "Klasifikasi Akun"
        verbose_name_plural = "Klasifikasi Akun"

    def __str__(self):
        return self.name


class Account(models.Model):
    """Chart of Accounts (Daftar Akun) — struktur akun berjenjang."""

    AccountType = AccountType
    DEBIT_NORMAL_TYPES = {AccountType.ASSET, AccountType.EXPENSE}

    code = models.CharField(max_length=20, unique=True, help_text="Misal: 11101, 41000")
    name = models.CharField(max_length=150)
    description = models.TextField(
        blank=True, default="", help_text="Catatan/keterangan akun — kapan dipakai, aturan khusus, dll.",
    )
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    classification = models.ForeignKey(
        AccountClassification,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="accounts",
    )
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="children",
    )
    is_contra = models.BooleanField(
        default=False,
        help_text="Akun kontra (saldo normal kebalikan dari account_type) — mis. Akumulasi "
        "Penyusutan (kontra-Aset), Prive (kontra-Ekuitas), Retur/Potongan Penjualan (kontra-Pendapatan).",
    )
    is_active = models.BooleanField(default=True)
    ignore_minus_closing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounting_account"
        ordering = ["code"]
        verbose_name = "Akun"
        verbose_name_plural = "Daftar Akun"

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.classification_id and self.classification.code_range_start and self.code:
            try:
                code_num = int(self.code)
            except ValueError:
                return
            cls = self.classification
            if not (cls.code_range_start <= code_num <= cls.code_range_end):
                raise ValidationError(
                    f"Kode akun {self.code} di luar rentang klasifikasi '{cls.name}' "
                    f"({cls.code_range_start}-{cls.code_range_end})."
                )

    @property
    def normal_balance(self):
        """'debit' untuk Aset/Beban, 'credit' untuk Kewajiban/Ekuitas/Pendapatan — dibalik kalau is_contra."""
        is_debit_normal = self.account_type in self.DEBIT_NORMAL_TYPES
        if self.is_contra:
            is_debit_normal = not is_debit_normal
        return "debit" if is_debit_normal else "credit"


class ProductAccountGroup(models.Model):
    """Pemetaan grup produk ke akun COA — revenue/COGS/inventori bisa beda per grup produk."""

    name = models.CharField(max_length=150, unique=True)
    revenue_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="+")
    cogs_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="+")
    inventory_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="+")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounting_product_account_group"
        verbose_name = "Grup Akun Produk"
        verbose_name_plural = "Grup Akun Produk"

    def __str__(self):
        return self.name
