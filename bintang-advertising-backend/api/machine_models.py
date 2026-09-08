"""Penggunaan Mesin -- pelacakan pemakaian mesin produksi (DocuColor, Cetak
Banner, Printer, dst.) per job/SPK, untuk 2 kebutuhan sekaligus (instruksi
user 2026-09-07): (1) lacak biaya produksi riil per order berdasarkan
konsumsi mesin sungguhan, (2) jadwal maintenance berbasis akumulasi counter
pemakaian, bukan tebak-tebakan waktu."""
from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import models
from django.utils import timezone


class Mesin(models.Model):
    # Daftar SARAN default di form Tambah Mesin -- BUKAN batasan/enum tetap.
    # `tipe` sengaja CharField bebas (lihat di bawah), supaya owner bisa
    # mendaftarkan tipe mesin baru sendiri (mis. beli mesin laminating) tanpa
    # perlu kode/deploy baru (bug dilaporkan user 2026-09-09: form Tambah
    # Mesin sebelumnya cuma bisa pilih 3 tipe ini via <select> choices tetap).
    TIPE_PRESETS = [
        ('docucolor', 'Fuji Xerox DocuColor'),
        ('cetak_banner', 'Cetak Banner'),
        ('printer', 'Printer'),
    ]
    _TIPE_PRESET_LABELS = dict(TIPE_PRESETS)

    class BasisPencatatan(models.TextChoices):
        """Menentukan field mana yang diisi staff di form Catat Penggunaan
        Mesin (ForwardJobModal) -- dulu ditentukan dari string `tipe` literal
        (`tipe == 'docucolor'` dst), yang gagal total untuk tipe mesin baru
        yang belum dikenal kode. Basis ini yang jadi sumber kebenaran sekarang."""
        LEMBAR = 'lembar', 'Lembar/Klik (Color & Mono) -- DocuColor, Printer'
        METER = 'meter', 'Meter/Panjang Bahan -- Cetak Banner'
        LAINNYA = 'lainnya', 'Lainnya (catatan manual, tanpa satuan baku)'

    class JadwalServisInterval(models.TextChoices):
        """Servis berbasis WAKTU (baru) -- pelengkap ambang_servis_klik yang
        berbasis akumulasi klik/lembar. Owner minta ini karena mesin idle
        (jarang dipakai) tetap butuh servis berkala biar tidak ketahuan cuma
        dari klik yang jarang bertambah (instruksi user 2026-09-09)."""
        MINGGUAN = 'mingguan', 'Mingguan'
        BULANAN = 'bulanan', 'Bulanan'
        TAHUNAN = 'tahunan', 'Tahunan'
        CUSTOM_BULAN = 'custom_bulan', 'Setiap N Bulan'

    nama = models.CharField(max_length=100)
    tipe = models.CharField(max_length=50)
    basis_pencatatan = models.CharField(
        max_length=10, choices=BasisPencatatan.choices, default=BasisPencatatan.LEMBAR,
    )
    divisi = models.ForeignKey(
        'Divisi', on_delete=models.SET_NULL, null=True, blank=True, related_name='mesin_list',
    )
    # Sebelumnya "lokasi" -- diganti jadi nama vendor/supplier mesin (instruksi
    # user 2026-09-09), lebih berguna untuk kontak servis/beli sparepart
    # daripada lokasi fisik yang jarang berubah & jarang dicari.
    vendor = models.CharField(max_length=100, blank=True, default='')
    # Servis berkala dipicu tiap N lembar/klik akumulasi -- kosong berarti
    # tidak ada pengingat otomatis dari sisi klik untuk mesin ini.
    ambang_servis_klik = models.PositiveIntegerField(null=True, blank=True)
    # Servis berkala berbasis WAKTU -- independen dari ambang_servis_klik,
    # keduanya bisa aktif bersamaan (perlu_servis = OR keduanya).
    jadwal_servis_interval = models.CharField(
        max_length=15, choices=JadwalServisInterval.choices, null=True, blank=True,
    )
    jadwal_servis_custom_bulan = models.PositiveIntegerField(
        null=True, blank=True, help_text="Dipakai hanya kalau jadwal_servis_interval='custom_bulan'.",
    )
    is_active = models.BooleanField(default=True)
    catatan = models.TextField(blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nama']

    def __str__(self):
        return f"{self.nama} ({self.tipe_display})"

    @property
    def tipe_display(self):
        """Label rapi untuk tipe preset yang dikenal; tipe kustom milik owner
        ditampilkan apa adanya (tidak ada di _TIPE_PRESET_LABELS)."""
        return self._TIPE_PRESET_LABELS.get(self.tipe, self.tipe)

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
    def total_meter(self):
        """Akumulasi meter bahan (mesin basis METER, mis. Cetak Banner) sejak
        dicatat -- pasangan total_klik untuk mesin yang ditagih per meter,
        bukan per lembar."""
        agg = self.log_penggunaan.aggregate(total=models.Sum('panjang_bahan_meter'))
        return agg['total'] or 0

    @property
    def jadwal_servis_berikutnya(self):
        """Tanggal servis terjadwal berikutnya berdasarkan jadwal_servis_interval,
        dihitung dari maintenance TERAKHIR (atau tanggal mesin didaftarkan
        kalau belum pernah diservis sama sekali). None kalau tidak diset."""
        if not self.jadwal_servis_interval:
            return None
        last = self.riwayat_maintenance.order_by('-tanggal', '-id').first()
        basis_tanggal = last.tanggal if last else self.dibuat_pada.date()
        if self.jadwal_servis_interval == self.JadwalServisInterval.MINGGUAN:
            return basis_tanggal + timedelta(weeks=1)
        if self.jadwal_servis_interval == self.JadwalServisInterval.BULANAN:
            return basis_tanggal + relativedelta(months=1)
        if self.jadwal_servis_interval == self.JadwalServisInterval.TAHUNAN:
            return basis_tanggal + relativedelta(years=1)
        if self.jadwal_servis_interval == self.JadwalServisInterval.CUSTOM_BULAN:
            return basis_tanggal + relativedelta(months=self.jadwal_servis_custom_bulan or 1)
        return None

    @property
    def perlu_servis_jadwal(self):
        due = self.jadwal_servis_berikutnya
        return bool(due) and timezone.localdate() >= due

    @property
    def perlu_servis(self):
        """Gabungan 2 pemicu independen: ambang klik/lembar (lama) ATAU
        jadwal waktu (baru) -- mesin idle yang klik-nya jarang bertambah
        tetap kena pengingat servis dari sisi waktu."""
        perlu_klik = bool(self.ambang_servis_klik) and self.klik_sejak_servis_terakhir >= self.ambang_servis_klik
        return perlu_klik or self.perlu_servis_jadwal


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
