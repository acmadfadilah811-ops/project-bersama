from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0181_langganan_push'),
    ]

    operations = [
        migrations.AddField(
            model_name='possale',
            name='pembulatan',
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=12,
                help_text='Selisih pembulatan total (Pengaturan POS > Pembulatan); positif = pelanggan bayar lebih. `total` sudah termasuk pembulatan ini.',
            ),
        ),
    ]
