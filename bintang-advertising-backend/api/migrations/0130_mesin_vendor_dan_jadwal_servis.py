from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0129_mesin_tipe_bebas_basis_pencatatan'),
    ]

    operations = [
        migrations.RenameField(
            model_name='mesin',
            old_name='lokasi',
            new_name='vendor',
        ),
        migrations.AddField(
            model_name='mesin',
            name='jadwal_servis_interval',
            field=models.CharField(
                blank=True,
                choices=[
                    ('mingguan', 'Mingguan'),
                    ('bulanan', 'Bulanan'),
                    ('tahunan', 'Tahunan'),
                    ('custom_bulan', 'Setiap N Bulan'),
                ],
                max_length=15,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='mesin',
            name='jadwal_servis_custom_bulan',
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Dipakai hanya kalau jadwal_servis_interval='custom_bulan'.",
                null=True,
            ),
        ),
    ]
