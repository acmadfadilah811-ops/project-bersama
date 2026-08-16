from django.db import models
from django.conf import settings
from .models import Contact, CustomUser, SaldoKasHarian
from .product_models import Product, ProductPackage, ProductVariant
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
    WHATSAPP_RESI_STATUS_CHOICES = (
        ('pending', 'Belum Dikirim'),
        ('sending', 'Sedang Dikirim'),
        ('sent', 'Terkirim'),
        ('failed', 'Gagal Dikirim'),
        ('skipped', 'Tidak Dikirim'),
    )
    whatsapp_resi_status = models.CharField(
        max_length=20, choices=WHATSAPP_RESI_STATUS_CHOICES, default='pending',
        help_text='Status pengiriman resi POS melalui WhatsApp.',
    )
    whatsapp_resi_number = models.CharField(max_length=20, blank=True, default='')
    whatsapp_resi_sent_at = models.DateTimeField(null=True, blank=True)
    whatsapp_resi_error = models.CharField(max_length=255, blank=True, default='')
    # Audit pembatalan disimpan pada transaksi sumber. Jangan gunakan
    # ``created_at`` sebagai waktu void karena keduanya adalah peristiwa berbeda.
    voided_at = models.DateTimeField(null=True, blank=True, db_index=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pos_sales_voided',
    )
    
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

    # Terisi saat kasir menandai pesanan (dengan SPK produksi) sudah diambil
    # pelanggan — padanan Order.status_global='selesai' utk transaksi POS.
    # Sebelum ini transaksi POS Lunas + SPK tidak punya status "siap
    # diambil"/"sudah diambil" sama sekali: job produksi dari alur POS
    # sengaja di-skip di logic auto-ready (views/jobs.py, cuma cek
    # order_item), dan halaman Pesanan & Pelunasan cuma baca /orders/ —
    # jadi pesanan Lunas via Terminal Kasir tidak pernah tampil di sana
    # meski masih dalam produksi (bug ditemukan & diperbaiki 2026-08-13).
    diambil_pada = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.nomor} - {self.status}"


class POSVoidRequest(models.Model):
    """Permintaan kasir untuk membatalkan (void) transaksi POS Lunas —
    padanan `OrderVoidRequest` (lihat api/models.py) untuk transaksi kasir
    yang dibayar langsung/lunas, bukan Order (Pesanan) DP.

    Kasir tidak bisa memanggil /pos/sales/{id}/void/ langsung — dia harus
    mengajukan permintaan di sini dulu, owner menyetujui lewat Dashboard
    (men-generate `otp_code`), baru kasir bisa menyelesaikan void dengan
    kode itu. Owner/manager/admin tetap bisa langsung void tanpa alur ini.
    Ditolak sejak awal kalau transaksi sudah ditandai `diambil_pada` (sudah
    diambil pelanggan & resi/notifikasi selesai terkirim lewat panel
    Pesanan & Pelunasan) — instruksi user 2026-08-14.
    """
    STATUS_CHOICES = (
        ('pending', 'Menunggu Persetujuan'),
        ('disetujui', 'Disetujui'),
        ('ditolak', 'Ditolak'),
        ('digunakan', 'Sudah Digunakan'),
    )

    sale = models.ForeignKey(POSSale, on_delete=models.CASCADE, related_name='void_requests')
    diminta_oleh = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, related_name='pos_void_requests_diminta',
    )
    alasan = models.TextField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', db_index=True)
    otp_code = models.CharField(max_length=6, blank=True, default='')
    disetujui_oleh = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='pos_void_requests_disetujui',
    )
    alasan_tolak = models.TextField(blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)
    disetujui_pada = models.DateTimeField(null=True, blank=True)
    kadaluarsa_pada = models.DateTimeField(null=True, blank=True)
    digunakan_pada = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-dibuat_pada']
        indexes = [
            models.Index(fields=['sale', 'status'], name='idx_pvr_sale_status'),
        ]

    def __str__(self):
        return f'POSVoidRequest#{self.pk} sale={self.sale_id} status={self.status}'


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
    # Snapshot semua kanal pembayaran pada saat shift ditutup. Setiap baris
    # berisi metode, tipe, total, nilai POS, dan nilai DP/pelunasan Order.
    rincian_metode = models.JSONField(default=list, blank=True)
    # Catatan kasir saat menutup shift (mis. alasan selisih kas) — diambil
    # dari SaldoKasHarian.catatan yang sudah diterima server saat close()
    # tapi sebelumnya tidak pernah ikut disalin ke snapshot Ringkasan Shift
    # ini, jadi tidak pernah muncul di laporan V2 (bug ditemukan &
    # diperbaiki 2026-08-13).
    keterangan = models.TextField(blank=True, default='')

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
    # Paket adalah barang jual tersendiri. Komponen paket tetap dipakai untuk
    # pemotongan stok, tetapi referensi ini menjaga laporan/riwayat tidak
    # kehilangan identitas paket setelah transaksi selesai.
    paket = models.ForeignKey(
        ProductPackage, on_delete=models.PROTECT, null=True, blank=True,
        related_name='pos_sale_items',
    )
    
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

    # Produk meteran (price_type='per_m2') & Finishing — sebelumnya item begini
    # dikirim TANPA product (dianggap "item kustom"), jadi tidak bisa dipakaikan
    # addon maupun ikut potong stok. Sekarang product/variant TETAP tertaut;
    # dua field ini cuma menyimpan ukuran/biaya finishing untuk riwayat &
    # struk (harga_snapshot/subtotal tetap dihitung ulang di server dari sini).
    panjang = models.FloatField(default=0.0, help_text="Panjang (meter) untuk produk meteran")
    lebar = models.FloatField(default=0.0, help_text="Lebar (meter) untuk produk meteran")
    finishing_biaya = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Biaya tambahan finishing per satuan qty (mis. laminasi, mata ayam)",
    )

    # Nomor seri yang benar-benar terjual di baris ini (produk dengan
    # `product.pesanan_no_seri=True`) — daftar string, panjangnya harus sama
    # dengan `qty`. Sebelum field ini ada, kolom "No. Seri" tersimpan di
    # kartu produk (Product.serial_numbers) tapi tidak pernah tercatat
    # terjual di transaksi mana pun (bug ditemukan & diperbaiki 2026-08-13).
    serial_numbers = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.nama_snapshot} x {self.qty}"
