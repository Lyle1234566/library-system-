import logging
import secrets
import string
import re
import hashlib
import math
from datetime import datetime, timedelta
from urllib.parse import urlencode
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.html import escape
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .enrollment_import import EnrollmentImportError, get_enrollment_summary, import_enrollment_csv_file
from .teacher_import import TeacherImportError, get_teacher_records_summary, import_teacher_csv_file
from .models import (
    PasswordResetCode,
    ContactMessage,
    Notification,
    EmailVerificationCode,
    LoginOTPCode,
)
from .registration_rules import get_identifier_status
from backend.email_bridge import (
    get_email_bridge_config_error,
    is_email_bridge_configured,
    send_application_email,
)
from backend.notification_utils import notify_librarian_users, notify_pending_account_reviewers

from .serializers import (
    UserSerializer,
    ProfileSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetVerifySerializer,
    PasswordResetConfirmSerializer,
    ContactMessageSerializer,
    ContactMessageRecordSerializer,
    ContactMessageUpdateSerializer,
    NotificationSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)
OTP_CHALLENGE_SALT = 'user.login_otp.challenge'
LOGIN_FAILURE_CACHE_PREFIX = 'auth.login_fail'
LOGIN_LOCK_CACHE_PREFIX = 'auth.login_lock'

PLACEHOLDER_EMAIL_USERS = {
    'yourgmail@gmail.com',
    'you@example.com',
    'example@example.com',
}
PLACEHOLDER_EMAIL_PASSWORDS = {
    'your_app_password',
    'app_password',
    'password',
    'changeme',
}

PORTAL_ROLE_MAP = {
    'student': {'STUDENT', 'WORKING'},
    'teacher': {'TEACHER'},
    'librarian': {'LIBRARIAN', 'ADMIN'},
    'staff': {'STAFF', 'WORKING', 'ADMIN'},
}
REGISTRABLE_ACCOUNT_ROLES = {'STUDENT', 'TEACHER'}
PENDING_ACCOUNT_ROLES = {'STUDENT', 'TEACHER', 'WORKING'}


def get_contact_sender_role_label(user) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        return 'Guest'
    role = getattr(user, 'role', '')
    if role == 'WORKING' or (role == 'STUDENT' and getattr(user, 'is_working_student', False)):
        return 'Working Student'
    return {
        'STUDENT': 'Student',
        'TEACHER': 'Teacher',
        'LIBRARIAN': 'Librarian',
        'STAFF': 'Staff',
        'ADMIN': 'Admin',
    }.get(role, 'Guest')


def get_contact_sender_identifier(user) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        return ''
    return str(getattr(user, 'staff_id', '') or getattr(user, 'student_id', '') or '').strip()

def is_super_admin(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or getattr(user, 'role', None) == 'ADMIN')
    )


def is_working_student(user) -> bool:
    return bool(user and user.is_authenticated and getattr(user, 'has_working_student_access', lambda: False)())


def has_staff_portal_access(user) -> bool:
    return bool(user and user.is_authenticated and getattr(user, 'has_staff_desk_access', lambda: False)())


def parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return bool(value)


def can_manage_pending_students(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (
            is_super_admin(user)
            or getattr(user, 'role', None) == 'LIBRARIAN'
            or is_working_student(user)
        )
    )


def can_manage_enrollment_records(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (
            is_super_admin(user)
            or getattr(user, 'role', None) == 'LIBRARIAN'
        )
    )


def can_send_contact_messages(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (
            is_super_admin(user)
            or getattr(user, 'role', None) in {'LIBRARIAN', 'STAFF'}
        )
    )


class CanViewPendingStudents(BasePermission):
    def has_permission(self, request, view):
        return can_manage_pending_students(request.user)


class CanApproveStudents(BasePermission):
    def has_permission(self, request, view):
        return can_manage_pending_students(request.user)


class CanManageEnrollmentRecords(BasePermission):
    def has_permission(self, request, view):
        return can_manage_enrollment_records(request.user)


class CanManageContactMessages(BasePermission):
    def has_permission(self, request, view):
        return can_manage_enrollment_records(request.user)


class CanSendContactMessages(BasePermission):
    message = 'Reader accounts cannot send feedback messages.'

    def has_permission(self, request, view):
        return can_send_contact_messages(request.user)


def normalize_email_value(email: str | None) -> str:
    return (email or '').strip().lower()


def normalize_login_identifier(identifier: str | None) -> str:
    return (identifier or '').strip().lower()


def find_user_by_email(email: str) -> User | None:
    normalized = normalize_email_value(email)
    if not normalized:
        return None
    return User.objects.filter(email__iexact=normalized).first()


def get_client_ip(request) -> str:
    forwarded_for = str(request.META.get('HTTP_X_FORWARDED_FOR', '')).strip()
    if forwarded_for:
        first_ip = forwarded_for.split(',')[0].strip()
        if first_ip:
            return first_ip
    return str(request.META.get('REMOTE_ADDR', '')).strip() or 'unknown'


def make_cache_scope_token(raw_value: str) -> str:
    return hashlib.sha256(raw_value.encode('utf-8')).hexdigest()[:32]


def get_login_cache_keys(request, identifier: str) -> dict[str, str]:
    normalized_identifier = normalize_login_identifier(identifier)
    identifier_token = make_cache_scope_token(normalized_identifier or 'unknown')
    ip_token = make_cache_scope_token(get_client_ip(request))
    return {
        'identifier_failures': f'{LOGIN_FAILURE_CACHE_PREFIX}:identifier:{identifier_token}',
        'ip_failures': f'{LOGIN_FAILURE_CACHE_PREFIX}:ip:{ip_token}',
        'identifier_lock': f'{LOGIN_LOCK_CACHE_PREFIX}:identifier:{identifier_token}',
        'ip_lock': f'{LOGIN_LOCK_CACHE_PREFIX}:ip:{ip_token}',
    }


def get_active_lockout_message(request, identifier: str) -> str | None:
    keys = get_login_cache_keys(request, identifier)
    active_until_values: list[datetime] = []
    now = timezone.now()

    for lock_key in (keys['identifier_lock'], keys['ip_lock']):
        raw_value = cache.get(lock_key)
        if not raw_value:
            continue
        try:
            locked_until = datetime.fromisoformat(str(raw_value))
        except ValueError:
            cache.delete(lock_key)
            continue
        if timezone.is_naive(locked_until):
            locked_until = timezone.make_aware(locked_until, timezone.get_current_timezone())
        if locked_until <= now:
            cache.delete(lock_key)
            continue
        active_until_values.append(locked_until)

    if not active_until_values:
        return None

    locked_until = max(active_until_values)
    remaining_seconds = max(1, int((locked_until - now).total_seconds()))
    remaining_minutes = max(1, math.ceil(remaining_seconds / 60))
    return f'Too many failed login attempts. Try again in {remaining_minutes} minute(s).'


def clear_failed_login_attempts(request, identifier: str) -> None:
    keys = get_login_cache_keys(request, identifier)
    cache.delete_many(
        [
            keys['identifier_failures'],
            keys['ip_failures'],
            keys['identifier_lock'],
            keys['ip_lock'],
        ]
    )


def record_failed_login_attempt(request, identifier: str) -> None:
    keys = get_login_cache_keys(request, identifier)
    limit = max(1, int(getattr(settings, 'LOGIN_FAILURE_LIMIT', 5)))
    window_timeout = max(60, int(getattr(settings, 'LOGIN_FAILURE_WINDOW_MINUTES', 15)) * 60)
    lockout_timeout = max(60, int(getattr(settings, 'LOGIN_LOCKOUT_MINUTES', 15)) * 60)
    locked_until = (timezone.now() + timedelta(seconds=lockout_timeout)).isoformat()

    for failure_key, lock_key in (
        (keys['identifier_failures'], keys['identifier_lock']),
        (keys['ip_failures'], keys['ip_lock']),
    ):
        failures = int(cache.get(failure_key, 0)) + 1
        cache.set(failure_key, failures, timeout=window_timeout)
        if failures >= limit:
            cache.set(lock_key, locked_until, timeout=lockout_timeout)
            cache.delete(failure_key)


def build_otp_challenge_token(user: User) -> str:
    return signing.dumps(
        {
            'purpose': 'otp_challenge',
            'user_id': user.id,
            'email': normalize_email_value(user.email),
        },
        salt=OTP_CHALLENGE_SALT,
        compress=True,
    )


def resolve_otp_challenge_user(raw_token: str) -> tuple[User | None, str | None]:
    token = str(raw_token or '').strip()
    if not token:
        return None, 'Verification session is required.'

    ttl_minutes = int(getattr(settings, 'OTP_CHALLENGE_TTL_MINUTES', 30))
    try:
        payload = signing.loads(
            token,
            salt=OTP_CHALLENGE_SALT,
            max_age=ttl_minutes * 60,
        )
    except SignatureExpired:
        return None, 'This verification session has expired. Please sign in again.'
    except BadSignature:
        return None, 'Invalid verification session. Please sign in again.'

    if payload.get('purpose') != 'otp_challenge':
        return None, 'Invalid verification session. Please sign in again.'

    user_id = payload.get('user_id')
    expected_email = normalize_email_value(payload.get('email'))
    if not user_id or not expected_email:
        return None, 'Invalid verification session. Please sign in again.'

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None, 'Account not found. Please sign in again.'

    if normalize_email_value(user.email) != expected_email:
        return None, 'This verification session is no longer valid. Please start again.'

    return user, None


def blacklist_user_refresh_tokens(user: User) -> int:
    blacklisted_count = 0
    outstanding_tokens = OutstandingToken.objects.filter(
        user=user,
        expires_at__gt=timezone.now(),
    )
    for token in outstanding_tokens:
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            blacklisted_count += 1
    return blacklisted_count


def generate_reset_code() -> str:
    length = getattr(settings, 'PASSWORD_RESET_CODE_LENGTH', 6)
    digits = string.digits
    return ''.join(secrets.choice(digits) for _ in range(length))


def build_reset_link(email: str, code: str) -> str:
    base_url = getattr(settings, 'PASSWORD_RESET_WEB_URL', '').strip() or 'http://localhost:3000/forgot-password'
    separator = '&' if '?' in base_url else '?'
    query = urlencode(
        {
            'email': email,
            'code': code,
            'source': 'email',
        }
    )
    return f"{base_url}{separator}{query}"


def send_reset_code(email: str, code: str) -> None:
    ttl_minutes = getattr(settings, 'PASSWORD_RESET_CODE_TTL_MINUTES', 15)
    reset_link = build_reset_link(email, code)
    subject = "Password Reset Verification Code"
    body = (
        f"Your verification code is {code}. "
        f"This code will expire in {ttl_minutes} minutes.\n\n"
        f"Reset your password here: {reset_link}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )
    html_body = f"""
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Password Reset Verification Code</h2>
          <p>Your verification code is <strong>{code}</strong>.</p>
          <p>This code will expire in {ttl_minutes} minutes.</p>
          <p>
            <a
              href="{reset_link}"
              style="display: inline-block; padding: 12px 18px; background: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;"
            >
              Change Password
            </a>
          </p>
          <p>If the button does not work, open this link:</p>
          <p><a href="{reset_link}">{reset_link}</a></p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
    """
    send_application_email(
        to=[email],
        subject=subject,
        text=body,
        html=html_body,
        fail_silently=False,
    )


def send_login_otp_code(email: str, code: str) -> None:
    ttl_minutes = getattr(settings, 'LOGIN_OTP_CODE_TTL_MINUTES', 15)
    subject = "Login Verification Code"
    body = (
        f"Your login verification code is {code}. "
        f"This code will expire in {ttl_minutes} minutes.\n\n"
        "If you did not attempt to login, please secure your account immediately."
    )
    html_body = f"""
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Login Verification Code</h2>
          <p>Your verification code is <strong style="font-size: 24px; color: #0ea5e9;">{code}</strong>.</p>
          <p>This code will expire in {ttl_minutes} minutes.</p>
          <p>Enter this code to complete your login.</p>
          <p>If you did not attempt to login, please secure your account immediately.</p>
        </div>
    """
    send_application_email(
        to=[email],
        subject=subject,
        text=body,
        html=html_body,
        fail_silently=False,
    )


def send_verification_code(email: str, code: str) -> None:
    ttl_minutes = getattr(settings, 'EMAIL_VERIFICATION_CODE_TTL_MINUTES', 15)
    subject = "Email Verification Code"
    body = (
        f"Your email verification code is {code}. "
        f"This code will expire in {ttl_minutes} minutes.\n\n"
        "If you did not request this code, you can ignore this email."
    )
    html_body = f"""
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Email Verification Code</h2>
          <p>Your verification code is <strong style="font-size: 24px; color: #0ea5e9;">{code}</strong>.</p>
          <p>This code will expire in {ttl_minutes} minutes.</p>
          <p>Enter this code on the registration page to verify your email address.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
    """
    send_application_email(
        to=[email],
        subject=subject,
        text=body,
        html=html_body,
        fail_silently=False,
    )


def send_account_approved_email(user_id: int) -> None:
    user = User.objects.filter(pk=user_id).only(
        'id',
        'email',
        'full_name',
        'username',
        'role',
        'student_id',
        'staff_id',
        'is_working_student',
    ).first()
    if not user or not user.email:
        return

    if get_email_config_error():
        return

    base_url = getattr(settings, 'LIBRARY_WEB_URL', '').strip() or 'http://localhost:3000'
    login_url = f"{base_url.rstrip('/')}/login"
    recipient_name = user.full_name or user.username or 'Library user'
    access_note = (
        ' Working student access has also been enabled for your account.'
        if user.is_working_student
        else ''
    )
    subject = 'Library Account Approved'
    body = (
        f"Hi {recipient_name},\n\n"
        "Your library account request has been approved. "
        "You can now sign in to the SCSIT Library System using your registered ID or username and password."
        f"{access_note}\n\n"
        f"Sign in here: {login_url}\n\n"
        "SCSIT Library System"
    )
    html_body = f"""
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Library Account Approved</h2>
          <p>Hi {recipient_name},</p>
          <p>
            Your library account request has been approved. You can now sign in to the
            SCSIT Library System using your registered ID or username and password.{access_note}
          </p>
          <p>
            <a
              href="{login_url}"
              style="display: inline-block; padding: 12px 18px; background: #0f4c81; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;"
            >
              Sign In
            </a>
          </p>
          <p>If the button does not work, open this link:</p>
          <p><a href="{login_url}">{login_url}</a></p>
        </div>
    """
    send_application_email(
        to=[user.email],
        subject=subject,
        text=body,
        html=html_body,
        fail_silently=True,
    )


def build_otp_challenge_payload(user: User, message: str) -> dict:
    return {
        'requires_otp': True,
        'otp_session': build_otp_challenge_token(user),
        'email': user.email,
        'full_name': user.full_name,
        'role': user.role,
        'student_id': user.student_id,
        'staff_id': user.staff_id,
        'message': message,
    }


def create_and_send_login_otp(user: User) -> None:
    if not user.email:
        raise ValueError('No email associated with this account.')

    LoginOTPCode.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())

    code = generate_reset_code()
    otp_code = LoginOTPCode(user=user, email=user.email)
    otp_code.set_code(code)
    otp_code.save()
    send_login_otp_code(user.email, code)


def get_email_config_error() -> str | None:
    bridge_config_error = get_email_bridge_config_error()
    if bridge_config_error:
        return bridge_config_error
    if is_email_bridge_configured():
        return None

    email_backend = getattr(settings, 'EMAIL_BACKEND', '')
    non_smtp_backends = {
        'django.core.mail.backends.console.EmailBackend',
        'django.core.mail.backends.locmem.EmailBackend',
        'django.core.mail.backends.filebased.EmailBackend',
        'django.core.mail.backends.dummy.EmailBackend',
    }
    if email_backend in non_smtp_backends:
        return None
    if email_backend and email_backend != 'django.core.mail.backends.smtp.EmailBackend':
        return None

    missing = []
    if not getattr(settings, 'EMAIL_HOST', ''):
        missing.append('EMAIL_HOST')
    email_host_user = getattr(settings, 'EMAIL_HOST_USER', '')
    if not email_host_user:
        missing.append('EMAIL_HOST_USER')
    email_host_password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    if not email_host_password:
        missing.append('EMAIL_HOST_PASSWORD')
    if missing:
        return f"Email service is not configured. Missing: {', '.join(missing)}."
    if email_host_user.strip().lower() in PLACEHOLDER_EMAIL_USERS:
        return 'Email service is not configured. Replace the placeholder EMAIL_HOST_USER value in backend/.env.'
    if email_host_password.strip() in PLACEHOLDER_EMAIL_PASSWORDS:
        return 'Email service is not configured. Replace the placeholder EMAIL_HOST_PASSWORD value in backend/.env.'
    return None


def get_latest_password_reset_code(user: User, email: str) -> PasswordResetCode | None:
    return (
        PasswordResetCode.objects.filter(user=user, email__iexact=email)
        .order_by('-created_at')
        .first()
    )


class RegisterView(generics.CreateAPIView):
    """
    API endpoint for student and teacher registration.
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = 'register'
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        config_error = get_email_config_error()
        if config_error:
            return Response(
                {'detail': config_error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        user = serializer.save()

        try:
            create_and_send_login_otp(user)
        except Exception as exc:
            logger.exception("Failed to send registration OTP email: %s", exc)
            user.delete()
            return Response(
                {'detail': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        notify_pending_account_reviewers(
            notification_type='ACCOUNT_PENDING_APPROVAL',
            title='New pending account',
            message=(
                f"{user.full_name} registered as a {user.role.lower()} and is awaiting approval."
            ),
            data={
                'dashboard_section': 'desk-accounts',
                'user_id': user.pk,
                'role': user.role,
            },
        )

        return Response(
            {
                'user': UserSerializer(user).data,
                **build_otp_challenge_payload(
                    user,
                    'Account created. Verify your email first. Staff approval will come after email verification.',
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    API endpoint for user login with student/staff ID or username.
    Authenticates user and returns JWT tokens.
    If email is not verified, requires OTP verification first.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'login'
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        portal = serializer.validated_data.get('portal')
        identifier = serializer.validated_data['student_id'].strip()
        password = serializer.validated_data['password']

        lockout_message = get_active_lockout_message(request, identifier)
        if lockout_message:
            return Response(
                {'detail': lockout_message},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        
        # Find user by student_id, staff_id, or username
        user = (
            User.objects.filter(student_id=identifier).first()
            or User.objects.filter(staff_id=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )
        if not user:
            record_failed_login_attempt(request, identifier)
            return Response(
                {'detail': 'Invalid ID or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Check password
        if not user.check_password(password):
            record_failed_login_attempt(request, identifier)
            return Response({
                'detail': 'Invalid ID or password.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        clear_failed_login_attempts(request, identifier)

        if portal:
            allowed_roles = PORTAL_ROLE_MAP.get(portal, set())
            has_portal_access = (
                has_staff_portal_access(user)
                if portal == 'staff'
                else user.role in allowed_roles
            )
            if allowed_roles and not has_portal_access:
                return Response(
                    {'detail': f"Your account cannot access the {portal} portal."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        if not user.email_verified and user.email:
            return Response(
                build_otp_challenge_payload(
                    user,
                    'Email verification required. OTP will be sent to your email.',
                ),
                status=status.HTTP_200_OK,
            )

        if not user.is_active:
            return Response({
                'detail': 'Account pending approval.'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': 'Login successful'
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    API endpoint for user logout.
    Blacklists the refresh token.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
        except Exception:
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint for retrieving and updating user profile.
    """
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    API endpoint for changing user password.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        with transaction.atomic():
            user.set_password(serializer.validated_data['new_password'])
            user.save(update_fields=['password'])
            blacklist_user_refresh_tokens(user)

        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)


class CheckStudentIdView(APIView):
    """
    API endpoint to check if a student ID is available.
    """
    permission_classes = [AllowAny]

    def get_response(self, role: str, identifier: str) -> Response:
        identifier_status = get_identifier_status(role, identifier)
        response_status = (
            status.HTTP_400_BAD_REQUEST
            if identifier_status.reason == 'missing_identifier'
            else status.HTTP_200_OK
        )
        return Response(identifier_status.to_dict(), status=response_status)

    def get(self, request):
        student_id = request.query_params.get('student_id', '').strip()
        return self.get_response('STUDENT', student_id)


class CheckAccountIdentifierView(CheckStudentIdView):
    """
    API endpoint to check whether a student or faculty ID is available.
    """

    def get(self, request):
        role = str(request.query_params.get('role', 'STUDENT')).strip().upper()
        if role not in REGISTRABLE_ACCOUNT_ROLES:
            return Response(
                {'detail': 'Invalid registration role.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = str(request.query_params.get('identifier', '')).strip()
        return self.get_response(role, identifier)


class EnrollmentImportView(APIView):
    permission_classes = [IsAuthenticated, CanManageEnrollmentRecords]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(get_enrollment_summary(), status=status.HTTP_200_OK)

    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('csv')
        if upload is None:
            return Response(
                {'detail': 'CSV file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fallback_term = str(request.data.get('academic_term') or '').strip()

        try:
            result = import_enrollment_csv_file(upload, fallback_term=fallback_term)
        except EnrollmentImportError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        summary = get_enrollment_summary()
        return Response(
            {
                'message': 'Enrollment records uploaded successfully.',
                'created_count': result.created_count,
                'updated_count': result.updated_count,
                'skipped_count': result.skipped_count,
                'skipped_rows': result.skipped_rows,
                **summary,
            },
            status=status.HTTP_200_OK,
        )


class PendingAccountsView(APIView):
    """
    List student, teacher, and working-student accounts awaiting approval.
    """

    permission_classes = [IsAuthenticated, CanViewPendingStudents]

    def get(self, request):
        pending_accounts = User.objects.filter(
            role__in=PENDING_ACCOUNT_ROLES,
            is_active=False,
        ).order_by('date_joined')
        data = UserSerializer(pending_accounts, many=True).data
        return Response({'results': data}, status=status.HTTP_200_OK)


class PendingStudentsView(PendingAccountsView):
    """
    Backward-compatible alias for the pending-accounts endpoint.
    """


class ApproveAccountView(APIView):
    """
    Approve a pending student, teacher, or working-student account.
    """

    permission_classes = [IsAuthenticated, CanApproveStudents]

    def post(self, request, user_id: int):
        try:
            account = User.objects.get(pk=user_id, role__in=PENDING_ACCOUNT_ROLES)
        except User.DoesNotExist:
            return Response({'detail': 'Pending account not found.'}, status=status.HTTP_404_NOT_FOUND)

        if account.is_active:
            return Response(
                {'detail': 'Account is already active.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mark_as_working_student = account.role == 'WORKING' or parse_bool(request.data.get('is_working_student'))
        if mark_as_working_student and account.role not in {'STUDENT', 'WORKING'}:
            return Response(
                {'detail': 'Only student accounts can be approved as working students.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            account.is_active = True
            account.is_working_student = mark_as_working_student
            account.save(update_fields=['is_active', 'is_working_student'])
            transaction.on_commit(
                lambda approved_user_id=account.id: send_account_approved_email(approved_user_id)
            )
        return Response(UserSerializer(account).data, status=status.HTTP_200_OK)


class ApproveStudentView(ApproveAccountView):
    """
    Backward-compatible alias for the approve-account endpoint.
    """


class RejectAccountView(APIView):
    """
    Reject a pending student, teacher, or working-student account.
    """

    permission_classes = [IsAuthenticated, CanApproveStudents]

    def post(self, request, user_id: int):
        try:
            account = User.objects.get(pk=user_id, role__in=PENDING_ACCOUNT_ROLES)
        except User.DoesNotExist:
            return Response({'detail': 'Pending account not found.'}, status=status.HTTP_404_NOT_FOUND)

        if account.is_active:
            return Response(
                {'detail': 'Cannot reject an active account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delete the account
        account_info = {
            'id': account.id,
            'full_name': account.full_name,
            'email': account.email,
            'role': account.role,
        }
        account.delete()
        
        return Response(
            {
                'message': 'Account rejected and removed.',
                'account': account_info,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(APIView):
    """
    Request a short reset code for the given email address.
    """

    permission_classes = [AllowAny]
    throttle_scope = 'password_reset_request'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user = find_user_by_email(email)
        ttl_minutes = int(getattr(settings, 'PASSWORD_RESET_CODE_TTL_MINUTES', 15))
        code_length = int(getattr(settings, 'PASSWORD_RESET_CODE_LENGTH', 6))
        allow_debug_fallback = bool(
            getattr(settings, 'DEBUG', False)
            and getattr(settings, 'PASSWORD_RESET_DEBUG_RETURN_CODE', False)
        )
        success_payload = {
            'message': 'If that email is registered, a reset code has been sent.',
            'code_length': code_length,
            'expires_in_minutes': ttl_minutes,
        }

        if not user:
            return Response(
                success_payload,
                status=status.HTTP_200_OK,
            )

        message = 'A reset code has been sent to your email address.'

        config_error = get_email_config_error()
        if config_error:
            if not allow_debug_fallback:
                return Response(
                    {'detail': config_error},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            logger.warning("Email config missing. Using debug password reset code fallback: %s", config_error)

        # Invalidate any previous outstanding codes for this user.
        user.password_reset_codes.filter(used_at__isnull=True).update(used_at=timezone.now())

        code = generate_reset_code()
        reset_code = PasswordResetCode(
            user=user,
            email=email,
        )
        reset_code.set_code(code)
        reset_code.save()
        if config_error:
            return Response(
                {
                    'message': 'Email service unavailable. Using debug reset code for local development.',
                    'code': code,
                    'code_length': code_length,
                    'expires_in_minutes': ttl_minutes,
                    'email_delivery': 'debug_fallback',
                },
                status=status.HTTP_200_OK,
            )

        try:
            send_reset_code(email, code)
        except Exception as exc:
            logger.exception("Failed to send reset email: %s", exc)
            if not allow_debug_fallback:
                detail = 'Email service is not configured. Please contact support.'
                if settings.DEBUG:
                    detail = f"Email send failed: {exc}"
                return Response({'detail': detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response(
                {
                    'message': 'Email delivery failed. Using debug reset code for local development.',
                    'code': code,
                    'code_length': code_length,
                    'expires_in_minutes': ttl_minutes,
                    'email_delivery': 'debug_fallback',
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                'message': message,
                'code_length': code_length,
                'expires_in_minutes': ttl_minutes,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    Confirm the reset code and set a new password.
    """

    permission_classes = [AllowAny]
    throttle_scope = 'password_reset_confirm'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        submitted_code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']

        user = find_user_by_email(email)
        if not user:
            return Response(
                {'detail': 'Invalid reset code or email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reset_code = get_latest_password_reset_code(user, email)
        if not reset_code:
            return Response(
                {'detail': 'No reset request found. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_attempts = int(getattr(settings, 'PASSWORD_RESET_MAX_ATTEMPTS', 5))

        if reset_code.is_used:
            return Response(
                {'detail': 'This reset code has already been used. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if reset_code.is_expired or reset_code.attempt_count >= max_attempts:
            if not reset_code.is_used:
                reset_code.used_at = timezone.now()
                reset_code.save(update_fields=['used_at'])
            return Response(
                {'detail': 'This reset code has expired. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reset_code.matches(submitted_code):
            reset_code.attempt_count += 1
            if reset_code.attempt_count >= max_attempts:
                reset_code.used_at = timezone.now()
                reset_code.save(update_fields=['attempt_count', 'used_at'])
            else:
                reset_code.save(update_fields=['attempt_count'])
            return Response(
                {'detail': 'Invalid reset code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=['password'])
            reset_code.mark_used()
            user.password_reset_codes.filter(used_at__isnull=True).exclude(pk=reset_code.pk).update(
                used_at=timezone.now()
            )
            blacklist_user_refresh_tokens(user)

        return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)


class PasswordResetVerifyView(APIView):
    """
    Validate a reset code before allowing a password change.
    """

    permission_classes = [AllowAny]
    throttle_scope = 'password_reset_verify'

    def post(self, request):
        serializer = PasswordResetVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        submitted_code = serializer.validated_data['code']
        user = find_user_by_email(email)
        if not user:
            return Response(
                {'detail': 'Invalid reset code or email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reset_code = get_latest_password_reset_code(user, email)
        if not reset_code:
            return Response(
                {'detail': 'No reset request found. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_attempts = int(getattr(settings, 'PASSWORD_RESET_MAX_ATTEMPTS', 5))

        if reset_code.is_used:
            return Response(
                {'detail': 'This reset code has already been used. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if reset_code.is_expired or reset_code.attempt_count >= max_attempts:
            if not reset_code.is_used:
                reset_code.used_at = timezone.now()
                reset_code.save(update_fields=['used_at'])
            return Response(
                {'detail': 'This reset code has expired. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reset_code.matches(submitted_code):
            reset_code.attempt_count += 1
            if reset_code.attempt_count >= max_attempts:
                reset_code.used_at = timezone.now()
                reset_code.save(update_fields=['attempt_count', 'used_at'])
            else:
                reset_code.save(update_fields=['attempt_count'])
            return Response(
                {'detail': 'Invalid reset code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {'message': 'Reset code verified. You can now choose a new password.'},
            status=status.HTTP_200_OK,
        )


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread_param = str(request.query_params.get('unread', '')).strip().lower()
        unread_only = unread_param in {'1', 'true', 'yes'}
        limit_raw = request.query_params.get('limit')
        limit = 50
        if limit_raw:
            try:
                limit = max(1, min(int(limit_raw), 200))
            except (TypeError, ValueError):
                limit = 50

        base_queryset = Notification.objects.filter(user=request.user)
        queryset = base_queryset
        if unread_only:
            queryset = queryset.filter(is_read=False)
        queryset = queryset.order_by('-created_at')[:limit]

        serializer = NotificationSerializer(queryset, many=True)
        return Response(
            {
                'results': serializer.data,
                'unread_count': request.user.get_unread_notifications_count(),
                'total_count': base_queryset.count(),
            },
            status=status.HTTP_200_OK,
        )


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {'unread_count': request.user.get_unread_notifications_count()},
            status=status.HTTP_200_OK,
        )


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id: int):
        try:
            notification = Notification.objects.get(pk=notification_id, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification.mark_read()
        return Response(
            {
                'message': 'Notification marked as read.',
                'unread_count': request.user.get_unread_notifications_count(),
            },
            status=status.HTTP_200_OK,
        )


class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, notification_id: int):
        try:
            notification = Notification.objects.get(pk=notification_id, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification.delete()
        return Response(
            {
                'message': 'Notification deleted.',
                'unread_count': request.user.get_unread_notifications_count(),
                'total_count': Notification.objects.filter(user=request.user).count(),
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True,
            read_at=now,
        )
        return Response(
            {
                'message': 'All notifications marked as read.',
                'unread_count': 0,
            },
            status=status.HTTP_200_OK,
        )


class ContactMessageListView(APIView):
    permission_classes = [IsAuthenticated, CanManageContactMessages]

    def get(self, request):
        search = str(request.query_params.get('search') or '').strip()
        status_filter = str(request.query_params.get('status') or '').strip().upper()
        limit_raw = request.query_params.get('limit')
        limit = 100
        if limit_raw:
            try:
                limit = max(1, min(int(limit_raw), 250))
            except (TypeError, ValueError):
                limit = 100

        base_queryset = ContactMessage.objects.select_related('user', 'handled_by').all()
        if search:
            base_queryset = base_queryset.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(subject__icontains=search)
                | Q(message__icontains=search)
                | Q(internal_notes__icontains=search)
                | Q(user__full_name__icontains=search)
                | Q(user__student_id__icontains=search)
                | Q(user__staff_id__icontains=search)
            )

        status_counts = {
            row['status']: row['count']
            for row in base_queryset.values('status').annotate(count=Count('id'))
        }

        queryset = base_queryset.order_by('-created_at')
        if status_filter in dict(ContactMessage.STATUS_CHOICES):
            queryset = queryset.filter(status=status_filter)

        filtered_count = queryset.count()
        queryset = queryset[:limit]
        serializer = ContactMessageRecordSerializer(queryset, many=True)
        return Response(
            {
                'results': serializer.data,
                'total_count': base_queryset.count(),
                'filtered_count': filtered_count,
                'status_counts': {
                    ContactMessage.STATUS_NEW: status_counts.get(ContactMessage.STATUS_NEW, 0),
                    ContactMessage.STATUS_IN_PROGRESS: status_counts.get(ContactMessage.STATUS_IN_PROGRESS, 0),
                    ContactMessage.STATUS_RESOLVED: status_counts.get(ContactMessage.STATUS_RESOLVED, 0),
                },
            },
            status=status.HTTP_200_OK,
        )


class ContactMessageDetailView(APIView):
    permission_classes = [IsAuthenticated, CanManageContactMessages]

    def patch(self, request, message_id: int):
        try:
            contact_message = ContactMessage.objects.select_related('user', 'handled_by').get(pk=message_id)
        except ContactMessage.DoesNotExist:
            return Response({'detail': 'Contact message not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ContactMessageUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        update_fields: list[str] = []
        next_notes = data.get('internal_notes', contact_message.internal_notes)
        next_status = data.get('status', contact_message.status)

        if contact_message.internal_notes != next_notes:
            contact_message.internal_notes = next_notes
            update_fields.append('internal_notes')
        if contact_message.status != next_status:
            contact_message.status = next_status
            update_fields.append('status')

        if update_fields:
            contact_message.handled_by = request.user
            contact_message.handled_at = timezone.now()
            update_fields.extend(['handled_by', 'handled_at'])
            contact_message.save(update_fields=update_fields)
            contact_message.refresh_from_db()

        return Response(ContactMessageRecordSerializer(contact_message).data, status=status.HTTP_200_OK)


class TeacherRecordsImportView(APIView):
    permission_classes = [IsAuthenticated, CanManageEnrollmentRecords]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(get_teacher_records_summary(), status=status.HTTP_200_OK)

    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('csv')
        if upload is None:
            return Response(
                {'detail': 'CSV file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fallback_term = str(request.data.get('academic_term') or '').strip()

        try:
            result = import_teacher_csv_file(upload, fallback_term=fallback_term)
        except TeacherImportError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        summary = get_teacher_records_summary()
        return Response(
            {
                'message': 'Teacher records uploaded successfully.',
                'created_count': result.created_count,
                'updated_count': result.updated_count,
                'skipped_count': result.skipped_count,
                'skipped_rows': result.skipped_rows,
                **summary,
            },
            status=status.HTTP_200_OK,
        )


class ContactMessageView(APIView):
    """
    Accept contact form submissions and notify the admin by email.
    """

    permission_classes = [IsAuthenticated, CanSendContactMessages]
    throttle_scope = 'contact'

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        sender_user = request.user if request.user.is_authenticated else None
        sender_role = get_contact_sender_role_label(sender_user)
        sender_identifier = get_contact_sender_identifier(sender_user)
        contact_message = ContactMessage.objects.create(
            user=sender_user,
            name=data['name'],
            email=data['email'],
            subject=data.get('subject', ''),
            message=data['message'],
        )
        subject_line = data.get('subject', '').strip() or 'No subject'
        message_preview = re.sub(r'\s+', ' ', data['message']).strip()[:140]

        notify_librarian_users(
            notification_type=Notification.TYPE_CONTACT_MESSAGE_RECEIVED,
            title=f"New contact message from {data['name']}",
            message=f'{sender_role} {data["name"]} sent a contact message about "{subject_line}".',
            data={
                'dashboard_section': 'desk-contact',
                'contact_message_id': contact_message.id,
                'sender_name': data['name'],
                'sender_email': data['email'],
                'sender_role': sender_role,
                'sender_identifier': sender_identifier,
                'subject': subject_line,
                'message_preview': message_preview,
            },
            dedupe=False,
        )

        admin_email = getattr(settings, 'CONTACT_ADMIN_EMAIL', '').strip()
        if admin_email and not get_email_config_error():
            sender_name = data['name']
            sender_email = data['email']
            body_text = data['message']
            account_line = f"Account ID: {sender_identifier}\n" if sender_identifier else ''
            html_account_line = (
                f'<p><strong>Account ID:</strong> {escape(sender_identifier)}</p>'
                if sender_identifier
                else ''
            )
            email_subject = f"[Contact Form] {subject_line} - from {sender_name}"
            text_body = (
                f"New contact form message\n\n"
                f"From: {sender_name} <{sender_email}>\n"
                f"Role: {sender_role}\n"
                f"{account_line}"
                f"Subject: {subject_line}\n\n"
                f"{body_text}"
            )
            html_body = f"""
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                  <h2 style="margin-bottom: 8px;">New Contact Form Message</h2>
                  <p><strong>From:</strong> {escape(sender_name)} &lt;{escape(sender_email)}&gt;</p>
                  <p><strong>Role:</strong> {escape(sender_role)}</p>
                  {html_account_line}
                  <p><strong>Subject:</strong> {escape(subject_line)}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                  <p style="white-space: pre-wrap;">{escape(body_text)}</p>
                </div>
            """
            try:
                send_application_email(
                    to=[admin_email],
                    subject=email_subject,
                    text=text_body,
                    html=html_body,
                    fail_silently=True,
                )
            except Exception:
                logger.exception('Failed to send contact form notification email.')

        return Response(
            {'message': 'Thanks! Your message has been received.'},
            status=status.HTTP_201_CREATED,
        )


class ContactMessageReplyView(APIView):
    """
    Send an email reply to a contact message sender.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, message_id: int):
        if not (is_super_admin(request.user) or getattr(request.user, 'role', None) in {'LIBRARIAN', 'STAFF'}):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            contact_message = ContactMessage.objects.get(pk=message_id)
        except ContactMessage.DoesNotExist:
            return Response({'detail': 'Contact message not found.'}, status=status.HTTP_404_NOT_FOUND)

        reply_body = str(request.data.get('reply', '')).strip()
        if not reply_body:
            return Response({'detail': 'Reply message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        config_error = get_email_config_error()
        if config_error:
            return Response({'detail': config_error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        librarian_name = getattr(request.user, 'full_name', '') or getattr(request.user, 'username', '') or 'Librarian'
        original_subject = contact_message.subject.strip() or 'Your message'
        email_subject = f"Re: {original_subject}"
        text_body = (
            f"Hi {contact_message.name},\n\n"
            f"{reply_body}\n\n"
            f"— {librarian_name}\nSCSIT Library System"
        )
        html_body = f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
              <p>Hi {contact_message.name},</p>
              <p style="white-space: pre-wrap;">{reply_body}</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
              <p style="color: #64748b; font-size: 13px;">
                — {librarian_name}<br />SCSIT Library System
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">
                This is a reply to your message: &ldquo;{original_subject}&rdquo;
              </p>
            </div>
        """

        try:
            send_application_email(
                to=[contact_message.email],
                subject=email_subject,
                text=text_body,
                html=html_body,
                fail_silently=False,
            )
        except Exception as exc:
            logger.exception('Failed to send contact reply email: %s', exc)
            return Response(
                {'detail': 'Failed to send reply email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        contact_message.status = 'IN_PROGRESS'
        contact_message.handled_by = request.user
        contact_message.handled_at = timezone.now()
        contact_message.save(update_fields=['status', 'handled_by', 'handled_at'])

        if contact_message.user_id:
            from backend.notification_utils import create_user_notification
            subject_preview = contact_message.subject or 'your inquiry'
            create_user_notification(
                user_id=contact_message.user_id,
                notification_type='CONTACT_REPLY',
                title='Reply to your message',
                message='The library has replied to your message: ' + subject_preview + '.',
                data={'contact_message_id': contact_message.id},
            )

        return Response({'message': f'Reply sent to {contact_message.email}.'}, status=status.HTTP_200_OK)


class SendEmailVerificationView(APIView):
    """
    Send verification code to email for registration.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'email_verification_send'

    def post(self, request):
        email = request.data.get('email', '').strip()
        
        if not email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return Response(
                {'detail': 'Please enter a valid email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {'detail': 'This email is already registered.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        ttl_minutes = int(getattr(settings, 'EMAIL_VERIFICATION_CODE_TTL_MINUTES', 15))
        code_length = int(getattr(settings, 'EMAIL_VERIFICATION_CODE_LENGTH', 6))
        
        config_error = get_email_config_error()
        if config_error:
            return Response(
                {'detail': config_error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        EmailVerificationCode.objects.filter(email__iexact=email, used_at__isnull=True).update(used_at=timezone.now())
        
        code = generate_reset_code()
        verification_code = EmailVerificationCode(email=email)
        verification_code.set_code(code)
        verification_code.save()
        
        try:
            send_verification_code(email, code)
        except Exception as exc:
            logger.exception("Failed to send verification email: %s", exc)
            return Response(
                {'detail': 'Failed to send verification email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        return Response(
            {
                'message': 'Verification code sent to your email.',
                'code_length': code_length,
                'expires_in_minutes': ttl_minutes,
            },
            status=status.HTTP_200_OK,
        )


class VerifyEmailCodeView(APIView):
    """
    Verify the email verification code.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'email_verification_verify'

    def post(self, request):
        email = request.data.get('email', '').strip()
        submitted_code = request.data.get('code', '').strip()
        
        if not email or not submitted_code:
            return Response(
                {'detail': 'Email and code are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        verification_code = (
            EmailVerificationCode.objects.filter(email__iexact=email)
            .order_by('-created_at')
            .first()
        )
        
        if not verification_code:
            return Response(
                {'detail': 'No verification request found. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        max_attempts = int(getattr(settings, 'EMAIL_VERIFICATION_MAX_ATTEMPTS', 5))
        
        if verification_code.is_used:
            return Response(
                {'detail': 'This verification code has already been used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if verification_code.is_expired or verification_code.attempt_count >= max_attempts:
            if not verification_code.is_used:
                verification_code.used_at = timezone.now()
                verification_code.save(update_fields=['used_at'])
            return Response(
                {'detail': 'This verification code has expired. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if not verification_code.matches(submitted_code):
            verification_code.attempt_count += 1
            if verification_code.attempt_count >= max_attempts:
                verification_code.used_at = timezone.now()
                verification_code.save(update_fields=['attempt_count', 'used_at'])
            else:
                verification_code.save(update_fields=['attempt_count'])
            return Response(
                {'detail': 'Invalid verification code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        verification_code.mark_used()
        
        return Response(
            {'message': 'Email verified successfully. You can now complete registration.'},
            status=status.HTTP_200_OK,
        )


class SendLoginOTPView(APIView):
    """
    Send OTP code to user's email for login verification.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'otp_send'

    def post(self, request):
        user, challenge_error = resolve_otp_challenge_user(request.data.get('otp_session'))
        if challenge_error:
            return Response(
                {'detail': challenge_error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email:
            return Response(
                {'detail': 'No email associated with this account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        ttl_minutes = int(getattr(settings, 'LOGIN_OTP_CODE_TTL_MINUTES', 15))
        code_length = int(getattr(settings, 'LOGIN_OTP_CODE_LENGTH', 6))
        
        config_error = get_email_config_error()
        if config_error:
            return Response(
                {'detail': config_error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        try:
            create_and_send_login_otp(user)
        except Exception as exc:
            logger.exception("Failed to send login OTP email: %s", exc)
            return Response(
                {'detail': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        return Response(
            {
                'message': 'OTP code sent to your email.',
                'email': user.email,
                'code_length': code_length,
                'expires_in_minutes': ttl_minutes,
            },
            status=status.HTTP_200_OK,
        )


class VerifyLoginOTPView(APIView):
    """
    Verify the login OTP code and complete login.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        otp_session = request.data.get('otp_session')
        submitted_code = request.data.get('code', '').strip()

        if not otp_session or not submitted_code:
            return Response(
                {'detail': 'Verification session and code are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, challenge_error = resolve_otp_challenge_user(otp_session)
        if challenge_error:
            return Response(
                {'detail': challenge_error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_code = (
            LoginOTPCode.objects.filter(user=user)
            .order_by('-created_at')
            .first()
        )
        
        if not otp_code:
            return Response(
                {'detail': 'No OTP request found. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        max_attempts = int(getattr(settings, 'LOGIN_OTP_MAX_ATTEMPTS', 5))
        
        if otp_code.is_used:
            return Response(
                {'detail': 'This OTP code has already been used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if otp_code.is_expired or otp_code.attempt_count >= max_attempts:
            if not otp_code.is_used:
                otp_code.used_at = timezone.now()
                otp_code.save(update_fields=['used_at'])
            return Response(
                {'detail': 'This OTP code has expired. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if not otp_code.matches(submitted_code):
            otp_code.attempt_count += 1
            if otp_code.attempt_count >= max_attempts:
                otp_code.used_at = timezone.now()
                otp_code.save(update_fields=['attempt_count', 'used_at'])
            else:
                otp_code.save(update_fields=['attempt_count'])
            return Response(
                {'detail': 'Invalid OTP code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        otp_code.mark_used()
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=['email_verified'])

        if not user.is_active:
            return Response(
                {
                    'email_verified': True,
                    'requires_approval': True,
                    'message': 'Email verified. Wait for account approval before signing in.',
                },
                status=status.HTTP_200_OK,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'message': 'Login successful. Email verified.'
            },
            status=status.HTTP_200_OK,
        )


class UpdateEmailView(APIView):
    """
    Update a user's email address.
    Unauthenticated recovery requires a signed verification session.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'update_email'

    def post(self, request):
        otp_session = request.data.get('otp_session')
        new_email = request.data.get('email', '').strip()

        if not new_email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', new_email):
            return Response(
                {'detail': 'Please enter a valid email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if request.user.is_authenticated:
            user = request.user
        elif otp_session:
            user, challenge_error = resolve_otp_challenge_user(otp_session)
            if challenge_error:
                return Response(
                    {'detail': challenge_error},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.email_verified:
                return Response(
                    {'detail': 'Email already verified. Please login to update.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {'detail': 'Authentication or verification session required.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            return Response(
                {'detail': 'This email is already in use.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.email = new_email
        user.email_verified = False
        user.save(update_fields=['email', 'email_verified'])

        return Response(
            {
                'message': 'Email updated successfully. Please verify with OTP.',
                'email': user.email,
                'otp_session': build_otp_challenge_token(user),
            },
            status=status.HTTP_200_OK,
        )
