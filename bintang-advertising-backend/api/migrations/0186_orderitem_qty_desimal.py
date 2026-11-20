from django.db import migrations, models


class Migration(migrations.Migration):
    """OrderItem.qty int -> decimal(12,4) supaya order DP kasir boleh qty berkoma.

    Aman: integer ke numeric tanpa kehilangan nilai; reverse kembali ke integer (nilai berkoma akan terpotong).
    """

    dependencies = [
        ('api', '0185_stok_4_desimal'),
    ]

    operations = [
        migrations.AlterField(
            model_name='orderitem',
            name='qty',
            field=models.DecimalField(decimal_places=4, default=1, max_digits=12),
        ),
    ]
