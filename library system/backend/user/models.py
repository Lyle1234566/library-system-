from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.contrib.auth.hashers import check_password, make_password


class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("Users must have a username")

        email = extra_fields.get('email')
        if email:
            extra_fields['email'] = self.normalize_email(email)

        role = extra_fields.get('role') or 'STUDENT'
        if role == 'WORKING':
            extra_fields['is_working_student'] = True

        is_working_student = bool(extra_fields.get('is_working_student'))
        staff_id = extra_fields.get('staff_id')
        student_id = extra_fields.get('student_id')
        if is_working_student and role not in {'STUDENT', 'WORKING'}:
            raise ValueError('Only student accounts can be marked as working students.')
        if role in {'LIBRARIAN', 'STAFF', 'TEACHER'} and not staff_id:
            raise ValueError('Staff ID is required for librarian/staff/teacher accounts.')
        if role in {'STUDENT', 'WORKING'} and not student_id:
            raise ValueError('Student ID is required for student accounts.')

        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('STUDENT', 'Student'),
        ('TEACHER', 'Teacher'),
        ('LIBRARIAN', 'Librarian'),
        ('WORKING', 'Working Student'),
        ('ADMIN', 'Admin'),
        ('STAFF', 'Staff'),
    )

    username = models.CharField(max_length=150, unique=True)
    student_id = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        help_text="Unique student ID number",
    )
    staff_id = models.CharField(
        "Faculty ID",
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        help_text="Unique faculty ID number",
    )
    email = models.EmailField(blank=True, null=True)
    email_verified = models.BooleanField(
        default=False,
        help_text='Whether the email has been verified via OTP',
    )
    full_name = models.CharField(max_length=100)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')
    is_working_student = models.BooleanField(
        default=False,
        help_text='Grants working-student desk access while keeping the base student account.',
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return f"{self.username} - {self.full_name}"

    def save(self, *args, **kwargs):
        self.username = (self.username or '').strip()
        self.student_id = (self.student_id or '').strip().upper() or None
        self.staff_id = (self.staff_id or '').strip().upper() or None
        self.email = (self.email or '').strip().lower() or None
        self.full_name = (self.full_name or '').strip()
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        self.username = (self.username or '').strip()
        self.student_id = (self.student_id or '').strip().upper() or None
        self.staff_id = (self.staff_id or '').strip().upper() or None
        self.email = (self.email or '').strip().lower() or None
        self.full_name = (self.full_name or '').strip()
        if self.role == 'WORKING':
            self.is_working_student = True
        if self.is_working_student and self.role not in {'STUDENT', 'WORKING'}:
            raise ValidationError({'is_working_student': 'Only student accounts can be marked as working students.'})
        if self.role in {'LIBRARIAN', 'STAFF', 'TEACHER'} and not self.staff_id:
            raise ValidationError({'staff_id': 'Staff ID is required for librarian/staff/teacher accounts.'})
        if self.role in {'STUDENT', 'WORKING'} and not self.student_id:
            raise ValidationError({'student_id': 'Student ID is required for student accounts.'})

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        constraints = [
            models.UniqueConstraint(
                Lower('email'),
                condition=Q(email__isnull=False),
                name='user_email_ci_unique',
            ),
        ]

    def get_unpaid_fines_total(self) -> Decimal:
        """
        Sum of all unpaid fine payments linked to this user.
        Uses import laziness to avoid model circular imports.
        """
        from books.models import FinePayment

        total = FinePayment.objects.filter(
            borrow_request__user=self,
            status=FinePayment.STATUS_PENDING,
        ).aggregate(total=models.Sum('amount')).get('total')
        if total is None:
            return Decimal('0.00')
        return Decimal(total).quantize(Decimal('0.01'))

    def has_excess_unpaid_fines(self, limit_amount: Decimal) -> bool:
        return self.get_unpaid_fines_total() > Decimal(str(limit_amount))

    def get_unread_notifications_count(self) -> int:
        return self.notifications.filter(is_read=False).count()

    def can_review_book(self, book_id: int) -> bool:
        """
        Check if user can review a book.
        User must have returned the book at least once to review it.
        """
        from books.models import BorrowRequest
        return BorrowRequest.objects.filter(
            user=self,
            book_id=book_id,
            status=BorrowRequest.STATUS_RETURNED,
        ).exists()

    def has_working_student_access(self) -> bool:
        return self.role == 'WORKING' or (self.role == 'STUDENT' and self.is_working_student)

    def has_staff_desk_access(self) -> bool:
        return self.role in {'STAFF', 'ADMIN'} or self.has_working_student_access()


class EnrollmentRecord(models.Model):
    student_id = models.CharField(
        max_length=20,
        unique=True,
        help_text='Official student ID from the enrollment list.',
    )
    full_name = models.CharField(max_length=100, blank=True)
    school_email = models.EmailField(blank=True)
    program = models.CharField(max_length=120, blank=True)
    year_level = models.CharField(max_length=40, blank=True)
    academic_term = models.CharField(max_length=80, blank=True)
    is_currently_enrolled = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['student_id']
        verbose_name = 'Enrollment record'
        verbose_name_plural = 'Enrollment records'

    def __str__(self) -> str:
        return f"{self.student_id} - {self.full_name or 'Enrollment record'}"

    def save(self, *args, **kwargs):
        self.student_id = (self.student_id or '').strip().upper()
        self.full_name = (self.full_name or '').strip()
        self.school_email = (self.school_email or '').strip().lower()
        self.program = (self.program or '').strip()
        self.year_level = (self.year_level or '').strip()
        self.academic_term = (self.academic_term or '').strip()
        super().save(*args, **kwargs)


class PasswordResetCode(models.Model):
    """
    Short-lived reset code sent to a user's email address.
    This is intentionally simple for local/dev use.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_codes')
    email = models.EmailField()
    code = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(blank=True, null=True)
    attempt_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Reset code for {self.user_id} at {self.created_at.isoformat()}"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        ttl_minutes = getattr(settings, 'PASSWORD_RESET_CODE_TTL_MINUTES', 15)
        expires_at = self.created_at + timedelta(minutes=ttl_minutes)
        return timezone.now() > expires_at

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])

    def set_code(self, raw_code: str) -> None:
        self.code = make_password(raw_code)

    def matches(self, raw_code: str) -> bool:
        if not raw_code:
            return False
        return self.code == raw_code or check_password(raw_code, self.code)


class ContactMessage(models.Model):
    """Stores contact form submissions."""

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='contact_messages')
    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.name} ({self.email})"


class Notification(models.Model):
    TYPE_BORROW_APPROVED = 'BORROW_APPROVED'
    TYPE_BORROW_REJECTED = 'BORROW_REJECTED'
    TYPE_RETURN_APPROVED = 'RETURN_APPROVED'
    TYPE_RETURN_REJECTED = 'RETURN_REJECTED'
    TYPE_RENEWAL_REQUEST_SUBMITTED = 'RENEWAL_REQUEST_SUBMITTED'
    TYPE_RENEWAL_REQUEST_REJECTED = 'RENEWAL_REQUEST_REJECTED'
    TYPE_RENEWAL_SUCCESS = 'RENEWAL_SUCCESS'
    TYPE_REPORT_SUBMITTED = 'REPORT_SUBMITTED'
    TYPE_FINE_CREATED = 'FINE_CREATED'
    TYPE_FINE_PAID = 'FINE_PAID'
    TYPE_FINE_WAIVED = 'FINE_WAIVED'
    TYPE_RESERVATION_CREATED = 'RESERVATION_CREATED'
    TYPE_RESERVATION_AVAILABLE = 'RESERVATION_AVAILABLE'
    TYPE_RESERVATION_EXPIRED = 'RESERVATION_EXPIRED'
    TYPE_RESERVATION_CANCELLED = 'RESERVATION_CANCELLED'
    TYPE_DUE_SOON = 'DUE_SOON'

    TYPE_CHOICES = (
        (TYPE_BORROW_APPROVED, 'Borrow approved'),
        (TYPE_BORROW_REJECTED, 'Borrow rejected'),
        (TYPE_RETURN_APPROVED, 'Return approved'),
        (TYPE_RETURN_REJECTED, 'Return rejected'),
        (TYPE_RENEWAL_REQUEST_SUBMITTED, 'Renewal request submitted'),
        (TYPE_RENEWAL_REQUEST_REJECTED, 'Renewal request rejected'),
        (TYPE_RENEWAL_SUCCESS, 'Renewal success'),
        (TYPE_REPORT_SUBMITTED, 'Report submitted'),
        (TYPE_FINE_CREATED, 'Fine created'),
        (TYPE_FINE_PAID, 'Fine paid'),
        (TYPE_FINE_WAIVED, 'Fine waived'),
        (TYPE_RESERVATION_CREATED, 'Reservation created'),
        (TYPE_RESERVATION_AVAILABLE, 'Reservation available'),
        (TYPE_RESERVATION_EXPIRED, 'Reservation expired'),
        (TYPE_RESERVATION_CANCELLED, 'Reservation cancelled'),
        (TYPE_DUE_SOON, 'Due soon'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    title = models.CharField(max_length=160)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def mark_read(self):
        if self.is_read:
            return
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_at'])

    def __str__(self):
        return f"{self.user_id} - {self.notification_type}"


class EmailVerificationCode(models.Model):
    """
    Email verification code for registration.
    """
    email = models.EmailField()
    code = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(blank=True, null=True)
    attempt_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Verification code for {self.email} at {self.created_at.isoformat()}"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        ttl_minutes = getattr(settings, 'EMAIL_VERIFICATION_CODE_TTL_MINUTES', 15)
        expires_at = self.created_at + timedelta(minutes=ttl_minutes)
        return timezone.now() > expires_at

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])

    def set_code(self, raw_code: str) -> None:
        self.code = make_password(raw_code)

    def matches(self, raw_code: str) -> bool:
        if not raw_code:
            return False
        return self.code == raw_code or check_password(raw_code, self.code)


class LoginOTPCode(models.Model):
    """
    Short-lived OTP code sent to a user's email address during login.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_otp_codes')
    email = models.EmailField()
    code = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(blank=True, null=True)
    attempt_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Login OTP for {self.user_id} at {self.created_at.isoformat()}"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        ttl_minutes = getattr(settings, 'LOGIN_OTP_CODE_TTL_MINUTES', 15)
        expires_at = self.created_at + timedelta(minutes=ttl_minutes)
        return timezone.now() > expires_at

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])

    def set_code(self, raw_code: str) -> None:
        self.code = make_password(raw_code)

    def matches(self, raw_code: str) -> bool:
        if not raw_code:
            return False
        return self.code == raw_code or check_password(raw_code, self.code)
