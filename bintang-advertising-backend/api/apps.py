from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        from .services import sinkron_sandi  # noqa: F401  (ganti sandi -> HR/CRM ikut)
        from .services import sinkron_foto  # noqa: F401  (ganti foto profil -> HR/CRM ikut)
