from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0015_remove_bankstatementline_matched_journal_entry_and_more'),
        ('api', '0085_order_metode_diskon'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='accounting_payment_method',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='orders', to='accounting.paymentmethod'),
        ),
        migrations.AddField(
            model_name='order',
            name='settlement_status',
            field=models.CharField(choices=[('unsettled', 'Unsettled'), ('settled', 'Settled')], db_index=True, default='unsettled', max_length=20),
        ),
        migrations.AddField(
            model_name='possale',
            name='accounting_payment_method',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pos_sales', to='accounting.paymentmethod'),
        ),
        migrations.AddField(
            model_name='possale',
            name='settlement_status',
            field=models.CharField(choices=[('unsettled', 'Unsettled'), ('settled', 'Settled')], db_index=True, default='unsettled', max_length=20),
        ),
    ]
