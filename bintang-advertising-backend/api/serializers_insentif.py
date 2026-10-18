"""Serializer master Jenis Insentif (2026-09-30)."""
from rest_framework import serializers

from .insentif_models import InsentifProduk, JenisInsentif


class JenisInsentifSerializer(serializers.ModelSerializer):
    divisi_nama = serializers.SerializerMethodField()
    unit_bisnis_nama = serializers.ReadOnlyField(source='unit_bisnis.nama')

    class Meta:
        model = JenisInsentif
        fields = [
            'id', 'nama', 'nominal_default', 'unit_bisnis', 'unit_bisnis_nama', 'divisi', 'divisi_nama', 'aktif',
            'keterangan', 'dibuat_pada',
        ]
        read_only_fields = ['dibuat_pada']
        validators = []  # keunikan nama per unit dicek di validate() dengan pesan yang jelas

    def validate(self, attrs):
        unit = attrs['unit_bisnis'] if 'unit_bisnis' in attrs else getattr(self.instance, 'unit_bisnis', None)
        divisi = attrs.get('divisi')
        if divisi is None and self.instance is not None:
            divisi = list(self.instance.divisi.all())
        if unit is not None:
            lain = [d.nama for d in divisi or [] if d.unit_bisnis_id and d.unit_bisnis_id != unit.id]
            if lain:
                raise serializers.ValidationError({'divisi': f"Divisi {', '.join(lain)} bukan milik unit {unit.nama}."})
        nama = attrs.get('nama', getattr(self.instance, 'nama', ''))
        bentrok = JenisInsentif.objects.filter(nama__iexact=nama, unit_bisnis=unit)
        if self.instance is not None:
            bentrok = bentrok.exclude(pk=self.instance.pk)
        if bentrok.exists():
            raise serializers.ValidationError({'nama': 'Nama jenis insentif sudah dipakai di unit ini.'})
        return attrs

    def get_divisi_nama(self, obj):
        return [d.nama for d in obj.divisi.all()]

    def validate_nama(self, value):
        return value.strip()


class InsentifProdukSerializer(serializers.ModelSerializer):
    product_nama = serializers.ReadOnlyField(source='product.nama')
    divisi_nama = serializers.ReadOnlyField(source='divisi.nama')
    unit_bisnis = serializers.SerializerMethodField()
    unit_bisnis_nama = serializers.SerializerMethodField()
    cara_hitung_label = serializers.CharField(source='get_cara_hitung_display', read_only=True)

    class Meta:
        model = InsentifProduk
        fields = [
            'id', 'product', 'product_nama', 'divisi', 'divisi_nama', 'unit_bisnis', 'unit_bisnis_nama',
            'cara_hitung', 'cara_hitung_label', 'nominal', 'persen', 'aktif', 'keterangan', 'diubah_pada',
        ]
        read_only_fields = ['diubah_pada']
        validators = []  # keunikan produk+divisi dicek di validate() dengan pesan yang jelas

    def _unit(self, obj):
        return obj.product.unit_bisnis or obj.divisi.unit_bisnis

    def get_unit_bisnis(self, obj):
        unit = self._unit(obj)
        return unit.id if unit else None

    def get_unit_bisnis_nama(self, obj):
        unit = self._unit(obj)
        return unit.nama if unit else ''

    def validate(self, attrs):
        product = attrs.get('product', getattr(self.instance, 'product', None))
        divisi = attrs.get('divisi', getattr(self.instance, 'divisi', None))
        if product and divisi and product.unit_bisnis_id and divisi.unit_bisnis_id \
                and product.unit_bisnis_id != divisi.unit_bisnis_id:
            raise serializers.ValidationError({'divisi': f'Divisi {divisi.nama} bukan milik unit produk {product.nama}.'})
        cara = attrs.get('cara_hitung', getattr(self.instance, 'cara_hitung', InsentifProduk.CARA_QTY))
        persen = attrs.get('persen', getattr(self.instance, 'persen', 0))
        if cara == InsentifProduk.CARA_PERSEN:
            if not (0 < float(persen or 0) <= 100):
                raise serializers.ValidationError({'persen': 'Persen harus lebih dari 0 dan paling besar 100.'})
            attrs['nominal'] = 0
        else:
            attrs['persen'] = 0
        bentrok = InsentifProduk.objects.filter(product=product, divisi=divisi)
        if self.instance is not None:
            bentrok = bentrok.exclude(pk=self.instance.pk)
        if bentrok.exists():
            raise serializers.ValidationError({'product': f'Insentif {product.nama} untuk divisi {divisi.nama} sudah ada.'})
        return attrs
