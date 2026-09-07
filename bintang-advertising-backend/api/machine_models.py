"""Penggunaan Mesin -- pelacakan pemakaian mesin produksi (DocuColor, Cetak
Banner, Printer, dst.) per job/SPK, untuk 2 kebutuhan sekaligus (instruksi
user 2026-09-07): (1) lacak biaya produksi riil per order berdasarkan
konsumsi mesin sungguhan, (2) jadwal maintenance berbasis akumulasi counter
pemakaian, bukan tebak-tebakan waktu."""
from django.conf import settings
from django.db import models
from django.utils import timezone


class Mesin(models.Model):
    TIPE_CHOICES = [
        ('docucolor', 'Fuji Xerox DocuColor'),
        ('cetak_banner', 'Cetak Banner'),
        ('printer', 'Printer'),
    ]

    nama = models.CharField(max_length=100)
    tipe = models.CharField(max_length=20, choices=TIPE_CHOICES)
    divisi = models.ForeignKey(
        'Divisi', on_delete=models.SET_NULL, null=True, blank=True, related_name='mesin_list',
    )
    lokasi = models.CharField(max_length=100, blank=True, default='')
    # Servis berkala dipicu tiap N lembar/klik akumulasi -- kosong berarti
    # tidak ada pengingat otomatis untuk mesin ini.
    ambang_servis_klik = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    catatan = models.TextField(blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nama']

    def __str__(self):
        return f"{self.nama} ({self.get_tipe_display()})"

    @property
    def total_klik(self):
        """Akumulasi lembar/klik sejak mesin ini dicatat (color+mono+lembar
        biasa) -- dasar pengecekan ambang servis."""
        agg = self.log_penggunaan.aggregate(
            total=models.Sum(
                models.F('lembar_color') + models.F('lembar_mono'),
                output_field=models.IntegerField(),
            )
        )
        return agg['total'] or 0

    @property
    def klik_sejak_servis_terakhir(self):
        """Akumulasi lembar/klik sejak maintenance TERAKHIR (bukan sejak
        mesin pertama dicatat) -- angka yang sebenarnya dibandingkan ke
        ambang_servis_klik untuk keputusan "sudah waktunya servis?"."""
        last = self.riwayat_maintenance.order_by('-tanggal', '-id').first()
        qs = self.log_penggunaan.all()
        if last:
            qs = qs.filter(
                models.Q(waktu__date__gt=last.tanggal)
                | (models.Q(waktu__date=last.tanggal) & models.Q(id__gt=last.id))
            )
        agg = qs.aggregate(
            total=models.Sum(
                models.F('lembar_color') + models.F('lembar_mono'),
                output_field=models.IntegerField(),
            )
        )
        return agg['total'] or 0

    @property
    def perlu_servis(self):
        if not self.ambang_servis_klik:
            return False
        return self.klik_sejak_servis_terakhir >= self.ambang_servis_klik


class PenggunaanMesin(models.Model):
    KONDISI_CHOICES = [
        ('ok', 'OK'),
        ('kendala', 'Ada Kendala'),
    ]

    mesin = models.ForeignKey(Mesin, on_delete=models.PROTECT, related_name='log_penggunaan')
    job = models.ForeignKey(
        'JobBoard', on_delete=models.SET_NULL, null=True, blank=True, related_name='penggunaan_mesin',
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='penggunaan_mesin',
    )
    waktu = models.DateTimeField(default=timezone.now)

    # DocuColor / Printer -- lembar dipisah color vs mono (basis tagihan
    # klik Xerox berbeda tarif per warna).
    lembar_color = models.PositiveIntegerField(default=0)
    lembar_mono = models.PositiveIntegerField(default=0)
    ukuran_kertas = models.CharField(max_length=20, blank=True, default='')
    jenis_kertas = models.CharField(max_length=100, blank=True, default='')
    gramasi_kertas = models.CharField(max_length=20, blank=True, default='')

    # Cetak Banner -- ditagih per meter/m2, bukan per lembar.
    panjang_bahan_meter = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    jenis_bahan = models.CharField(max_length=100, blank=True, default='')

    kondisi_hasil = models.CharField(max_length=20, choices=KONDISI_CHOICES, default='ok')
    catatan_konfirmasi = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-waktu']
        indexes = [
            models.Index(fields=['mesin', '-waktu'], name='idx_penggunaan_mesin_waktu'),
        ]

    def __str__(self):
        return f"{self.mesin.nama} — {self.waktu:%Y-%m-%d %H:%M}"


class MaintenanceMesin(models.Model):
    mesin = models.ForeignKey(Mesin, on_delete=models.CASCADE, related_name='riwayat_maintenance')
    tanggal = models.DateField(default=timezone.localdate)
    # Snapshot counter mesin saat servis -- dasar hitung klik_sejak_servis_terakhir.
    counter_saat_servis = models.PositiveIntegerField(null=True, blank=True)
    jenis = models.CharField(max_length=150, help_text="Mis: Ganti Toner Cyan, Ganti Fuser, Servis Rutin")
    dicatat_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_dicatat',
    )
    catatan = models.TextField(blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-tanggal', '-id']

    def __str__(self):
        return f"{self.mesin.nama} — {self.jenis} ({self.tanggal})"
