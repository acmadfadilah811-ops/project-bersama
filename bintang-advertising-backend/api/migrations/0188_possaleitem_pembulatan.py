from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0187_order_diskon_manual'),
    ]

    operations = [
        migrations.AddField(
            model_name='possaleitem',
            name='pembulatan',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
