import uuid
from decimal import Decimal
from datetime import timedelta
import logging

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils.html import escape
from django.utils import timezone

from backend.email_bridge import send_application_email
from backend.notification_utils import (
    create_user_notification,
    notify_librarian_dashboard,
)

logger = logging.getLogger(__name__)


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=100)
    isbn = models.CharField(max_length=13, unique=True)
    published_date = models.DateField()
    genre = models.CharField(max_length=50)
    description = models.TextField(blank=True, default='')
    language = models.CharField(max_length=50, blank=True, default='')
    grade_level = models.CharField(max_length=50, blank=True, default='')
    location_shelf = models.CharField(max_length=100, blank=True, default='')
    categories = models.ManyToManyField(
        Category,
        related_name='books',
        blank=True,
    )
    cover_image = models.ImageField(upload_to='book_covers/', blank=True, null=True)
    cover_back = models.ImageField(upload_to='book_covers/', blank=True, null=True)
    copies_available = models.PositiveIntegerField(default=0)
    available = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        update_book_availability(self.pk)

    def __str__(self):
        return self.title

    @property
    def average_rating(self):
        """Calculate average rating from all reviews."""
        from django.db.models import Avg
        result = self.reviews.aggregate(avg=Avg('rating'))
        return round(result['avg'], 1) if result['avg'] else 0

    @property
    def review_count(self):
        """Get total number of reviews."""
        return self.reviews.count()


class BookCopy(models.Model):
    STATUS_AVAILABLE = 'AVAILABLE'
    STATUS_BORROWED = 'BORROWED'
    STATUS_MAINTENANCE = 'MAINTENANCE'
    STATUS_CHOICES = (
        (STATUS_AVAILABLE, 'Available'),
        (STATUS_BORROWED, 'Borrowed'),
        (STATUS_MAINTENANCE, 'Maintenance'),
    )

    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='copies',
    )
    barcode = models.CharField(max_length=50, unique=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    location_room = models.CharField(max_length=100, blank=True, default='')
    location_shelf = models.CharField(max_length=100, blank=True, default='')
    is_reference_only = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['barcode', 'id']

    def save(self, *args, **kwargs):
        if not self.barcode:
            super().save(*args, **kwargs)
            self.barcode = f"{self.book.isbn}-{self.pk:04d}"
            BookCopy.objects.filter(pk=self.pk).update(barcode=self.barcode)
            return
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.book.title} ({self.barcode})"


class BorrowRequest(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_RETURNED = 'RETURNED'
    REPORT_NONE = 'NONE'
    REPORT_WEEKLY = 'WEEKLY'
    REPORT_MONTHLY = 'MONTHLY'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_RETURNED, 'Returned'),
    )
    REPORTING_FREQUENCY_CHOICES = (
        (REPORT_NONE, 'No reporting'),
        (REPORT_WEEKLY, 'Weekly'),
        (REPORT_MONTHLY, 'Monthly'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='borrow_requests',
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='borrow_requests',
    )
    copy = models.ForeignKey(
        'BookCopy',
        on_delete=models.SET_NULL,
        related_name='borrow_requests',
        blank=True,
        null=True,
    )
    receipt_number = models.CharField(max_length=32, unique=True, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    late_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    due_soon_reminder_sent_at = models.DateTimeField(blank=True, null=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='processed_borrow_requests',
        blank=True,
        null=True,
    )
    renewal_count = models.PositiveIntegerField(default=0)
    max_renewals = models.PositiveIntegerField(default=2)
    last_renewed_at = models.DateTimeField(blank=True, null=True)
    requested_borrow_days = models.PositiveIntegerField(default=14)
    reporting_frequency = models.CharField(
        max_length=10,
        choices=REPORTING_FREQUENCY_CHOICES,
        default=REPORT_NONE,
    )
    last_reported_at = models.DateTimeField(blank=True, null=True)
    next_report_due_date = models.DateField(blank=True, null=True)

    class Meta:
        ordering = ['-requested_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'book'],
                condition=Q(status='PENDING'),
                name='unique_pending_borrow_request',
            ),
        ]

    def ensure_receipt_number(self):
        if self.receipt_number:
            return
        for _ in range(5):
            candidate = f"BRW-{uuid.uuid4().hex[:12].upper()}"
            if not self.__class__.objects.filter(receipt_number=candidate).exists():
                self.receipt_number = candidate
                return
        self.receipt_number = f"BRW-{uuid.uuid4().hex.upper()}"

    @staticmethod
    def get_late_fee_per_day() -> Decimal:
        raw = getattr(settings, 'LATE_FEE_PER_DAY', Decimal('5.00'))
        try:
            return Decimal(str(raw)).quantize(Decimal('0.01'))
        except Exception:
            return Decimal('0.00')

    @staticmethod
    def get_due_soon_reminder_days() -> int:
        raw = getattr(settings, 'DUE_SOON_REMINDER_DAYS', 2)
        try:
            return max(int(raw), 0)
        except (TypeError, ValueError):
            return 2

    @staticmethod
    def get_renewal_duration_days() -> int:
        fallback = getattr(settings, 'BORROW_DURATION_DAYS', 14)
        raw = getattr(settings, 'RENEWAL_DURATION_DAYS', fallback)
        try:
            return max(int(raw), 1)
        except (TypeError, ValueError):
            try:
                return max(int(fallback), 1)
            except (TypeError, ValueError):
                return 14

    @staticmethod
    def get_default_max_renewals() -> int:
        raw = getattr(settings, 'MAX_RENEWALS_PER_BORROW', 2)
        try:
            return max(int(raw), 0)
        except (TypeError, ValueError):
            return 2

    @staticmethod
    def get_library_portal_url() -> str:
        base_url = getattr(settings, 'LIBRARY_WEB_URL', '').strip() or 'http://localhost:3000'
        return base_url.rstrip('/')

    def get_overdue_days(self, as_of=None) -> int:
        if self.status != self.STATUS_APPROVED or not self.due_date:
            return 0
        as_of_date = as_of or timezone.localdate()
        return max((as_of_date - self.due_date).days, 0)

    def calculate_late_fee_amount(self, as_of=None) -> Decimal:
        if self.status != self.STATUS_APPROVED or not self.due_date:
            # For non-active borrows, keep existing persisted fee.
            return (self.late_fee_amount or Decimal('0.00')).quantize(Decimal('0.01'))
        overdue_days = self.get_overdue_days(as_of=as_of)
        return (self.get_late_fee_per_day() * Decimal(overdue_days)).quantize(Decimal('0.01'))

    def refresh_late_fee(self, as_of=None, commit=True) -> Decimal:
        calculated = self.calculate_late_fee_amount(as_of=as_of)
        if self.late_fee_amount != calculated:
            self.late_fee_amount = calculated
            if commit:
                self.save(update_fields=['late_fee_amount'])
        return calculated

    def get_settled_fine_total(self) -> Decimal:
        total = self.fine_payments.exclude(status=FinePayment.STATUS_PENDING).aggregate(
            total=Sum('amount')
        ).get('total')
        if total is None:
            return Decimal('0.00')
        return Decimal(total).quantize(Decimal('0.01'))

    def sync_pending_fine_payment(self, as_of=None):
        current_total = self.calculate_late_fee_amount(as_of=as_of)
        settled_total = self.get_settled_fine_total()
        outstanding = (current_total - settled_total).quantize(Decimal('0.01'))
        if outstanding < Decimal('0.00'):
            outstanding = Decimal('0.00')

        pending_payments = list(
            self.fine_payments.filter(status=FinePayment.STATUS_PENDING).order_by('created_at', 'pk')
        )
        primary_pending = pending_payments[0] if pending_payments else None

        if outstanding == Decimal('0.00'):
            if pending_payments:
                self.fine_payments.filter(status=FinePayment.STATUS_PENDING).delete()
            return None

        if primary_pending:
            if primary_pending.amount != outstanding:
                primary_pending.amount = outstanding
                primary_pending.save(update_fields=['amount'])
            if len(pending_payments) > 1:
                self.fine_payments.filter(status=FinePayment.STATUS_PENDING).exclude(pk=primary_pending.pk).delete()
            return primary_pending

        fine_payment = FinePayment.objects.create(
            borrow_request=self,
            amount=outstanding,
            status=FinePayment.STATUS_PENDING,
        )
        create_user_notification(
            user_id=self.user_id,
            notification_type='FINE_CREATED',
            title='Late fee added',
            message=(
                f"A late fee of {fine_payment.amount} was added for "
                f"'{self.book.title}'."
            ),
            data={
                'fine_payment_id': fine_payment.pk,
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
            },
        )
        return fine_payment

    def get_pending_return_request(self):
        prefetched = getattr(self, '_prefetched_objects_cache', {}).get('return_requests')
        if prefetched is not None:
            for return_request in prefetched:
                if return_request.status == ReturnRequest.STATUS_PENDING:
                    return return_request
            return None
        return self.return_requests.filter(status=ReturnRequest.STATUS_PENDING).order_by('-requested_at').first()

    def get_pending_renewal_request(self):
        prefetched = getattr(self, '_prefetched_objects_cache', {}).get('renewal_requests')
        if prefetched is not None:
            for renewal_request in prefetched:
                if renewal_request.status == RenewalRequest.STATUS_PENDING:
                    return renewal_request
            return None
        return self.renewal_requests.filter(status=RenewalRequest.STATUS_PENDING).order_by('-requested_at').first()

    def get_renewal_block_reason(self, *, ignore_pending_request: bool = False) -> str | None:
        if self.is_teacher_borrow():
            return 'Teacher borrows cannot be renewed.'
        if self.status != self.STATUS_APPROVED:
            return 'Only approved borrows can be renewed.'
        if self.renewal_count >= self.max_renewals:
            return 'Renewal limit reached.'
        if not self.due_date:
            return 'This borrow has no due date to extend.'
        if self.get_overdue_days() > 0:
            return 'Overdue books cannot be renewed.'
        if self.get_pending_return_request():
            return 'A return request is already pending for this book.'
        if not ignore_pending_request and self.get_pending_renewal_request():
            return 'A renewal request is already pending for this book.'
        if Reservation.objects.filter(
            book_id=self.book_id,
            status=Reservation.STATUS_PENDING,
        ).exclude(user_id=self.user_id).exists():
            return 'This book already has a pending reservation.'
        return None

    def can_renew(self, *, ignore_pending_request: bool = False) -> bool:
        return self.get_renewal_block_reason(ignore_pending_request=ignore_pending_request) is None

    def get_remaining_renewals(self) -> int:
        return max((self.max_renewals or 0) - (self.renewal_count or 0), 0)

    def renew(self, renewal_days: int | None = None, *, ignore_pending_request: bool = False):
        reason = self.get_renewal_block_reason(ignore_pending_request=ignore_pending_request)
        if reason:
            raise ValueError(reason)

        extension_days = renewal_days or self.get_renewal_duration_days()
        self.due_date = self.due_date + timedelta(days=extension_days)
        self.renewal_count += 1
        self.last_renewed_at = timezone.now()
        self.due_soon_reminder_sent_at = None
        self.late_fee_amount = Decimal('0.00')
        self.save(
            update_fields=[
                'due_date',
                'renewal_count',
                'last_renewed_at',
                'due_soon_reminder_sent_at',
                'late_fee_amount',
            ]
        )
        create_user_notification(
            user_id=self.user_id,
            notification_type='RENEWAL_SUCCESS',
            title='Book renewed',
            message=f"'{self.book.title}' has been renewed until {self.due_date}.",
            data={
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
                'due_date': str(self.due_date),
                'renewal_count': self.renewal_count,
            },
        )
        return self

    @staticmethod
    def get_reporting_interval_days(frequency: str) -> int | None:
        return {
            BorrowRequest.REPORT_WEEKLY: 7,
            BorrowRequest.REPORT_MONTHLY: 30,
        }.get(frequency)

    def is_teacher_borrow(self) -> bool:
        return getattr(self.user, 'role', None) == 'TEACHER'

    def requires_periodic_reporting(self) -> bool:
        return bool(
            self.is_teacher_borrow()
            and self.status == self.STATUS_APPROVED
            and self.get_reporting_interval_days(self.reporting_frequency)
        )

    def update_next_report_due_date(self, reference_dt=None):
        if not self.requires_periodic_reporting():
            self.next_report_due_date = None
            return None

        interval_days = self.get_reporting_interval_days(self.reporting_frequency)
        anchor = reference_dt or self.last_reported_at or self.processed_at or timezone.now()
        anchor_date = anchor.date() if hasattr(anchor, 'date') else anchor
        self.next_report_due_date = anchor_date + timedelta(days=interval_days)
        return self.next_report_due_date

    def is_report_due(self, as_of=None) -> bool:
        if not self.requires_periodic_reporting() or not self.next_report_due_date:
            return False
        as_of_date = as_of or timezone.localdate()
        return self.next_report_due_date <= as_of_date

    def get_report_overdue_days(self, as_of=None) -> int:
        if not self.requires_periodic_reporting() or not self.next_report_due_date:
            return 0
        as_of_date = as_of or timezone.localdate()
        return max((as_of_date - self.next_report_due_date).days, 0)

    def submit_report(self):
        if self.status != self.STATUS_APPROVED:
            raise ValueError('Only approved borrows can be reported.')
        if not self.is_teacher_borrow():
            raise ValueError('Only teacher borrows can submit periodic reports.')
        if self.reporting_frequency not in {self.REPORT_WEEKLY, self.REPORT_MONTHLY}:
            raise ValueError('This borrow does not have a reporting schedule.')

        self.last_reported_at = timezone.now()
        self.update_next_report_due_date(reference_dt=self.last_reported_at)
        self.save(update_fields=['last_reported_at', 'next_report_due_date'])
        create_user_notification(
            user_id=self.user_id,
            notification_type='REPORT_SUBMITTED',
            title='Borrow report submitted',
            message=(
                f"Your {self.get_reporting_frequency_display().lower()} report for "
                f"'{self.book.title}' has been recorded."
            ),
            data={
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
                'reporting_frequency': self.reporting_frequency,
                'last_reported_at': self.last_reported_at.isoformat(),
                'next_report_due_date': (
                    str(self.next_report_due_date) if self.next_report_due_date else None
                ),
            },
        )
        reporter_name = self.user.full_name or self.user.username
        notify_librarian_dashboard(
            notification_type='REPORT_SUBMITTED',
            title='Student report submitted',
            message=(
                f"{reporter_name} submitted a "
                f"{self.get_reporting_frequency_display().lower()} report for "
                f"'{self.book.title}'."
            ),
            data={
                'portal': 'librarian',
                'dashboard_section': 'desk-notifications',
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
                'user_id': self.user_id,
                'reporting_frequency': self.reporting_frequency,
                'last_reported_at': self.last_reported_at.isoformat(),
                'next_report_due_date': (
                    str(self.next_report_due_date) if self.next_report_due_date else None
                ),
            },
            dedupe=False,
        )
        return self

    def should_send_due_soon_reminder(self, as_of=None) -> bool:
        if self.status != self.STATUS_APPROVED or not self.due_date:
            return False
        if self.due_soon_reminder_sent_at:
            return False
        recipient = getattr(self.user, 'email', None)
        if not recipient:
            return False
        as_of_date = as_of or timezone.localdate()
        reminder_days = self.get_due_soon_reminder_days()
        return self.due_date == (as_of_date + timedelta(days=reminder_days))

    def send_due_soon_reminder(self, as_of=None) -> bool:
        if not self.should_send_due_soon_reminder(as_of=as_of):
            return False

        recipient = self.user.email
        if not recipient:
            return False

        reminder_days = self.get_due_soon_reminder_days()
        late_fee_per_day = self.get_late_fee_per_day()
        due_date_label = self.due_date.strftime('%B %d, %Y')
        my_books_url = f"{self.get_library_portal_url()}/my-books"

        subject = f"Reminder: return '{self.book.title}' by {due_date_label}"
        body = (
            f"Hi {self.user.full_name or self.user.username},\n\n"
            f"This is a reminder that '{self.book.title}' is due on {due_date_label}.\n"
            f"Please return or renew it on time to avoid late fees.\n\n"
            f"Open your library account here: {my_books_url}\n\n"
            f"Late fee rate: {late_fee_per_day} per day overdue.\n"
            "If you already requested a return, you can ignore this reminder.\n\n"
            "SCSIT Library System"
        )
        html_body = f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
              <h2 style="margin-bottom: 12px;">Book Return Reminder</h2>
              <p>Hi {escape(self.user.full_name or self.user.username)},</p>
              <p>
                This is a reminder that <strong>{escape(self.book.title)}</strong> is due on
                <strong>{escape(due_date_label)}</strong>.
              </p>
              <p>Please return or renew it on time to avoid late fees.</p>
              <p>
                <a
                  href="{my_books_url}"
                  style="display: inline-block; padding: 12px 18px; background: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;"
                >
                  Open My Books
                </a>
              </p>
              <p>Late fee rate: <strong>{escape(str(late_fee_per_day))}</strong> per day overdue.</p>
              <p>If you already requested a return, you can ignore this reminder.</p>
              <p>SCSIT Library System</p>
            </div>
        """

        send_application_email(
            to=[recipient],
            subject=subject,
            text=body,
            html=html_body,
            fail_silently=False,
        )
        self.due_soon_reminder_sent_at = timezone.now()
        self.save(update_fields=['due_soon_reminder_sent_at'])
        create_user_notification(
            user_id=self.user_id,
            notification_type='DUE_SOON',
            title='Book due soon',
            message=f"'{self.book.title}' is due on {self.due_date}.",
            data={
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
                'due_date': str(self.due_date),
            },
        )
        return True

    def approve(self, processed_by=None):
        from django.db import transaction

        if self.status != self.STATUS_PENDING:
            raise ValueError('Only pending requests can be approved.')

        with transaction.atomic():
            book = Book.objects.select_for_update().get(pk=self.book_id)
            if not self.user.is_active:
                raise ValueError('User account is inactive.')

            max_active = getattr(settings, 'MAX_ACTIVE_BORROWS', 3)
            active_borrows = BorrowRequest.objects.select_for_update().filter(
                user=self.user,
                status=self.STATUS_APPROVED,
            ).count()
            if active_borrows >= max_active:
                raise ValueError('User has reached the borrow limit.')

            copy = BookCopy.objects.select_for_update().filter(
                book=book,
                status=BookCopy.STATUS_AVAILABLE,
                is_reference_only=False,
            ).order_by('id').first()
            if not copy:
                raise ValueError('No copies available for borrowing.')

            existing_approved = BorrowRequest.objects.filter(
                user=self.user,
                book=book,
                status=self.STATUS_APPROVED,
            ).exists()
            if existing_approved:
                raise ValueError('User already has an approved request for this book.')

            copy.status = BookCopy.STATUS_BORROWED
            copy.save(update_fields=['status'])

            self.status = self.STATUS_APPROVED
            self.copy = copy
            self.processed_at = timezone.now()
            self.processed_by = processed_by
            self.ensure_receipt_number()
            if self.is_teacher_borrow():
                if self.reporting_frequency not in {self.REPORT_WEEKLY, self.REPORT_MONTHLY}:
                    self.reporting_frequency = self.REPORT_MONTHLY
                self.due_date = None
                self.max_renewals = 0
                self.update_next_report_due_date(reference_dt=self.processed_at)
            elif not self.due_date:
                borrow_days = self.requested_borrow_days or getattr(settings, 'BORROW_DURATION_DAYS', 14)
                self.due_date = self.processed_at.date() + timedelta(days=borrow_days)
            self.late_fee_amount = Decimal('0.00')
            self.due_soon_reminder_sent_at = None
            self.save(
                update_fields=[
                    'status',
                    'processed_at',
                    'processed_by',
                    'copy',
                    'receipt_number',
                    'due_date',
                    'late_fee_amount',
                    'due_soon_reminder_sent_at',
                    'max_renewals',
                    'reporting_frequency',
                    'next_report_due_date',
                ]
            )

        create_user_notification(
            user_id=self.user_id,
            notification_type='BORROW_APPROVED',
            title='Borrow request approved',
            message=f"Your request for '{self.book.title}' has been approved.",
            data={
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
                'due_date': str(self.due_date) if self.due_date else None,
                'receipt_number': self.receipt_number,
            },
        )

        return self

    def reject(self, processed_by=None):
        if self.status != self.STATUS_PENDING:
            raise ValueError('Only pending requests can be rejected.')

        self.status = self.STATUS_REJECTED
        self.processed_at = timezone.now()
        self.processed_by = processed_by
        self.save(update_fields=['status', 'processed_at', 'processed_by'])
        create_user_notification(
            user_id=self.user_id,
            notification_type='BORROW_REJECTED',
            title='Borrow request rejected',
            message=f"Your request for '{self.book.title}' was not approved.",
            data={
                'borrow_request_id': self.pk,
                'book_id': self.book_id,
            },
        )

    def __str__(self):
        return f"{self.user} -> {self.book} ({self.status})"


class BorrowedBook(BorrowRequest):
    class Meta:
        proxy = True
        verbose_name = 'Borrowed book'
        verbose_name_plural = 'Borrowed books'


class ReturnRequest(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    )

    borrow_request = models.ForeignKey(
        BorrowRequest,
        on_delete=models.CASCADE,
        related_name='return_requests',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='processed_return_requests',
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ['-requested_at']
        constraints = [
            models.UniqueConstraint(
                fields=['borrow_request'],
                condition=Q(status='PENDING'),
                name='unique_pending_return_request',
            ),
        ]

    def approve(self, processed_by=None):
        from django.db import transaction

        if self.status != self.STATUS_PENDING:
            raise ValueError('Only pending return requests can be approved.')

        with transaction.atomic():
            borrow_request = BorrowRequest.objects.select_for_update().get(pk=self.borrow_request_id)
            if borrow_request.status != BorrowRequest.STATUS_APPROVED:
                raise ValueError('Borrow request is not active.')

            copy = borrow_request.copy
            if not copy:
                raise ValueError('No copy assigned to this borrow request.')
            copy.status = BookCopy.STATUS_AVAILABLE
            copy.save(update_fields=['status'])

            # Freeze fee amount at return approval time.
            borrow_request.refresh_late_fee(as_of=timezone.localdate(), commit=False)
            borrow_request.status = BorrowRequest.STATUS_RETURNED
            borrow_request.save(update_fields=['status', 'late_fee_amount'])
            borrow_request.sync_pending_fine_payment(as_of=timezone.localdate())

            self.status = self.STATUS_APPROVED
            self.processed_at = timezone.now()
            self.processed_by = processed_by
            self.save(update_fields=['status', 'processed_at', 'processed_by'])

            notified_reservation = notify_next_pending_reservation(borrow_request.book)

        create_user_notification(
            user_id=borrow_request.user_id,
            notification_type='RETURN_APPROVED',
            title='Return approved',
            message=f"Your return for '{borrow_request.book.title}' has been processed.",
            data={
                'borrow_request_id': borrow_request.pk,
                'book_id': borrow_request.book_id,
                'return_request_id': self.pk,
            },
        )
        if notified_reservation:
            logger.info(
                'Notified reservation_id=%s for book_id=%s after return approval',
                notified_reservation.pk,
                borrow_request.book_id,
            )
        return self

    def reject(self, processed_by=None):
        if self.status != self.STATUS_PENDING:
            raise ValueError('Only pending return requests can be rejected.')

        self.status = self.STATUS_REJECTED
        self.processed_at = timezone.now()
        self.processed_by = processed_by
        self.save(update_fields=['status', 'processed_at', 'processed_by'])
        create_user_notification(
            user_id=self.borrow_request.user_id,
            notification_type='RETURN_REJECTED',
            title='Return request rejected',
            message=f"Your return request for '{self.borrow_request.book.title}' was rejected.",
            data={
                'borrow_request_id': self.borrow_request_id,
                'book_id': self.borrow_request.book_id,
                'return_request_id': self.pk,
            },
        )

    def __str__(self):
        return f"{self.borrow_request} return ({self.status})"


class RenewalRequest(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    )

    borrow_request = models.ForeignKey(
        BorrowRequest,
        on_delete=models.CASCADE,
        related_name='renewal_requests',
    )
    requested_extension_days = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='processed_renewal_requests',
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ['-requested_at']
        constraints = [
            models.UniqueConstraint(
                fields=['borrow_request'],
                condition=Q(status='PENDING'),
                name='unique_pending_renewal_request',
            ),
        ]

    def approve(self, processed_by=None):
        from django.db import transaction

        with transaction.atomic():
            locked_request = RenewalRequest.objects.select_for_update().get(pk=self.pk)
            if locked_request.status != self.STATUS_PENDING:
                raise ValueError('Only pending renewal requests can be approved.')

            borrow_request = BorrowRequest.objects.select_for_update().get(pk=locked_request.borrow_request_id)
            extension_days = (
                locked_request.requested_extension_days or borrow_request.get_renewal_duration_days()
            )
            borrow_request.renew(
                renewal_days=extension_days,
                ignore_pending_request=True,
            )

            locked_request.status = self.STATUS_APPROVED
            locked_request.processed_at = timezone.now()
            locked_request.processed_by = processed_by
            locked_request.save(update_fields=['status', 'processed_at', 'processed_by'])

            self.status = locked_request.status
            self.processed_at = locked_request.processed_at
            self.processed_by = locked_request.processed_by

        return self

    def reject(self, processed_by=None):
        from django.db import transaction

        with transaction.atomic():
            locked_request = RenewalRequest.objects.select_for_update().get(pk=self.pk)
            if locked_request.status != self.STATUS_PENDING:
                raise ValueError('Only pending renewal requests can be rejected.')

            locked_request.status = self.STATUS_REJECTED
            locked_request.processed_at = timezone.now()
            locked_request.processed_by = processed_by
            locked_request.save(update_fields=['status', 'processed_at', 'processed_by'])

            self.status = locked_request.status
            self.processed_at = locked_request.processed_at
            self.processed_by = locked_request.processed_by
        create_user_notification(
            user_id=self.borrow_request.user_id,
            notification_type='RENEWAL_REQUEST_REJECTED',
            title='Renewal request rejected',
            message=f"Your renewal request for '{self.borrow_request.book.title}' was rejected.",
            data={
                'borrow_request_id': self.borrow_request_id,
                'book_id': self.borrow_request.book_id,
                'renewal_request_id': self.pk,
            },
        )
        return self

    def __str__(self):
        return f"{self.borrow_request} renewal ({self.status})"


def update_book_availability(book_id):
    if not book_id:
        return
    counts = BookCopy.objects.filter(book_id=book_id).aggregate(
        total=models.Count('id'),
        available=models.Count(
            'id',
            filter=Q(
                status=BookCopy.STATUS_AVAILABLE,
                is_reference_only=False,
            ),
        ),
    )
    available_count = counts.get('available') or 0
    Book.objects.filter(pk=book_id).update(
        copies_available=available_count,
        available=available_count > 0,
    )


class FinePayment(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_PAID = 'PAID'
    STATUS_WAIVED = 'WAIVED'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_PAID, 'Paid'),
        (STATUS_WAIVED, 'Waived'),
    )

    borrow_request = models.ForeignKey(BorrowRequest, on_delete=models.CASCADE, related_name='fine_payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    payment_method = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='processed_payments',
        blank=True,
        null=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def mark_paid(self, processed_by=None, payment_method='', reference=''):
        self.status = self.STATUS_PAID
        self.paid_at = timezone.now()
        self.processed_by = processed_by
        self.payment_method = payment_method
        self.payment_reference = reference
        self.save()
        self.borrow_request.sync_pending_fine_payment(as_of=timezone.localdate())
        create_user_notification(
            user_id=self.borrow_request.user_id,
            notification_type='FINE_PAID',
            title='Fine payment recorded',
            message=(
                f"Payment received for fine on '{self.borrow_request.book.title}'."
            ),
            data={
                'fine_payment_id': self.pk,
                'borrow_request_id': self.borrow_request_id,
                'book_id': self.borrow_request.book_id,
            },
        )

    def mark_waived(self, processed_by=None, notes=''):
        self.status = self.STATUS_WAIVED
        self.paid_at = timezone.now()
        self.processed_by = processed_by
        if notes:
            self.notes = notes
        self.save()
        self.borrow_request.sync_pending_fine_payment(as_of=timezone.localdate())
        create_user_notification(
            user_id=self.borrow_request.user_id,
            notification_type='FINE_WAIVED',
            title='Fine waived',
            message=f"Fine for '{self.borrow_request.book.title}' has been waived.",
            data={
                'fine_payment_id': self.pk,
                'borrow_request_id': self.borrow_request_id,
                'book_id': self.borrow_request.book_id,
            },
        )

    def __str__(self):
        return f"Fine PHP {self.amount} for {self.borrow_request}"


class Reservation(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_NOTIFIED = 'NOTIFIED'
    STATUS_FULFILLED = 'FULFILLED'
    STATUS_CANCELLED = 'CANCELLED'
    STATUS_EXPIRED = 'EXPIRED'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_NOTIFIED, 'Notified'),
        (STATUS_FULFILLED, 'Fulfilled'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_EXPIRED, 'Expired'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations')
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='reservations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    notified_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'book'],
                condition=Q(status='PENDING'),
                name='unique_pending_reservation',
            ),
        ]

    def __str__(self):
        return f"{self.user} reserved {self.book}"


class BookReview(models.Model):
    """
    Book reviews and ratings from students.
    Students can only review books they've returned.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='book_reviews',
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    rating = models.PositiveIntegerField(
        choices=[(i, i) for i in range(1, 6)],  # 1-5 stars
    )
    review_text = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'book'],
                name='unique_user_book_review',
            ),
        ]

    def __str__(self):
        return f"{self.user} - {self.book.title} ({self.rating}★)"


class AutomationCheckpoint(models.Model):
    key = models.CharField(max_length=64, unique=True)
    last_attempted_on = models.DateField(blank=True, null=True)
    last_attempted_at = models.DateTimeField(blank=True, null=True)
    last_run_on = models.DateField(blank=True, null=True)
    last_run_at = models.DateTimeField(blank=True, null=True)
    last_error = models.TextField(blank=True, default='')
    last_stats = models.JSONField(blank=True, default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['key']

    def __str__(self):
        return self.key


def recalculate_pending_reservation_positions(book_id: int) -> None:
    pending = (
        Reservation.objects.select_for_update()
        .filter(book_id=book_id, status=Reservation.STATUS_PENDING)
        .order_by('created_at', 'id')
    )
    for index, reservation in enumerate(pending, start=1):
        if reservation.position != index:
            Reservation.objects.filter(pk=reservation.pk).update(position=index)


def notify_next_pending_reservation(book: Book):
    """
    Move the next pending reservation to NOTIFIED and assign an expiry window.
    Returns the notified reservation instance or None.
    """
    next_pending = (
        Reservation.objects.select_for_update()
        .filter(book=book, status=Reservation.STATUS_PENDING)
        .order_by('created_at', 'id')
        .first()
    )
    if not next_pending:
        return None

    expiry_hours_raw = getattr(settings, 'RESERVATION_NOTIFICATION_HOURS', 48)
    try:
        expiry_hours = max(int(expiry_hours_raw), 1)
    except (TypeError, ValueError):
        expiry_hours = 48

    now = timezone.now()
    next_pending.status = Reservation.STATUS_NOTIFIED
    next_pending.notified_at = now
    next_pending.expires_at = now + timedelta(hours=expiry_hours)
    next_pending.save(update_fields=['status', 'notified_at', 'expires_at'])

    recalculate_pending_reservation_positions(book.id)

    expires_label = next_pending.expires_at.strftime('%Y-%m-%d %H:%M UTC')
    create_user_notification(
        user_id=next_pending.user_id,
        notification_type='RESERVATION_AVAILABLE',
        title='Reserved book available',
        message=(
            f"'{book.title}' is now available for you. "
            f"Please request borrowing before {expires_label}."
        ),
        data={
            'reservation_id': next_pending.pk,
            'book_id': book.id,
            'expires_at': next_pending.expires_at.isoformat(),
        },
    )

    recipient = getattr(next_pending.user, 'email', None)
    if recipient:
        try:
            send_application_email(
                to=[recipient],
                subject=f"Reserved book available: {book.title}",
                text=(
                    f"Hi {next_pending.user.full_name or next_pending.user.username},\n\n"
                    f"Your reserved book '{book.title}' is now available.\n"
                    f"Please borrow it before {expires_label}.\n\n"
                    "SCSIT Library System"
                ),
                fail_silently=True,
            )
        except Exception:
            logger.exception(
                'Failed to send reservation availability email for reservation_id=%s',
                next_pending.pk,
            )

    return next_pending


def notify_librarian_about_overdue_borrow(borrow_request: BorrowRequest) -> None:
    overdue_days = borrow_request.get_overdue_days(as_of=timezone.localdate())
    if overdue_days <= 0:
        return

    due_date_label = borrow_request.due_date.isoformat() if borrow_request.due_date else None
    notify_librarian_dashboard(
        notification_type='OVERDUE_BOOK_ALERT',
        title='Overdue book needs attention',
        message=(
            f"{borrow_request.user.full_name} has '{borrow_request.book.title}' overdue by "
            f"{overdue_days} day{'s' if overdue_days != 1 else ''}."
        ),
        data={
            'portal': 'librarian',
            'dashboard_section': 'desk-overdue',
            'borrow_request_id': borrow_request.pk,
            'book_id': borrow_request.book_id,
            'user_id': borrow_request.user_id,
            'due_date': due_date_label,
            'overdue_days': overdue_days,
        },
    )


def run_borrow_automation(as_of=None, send_reminders=True):
    as_of_date = as_of or timezone.localdate()
    stats = {
        'processed': 0,
        'fees_updated': 0,
        'reminders_sent': 0,
        'reminder_failures': 0,
    }

    queryset = BorrowRequest.objects.select_related('user', 'book').filter(
        status=BorrowRequest.STATUS_APPROVED,
        due_date__isnull=False,
    )
    for borrow_request in queryset.iterator():
        stats['processed'] += 1
        previous_fee = borrow_request.late_fee_amount
        updated_fee = borrow_request.refresh_late_fee(as_of=as_of_date, commit=True)
        borrow_request.sync_pending_fine_payment(as_of=as_of_date)
        if updated_fee != previous_fee:
            stats['fees_updated'] += 1
        if borrow_request.get_overdue_days(as_of=as_of_date) > 0:
            notify_librarian_about_overdue_borrow(borrow_request)

        if send_reminders and borrow_request.should_send_due_soon_reminder(as_of=as_of_date):
            try:
                if borrow_request.send_due_soon_reminder(as_of=as_of_date):
                    stats['reminders_sent'] += 1
            except Exception as exc:
                logger.exception(
                    "Failed due-soon reminder for borrow_request_id=%s: %s",
                    borrow_request.pk,
                    exc,
                )
                stats['reminder_failures'] += 1

    return stats


def sync_overdue_fine_payments(*, user_id: int | None = None, as_of=None) -> int:
    as_of_date = as_of or timezone.localdate()
    queryset = BorrowRequest.objects.select_related('user', 'book').filter(
        status=BorrowRequest.STATUS_APPROVED,
        due_date__isnull=False,
    )
    if user_id is not None:
        queryset = queryset.filter(user_id=user_id)

    synced = 0
    for borrow_request in queryset.iterator():
        borrow_request.refresh_late_fee(as_of=as_of_date, commit=True)
        borrow_request.sync_pending_fine_payment(as_of=as_of_date)
        if borrow_request.get_overdue_days(as_of=as_of_date) > 0:
            notify_librarian_about_overdue_borrow(borrow_request)
        synced += 1
    return synced


@receiver(post_save, sender=BookCopy)
def update_book_availability_on_save(sender, instance, **kwargs):
    update_book_availability(instance.book_id)


@receiver(post_delete, sender=BookCopy)
def update_book_availability_on_delete(sender, instance, **kwargs):
    update_book_availability(instance.book_id)
