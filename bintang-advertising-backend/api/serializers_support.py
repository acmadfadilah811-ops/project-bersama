"""Serializer untuk FAQ, komplain, dan CRM/MRP."""
from rest_framework import serializers

from .models import (
    BillOfMaterials, BoMItem, CustomerActivity, FAQ, KomplainLog, KomplainOrder,
)


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = '__all__'


class KomplainLogSerializer(serializers.ModelSerializer):
    user_nama = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = KomplainLog
        fields = ['id', 'user', 'user_nama', 'status_baru', 'catatan', 'waktu']
        read_only_fields = ['user', 'waktu']


class KomplainOrderSerializer(serializers.ModelSerializer):
    dicatat_oleh_nama = serializers.ReadOnlyField(source='dicatat_oleh.username')
    ditangani_oleh_nama = serializers.ReadOnlyField(source='ditangani_oleh.username')
    order_nama = serializers.ReadOnlyField(source='order.nama')
    order_nomor_wa = serializers.ReadOnlyField(source='order.nomor_wa')
    jenis_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    resolusi_display = serializers.SerializerMethodField()
    logs = KomplainLogSerializer(many=True, read_only=True)

    class Meta:
        model = KomplainOrder
        fields = [
            'id', 'order', 'order_nama', 'order_nomor_wa',
            'dicatat_oleh', 'dicatat_oleh_nama', 'ditangani_oleh', 'ditangani_oleh_nama',
            'jenis_komplain', 'jenis_display', 'deskripsi', 'status', 'status_display',
            'resolusi', 'resolusi_display', 'catatan_resolusi', 'perlu_cetak_ulang',
            'foto_bukti', 'waktu_masuk', 'waktu_selesai', 'logs',
        ]
        read_only_fields = ['waktu_masuk', 'waktu_selesai']

    def get_jenis_display(self, obj):
        return obj.get_jenis_komplain_display()

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_resolusi_display(self, obj):
        return obj.get_resolusi_display() if obj.resolusi else None


class CustomerActivitySerializer(serializers.ModelSerializer):
    pic_username = serializers.ReadOnlyField(source='pic.username')
    order_nama = serializers.ReadOnlyField(source='order.nama')

    class Meta:
        model = CustomerActivity
        fields = '__all__'
        read_only_fields = ['pic']


class BoMItemSerializer(serializers.ModelSerializer):
    inventory_item_nama = serializers.ReadOnlyField(source='inventory_item.nama')
    inventory_item_satuan = serializers.ReadOnlyField(source='inventory_item.satuan')

    class Meta:
        model = BoMItem
        fields = '__all__'


class BillOfMaterialsSerializer(serializers.ModelSerializer):
    # `product` sekarang FK ke Product asli (product_models); `product_price`
    # dipertahankan sebagai tautan legacy (lihat migration 0114). Kedua
    # method field ini menangani baris lama (cuma product_price terisi) dan
    # baris baru (product terisi) supaya frontend tidak perlu tahu bedanya.
    product_nama = serializers.SerializerMethodField()
    variant_nama = serializers.SerializerMethodField()
    items = BoMItemSerializer(many=True, read_only=True)

    class Meta:
        model = BillOfMaterials
        fields = '__all__'

    def get_product_nama(self, obj):
        if obj.product_id:
            return obj.product.nama
        if obj.product_price_id:
            return obj.product_price.nama_produk
        return None

    def get_variant_nama(self, obj):
        return obj.variant.nama_varian if obj.variant_id else None
