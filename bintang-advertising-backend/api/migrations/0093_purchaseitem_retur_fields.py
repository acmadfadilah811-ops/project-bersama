# Generated manually for Return Purchase UI precision (SS 1, 2, 3, 4)
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0092_purchase_attachment'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseitem',
            name='alasan_retur',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='purchaseitem',
            name='catatan_retur',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='purchaseitem',
            name='jadikan_stok_keluar',
            field=models.BooleanField(default=True),
        ),
    ]
