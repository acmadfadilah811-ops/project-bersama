from django.conf import settings
from django.db import models

from .coa import Account


class CashBankAccount(models.Model):
    """
    Akun yang dianggap "kas/bank" untuk keperluan Bank Statement & Rekonsiliasi
    — daftar terkurasi, BUKAN otomatis semua akun klasifikasi Kas & Bank (bukti:
    dropdown akun Bank Statement di Olsera juga menyertakan 23000/23500 yang
    klasifikasinya Kewajiban lain, bukan Kas & Bank).
    """

    class Kind(models.TextChoices):
        CASH = "cash", "Kas"
        BANK = "bank", "Bank"
        OTHER = "other", "Lainnya"

    name = models.CharField(max_length=150)
    account = models.OneToOneField(Account, on_delete=models.PROTECT, related_name="cash_bank_account")
    kind = models.CharField(max_length=10, choices=Kind.choices, blank=True, default="")
    bank_name = models.CharField(max_length=100, blank=True, default="")
    account_number = models.CharField(max_length=50, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounting_cash_bank_account"
        verbose_name = "Akun Kas & Bank"
        verbose_name_plural = "Kas & Bank"

    def __str__(self):
        return self.name


class PaymentMethod(models.Model):
    """
    Cara Pembayaran — pemetaan metode bayar (CASH, Go-Pay, marketplace, dst) ke
    akun kas/bank penampung, plus akun & rating MDR (potongan biaya admin
    penyedia layanan) kalau ada.
    """

    name = models.CharField(max_length=100, unique=True, help_text="Nama pengenal, mis. 'Marketplace Tokopedia'.")
    payment_type = models.CharField(
        max_length=50, help_text="Tipe/kategori teknis, mis. 'Tokopedia', 'Tunai', 'Olsera-Qris'.",
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="payment_methods",
        help_text="Akun Pembayaran — akun kas/bank penampung dana dari metode ini.",
    )
    mdr_debit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun Debit (MDR) — biasanya akun beban MDR, dipakai kalau ada potongan biaya admin.",
    )
    mdr_kredit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun Kredit (MDR).",
    )
    mdr_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Rating (MDR), dalam persen.")
    is_locked = models.BooleanField(
        default=False,
        help_text="Kalau True, akun pembayaran tidak bisa diubah lewat 'Atur Akun' (mis. CASH — harus selalu ke akun kas fisik).",
    )
    is_cash = models.BooleanField(
        default=False,
        help_text="True bila ini adalah pembayaran kas/tunai fisik (tidak melalui batch settlement).",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounting_payment_method"
        ordering = ["name"]
        verbose_name = "Cara Pembayaran"
        verbose_name_plural = "Cara Pembayaran"

    def __str__(self):
        return self.name


class PaymentMethodAuditLog(models.Model):
    """
    Log Cara Pembayaran — riwayat perubahan akun pembayaran, snapshot kode/nama
    akun di WAKTU KEJADIAN (bukan FK live) supaya histori tidak berubah kalau
    akunnya di-rename belakangan.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"

    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.CASCADE, related_name="audit_logs")
    action = models.CharField(max_length=10, choices=Action.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    account_code = models.CharField(max_length=20, blank=True, default="")
    account_name = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounting_payment_method_audit_log"
        ordering = ["-created_at"]
        verbose_name = "Log Cara Pembayaran"
        verbose_name_plural = "Log Cara Pembayaran"

    def __str__(self):
        return f"{self.get_action_display()} {self.payment_method.name} » {self.account_code} {self.account_name}"
