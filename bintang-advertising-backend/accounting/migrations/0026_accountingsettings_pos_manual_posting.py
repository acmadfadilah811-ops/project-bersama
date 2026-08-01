from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounting", "0025_paymentmethodauditlog_previous_account_snapshot")]

    operations = [
        migrations.AddField(
            model_name="accountingsettings",
            name="pos_auto_post_enabled",
            field=models.BooleanField(default=True, help_text="Posting otomatis transaksi POS lunas ke jurnal."),
        ),
        migrations.AddField(
            model_name="accountingsettings",
            name="default_pos_payment_method",
            field=models.ForeignKey(blank=True, help_text="Metode pembayaran fallback untuk POS yang belum dipetakan; sebaiknya menuju akun transit.", null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to="accounting.paymentmethod"),
        ),
    ]
