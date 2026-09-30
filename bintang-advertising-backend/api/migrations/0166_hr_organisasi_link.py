from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0165_jenisinsentif_insentifpekerjaan'),
    ]

    operations = [
        migrations.AddField(
            model_name='divisi',
            name='hr_department_id',
            field=models.IntegerField(blank=True, help_text='ID Departemen di HR (diisi otomatis oleh jembatan HR)', null=True, unique=True),
        ),
        migrations.AddField(
            model_name='tahapproses',
            name='hr_job_role_id',
            field=models.IntegerField(blank=True, help_text='ID Peran Jabatan di HR (diisi otomatis oleh jembatan HR)', null=True, unique=True),
        ),
    ]
