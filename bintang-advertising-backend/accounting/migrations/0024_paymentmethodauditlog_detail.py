from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0023_alter_journalentry_source_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentmethodauditlog",
            name="detail",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]
