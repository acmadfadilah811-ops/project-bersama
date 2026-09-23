"""Laporan Kerja Harian untuk Admin Finance & SPV Finance: target & kendala
operasional per periode (input manual). Pola sama dengan
laporan_produksi_models.py (LaporanTargetProduksi) tapi lingkupnya
keuangan, bukan divisi produksi -- tidak ada field `divisi` di sini.
Instruksi user 2026-09-24.

Angka "aktual" (transaksi kas terverifikasi + pengadaan dibuat) SENGAJA
TIDAK disimpan di sini -- selalu dihitung ulang server-side dari
CashTransaction & Purchase saat laporan dibaca (lihat
api/views/laporan_keuangan.py), sama seperti pola Laporan Produksi supaya
tidak pernah menyimpang dari data modul keuangan yang sebenarnya.
"""
from django.db import models


class LaporanTargetKeuangan(models.Model):
    PERIODE_CHOICES = (
        ('harian', 'Harian'),
        ('mingguan', 'Mingguan'),
        ('bulanan', 'Bulanan'),
    )

    dibuat_oleh = models.ForeignKey(
        'api.CustomUser', on_delete=models.SET_NULL, null=True,
        related_name='laporan_target_keuangan',
    )
    periode_tipe = models.CharField(max_length=10, choices=PERIODE_CHOICES)
    tanggal_mulai = models.DateField()
    tanggal_selesai = models.DateField()
    target_transaksi = models.PositiveIntegerField(
        default=0,
        help_text='Target jumlah transaksi/pengajuan yang diselesaikan pada periode ini.',
    )
    kendala_operasional = models.TextField(blank=True, default='')
    catatan = models.TextField(blank=True, default='')
    dibuat_pada = models.DateTimeField(auto_now_add=True)
    diperbarui_pada = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-tanggal_mulai', '-id']
        indexes = [
            models.Index(fields=['dibuat_oleh', 'tanggal_mulai'], name='idx_ltk_pembuat_tanggal'),
        ]

    def __str__(self):
        return f'LaporanTargetKeuangan#{self.pk} user={self.dibuat_oleh_id} {self.tanggal_mulai}..{self.tanggal_selesai}'
