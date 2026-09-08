from django.db import migrations, models


def backfill_basis_pencatatan(apps, schema_editor):
    """Data lama: 'cetak_banner' -> basis 'meter', sisanya (docucolor/printer)
    biarkan default 'lembar' yang sudah benar."""
    Mesin = apps.get_model('api', 'Mesin')
    Mesin.objects.filter(tipe='cetak_banner').update(basis_pencatatan='meter')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0128_possale_idempotency_key'),
    ]

    operations = [
        migrations.AlterField(
            model_name='mesin',
            name='tipe',
            field=models.CharField(max_length=50),
        ),
        migrations.AddField(
            model_name='mesin',
            name='basis_pencatatan',
            field=models.CharField(
                choices=[
                    ('lembar', 'Lembar/Klik (Color & Mono) -- DocuColor, Printer'),
                    ('meter', 'Meter/Panjang Bahan -- Cetak Banner'),
                    ('lainnya', 'Lainnya (catatan manual, tanpa satuan baku)'),
                ],
                default='lembar',
                max_length=10,
            ),
        ),
        migrations.RunPython(backfill_basis_pencatatan, noop_reverse),
    ]
