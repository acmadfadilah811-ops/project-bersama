from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0183_orderpayment_pembulatan'),
    ]

    operations = [
        migrations.AlterField(
            model_name='possaleitem',
            name='qty',
            field=models.DecimalField(decimal_places=4, help_text='Qty dalam satuan DASAR', max_digits=12),
        ),
    ]
