"""Serializer master Jenis Insentif (2026-09-30)."""
from rest_framework import serializers

from .insentif_models import JenisInsentif


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
