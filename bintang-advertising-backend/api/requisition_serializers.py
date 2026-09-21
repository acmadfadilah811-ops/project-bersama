from rest_framework import serializers

from .models import MaterialRequisition, MaterialRequisitionItem
from .services.material_requisition import aksi_untuk


class MaterialRequisitionItemSerializer(serializers.ModelSerializer):
    item_id = serializers.CharField(read_only=True)
    item_nama = serializers.CharField(source='item.nama', read_only=True)
    satuan = serializers.CharField(source='item.satuan', read_only=True)
    stok_tercatat = serializers.FloatField(source='item.stok', read_only=True)

    class Meta:
        model = MaterialRequisitionItem
        fields = [
            'id', 'item_id', 'item_nama', 'satuan', 'stok_tercatat',
            'qty_diminta', 'qty_disetujui', 'qty_disiapkan', 'catatan',
        ]
        read_only_fields = fields


class MaterialRequisitionSerializer(serializers.ModelSerializer):
    items = MaterialRequisitionItemSerializer(many=True, read_only=True)
    pemohon_nama = serializers.SerializerMethodField()
    divisi_nama = serializers.CharField(source='divisi.nama', read_only=True, default=None)
    disetujui_oleh_nama = serializers.SerializerMethodField()
    disiapkan_oleh_nama = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    aksi = serializers.SerializerMethodField()

    class Meta:
        model = MaterialRequisition
        fields = [
            'id', 'nomor', 'status', 'status_display', 'keperluan', 'job',
            'pemohon', 'pemohon_nama', 'divisi', 'divisi_nama',
            'catatan_penolakan', 'disetujui_oleh_nama', 'disetujui_pada',
            'disiapkan_oleh_nama', 'disiapkan_pada', 'diterima_pada',
            'created_at', 'items', 'aksi',
        ]
        read_only_fields = fields

    @staticmethod
    def _nama(user):
        return (user.get_full_name() or user.username) if user else None

    def get_pemohon_nama(self, obj):
        return self._nama(obj.pemohon)

    def get_disetujui_oleh_nama(self, obj):
        return self._nama(obj.disetujui_oleh)

    def get_disiapkan_oleh_nama(self, obj):
        return self._nama(obj.disiapkan_oleh)

    def get_aksi(self, obj):
        request = self.context.get('request')
        return aksi_untuk(request.user, obj) if request else []


class _BarisPermintaanSerializer(serializers.Serializer):
    item_id = serializers.CharField()
    qty = serializers.DecimalField(max_digits=12, decimal_places=4)
    catatan = serializers.CharField(required=False, allow_blank=True, max_length=255)


class MaterialRequisitionCreateSerializer(serializers.Serializer):
    """Hanya untuk validasi bentuk request & skema API; aturan bisnis ada di service."""

    keperluan = serializers.CharField(required=False, allow_blank=True)
    job = serializers.IntegerField(required=False, allow_null=True)
    items = _BarisPermintaanSerializer(many=True)
