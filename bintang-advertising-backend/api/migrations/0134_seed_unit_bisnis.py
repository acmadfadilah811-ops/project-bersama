from django.db import migrations


def seed_unit_bisnis(apps, schema_editor):
    UnitBisnis = apps.get_model('api', 'UnitBisnis')
    for nama in ('StarFoto', 'Star Advertising'):
        UnitBisnis.objects.get_or_create(nama=nama)


def remove_unit_bisnis(apps, schema_editor):
    UnitBisnis = apps.get_model('api', 'UnitBisnis')
    UnitBisnis.objects.filter(nama__in=('StarFoto', 'Star Advertising')).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0133_unitbisnis_customuser_posisi_customer_unit_bisnis_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_unit_bisnis, remove_unit_bisnis),
    ]
