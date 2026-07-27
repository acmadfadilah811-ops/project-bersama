from django.conf import settings as django_settings
from django.db import models

from .coa import Account


class AccountingSettings(models.Model):
    """
    Konfigurasi tunggal (singleton) untuk modul Akuntansi Internal.
    Menentukan tanggal mulai akuntansi dan toggle fitur opsional,
    mengikuti pola "Pengaturan Akuntansi" di Olsera.
    """

    accounting_start_date = models.DateField(
        help_text="Tanggal mulai akuntansi berlaku. Entry sebelum tanggal ini tidak diperbolehkan.",
    )
    default_payment_due_days = models.PositiveIntegerField(
        default=0,
        help_text="Jatuh tempo pembayaran default (hari) untuk Piutang/Hutang baru.",
    )
    reminder_days_before_due = models.PositiveIntegerField(
        default=0,
        help_text="Kirim pengingat berapa hari sebelum jatuh tempo.",
    )
    send_ar_due_email = models.BooleanField(
        default=False, help_text="Kirim email otomatis saat piutang jatuh tempo.",
    )
    is_ppn_active = models.BooleanField(default=False, help_text="Aktifkan pemungutan pajak PPN.")
    ppn_rate_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Tarif PPN (%), dipakai kalau is_ppn_active aktif.",
    )
    show_inventory_in_profit_loss = models.BooleanField(
        default=True, help_text="Tampilkan nilai inventori di laporan Laba Rugi.",
    )
    calculate_coa_from_this_year = models.BooleanField(
        default=False, help_text="Hitung saldo Chart of Accounts mulai dari tahun berjalan saja.",
    )
    opening_balance_equity_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun penyeimbang otomatis saat mengisi Saldo Awal di Daftar Akun (menu gerigi "
        "'Sesuaikan Saldo Awal'). Default: akun 'Saldo Awal' bawaan — ganti di sini kalau mau "
        "diarahkan ke akun lain, tidak perlu ubah kode.",
    )
    pos_sales_revenue_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun pendapatan default untuk penjualan POS.",
    )
    pos_ppn_output_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun PPN Keluaran default untuk penjualan POS.",
    )
    order_sales_revenue_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text=(
            "Akun pendapatan default untuk pembayaran Order (DP/pelunasan). "
            "Berbeda dari akun pendapatan POS — admin dapat mengarahkan ke akun COA yang sama "
            "jika ingin menyatukan omzet Order dan POS dalam satu akun."
        ),
    )

    enable_product_account_group = models.BooleanField(
        default=False, help_text="Aktifkan pengelompokan akun berdasarkan grup produk (ProductAccountGroup).",
    )
    enable_transfer_between_stores_as_sale = models.BooleanField(
        default=False, help_text="Catat transfer stok antar toko sebagai transaksi penjualan.",
    )

    # --- Toggle fitur opsional: aktifkan hanya yang relevan buat bisnis ini ---
    enable_ojek_online_fee = models.BooleanField(default=False)
    enable_marketplace_sales = models.BooleanField(default=False)
    enable_mdr_fee = models.BooleanField(default=False)
    enable_sales_commission = models.BooleanField(default=False)
    enable_multi_branch_closing = models.BooleanField(default=False)

    # --- Lifecycle modul: status saat ini. Riwayat start/stop ada di AccountingLifecycleLog ---
    is_active = models.BooleanField(default=True)
    initial_setup_completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Diisi otomatis saat wizard 'Pengaturan Awal' selesai (tombol Mulai di step "
        "Ringkasan). Null berarti belum pernah setup — halaman Pengaturan Akuntansi menampilkan "
        "empty state 'Atur Sekarang' sampai field ini terisi.",
    )

    class Meta:
        db_table = "accounting_settings"
        verbose_name = "Pengaturan Akuntansi"
        verbose_name_plural = "Pengaturan Akuntansi"

    def __str__(self):
        return f"Pengaturan Akuntansi (mulai {self.accounting_start_date})"

    def save(self, *args, **kwargs):
        if not self.pk and AccountingSettings.objects.exists():
            raise ValueError("AccountingSettings hanya boleh ada satu baris (singleton).")
        super().save(*args, **kwargs)


class AccountingLifecycleLog(models.Model):
    """Log Start/Stop Akuntansi — riwayat kapan modul diaktifkan/dinonaktifkan, oleh siapa."""

    class Action(models.TextChoices):
        START = "start", "Start"
        STOP = "stop", "Stop"

    action = models.CharField(max_length=10, choices=Action.choices)
    actor = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounting_lifecycle_log"
        ordering = ["-created_at"]
        verbose_name = "Log Start/Stop Akuntansi"
        verbose_name_plural = "Log Start/Stop Akuntansi"

    def __str__(self):
        return f"{self.get_action_display()} oleh {self.actor} — {self.created_at:%Y-%m-%d %H:%M}"
