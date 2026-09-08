"""Serializer Penggunaan Mesin (Mesin, PenggunaanMesin, MaintenanceMesin)."""
from rest_framework import serializers

from .models import Mesin, PenggunaanMesin, MaintenanceMesin


class MesinSerializer(serializers.ModelSerializer):
    divisi_nama = serializers.ReadOnlyField(source='divisi.nama')
    # `tipe` sekarang teks bebas (bukan Django choices tetap, lihat
    # machine_models.py) -- tipe_display baca property model (lookup preset
    # dengan fallback ke nilai apa adanya), BUKAN get_tipe_display() bawaan
    # Django yang cuma ada untuk field ber-choices.
    tipe_display = serializers.ReadOnlyField()
    basis_pencatatan_display = serializers.ReadOnlyField(source='get_basis_pencatatan_display')
    total_klik = serializers.ReadOnlyField()
    total_meter = serializers.ReadOnlyField()
    klik_sejak_servis_terakhir = serializers.ReadOnlyField()
    perlu_servis = serializers.ReadOnlyField()

    class Meta:
        model = Mesin
        fields = '__all__'


class PenggunaanMesinSerializer(serializers.ModelSerializer):
    mesin_nama = serializers.ReadOnlyField(source='mesin.nama')
    operator_nama = serializers.SerializerMethodField()
    job_nomor_sumber = serializers.ReadOnlyField(source='job.nomor_sumber')

    class Meta:
        model = PenggunaanMesin
        fields = '__all__'
        read_only_fields = ['operator']

    def get_operator_nama(self, obj):
        if not obj.operator:
            return ''
        return obj.operator.get_full_name() or obj.operator.username

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['operator'] = request.user
        return super().create(validated_data)


class MaintenanceMesinSerializer(serializers.ModelSerializer):
    mesin_nama = serializers.ReadOnlyField(source='mesin.nama')
    dicatat_oleh_nama = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceMesin
        fields = '__all__'
        read_only_fields = ['dicatat_oleh']

    def get_dicatat_oleh_nama(self, obj):
        if not obj.dicatat_oleh:
            return ''
        return obj.dicatat_oleh.get_full_name() or obj.dicatat_oleh.username

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['dicatat_oleh'] = request.user
        return super().create(validated_data)
