from urllib.parse import quote

from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils.html import escape

from backend.email_bridge import send_application_email


DIRECT_EMAIL_NOTIFICATION_TYPES = {
    'ACCOUNT_PENDING_APPROVAL',
    'BORROW_APPROVED',
    'BORROW_REJECTED',
    'BORROW_REQUEST_SUBMITTED',
    'CONTACT_MESSAGE_RECEIVED',
    'FINE_CREATED',
    'FINE_PAID',
    'FINE_WAIVED',
    'OVERDUE_BOOK_ALERT',
    'RENEWAL_REQUEST_REJECTED',
    'RENEWAL_REQUEST_SUBMITTED',
    'RENEWAL_SUCCESS',
    'REPORT_SUBMITTED',
    'RESERVATION_CANCELLED',
    'RESERVATION_EXPIRED',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
    'RETURN_REQUEST_SUBMITTED',
}
MY_BOOKS_NOTIFICATION_TYPES = {
    'BORROW_APPROVED',
    'BORROW_REJECTED',
    'DUE_SOON',
    'FINE_CREATED',
    'FINE_PAID',
    'FINE_WAIVED',
    'RENEWAL_REQUEST_REJECTED',
    'RENEWAL_SUCCESS',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
}
RESERVATION_NOTIFICATION_TYPES = {
    'RESERVATION_AVAILABLE',
    'RESERVATION_CANCELLED',
    'RESERVATION_EXPIRED',
}
SKIP_DIRECT_EMAIL_NOTIFICATION_TYPES = {
    'DUE_SOON',
    'RESERVATION_AVAILABLE',
}
PENDING_ACCOUNT_REVIEW_DASHBOARD_SECTION = 'desk-accounts'


def _get_notification_model():
    return apps.get_model('user', 'Notification')


def _get_user_model():
    app_label, model_name = settings.AUTH_USER_MODEL.split('.', 1)
    return apps.get_model(app_label, model_name)


def _get_library_portal_url() -> str:
    base_url = getattr(settings, 'LIBRARY_WEB_URL', '').strip() or 'http://localhost:3000'
    return base_url.rstrip('/')


def _get_notification_action_url(notification_type: str, data: dict | None = None) -> str:
    payload = data or {}
    base_url = _get_library_portal_url()
    portal = str(payload.get('portal') or '').strip().lower()
    dashboard_section = str(payload.get('dashboard_section') or '').strip()
    book_id = payload.get('book_id')

    if portal == 'librarian':
        if dashboard_section:
            return f"{base_url}/librarian?section={quote(dashboard_section, safe='')}"
        return f"{base_url}/librarian?section=desk-notifications"
    if portal == 'staff':
        if dashboard_section:
            return f"{base_url}/staff?section={quote(dashboard_section, safe='')}"
        return f"{base_url}/staff"

    if notification_type in MY_BOOKS_NOTIFICATION_TYPES:
        return f"{base_url}/my-books"

    if notification_type in RESERVATION_NOTIFICATION_TYPES and book_id:
        return f"{base_url}/books/{book_id}"

    if book_id:
        return f"{base_url}/books/{book_id}"

    return f"{base_url}/notifications"


def _should_send_notification_email(notification_type: str, data: dict | None = None) -> bool:
    payload = data or {}
    if notification_type in SKIP_DIRECT_EMAIL_NOTIFICATION_TYPES:
        return False
    if notification_type == 'REPORT_SUBMITTED':
        return str(payload.get('portal') or '').strip().lower() == 'librarian'
    return notification_type in DIRECT_EMAIL_NOTIFICATION_TYPES


def _get_user_display_name(user) -> str:
    return (
        str(getattr(user, 'full_name', '') or '').strip()
        or str(getattr(user, 'username', '') or '').strip()
        or 'Library user'
    )


def _build_notification_email_content(
    *,
    user,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
) -> tuple[str, str, str]:
    action_url = _get_notification_action_url(notification_type, data=data)
    payload = data or {}
    recipient_name = _get_user_display_name(user)
    portal = str(payload.get('portal') or '').strip().lower()
    action_label = (
        'Open in librarian dashboard'
        if portal == 'librarian'
        else 'Open in staff desk'
        if portal == 'staff'
        else 'Open your library account'
    )

    subject = f"SCSIT Library System: {title}"
    text_body = (
        f"Hi {recipient_name},\n\n"
        f"{message}\n\n"
        f"{action_label}: {action_url}\n\n"
        f"Notification type: {notification_type}\n\n"
        "SCSIT Library System"
    )
    html_body = f"""
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin: 0 0 12px;">{escape(title)}</h2>
          <p style="margin: 0 0 12px;">Hi {escape(recipient_name)},</p>
          <p style="margin: 0 0 20px;">{escape(message)}</p>
          <p style="margin: 0 0 20px;">
            <a href="{escape(action_url)}"
               style="display: inline-block; padding: 10px 16px; border-radius: 999px; background: #0f4c81; color: #ffffff; text-decoration: none; font-weight: 600;">
              {escape(action_label)}
            </a>
          </p>
          <p style="margin: 0; color: #475569; font-size: 13px;">
            Notification type: {escape(notification_type)}
          </p>
        </div>
    """
    return subject, text_body, html_body


def send_notification_email_for_user(
    *,
    user_id: int | None,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
) -> None:
    if not user_id or not _should_send_notification_email(notification_type, data=data):
        return
    try:
        User = _get_user_model()
    except LookupError:
        return

    user = User.objects.filter(pk=user_id).only('id', 'email', 'username', 'full_name').first()
    recipient = str(getattr(user, 'email', '') or '').strip()
    if not user or not recipient:
        return

    subject, text_body, html_body = _build_notification_email_content(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        data=data,
    )
    send_application_email(
        to=[recipient],
        subject=subject,
        text=text_body,
        html=html_body,
        fail_silently=True,
    )


def create_user_notification(
    *,
    user_id: int | None,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
) -> None:
    if not user_id:
        return
    try:
        Notification = _get_notification_model()
    except LookupError:
        return
    Notification.objects.create(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        data=data or {},
    )
    transaction.on_commit(
        lambda: send_notification_email_for_user(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data=data,
        )
    )


def create_user_notifications(
    *,
    user_ids: list[int] | tuple[int, ...] | set[int],
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
) -> None:
    unique_user_ids = [user_id for user_id in dict.fromkeys(int(user_id) for user_id in user_ids if user_id)]
    for user_id in unique_user_ids:
        create_user_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data=data,
        )


def get_librarian_dashboard_user_ids() -> list[int]:
    try:
        User = _get_user_model()
    except LookupError:
        return []

    return list(
        User.objects.filter(
            Q(role='LIBRARIAN') | Q(role='ADMIN'),
            is_active=True,
        ).values_list('id', flat=True)
    )


def get_circulation_dashboard_targets() -> list[tuple[int, str]]:
    try:
        User = _get_user_model()
    except LookupError:
        return []

    return [
        (
            int(user_id),
            'librarian' if role in {'LIBRARIAN', 'ADMIN'} else 'staff',
        )
        for user_id, role in User.objects.filter(
            Q(role='LIBRARIAN')
            | Q(role='ADMIN')
            | Q(role='STAFF')
            | Q(role='WORKING')
            | Q(role='STUDENT', is_working_student=True),
            is_active=True,
        ).values_list('id', 'role')
    ]


def get_pending_account_reviewer_targets() -> list[tuple[int, str]]:
    try:
        User = _get_user_model()
    except LookupError:
        return []

    return [
        (
            int(user_id),
            'librarian' if role in {'LIBRARIAN', 'ADMIN'} else 'staff',
        )
        for user_id, role in User.objects.filter(
            Q(role='LIBRARIAN')
            | Q(role='ADMIN')
            | Q(role='WORKING')
            | Q(role='STUDENT', is_working_student=True),
            is_active=True,
        ).values_list('id', 'role')
    ]


def notification_exists(
    *,
    user_id: int,
    notification_type: str,
    data_filters: dict[str, object] | None = None,
) -> bool:
    try:
        Notification = _get_notification_model()
    except LookupError:
        return False

    queryset = Notification.objects.filter(user_id=user_id, notification_type=notification_type)
    for key, value in (data_filters or {}).items():
        queryset = queryset.filter(**{f'data__{key}': value})
    return queryset.exists()


def notify_librarian_dashboard(
    *,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
    dedupe: bool = True,
) -> None:
    data_filters = {
        key: value
        for key, value in (data or {}).items()
        if key.endswith('_id')
    }
    payload = {
        **(data or {}),
        'dashboard_section': str((data or {}).get('dashboard_section') or '').strip(),
    }
    for user_id, portal in get_circulation_dashboard_targets():
        if dedupe and data_filters and notification_exists(
            user_id=user_id,
            notification_type=notification_type,
            data_filters=data_filters,
        ):
            continue
        create_user_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data={
                **payload,
                'portal': portal,
            },
        )


def notify_librarian_users(
    *,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
    dedupe: bool = True,
) -> None:
    data_filters = {
        key: value
        for key, value in (data or {}).items()
        if key.endswith('_id')
    }
    payload = {
        **(data or {}),
        'dashboard_section': str((data or {}).get('dashboard_section') or '').strip(),
        'portal': 'librarian',
    }
    for user_id in get_librarian_dashboard_user_ids():
        if dedupe and data_filters and notification_exists(
            user_id=user_id,
            notification_type=notification_type,
            data_filters=data_filters,
        ):
            continue
        create_user_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data=payload,
        )


def notify_pending_account_reviewers(
    *,
    notification_type: str,
    title: str,
    message: str,
    data: dict | None = None,
    dedupe: bool = True,
) -> None:
    payload = {
        **(data or {}),
        'dashboard_section': str((data or {}).get('dashboard_section') or '').strip()
        or PENDING_ACCOUNT_REVIEW_DASHBOARD_SECTION,
    }
    data_filters = {
        key: value
        for key, value in payload.items()
        if key.endswith('_id')
    }

    for user_id, portal in get_pending_account_reviewer_targets():
        if dedupe and data_filters and notification_exists(
            user_id=user_id,
            notification_type=notification_type,
            data_filters=data_filters,
        ):
            continue
        create_user_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data={
                **payload,
                'portal': portal,
            },
        )
