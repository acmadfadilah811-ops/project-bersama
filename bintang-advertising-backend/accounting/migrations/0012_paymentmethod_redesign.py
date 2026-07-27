from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0011_alter_journalentry_source_type"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(model_name="paymentmethod", name="cash_bank_account"),
        migrations.AddField(
            model_name="paymentmethod",
            name="payment_type",
            field=models.CharField(default="", max_length=50, help_text="Tipe/kategori teknis, mis. 'Tokopedia', 'Tunai', 'Olsera-Qris'."),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="account",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="payment_methods",
                to="accounting.account",
                help_text="Akun Pembayaran — akun kas/bank penampung dana dari metode ini.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="paymentmethod",
            name="account",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="payment_methods",
                to="accounting.account",
                help_text="Akun Pembayaran — akun kas/bank penampung dana dari metode ini.",
            ),
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="mdr_debit_account",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="+", to="accounting.account",
                help_text="Akun Debit (MDR) — biasanya akun beban MDR, dipakai kalau ada potongan biaya admin.",
            ),
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="mdr_kredit_account",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="+", to="accounting.account", help_text="Akun Kredit (MDR).",
            ),
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="is_locked",
            field=models.BooleanField(
                default=False,
                help_text="Kalau True, akun pembayaran tidak bisa diubah lewat 'Atur Akun' (mis. CASH — harus selalu ke akun kas fisik).",
            ),
        ),
        migrations.AlterField(
            model_name="paymentmethod",
            name="mdr_percent",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5, help_text="Rating (MDR), dalam persen."),
        ),
        migrations.AlterModelOptions(
            name="paymentmethod",
            options={"ordering": ["name"], "verbose_name": "Cara Pembayaran", "verbose_name_plural": "Cara Pembayaran"},
        ),
        migrations.CreateModel(
            name="PaymentMethodAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("create", "Create"), ("update", "Update"), ("delete", "Delete")], max_length=10)),
                ("account_code", models.CharField(blank=True, default="", max_length=20)),
                ("account_name", models.CharField(blank=True, default="", max_length=150)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("payment_method", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="audit_logs", to="accounting.paymentmethod")),
            ],
            options={
                "db_table": "accounting_payment_method_audit_log",
                "verbose_name": "Log Cara Pembayaran",
                "verbose_name_plural": "Log Cara Pembayaran",
                "ordering": ["-created_at"],
            },
        ),
    ]
