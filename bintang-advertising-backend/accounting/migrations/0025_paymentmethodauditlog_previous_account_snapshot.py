from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0024_paymentmethodauditlog_detail"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentmethodauditlog",
            name="previous_account_code",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="paymentmethodauditlog",
            name="previous_account_name",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
    ]
