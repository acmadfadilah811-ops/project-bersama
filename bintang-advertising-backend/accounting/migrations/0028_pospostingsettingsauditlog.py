from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounting", "0027_accountingsettings_pos_default_accounts"),
    ]

    operations = [
        migrations.CreateModel(
            name="POSPostingSettingsAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("enable", "Aktifkan"), ("disable", "Nonaktifkan")], max_length=10)),
                ("previous_value", models.BooleanField()),
                ("new_value", models.BooleanField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Log Pengaturan Posting POS",
                "verbose_name_plural": "Log Pengaturan Posting POS",
                "db_table": "accounting_pos_posting_settings_audit_log",
                "ordering": ["-created_at"],
            },
        ),
    ]
