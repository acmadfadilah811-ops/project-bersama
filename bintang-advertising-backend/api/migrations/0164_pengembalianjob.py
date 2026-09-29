# Pengembalian pekerjaan ke tahap sebelumnya (PRD-05 UAT, 2026-09-29).

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0163_jobboard_dibuat_pada'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PengembalianJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alasan', models.TextField()),
                ('status', models.CharField(choices=[('menunggu', 'Menunggu diterima'), ('diterima', 'Diterima'), ('ditolak', 'Ditolak')], db_index=True, default='menunggu', max_length=10)),
                ('diajukan_pada', models.DateTimeField(auto_now_add=True)),
                ('diputuskan_pada', models.DateTimeField(blank=True, null=True)),
                ('catatan_keputusan', models.TextField(blank=True, default='')),
                ('diajukan_oleh', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('diputuskan_oleh', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pengembalian', to='api.jobboard')),
                ('job_tujuan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pengembalian_masuk', to='api.jobboard')),
            ],
            options={
                'ordering': ['-diajukan_pada'],
                'indexes': [models.Index(fields=['status', 'diajukan_pada'], name='idx_pengembalian_status')],
            },
        ),
    ]
