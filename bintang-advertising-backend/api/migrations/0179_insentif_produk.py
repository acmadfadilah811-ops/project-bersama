import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0178_customuser_diarsipkan'),
    ]

    operations = [
        migrations.CreateModel(
            name='InsentifProduk',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cara_hitung', models.CharField(choices=[('flat', 'Flat per SPK'), ('qty', 'Per qty'), ('m2', 'Per m\u00b2')], default='qty', max_length=10)),
                ('nominal', models.PositiveIntegerField(default=0, help_text='Rp per SPK / per qty / per m2 sesuai cara hitung')),
                ('aktif', models.BooleanField(default=True)),
                ('keterangan', models.CharField(blank=True, default='', max_length=255)),
                ('dibuat_pada', models.DateTimeField(auto_now_add=True)),
                ('diubah_pada', models.DateTimeField(auto_now=True)),
                ('divisi', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='insentif_produk', to='api.divisi')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='insentif_produk', to='api.product')),
            ],
            options={
                'ordering': ['product__nama', 'divisi__nama'],
                'constraints': [models.UniqueConstraint(fields=('product', 'divisi'), name='uniq_insentif_produk_divisi')],
            },
        ),
        migrations.AddField(
            model_name='insentifpekerjaan',
            name='aturan_produk',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='api.insentifproduk'),
        ),
        migrations.AddConstraint(
            model_name='insentifpekerjaan',
            constraint=models.UniqueConstraint(condition=models.Q(('aturan_produk__isnull', False)), fields=('job', 'aturan_produk'), name='uniq_insentif_job_aturan_produk'),
        ),
    ]
