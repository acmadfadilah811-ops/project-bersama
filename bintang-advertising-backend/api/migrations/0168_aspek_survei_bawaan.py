"""Aspek survei kepuasan bawaan (sama dengan e-receipt Olsera yang dipakai sebelumnya)."""
from django.db import migrations

ASPEK = ["Kualitas Produk", "Pelayanan & Keramahan", "Fast Response", "Kesesuaian Harga", "Kenyamanan Berbelanja"]


def isi(apps, schema_editor):
    AspekSurvei = apps.get_model("api", "AspekSurvei")
    for i, nama in enumerate(ASPEK, start=1):
        AspekSurvei.objects.get_or_create(nama=nama, defaults={"urutan": i, "aktif": True})


def hapus(apps, schema_editor):
    apps.get_model("api", "AspekSurvei").objects.filter(nama__in=ASPEK, nilai__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [("api", "0167_struk_online_survei")]
    operations = [migrations.RunPython(isi, hapus)]
