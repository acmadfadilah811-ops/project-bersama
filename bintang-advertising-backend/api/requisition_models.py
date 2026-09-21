"""Model Permintaan Bahan (Material Requisition): Kordiv/SPV meminta bahan baku
ke gudang. Alur: diajukan -> disetujui/ditolak -> disiapkan -> diterima (atau batal).

SENGAJA tidak mengubah stok (`InventoryItem.stok`) maupun jurnal apa pun -- stok
tetap berkurang hanya lewat pemakaian yang sudah ada (JobMaterialDeductView /
BoM otomatis, api/views/jobs.py). Dokumen ini murni lapisan permintaan &
persetujuan, supaya bahan tidak terpotong dua kali (dokumen ini + pemakaian)."""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q


class MaterialRequisition(models.Model):
    STATUS_CHOICES = [
        ('diajukan', 'Diajukan'),
        ('disetujui', 'Disetujui'),
        ('ditolak', 'Ditolak'),
        ('disiapkan', 'Disiapkan'),
        ('diterima', 'Diterima'),
        ('batal', 'Batal'),
    ]

    nomor = models.CharField(max_length=50, unique=True, blank=True)
    pemohon = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='permintaan_bahan',
    )
    divisi = models.ForeignKey(
        'Divisi', on_delete=models.SET_NULL, null=True, blank=True, related_name='permintaan_bahan',
    )
    # Pekerjaan terkait (opsional) -- hanya untuk konteks, tidak dipakai menghitung apa pun.
    job = models.ForeignKey(
        'JobBoard', on_delete=models.SET_NULL, null=True, blank=True, related_name='permintaan_bahan',
    )
    keperluan = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='diajukan', db_index=True)

    catatan_penolakan = models.TextField(blank=True, default='')
    disetujui_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='permintaan_bahan_disetujui',
    )
    disetujui_pada = models.DateTimeField(null=True, blank=True)
    disiapkan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='permintaan_bahan_disiapkan',
    )
    disiapkan_pada = models.DateTimeField(null=True, blank=True)
    diterima_pada = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', '-created_at'], name='idx_mreq_status_waktu')]

    def __str__(self):
        return self.nomor or f'MR-{self.pk}'


class MaterialRequisitionItem(models.Model):
    requisition = models.ForeignKey(MaterialRequisition, on_delete=models.CASCADE, related_name='items')
    # PROTECT: bahan yang pernah diminta tidak boleh terhapus diam-diam dari master.
    item = models.ForeignKey('InventoryItem', on_delete=models.PROTECT, related_name='permintaan_bahan_items')
    qty_diminta = models.DecimalField(max_digits=12, decimal_places=4)
    qty_disetujui = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    qty_disiapkan = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    catatan = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        constraints = [
            # Satu bahan hanya boleh muncul sekali per permintaan.
            models.UniqueConstraint(fields=['requisition', 'item'], name='uniq_mreq_item_per_dokumen'),
            models.CheckConstraint(condition=Q(qty_diminta__gt=Decimal('0')), name='chk_mreq_qty_diminta_positif'),
        ]

    def __str__(self):
        return f'{self.requisition_id} - {self.item_id} x{self.qty_diminta}'
