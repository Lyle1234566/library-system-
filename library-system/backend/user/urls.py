from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    ProfileView,
    ChangePasswordView,
    CheckStudentIdView,
    CheckAccountIdentifierView,
    EnrollmentImportView,
    PasswordResetRequestView,
    PasswordResetVerifyView,
    PasswordResetConfirmView,
    ContactMessageView,
    PendingAccountsView,
    PendingStudentsView,
    ApproveAccountView,
    ApproveStudentView,
    RejectAccountView,
    NotificationListView,
    NotificationUnreadCountView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    SendEmailVerificationView,
    VerifyEmailCodeView,
    SendLoginOTPView,
    VerifyLoginOTPView,
    UpdateEmailView,
)

urlpatterns = [
    # Authentication endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Token management
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # User profile
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),

    # Password reset
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/verify/', PasswordResetVerifyView.as_view(), name='password_reset_verify'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    # Email verification
    path('email-verification/send/', SendEmailVerificationView.as_view(), name='send_email_verification'),
    path('email-verification/verify/', VerifyEmailCodeView.as_view(), name='verify_email_code'),

    # Login OTP
    path('login-otp/send/', SendLoginOTPView.as_view(), name='send_login_otp'),
    path('login-otp/verify/', VerifyLoginOTPView.as_view(), name='verify_login_otp'),
    path('update-email/', UpdateEmailView.as_view(), name='update_email'),

    # Contact form
    path('contact/', ContactMessageView.as_view(), name='contact_message'),
    
    # Utility endpoints
    path('check-account-identifier/', CheckAccountIdentifierView.as_view(), name='check_account_identifier'),
    path('check-student-id/', CheckStudentIdView.as_view(), name='check_student_id'),
    path('enrollment-records/import/', EnrollmentImportView.as_view(), name='enrollment_import'),
    path('pending-accounts/', PendingAccountsView.as_view(), name='pending_accounts'),
    path('pending-students/', PendingStudentsView.as_view(), name='pending_students'),
    path('approve-account/<int:user_id>/', ApproveAccountView.as_view(), name='approve_account'),
    path('approve-student/<int:user_id>/', ApproveStudentView.as_view(), name='approve_student'),
    path('reject-account/<int:user_id>/', RejectAccountView.as_view(), name='reject_account'),

    # In-app notifications
    path('notifications/', NotificationListView.as_view(), name='notification_list'),
    path('notifications/unread-count/', NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('notifications/<int:notification_id>/mark-read/', NotificationMarkReadView.as_view(), name='notification_mark_read'),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification_mark_all_read'),
]
