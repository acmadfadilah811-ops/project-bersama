from rest_framework import serializers
from .pos_models import POSSale, POSSaleItem

class POSSaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = POSSaleItem
        fields = '__all__'

class POSSaleSerializer(serializers.ModelSerializer):
    items = POSSaleItemSerializer(many=True, read_only=True)
    kasir_name = serializers.ReadOnlyField(source='kasir.username')
    pelanggan_name = serializers.ReadOnlyField(source='pelanggan.nama')
    dilayani_oleh_nama = serializers.SerializerMethodField()

    class Meta:
        model = POSSale
        fields = '__all__'

    def get_dilayani_oleh_nama(self, obj):
        u = obj.dilayani_oleh
        if not u:
            return None
        return (f"{u.first_name} {u.last_name}".strip() or u.username)
