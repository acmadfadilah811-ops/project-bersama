"""
accounting/migrations/0021_order_payment_journal_support.py

T-202: Tambah:
- AccountingSettings.order_sales_revenue_account (FK ke Account)
- JournalEntry.SourceType.ORDER_PAYMENT (choice baru di CharField — tidak ubah DB schema,
  hanya update choices list; aman karena Django CharField tidak enforce choices di DB)
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0020_accountingsettings_pos_ppn_output_account_and_more'),
    ]

    operations = [
        # Tambah field order_sales_revenue_account ke AccountingSettings
        migrations.AddField(
            model_name='accountingsettings',
            name='order_sales_revenue_account',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='+',
                to='accounting.account',
                help_text=(
                    'Akun pendapatan default untuk pembayaran Order (DP/pelunasan). '
                    'Berbeda dari akun pendapatan POS \u2014 admin dapat mengarahkan ke akun COA yang sama '
                    'jika ingin menyatukan omzet Order dan POS dalam satu akun.'
                ),
            ),
        ),
        # ORDER_PAYMENT adalah choice baru di JournalEntry.source_type (CharField max_length=20).
        # Django TextChoices hanya mengubah validasi Python-level — tidak ada ALTER TABLE.
        # Migrasi ini tetap diperlukan supaya Django menganggap state konsisten.
        migrations.AlterField(
            model_name='journalentry',
            name='source_type',
            field=models.CharField(
                choices=[
                    ('manual', 'Manual'),
                    ('opening_balance', 'Saldo Awal'),
                    ('pos_sale', 'Penjualan POS'),
                    ('order_payment', 'Pembayaran Order'),
                    ('purchase', 'Pembelian'),
                    ('stock_in', 'Stok Masuk'),
                    ('stock_out', 'Stok Keluar'),
                    ('production', 'Produksi'),
                    ('payroll', 'Penggajian'),
                    ('cash_transaction', 'Transaksi Kas'),
                    ('cash_transfer', 'Transfer Kas'),
                    ('capital_transfer', 'Transfer Modal'),
                    ('settlement', 'Konfirmasi Settlement'),
                ],
                default='manual',
                max_length=20,
            ),
        ),
    ]
