"""Master Jenis Insentif & rincian insentif per SPK (2026-09-30).

Manager membuat jenis insentif (mis. "Desain", "Cetak") lengkap dengan nominal
standar dan divisi target. Begitu SPK terbit ke tahap milik divisi target,
baris insentifnya otomatis masuk ke SPK (dan tampil di papan kerja staff);
nominalnya bisa dikustom Manager per SPK. Total rincian disalin ke
JobBoard.insentif sehingga timecard/slip gaji/Posting Gaji tidak berubah.
Dipisah dari JobBoard (X2: model besar tidak diberi kolom baru).
"""
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class JenisInsentif(models.Model):
    nama = models.CharField(max_length=100, unique=True)
    nominal_default = models.PositiveIntegerField(default=0, help_text='Nominal standar (Rp) saat masuk ke SPK')
    # Kosong = tidak pernah otomatis, hanya bisa ditambahkan manual oleh Manager.
    divisi = models.ManyToManyField('Divisi', blank=True, related_name='jenis_insentif')
    aktif = models.BooleanField(default=True)
    keterangan = models.CharField(max_length=255, blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nama']

    def __str__(self):
        return self.nama


class InsentifPekerjaan(models.Model):
    job = models.ForeignKey('JobBoard', on_delete=models.CASCADE, related_name='rincian_insentif')
    jenis = models.ForeignKey(JenisInsentif, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    # Salinan nama jenis: tetap terbaca walau master diubah/dihapus.
    nama = models.CharField(max_length=100)
    nominal = models.PositiveIntegerField(default=0)
    catatan = models.CharField(max_length=255, blank=True, default='')
    # True = masuk otomatis dari master saat SPK terbit; False = ditambah/diketik Manager.
    otomatis = models.BooleanField(default=False)
    dibuat_oleh = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    dibuat_pada = models.DateTimeField(auto_now_add=True)
    diubah_pada = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'jenis'], condition=models.Q(jenis__isnull=False), name='uniq_insentif_job_jenis',
            ),
        ]

    def __str__(self):
        return f'{self.nama} Rp{self.nominal} (job #{self.job_id})'


@receiver(post_save, sender='api.JobBoard')
def _insentif_otomatis_saat_job_dibuat(sender, instance, created=False, raw=False, **kwargs):
    """Semua jalur pembuatan SPK (penerbitan, order baru, bot WA) ikut otomatis.
    Angka `insentif` yang diisi langsung saat membuat job dijadikan baris manual
    supaya totalnya tidak hilang saat rincian disinkronkan."""
    if raw or not created:
        return
    from .services import insentif_pekerjaan as svc
    if instance.insentif:
        svc.set_baris_manual(instance, instance.insentif)
    svc.terapkan_otomatis(instance)
