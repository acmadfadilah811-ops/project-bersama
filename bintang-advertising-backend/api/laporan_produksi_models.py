"""Laporan Produksi SPV: target & kendala operasional per periode.

Beda dari `production_models.py` (biaya produksi/BOM) -- ini soal laporan
kinerja SPK/JobBoard (2026-09-23, instruksi user). Ditemukan oleh
api/models.py lewat `from .laporan_produksi_models import *`, pola yang
sama dengan pos_models/product_models/dst.

Angka "aktual" (jumlah job selesai) SENGAJA TIDAK disimpan di sini --
selalu dihitung ulang server-side dari JobBoard saat laporan dibaca (lihat
api/views/laporan_produksi.py), supaya tidak pernah menyimpang dari data
modul produksi yang sebenarnya (kriteria UAT: "jumlah order selesai di
laporan cocok dengan data di modul produksi").
"""
from django.db import models


class LaporanTargetProduksi(models.Model):
    PERIODE_CHOICES = (
        ('harian', 'Harian'),
        ('mingguan', 'Mingguan'),
        ('bulanan', 'Bulanan'),
    )

    dibuat_oleh = models.ForeignKey(
        'api.CustomUser', on_delete=models.SET_NULL, null=True,
        related_name='laporan_target_produksi',
    )
    # Nullable: SPV yang mengawasi lintas divisi boleh membuat laporan tanpa
    # menyasar satu divisi spesifik (lingkup = seluruh tim bawahannya).
    divisi = models.ForeignKey(
        'api.Divisi', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='laporan_target_produksi',
    )
    periode_tipe = models.CharField(max_length=10, choices=PERIODE_CHOICES)
    tanggal_mulai = models.DateField()
    tanggal_selesai = models.DateField()
    target_selesai = models.PositiveIntegerField(
        default=0, help_text='Target jumlah job/order selesai pada periode ini.',
    )
    kendala_operasional = models.TextField(blank=True, default='')
    catatan = models.TextField(blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)
    diperbarui_pada = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-tanggal_mulai', '-id']
        indexes = [
            models.Index(fields=['divisi', 'tanggal_mulai'], name='idx_ltp_divisi_tanggal'),
            models.Index(fields=['dibuat_oleh', 'tanggal_mulai'], name='idx_ltp_pembuat_tanggal'),
        ]

    def __str__(self):
        divisi_nama = self.divisi.nama if self.divisi else 'Semua Divisi'
        return f'LaporanTargetProduksi#{self.pk} {divisi_nama} {self.tanggal_mulai}..{self.tanggal_selesai}'
