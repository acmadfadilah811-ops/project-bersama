from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0182_possale_pembulatan'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderpayment',
            name='pembulatan',
            field=models.IntegerField(
                default=0,
                help_text='Selisih pembulatan pembayaran; positif = pelanggan membayar lebih dari `jumlah`.',
            ),
        ),
    ]
