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
    closing_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun Closing (Laba Ditahan) — akun ekuitas tujuan laba/rugi periode berjalan. "
        "Dipakai untuk memberi label akun nyata pada baris 'Pendapatan periode ini' di laporan "
        "Neraca. Tidak membuat jurnal penutup baru — laporan tetap dihitung langsung dari jurnal "
        "posted per rentang tanggal (lihat get_balance_sheet), supaya laporan periode lama tidak "
        "berubah setelah tutup buku.",
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
    pos_cogs_expense_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun Harga Pokok Penjualan (HPP) untuk penjualan POS produk berlacak inventori (T-107).",
    )
    pos_inventory_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun Persediaan yang dikurangi (kredit) saat HPP penjualan POS diposting (T-107).",
    )
    order_hpp_expense_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun HPP untuk bahan baku Order yang terpakai via JobBoard, diposting saat Order "
        "diselesaikan (T-204). Boleh diarahkan ke akun sama dengan pos_cogs_expense_account "
        "kalau COA tidak membedakan HPP produk jadi vs bahan baku produksi.",
    )
    order_material_inventory_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Akun Persediaan Bahan Baku yang dikurangi (kredit) saat HPP Order diposting (T-204).",
    )
    pos_auto_post_enabled = models.BooleanField(
        default=True,
        help_text="Posting otomatis transaksi POS lunas ke jurnal.",
    )
    default_pos_payment_method = models.ForeignKey(
        "PaymentMethod",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        help_text="Metode pembayaran fallback untuk POS yang belum dipetakan; sebaiknya menuju akun transit.",
    )
    pos_post_discount_line_enabled = models.BooleanField(
        default=True,
        help_text="Tampilkan dan posting baris diskon POS secara terpisah.",
    )
    pos_marketplace_admin_fee_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun biaya admin marketplace default untuk POS.",
    )
    pos_deposit_income_difference_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun pendapatan selisih deposit POS.",
    )
    pos_deposit_expense_difference_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun biaya selisih deposit POS.",
    )
    pos_purchase_tax_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun pajak pembelian default dari pengaturan POS.",
    )
    pos_sales_total_minus_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun penyesuaian total penjualan minus POS.",
    )
    pos_sales_delivery_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun pengiriman penjualan POS.",
    )
    pos_sales_rounding_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun pembulatan penjualan POS.",
    )
    pos_sales_unique_payment_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun pembayaran unik penjualan POS.",
    )
    komisi_penjualan_debit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun debit default untuk posting komisi penjualan (mis. Beban Komisi).",
    )
    komisi_penjualan_kredit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
        help_text="Akun kredit default untuk posting komisi penjualan (mis. Hutang ke Brand).",
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


class POSPostingSettingsAuditLog(models.Model):
    """Jejak audit khusus perubahan sakelar auto-post transaksi POS."""

    class Action(models.TextChoices):
        ENABLE = "enable", "Aktifkan"
        DISABLE = "disable", "Nonaktifkan"

    action = models.CharField(max_length=10, choices=Action.choices)
    actor = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    previous_value = models.BooleanField()
    new_value = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounting_pos_posting_settings_audit_log"
        ordering = ["-created_at"]
        verbose_name = "Log Pengaturan Posting POS"
        verbose_name_plural = "Log Pengaturan Posting POS"

    def __str__(self):
        return f"{self.get_action_display()} auto-post POS oleh {self.actor}"
