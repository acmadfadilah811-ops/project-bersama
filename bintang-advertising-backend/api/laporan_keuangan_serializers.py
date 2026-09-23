from rest_framework import serializers

from .finance_models import CashTransaction
from .laporan_keuangan_models import LaporanTargetKeuangan
from .product_models import Purchase


class LaporanTargetKeuanganSerializer(serializers.ModelSerializer):
    dibuat_oleh_nama = serializers.SerializerMethodField()
    jumlah_transaksi_aktual = serializers.SerializerMethodField()
    capaian_persen = serializers.SerializerMethodField()

    class Meta:
        model = LaporanTargetKeuangan
        fields = [
            'id', 'dibuat_oleh', 'dibuat_oleh_nama', 'periode_tipe',
            'tanggal_mulai', 'tanggal_selesai', 'target_transaksi',
            'kendala_operasional', 'catatan', 'dibuat_pada', 'diperbarui_pada',
            'jumlah_transaksi_aktual', 'capaian_persen',
        ]
        read_only_fields = ['id', 'dibuat_oleh', 'dibuat_pada', 'diperbarui_pada']

    def get_dibuat_oleh_nama(self, obj):
        if not obj.dibuat_oleh:
            return None
        return obj.dibuat_oleh.get_full_name() or obj.dibuat_oleh.username

    def _hitung_aktual(self, obj):
        # "Aktual" = transaksi kas yang DIVERIFIKASI (diverifikasi_admin_finance_*,
        # lihat CashTransaction) + pengadaan yang DIBUAT oleh pembuat laporan
        # ini pada periode -- data nyata dari kerja harian Admin/SPV Finance,
        # dihitung per pembuat laporan (bukan seluruh tim) supaya laporan
        # mencerminkan kerja orang itu sendiri.
        if not obj.dibuat_oleh_id:
            return 0
        verifikasi = CashTransaction.objects.filter(
            diverifikasi_admin_finance_oleh_id=obj.dibuat_oleh_id,
            diverifikasi_admin_finance_pada__date__gte=obj.tanggal_mulai,
            diverifikasi_admin_finance_pada__date__lte=obj.tanggal_selesai,
        ).count()
        pengadaan = Purchase.objects.filter(
            dibuat_oleh_id=obj.dibuat_oleh_id,
            tanggal__gte=obj.tanggal_mulai,
            tanggal__lte=obj.tanggal_selesai,
        ).count()
        return verifikasi + pengadaan

    def get_jumlah_transaksi_aktual(self, obj):
        return self._hitung_aktual(obj)

    def get_capaian_persen(self, obj):
        if not obj.target_transaksi:
            return None
        aktual = self.get_jumlah_transaksi_aktual(obj)
        return round((aktual / obj.target_transaksi) * 100, 1)
