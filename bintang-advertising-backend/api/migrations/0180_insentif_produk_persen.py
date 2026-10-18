from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0179_insentif_produk'),
    ]

    operations = [
        migrations.AddField(
            model_name='insentifproduk',
            name='persen',
            field=models.DecimalField(decimal_places=2, default=0, help_text='% dari harga jual item', max_digits=5),
        ),
        migrations.AlterField(
            model_name='insentifproduk',
            name='cara_hitung',
            field=models.CharField(
                choices=[('flat', 'Flat per SPK'), ('qty', 'Per qty'), ('m2', 'Per m\u00b2'), ('persen', 'Persen dari harga jual')],
                default='qty', max_length=10,
            ),
        ),
    ]
