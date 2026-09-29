# Tanggal potong periode akuntansi (2026-09-29).

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0045_order_stock_hpp_source'),
    ]

    operations = [
        migrations.AddField(
            model_name='accountingsettings',
            name='period_cutoff_day',
            field=models.PositiveSmallIntegerField(
                default=0,
                validators=[django.core.validators.MaxValueValidator(28)],
                help_text="Tanggal potong periode akuntansi (2026-09-29). 0 = bulan kalender (1 s/d akhir "
                "bulan). 1-28 = periode BERAKHIR di tanggal itu, mis. 25 -> periode 26 s/d 25 bulan "
                "berikutnya; jurnal tanggal 26 ke atas masuk periode baru sehingga operasional tetap "
                "berjalan setelah periode lama ditutup. Lihat accounting/services/period_rules.py.",
            ),
        ),
    ]
