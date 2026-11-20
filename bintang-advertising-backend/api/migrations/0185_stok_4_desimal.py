from django.db import migrations, models


class Migration(migrations.Migration):
    """Stok bahan resep terpakai berkoma (mis. 0,4938 per penjualan) harus tercatat akurat di stok produk sumber:
    stok produk/varian, mutasi stok, dan lapisan FIFO dilebarkan dari 2 ke 4 angka di belakang koma."""

    dependencies = [
        ('api', '0184_possaleitem_qty_4_desimal'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product', name='qty_stok',
            field=models.DecimalField(decimal_places=4, default=0.0, max_digits=12),
        ),
        migrations.AlterField(
            model_name='productvariant', name='qty_stok',
            field=models.DecimalField(decimal_places=4, default=0.0, max_digits=12),
        ),
        migrations.AlterField(
            model_name='productstockmovement', name='qty',
            field=models.DecimalField(decimal_places=4, help_text="Selalu positif; arah ditentukan oleh 'tipe'", max_digits=12),
        ),
        migrations.AlterField(
            model_name='productstockmovement', name='stok_awal',
            field=models.DecimalField(decimal_places=4, default=0.0, max_digits=12),
        ),
        migrations.AlterField(
            model_name='productstockmovement', name='stok_akhir',
            field=models.DecimalField(decimal_places=4, default=0.0, max_digits=12),
        ),
        migrations.AlterField(
            model_name='stocklayer', name='qty_masuk',
            field=models.DecimalField(decimal_places=4, max_digits=12),
        ),
        migrations.AlterField(
            model_name='stocklayer', name='sisa_qty',
            field=models.DecimalField(decimal_places=4, help_text='Sisa yang belum terpakai', max_digits=12),
        ),
        migrations.AlterField(
            model_name='stocklayerconsumption', name='qty',
            field=models.DecimalField(decimal_places=4, max_digits=12),
        ),
    ]
