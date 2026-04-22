from django.apps import AppConfig


class BooksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'books'

    def ready(self):
        from django.conf import settings
        try:
            settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
        except (PermissionError, OSError):
            pass
