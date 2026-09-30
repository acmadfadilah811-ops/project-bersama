"""Serializer master Jenis Insentif (2026-09-30)."""
from rest_framework import serializers

from .insentif_models import JenisInsentif


class JenisInsentifSerializer(serializers.ModelSerializer):
    divisi_nama = serializers.SerializerMethodField()

    class Meta:
        model = JenisInsentif
        fields = ['id', 'nama', 'nominal_default', 'divisi', 'divisi_nama', 'aktif', 'keterangan', 'dibuat_pada']
        read_only_fields = ['dibuat_pada']

    def get_divisi_nama(self, obj):
        return [d.nama for d in obj.divisi.all()]

    def validate_nama(self, value):
        return value.strip()
