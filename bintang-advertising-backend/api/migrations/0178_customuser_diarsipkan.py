from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0177_order_ke_crm'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='diarsipkan',
            field=models.BooleanField(default=False),
        ),
    ]
