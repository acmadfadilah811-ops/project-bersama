from django.db import migrations


def tandai_paket_lama(apps, schema_editor):
    """Item paket yang SUDAH ada ditandai `stok_dikurangi=True`.

    Mulai 2026-09-24 OrderItemSerializer memotong stok komponen paket saat item
    paket dibuat/diedit lewat /order-items/. Tanpa penanda ini, item paket lama
    (yang sudah dipotong lewat checkout_pos, atau order lama yang sudah selesai)
    akan terpotong dobel/retroaktif begitu diedit sekali saja."""
    OrderItem = apps.get_model('api', 'OrderItem')
    OrderItem.objects.filter(paket__isnull=False, stok_dikurangi=False).update(stok_dikurangi=True)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0150_product_tampilkan_stok_pos'),
    ]

    operations = [
        migrations.RunPython(tandai_paket_lama, migrations.RunPython.noop),
    ]
