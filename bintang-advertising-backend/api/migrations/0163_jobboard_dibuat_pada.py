# Kapan SPK dibuat -- dipakai deteksi "pekerjaan macet" (PRD-10 UAT, 2026-09-29).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0162_role_sales_profil'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobboard',
            name='dibuat_pada',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
    ]
