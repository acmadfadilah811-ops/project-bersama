# Generated manually for the immutable shift payment-method snapshot.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0105_order_payment_history_and_return_stock'),
    ]

    operations = [
        migrations.AddField(
            model_name='ringkasanshift',
            name='rincian_metode',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
