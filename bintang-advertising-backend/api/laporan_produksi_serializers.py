from rest_framework import serializers

from .laporan_produksi_models import LaporanTargetProduksi
from .models import JobBoard


class LaporanTargetProduksiSerializer(serializers.ModelSerializer):
    dibuat_oleh_nama = serializers.SerializerMethodField()
    divisi_nama = serializers.SerializerMethodField()
    jumlah_selesai_aktual = serializers.SerializerMethodField()
    capaian_persen = serializers.SerializerMethodField()

    class Meta:
        model = LaporanTargetProduksi
        fields = [
            'id', 'dibuat_oleh', 'dibuat_oleh_nama', 'divisi', 'divisi_nama',
            'periode_tipe', 'tanggal_mulai', 'tanggal_selesai', 'target_selesai',
            'kendala_operasional', 'catatan', 'dibuat_pada', 'diperbarui_pada',
            'jumlah_selesai_aktual', 'capaian_persen',
        ]
        read_only_fields = ['id', 'dibuat_oleh', 'dibuat_pada', 'diperbarui_pada']

    def get_dibuat_oleh_nama(self, obj):
        if not obj.dibuat_oleh:
            return None
        return obj.dibuat_oleh.get_full_name() or obj.dibuat_oleh.username

    def get_divisi_nama(self, obj):
        return obj.divisi.nama if obj.divisi else 'Semua Divisi'

    def _job_selesai_queryset(self, obj):
        # Definisi "selesai" harus identik dengan StaffPerformanceReportView/
        # ringkasan_tim/ExportJobsView -- supaya kriteria UAT "jumlah order
        # selesai di laporan cocok dengan data di modul produksi" terjamin,
        # bukan cuma kebetulan sama.
        qs = JobBoard.objects.filter(
            status_pekerjaan='selesai',
            waktu_selesai__date__gte=obj.tanggal_mulai,
            waktu_selesai__date__lte=obj.tanggal_selesai,
        )
        if obj.divisi_id:
            qs = qs.filter(tahap__divisi_id=obj.divisi_id)
        return qs

    def get_jumlah_selesai_aktual(self, obj):
        return self._job_selesai_queryset(obj).count()

    def get_capaian_persen(self, obj):
        if not obj.target_selesai:
            return None
        aktual = self.get_jumlah_selesai_aktual(obj)
        return round((aktual / obj.target_selesai) * 100, 1)
