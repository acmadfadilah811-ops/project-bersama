"""Serializer sumber daya POS dan ringkasan shift."""
from rest_framework import serializers

from .models import POSAntrianDevice, POSPaymentMethod, SaldoKasHarian, RingkasanShift


class POSAntrianDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = POSAntrianDevice
        fields = '__all__'


class SaldoKasHarianSerializer(serializers.ModelSerializer):
    kasir_nama = serializers.SerializerMethodField()

    class Meta:
        model = SaldoKasHarian
        fields = '__all__'
        read_only_fields = ['kasir', 'kas_akhir', 'waktu_tutup']

    def get_kasir_nama(self, obj):
        return obj.kasir.get_full_name() or obj.kasir.username if obj.kasir else ''


class POSPaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = POSPaymentMethod
        fields = '__all__'


class RingkasanShiftSerializer(serializers.ModelSerializer):
    kasir_nama = serializers.SerializerMethodField()

    class Meta:
        model = RingkasanShift
        fields = '__all__'
        read_only_fields = [
            'tanggal', 'kasir', 'mulai', 'berakhir', 'expected', 'aktual', 'selisih',
            'rincian_tersedia', 'kas_awal', 'penjualan_tunai', 'kas_masuk', 'kas_keluar',
        ]

    def get_kasir_nama(self, obj):
        return obj.kasir.get_full_name() or obj.kasir.username if obj.kasir else ''
