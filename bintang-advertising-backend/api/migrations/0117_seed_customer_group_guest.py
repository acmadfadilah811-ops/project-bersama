from django.db import migrations


def seed_guest(apps, schema_editor):
    """"Guest" jadi kategori Tipe Pelanggan eksplisit yang bisa dikelola di
    menu Pelanggan & Supplier > Tipe Pelanggan seperti kategori lain
    (Reseller, VIP, dst) — supaya tier harga per Tipe Pelanggan bisa
    dibuatkan khusus utk pelanggan tanpa kategori, TANPA jadi default diam-
    diam yang otomatis dipasang ke semua transaksi tanpa pelanggan
    (instruksi user 2026-08-13 — sebelumnya sempat diimplementasikan sebagai
    default otomatis, dikoreksi supaya konsisten dgn cara kerja Tipe
    Pelanggan lain: harus ditautkan eksplisit).
    """
    CustomerGroup = apps.get_model('api', 'CustomerGroup')
    CustomerGroup.objects.get_or_create(nama='Guest', defaults={'diskon_persen': 0, 'is_active': True})


def unseed_guest(apps, schema_editor):
    CustomerGroup = apps.get_model('api', 'CustomerGroup')
    CustomerGroup.objects.filter(nama='Guest').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0116_possaleitem_serial_numbers'),
    ]

    operations = [
        migrations.RunPython(seed_guest, unseed_guest),
    ]
