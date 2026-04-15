from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.db import connections
from django.db.utils import OperationalError
from django.utils import timezone
from user.views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetVerifyView,
)


def health_check(_request):
    services = {
        "api": "ok",
        "database": "ok",
        "media_storage": "ok",
    }
    status_code = 200

    try:
        with connections['default'].cursor() as cursor:
            cursor.execute("SELECT 1")
    except OperationalError:
        services["database"] = "error"
        status_code = 503

    if not str(getattr(settings, 'MEDIA_ROOT', '')).strip():
        services["media_storage"] = "error"
        status_code = 503

    return JsonResponse(
        {
            "status": "ok" if status_code == 200 else "degraded",
            "service": "salazar-library-api",
            "timestamp": timezone.now().isoformat(),
            "services": services,
            "environment": "production" if not settings.DEBUG else "development",
        },
        status=status_code,
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='api_health'),
    path('api/forgot-password/', PasswordResetRequestView.as_view(), name='forgot_password'),
    path('api/verify-code/', PasswordResetVerifyView.as_view(), name='verify_code'),
    path('api/reset-password/', PasswordResetConfirmView.as_view(), name='reset_password'),
    path('api/books/', include('books.urls')),
    path('api/auth/', include('user.urls')),
]

if settings.DEBUG or getattr(settings, 'SERVE_MEDIA_FILES', False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
