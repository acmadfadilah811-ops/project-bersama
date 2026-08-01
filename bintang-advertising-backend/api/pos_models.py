from django.db import models
from django.conf import settings
from .models import Contact, CustomUser, SaldoKasHarian
from .product_models import Product, ProductVariant
from django.utils import timezone

class POSSale(models.Model):
    STATUS_CHOICES = (
        ('paid', 'Paid'),
        ('hold', 'Hold'),
        ('void', 'Void'),
    )

    nomor = models.CharField(max_length=50, unique=True)
    kasir = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='pos_sales')
    # Karyawan yang MELAYANI/menjadi "service order" pelanggan (bisa siapa saja),
    # dicatat oleh kasir yang menginput. Beda dari `kasir` (akun penginput).
    dilayani_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pos_sales_dilayani', help_text='Karyawan yang melayani pelanggan',
    )
    pelanggan = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name='pos_sales')
    shift = models.ForeignKey(SaldoKasHarian, on_delete=models.SET_NULL, null=True, blank=True, related_name='pos_sales')
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    diskon = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pajak = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    metode_bayar = models.CharField(max_length=50, default='Cash')
    dibayar = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    kembalian = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    catatan = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='paid')
    
    # TAMBAHAN FIELD MODUL PROMO/KUPON (MIGRASI 0078)
    kupon = models.ForeignKey('DiscountCoupon', on_delete=models.SET_NULL, null=True, blank=True, related_name='pos_sales')
    diskon_manual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    diskon_kupon = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    diskon_promo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Diskon Penjualan otomatis (tanpa kode) — mutually exclusive dengan kupon:
    # yang dipakai hanya salah satu, yang nilainya paling besar untuk pelanggan.
    sales_discount = models.ForeignKey(
        'SalesDiscount', on_delete=models.SET_NULL, null=True, blank=True, related_name='pos_sales',
    )
    diskon_penjualan = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ── Loyalty Point (MIGRASI baru) ──
    loyalty_redemption = models.ForeignKey(
        'LoyaltyPointRedemption', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pos_sales', help_text='Opsi penukaran poin yang dipakai di transaksi ini',
    )
    diskon_loyalti = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    poin_ditebus = models.IntegerField(default=0, help_text='Poin yang ditukar pada transaksi ini')
    poin_didapat = models.IntegerField(default=0, help_text='Poin yang diperoleh dari transaksi ini')

    # ── Settlement (Konfirmasi Kas & Bank) ──
    SETTLEMENT_STATUS_CHOICES = (
        ('unsettled', 'Unsettled'),
        ('settled', 'Settled'),
    )
    accounting_payment_method = models.ForeignKey(
        'accounting.PaymentMethod', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pos_sales',
    )
    settlement_status = models.CharField(
        max_length=20, choices=SETTLEMENT_STATUS_CHOICES, default='unsettled', db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nomor} - {self.status}"


class RingkasanShift(models.Model):
    """Snapshot rekonsiliasi kas ketika satu shift ditutup.

    Nilai rincian disimpan agar riwayat tidak berubah ketika transaksi/master
    pembayaran diedit setelah shift ditutup.
    """
    tanggal = models.DateField(default=timezone.localdate)
    kasir = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ringkasan_shift')
    mulai = models.DateTimeField(default=timezone.now)
    berakhir = models.DateTimeField(null=True, blank=True)
    expected = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    aktual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    selisih = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    rincian_tersedia = models.BooleanField(default=False)
    kas_awal = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    penjualan_tunai = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    kas_masuk = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    kas_keluar = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        self.selisih = self.aktual - self.expected
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tanggal} - {self.kasir.username} (Selisih: {self.selisih})"


class POSPaymentMethod(models.Model):
    """Metode pembayaran yang dapat dipilih di POS."""
    TIPE_CHOICES = [
        ('Tunai', 'Tunai (Cash)'), ('QRIS', 'QRIS'), ('Debit', 'Kartu Debit'),
        ('Kredit', 'Kartu Kredit'), ('Transfer', 'Transfer Bank'), ('E-Wallet', 'E-Wallet'),
    ]

    tipe = models.CharField(max_length=30, choices=TIPE_CHOICES, default='Tunai')
    nama = models.CharField(max_length=100, help_text="Nama yang tampil di POS, mis. 'CASH'")
    nama_biaya = models.CharField(max_length=100, blank=True, default='', help_text="Mis. 'MDR'")
    nilai_biaya = models.DecimalField(max_digits=6, decimal_places=2, default=0, help_text="Persen biaya layanan")
    is_active = models.BooleanField(default=True)
    accounting_payment_method = models.ForeignKey(
        'accounting.PaymentMethod', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pos_payment_methods',
        help_text="Pemetaan ke Cara Pembayaran di modul Akuntansi Internal.",
    )
    urutan = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['urutan', 'id']

    def __str__(self):
        return f"{self.nama} ({self.tipe})"

class POSSaleItem(models.Model):
    sale = models.ForeignKey(POSSale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    
    nama_snapshot = models.CharField(max_length=255)
    harga_snapshot = models.DecimalField(max_digits=12, decimal_places=2, help_text="Harga per satuan DASAR")
    qty = models.DecimalField(max_digits=10, decimal_places=2, help_text="Qty dalam satuan DASAR")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    catatan = models.TextField(blank=True, default='')
    # Satuan alternatif (UOM) yang dipilih kasir; qty/harga di atas tetap basis dasar.
    uom_kode = models.CharField(max_length=10, blank=True, default='')
    uom_konverter = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    uom_qty = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    uom_harga = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Harga per satuan yang dipilih")
    
    # TAMBAHAN FIELD MODUL PROMO/KUPON (MIGRASI 0078)
    is_gratis = models.BooleanField(default=False)
    promo = models.ForeignKey('POSPromotion', on_delete=models.SET_NULL, null=True, blank=True, related_name='sale_items')

    def __str__(self):
        return f"{self.nama_snapshot} x {self.qty}"
