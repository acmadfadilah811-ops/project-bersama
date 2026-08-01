from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounting", "0026_accountingsettings_pos_manual_posting")]

    operations = [
        migrations.AddField(
            model_name="accountingsettings",
            name="pos_post_discount_line_enabled",
            field=models.BooleanField(default=True, help_text="Tampilkan dan posting baris diskon POS secara terpisah."),
        ),
        *[
            migrations.AddField(
                model_name="accountingsettings",
                name=name,
                field=models.ForeignKey(
                    blank=True,
                    help_text=help_text,
                    null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="+",
                    to="accounting.account",
                ),
            )
            for name, help_text in [
                ("pos_marketplace_admin_fee_account", "Akun biaya admin marketplace default untuk POS."),
                ("pos_deposit_income_difference_account", "Akun pendapatan selisih deposit POS."),
                ("pos_deposit_expense_difference_account", "Akun biaya selisih deposit POS."),
                ("pos_purchase_tax_account", "Akun pajak pembelian default dari pengaturan POS."),
                ("pos_sales_total_minus_account", "Akun penyesuaian total penjualan minus POS."),
                ("pos_sales_delivery_account", "Akun pengiriman penjualan POS."),
                ("pos_sales_rounding_account", "Akun pembulatan penjualan POS."),
                ("pos_sales_unique_payment_account", "Akun pembayaran unik penjualan POS."),
            ]
        ],
    ]
