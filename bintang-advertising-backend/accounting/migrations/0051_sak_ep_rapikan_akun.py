# Rapikan daftar akun untuk SAK EP (2026-11-15).
#
# - 41000 "Penjualan antar cabang" dan 50100 "Pembelian antar cabang": dalam SATU entitas,
#   perpindahan barang antar cabang bukan pendapatan/HPP (harus tereliminasi).
# - 50000 "Pembelian": akun HPP metode periodik; sistem ini memakai persediaan perpetual FIFO
#   (pembelian masuk ke Persediaan, HPP dari lapisan FIFO), jadi akun ini berisiko dobel HPP.
#
# Akun hanya DINONAKTIFKAN bila belum pernah dipakai jurnal dan tidak dipilih di Pengaturan
# Akuntansi -- akun bersaldo tidak boleh hilang diam-diam dari laporan.

from django.db import migrations

AKUN = {
    "41000": "Dinonaktifkan 2026-11-15 (SAK EP): penjualan antar cabang dalam satu entitas bukan pendapatan.",
    "50100": "Dinonaktifkan 2026-11-15 (SAK EP): pembelian antar cabang dalam satu entitas bukan HPP.",
    "50000": "Dinonaktifkan 2026-11-15 (SAK EP): akun HPP periodik; sistem memakai persediaan perpetual FIFO.",
}


def nonaktifkan(apps, schema_editor):
    Account = apps.get_model("accounting", "Account")
    JournalEntryLine = apps.get_model("accounting", "JournalEntryLine")
    AccountingSettings = apps.get_model("accounting", "AccountingSettings")
    ProductAccountGroup = apps.get_model("accounting", "ProductAccountGroup")

    dipakai_pengaturan = set()
    for s in AccountingSettings.objects.all():
        for field in s._meta.fields:
            if field.is_relation and field.related_model is Account:
                nilai = getattr(s, field.attname)
                if nilai:
                    dipakai_pengaturan.add(nilai)
    for g in ProductAccountGroup.objects.all():
        dipakai_pengaturan.update({g.revenue_account_id, g.cogs_account_id, g.inventory_account_id})

    for kode, catatan in AKUN.items():
        akun = Account.objects.filter(code=kode, is_active=True).first()
        if akun is None or akun.pk in dipakai_pengaturan:
            continue
        if JournalEntryLine.objects.filter(account=akun).exists():
            continue
        akun.is_active = False
        akun.description = (catatan + (" " + akun.description if akun.description else "")).strip()
        akun.save(update_fields=["is_active", "description", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0050_ebitda_pajak_fiskal"),
    ]

    operations = [
        migrations.RunPython(nonaktifkan, migrations.RunPython.noop),
    ]
