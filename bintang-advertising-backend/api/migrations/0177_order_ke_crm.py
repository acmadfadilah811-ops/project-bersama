from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0176_unit_bisnis_jenis_insentif'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderKeCRM',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('terkirim_pada', models.DateTimeField(blank=True, null=True)),
                ('total_terkirim', models.IntegerField(default=0)),
                ('lunas_terkirim_pada', models.DateTimeField(blank=True, null=True)),
                ('crm_opportunity_id', models.IntegerField(blank=True, null=True)),
                ('dibuat', models.DateTimeField(auto_now_add=True)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='ke_crm', to='api.order')),
            ],
            options={
                'ordering': ['-dibuat'],
            },
        ),
    ]
