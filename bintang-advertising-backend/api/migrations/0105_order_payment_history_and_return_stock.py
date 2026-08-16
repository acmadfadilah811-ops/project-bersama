# Generated manually for payment history, shift reconciliation, and confirmed return stock.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0104_merge_20260808_1115'),
    ]

    operations = [
        migrations.AddField(
            model_name='pengembalianorder',
            name='stok_dikembalikan_oleh',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pengembalian_stok_dikonfirmasi', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='pengembalianorder',
            name='stok_dikembalikan_pada',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='OrderPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jumlah', models.PositiveIntegerField()),
                ('metode_pembayaran', models.CharField(default='tunai', max_length=50)),
                ('referensi_pembayaran', models.CharField(blank=True, default='', max_length=255)),
                ('idempotency_key', models.CharField(blank=True, max_length=64, null=True, unique=True)),
                ('is_dp', models.BooleanField(default=False)),
                ('dibuat_pada', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('activity_log', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payment_record', to='api.orderactivitylog')),
                ('dibuat_oleh', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='order_payments_dibuat', to=settings.AUTH_USER_MODEL)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='api.order')),
                ('shift', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='order_payments', to='api.saldokasharian')),
            ],
            options={
                'ordering': ['-dibuat_pada', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='orderpayment',
            index=models.Index(fields=['order', '-dibuat_pada'], name='idx_orderpay_order_time'),
        ),
        migrations.AddIndex(
            model_name='orderpayment',
            index=models.Index(fields=['shift', '-dibuat_pada'], name='idx_orderpay_shift_time'),
        ),
    ]
