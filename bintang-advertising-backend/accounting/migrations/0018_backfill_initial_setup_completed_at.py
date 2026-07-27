from django.db import migrations
from django.utils import timezone


def backfill(apps, schema_editor):
    """
    Grandfather setup di environment yang sudah punya baris AccountingSettings
    (mis. dev DB ini) — supaya empty state 'Pengaturan Awal' hanya muncul untuk
    environment yang benar-benar belum pernah setup (baris baru via
    _get_or_create_settings), bukan yang sudah lama jalan.
    """
    AccountingSettings = apps.get_model("accounting", "AccountingSettings")
    AccountingSettings.objects.filter(initial_setup_completed_at__isnull=True).update(
        initial_setup_completed_at=timezone.now()
    )


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0017_accountingsettings_initial_setup_completed_at"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
