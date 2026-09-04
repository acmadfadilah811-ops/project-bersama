from rest_framework import serializers

from .finance_models import CashTransactionType, CashTransaction, CashTransactionAttachment
from .protected_media import protected_media_url


class CashTransactionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashTransactionType
        fields = '__all__'
        read_only_fields = ['dibuat_oleh']


class CashTransactionAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    nama = serializers.SerializerMethodField()

    class Meta:
        model = CashTransactionAttachment
        fields = ['id', 'file', 'file_url', 'nama', 'created_at']

    def get_file_url(self, obj):
        return protected_media_url(obj.file, self.context.get('request'))

    def get_nama(self, obj):
        return obj.file.name.split('/')[-1] if obj.file else None

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Lampiran transaksi kas bisa berisi dokumen finansial privat -
        # jangan expose URL publik lewat field 'file' mentah.
        rep['file'] = protected_media_url(instance.file, self.context.get('request'))
        return rep


class CashTransactionSerializer(serializers.ModelSerializer):
    lampiran = CashTransactionAttachmentSerializer(many=True, read_only=True)
    tipe_transaksi_nama = serializers.ReadOnlyField(source='tipe_transaksi.nama')
    staff_nama = serializers.ReadOnlyField(source='staff.username')
    dibuat_oleh_nama = serializers.ReadOnlyField(source='dibuat_oleh.username')
    akun_debit_nama = serializers.ReadOnlyField(source='akun_debit.name', default='')
    akun_kredit_nama = serializers.ReadOnlyField(source='akun_kredit.name', default='')

    class Meta:
        model = CashTransaction
        fields = '__all__'
        read_only_fields = ['nomor', 'arah', 'dibuat_oleh', 'status']
