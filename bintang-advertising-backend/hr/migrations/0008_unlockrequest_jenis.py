from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0007_alter_absensi_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='unlockrequest',
            name='jenis',
            field=models.CharField(
                choices=[('terlambat', 'Izin terlambat'), ('tanpa_absen_hr', 'Mulai Kerja tanpa absen HR')],
                default='terlambat', max_length=20,
            ),
        ),
    ]
