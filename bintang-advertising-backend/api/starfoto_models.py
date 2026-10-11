"""Pesanan sesi foto StarFoto (2026-10-11).

Alur: Kasir (pesanan + DP) -> Fotografer & Asisten (sesi, boleh mengusulkan
tambahan) -> Kasir (konfirmasi usulan + pilih file) -> Editor -> Operator Cetak.

Paket foto = Product jasa biasa; model di sini hanya melengkapi informasi yang
tidak dimiliki Product/Order (X2: god model tidak diberi kolom baru). Uang tetap
lewat Order/OrderItem/Addon sehingga jurnal DP, pelunasan, dan pengakuan
pendapatan memakai alur yang sudah ada.
"""
from django.conf import settings
from django.db import models

LOKASI_CHOICES = (
    ('studio', 'Studio'),
    ('outdoor', 'Outdoor'),
)


class PaketFoto(models.Model):
    product = models.OneToOneField('Product', on_delete=models.CASCADE, related_name='paket_foto')
    kuota_orang = models.PositiveIntegerField(default=1, help_text='Jumlah orang yang sudah termasuk harga paket')
    # Kelebihan orang ditagih lewat addon ini (harga addon berbeda per kategori).
    addon_tambah_orang = models.ForeignKey(
        'Addon', on_delete=models.SET_NULL, null=True, blank=True, related_name='paket_foto_tambah_orang',
    )
    jumlah_edit = models.PositiveIntegerField(default=0, help_text='Jumlah file edit yang termasuk paket')
    jumlah_sesi = models.PositiveIntegerField(default=1)
    # Kosong = durasi bawaan di Pengaturan StarFoto.
    durasi_menit = models.PositiveIntegerField(null=True, blank=True)
    lokasi = models.CharField(max_length=20, choices=LOKASI_CHOICES + (('studio_outdoor', 'Studio & Outdoor'),), default='studio')
    # Kosong = DP minimal di Pengaturan StarFoto.
    dp_minimal_persen = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    isi_paket = models.TextField(blank=True, default='', help_text='Isi paket (cetak, kostum, tema) untuk ditampilkan ke kasir/staff')

    class Meta:
        ordering = ['product__nama']

    def __str__(self):
        return f'Paket foto {self.product.nama}'


class PesananFoto(models.Model):
    STATUS_CHOICES = (
        ('sesi', 'Sesi Foto'),
        ('menunggu_kasir', 'Menunggu Konfirmasi Kasir'),
        ('dikonfirmasi', 'Dikonfirmasi (Produksi)'),
        ('batal', 'Batal'),
    )
    JENIS_CHOICES = (
        ('booking_wa', 'Booking WhatsApp'),
        ('walkin', 'Datang Langsung'),
    )

    order = models.OneToOneField('Order', on_delete=models.CASCADE, related_name='pesanan_foto')
    paket_item = models.OneToOneField('OrderItem', on_delete=models.CASCADE, related_name='pesanan_foto')
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES, default='walkin')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sesi', db_index=True)
    jumlah_orang = models.PositiveIntegerField(default=1)
    nomor_kantong = models.CharField(max_length=30, blank=True, default='')
    background = models.CharField(max_length=100, blank=True, default='')
    catatan_file = models.TextField(blank=True, default='')
    dikonfirmasi_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    dikonfirmasi_pada = models.DateTimeField(null=True, blank=True)
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    # Approval hasil edit oleh pelanggan lewat tautan WA (2026-10-11).
    APPROVAL_CHOICES = (
        ('', 'Belum'),
        ('menunggu', 'Menunggu Pelanggan'),
        ('revisi', 'Revisi'),
        ('disetujui', 'Disetujui'),
        ('tanpa_edit', 'Tanpa Edit'),
    )
    approval_status = models.CharField(max_length=20, choices=APPROVAL_CHOICES, blank=True, default='', db_index=True)
    # Putaran pratinjau saat ini (1 = hasil edit pertama, 2 = setelah revisi ke-1, dst).
    approval_putaran = models.PositiveIntegerField(default=0)
    approval_dikirim_pada = models.DateTimeField(null=True, blank=True)
    approval_diputus_pada = models.DateTimeField(null=True, blank=True)
    # 'pelanggan' atau username staff yang memutuskan atas nama pelanggan.
    approval_oleh = models.CharField(max_length=150, blank=True, default='')

    class Meta:
        ordering = ['-dibuat_pada']

    def __str__(self):
        return f'Pesanan foto {self.order_id}'


class SesiFoto(models.Model):
    STATUS_CHOICES = (
        ('terjadwal', 'Terjadwal'),
        ('berlangsung', 'Berlangsung'),
        ('selesai', 'Selesai'),
        ('batal', 'Batal'),
    )

    pesanan = models.ForeignKey(PesananFoto, on_delete=models.CASCADE, related_name='sesi')
    urutan = models.PositiveIntegerField(default=1)
    mulai = models.DateTimeField(db_index=True)
    durasi_menit = models.PositiveIntegerField(default=30)
    lokasi = models.CharField(max_length=20, choices=LOKASI_CHOICES, default='studio')
    alamat = models.CharField(max_length=255, blank=True, default='')
    # Kosong = belum diambil; fotografer StarFoto mengklaim sesi dari antrean
    # global divisinya (2026-10-11) dan otomatis jadi PIC SPK Sesi Foto.
    fotografer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='sesi_foto_fotografer',
    )
    asisten = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='sesi_foto_asisten',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='terjadwal', db_index=True)
    mulai_aktual = models.DateTimeField(null=True, blank=True)
    selesai_aktual = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['mulai']
        constraints = [
            models.UniqueConstraint(fields=['pesanan', 'urutan'], name='uniq_sesi_foto_urutan'),
        ]

    def __str__(self):
        return f'Sesi {self.urutan} {self.pesanan.order_id}'


class UsulanTambahan(models.Model):
    """Tambahan yang diminta pelanggan saat sesi. Fotografer hanya MENGUSULKAN;
    tagihan & stok baru berubah setelah kasir menyetujui."""
    STATUS_CHOICES = (
        ('usulan', 'Menunggu Kasir'),
        ('disetujui', 'Disetujui'),
        ('ditolak', 'Ditolak'),
    )

    pesanan = models.ForeignKey(PesananFoto, on_delete=models.CASCADE, related_name='usulan')
    # Tepat satu: addon paket (tambah orang/kostum/edit) atau produk (pigura).
    addon = models.ForeignKey('Addon', on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    product = models.ForeignKey('Product', on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    variant = models.ForeignKey('ProductVariant', on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    nama = models.CharField(max_length=255)
    qty = models.PositiveIntegerField(default=1)
    catatan = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='usulan', db_index=True)
    alasan_tolak = models.CharField(max_length=255, blank=True, default='')
    diusulkan_oleh = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    diusulkan_pada = models.DateTimeField(auto_now_add=True)
    diputus_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    diputus_pada = models.DateTimeField(null=True, blank=True)
    # Baris pesanan hasil persetujuan usulan produk (pigura).
    order_item = models.ForeignKey('OrderItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        ordering = ['id']
        constraints = [
            models.CheckConstraint(
                name='usulan_tambahan_tepat_satu_sumber',
                check=(
                    models.Q(addon__isnull=False, product__isnull=True)
                    | models.Q(addon__isnull=True, product__isnull=False)
                ),
            ),
        ]

    def __str__(self):
        return f'{self.nama} x{self.qty} ({self.get_status_display()})'


class PilihanFile(models.Model):
    pesanan = models.ForeignKey(PesananFoto, on_delete=models.CASCADE, related_name='pilihan_file')
    nomor_file = models.CharField(max_length=50)
    peruntukan = models.CharField(max_length=150, blank=True, default='', help_text='Mis. edit + cetak 8RP + pigura')
    catatan = models.TextField(blank=True, default='')
    urutan = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['urutan', 'id']

    def __str__(self):
        return f'File {self.nomor_file} ({self.pesanan.order_id})'


def _path_pratinjau(instance, filename):
    import uuid
    return f'pratinjau_edit/{instance.pesanan_id}/{uuid.uuid4().hex}.jpg'


class PratinjauEdit(models.Model):
    """Pratinjau hasil edit (ber-watermark) per foto per putaran, beserta
    keputusan pelanggan. File di prefix terlindung `pratinjau_edit/`; pelanggan
    melihatnya lewat tautan bertanda tangan tanpa login."""
    KEPUTUSAN_CHOICES = (
        ('', 'Belum'),
        ('setuju', 'Setuju'),
        ('revisi', 'Minta Revisi'),
    )

    pesanan = models.ForeignKey(PesananFoto, on_delete=models.CASCADE, related_name='pratinjau')
    putaran = models.PositiveIntegerField(default=1)
    pilihan_file = models.ForeignKey(PilihanFile, on_delete=models.SET_NULL, null=True, blank=True, related_name='pratinjau')
    berkas = models.ImageField(upload_to=_path_pratinjau)
    keputusan = models.CharField(max_length=10, choices=KEPUTUSAN_CHOICES, blank=True, default='')
    catatan_pelanggan = models.TextField(blank=True, default='')
    diunggah_oleh = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['putaran', 'id']

    def __str__(self):
        return f'Pratinjau {self.pesanan.order_id} putaran {self.putaran}'
