import json
import logging
from urllib import error as urllib_error
from urllib import request as urllib_request

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


logger = logging.getLogger(__name__)
SMTP_EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
NON_SMTP_EMAIL_BACKENDS = {
    'django.core.mail.backends.console.EmailBackend',
    'django.core.mail.backends.locmem.EmailBackend',
    'django.core.mail.backends.filebased.EmailBackend',
    'django.core.mail.backends.dummy.EmailBackend',
}


def is_email_bridge_configured() -> bool:
    return bool(getattr(settings, 'EMAIL_BRIDGE_URL', '').strip())


def get_email_bridge_config_error() -> str | None:
    url = getattr(settings, 'EMAIL_BRIDGE_URL', '').strip()
    secret = getattr(settings, 'EMAIL_BRIDGE_SECRET', '').strip()

    if not url and not secret:
        return None
    if url and secret:
        return None
    if not url:
        return 'Email bridge is not configured. Missing: EMAIL_BRIDGE_URL.'
    return 'Email bridge is not configured. Missing: EMAIL_BRIDGE_SECRET.'


def _send_via_email_bridge(
    *,
    to: list[str],
    subject: str,
    text: str,
    html: str | None = None,
) -> None:
    bridge_url = getattr(settings, 'EMAIL_BRIDGE_URL', '').strip()
    bridge_secret = getattr(settings, 'EMAIL_BRIDGE_SECRET', '').strip()
    timeout_seconds = max(int(getattr(settings, 'EMAIL_BRIDGE_TIMEOUT_SECONDS', 15)), 1)

    payload = json.dumps(
        {
            'to': to,
            'subject': subject,
            'text': text,
            'html': html,
        }
    ).encode('utf-8')

    request = urllib_request.Request(
        bridge_url,
        data=payload,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Email-Bridge-Secret': bridge_secret,
        },
    )

    try:
        with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
            status_code = getattr(response, 'status', response.getcode())
            if 200 <= status_code < 300:
                return
            response_body = response.read().decode('utf-8', errors='replace')
            raise RuntimeError(
                f'Email bridge returned HTTP {status_code}. Response: {response_body[:500]}'
            )
    except urllib_error.HTTPError as exc:
        response_body = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(
            f'Email bridge returned HTTP {exc.code}. Response: {response_body[:500]}'
        ) from exc
    except urllib_error.URLError as exc:
        raise RuntimeError(f'Unable to reach email bridge: {exc.reason}') from exc


def _can_use_django_email_backend() -> bool:
    email_backend = getattr(settings, 'EMAIL_BACKEND', '')
    if email_backend in NON_SMTP_EMAIL_BACKENDS:
        return True
    if email_backend and email_backend != SMTP_EMAIL_BACKEND:
        return True

    return all(
        getattr(settings, key, '').strip()
        for key in ('EMAIL_HOST', 'EMAIL_HOST_USER', 'EMAIL_HOST_PASSWORD')
    )


def _send_via_django_email_backend(
    *,
    to: list[str],
    subject: str,
    text: str,
    html: str | None = None,
    fail_silently: bool = False,
) -> None:
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@salazar-library.local')
    message = EmailMultiAlternatives(
        subject,
        text,
        from_email,
        to,
    )
    if html:
        message.attach_alternative(html, 'text/html')
    message.send(fail_silently=fail_silently)


def send_application_email(
    *,
    to: list[str],
    subject: str,
    text: str,
    html: str | None = None,
    fail_silently: bool = False,
) -> bool:
    try:
        if is_email_bridge_configured():
            try:
                _send_via_email_bridge(to=to, subject=subject, text=text, html=html)
                return True
            except Exception:
                if not _can_use_django_email_backend():
                    raise
                logger.exception(
                    'Email bridge failed for %s. Falling back to the Django email backend.',
                    ', '.join(to),
                )

        _send_via_django_email_backend(
            to=to,
            subject=subject,
            text=text,
            html=html,
            fail_silently=fail_silently,
        )
        return True
    except Exception:
        if fail_silently:
            logger.exception('Failed to send application email to %s', ', '.join(to))
            return False
        raise
