from datetime import timedelta
from decimal import Decimal
from django.http import HttpResponse
from django.test import RequestFactory

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from books.models import (
    AutomationCheckpoint,
    Book,
    BookCopy,
    BookReview,
    BorrowRequest,
    Category,
    FinePayment,
    RenewalRequest,
    Reservation,
    ReturnRequest,
    run_borrow_automation,
)
from books.middleware import DailyBorrowAutomationMiddleware
from user.models import Notification


class BorrowAutomationTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='student1',
            password='test-pass-123',
            full_name='Student One',
            student_id='S-1001',
            email='student1@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Automation Testing',
            author='QA Bot',
            isbn='9781234567890',
            published_date=timezone.localdate(),
            genre='Education',
        )

    @override_settings(LATE_FEE_PER_DAY=5.00)
    def test_calculate_late_fee_amount_for_overdue_approved_request(self):
        today = timezone.localdate()
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today - timedelta(days=3),
        )

        self.assertEqual(borrow.get_overdue_days(as_of=today), 3)
        self.assertEqual(borrow.calculate_late_fee_amount(as_of=today), Decimal('15.00'))

    @override_settings(LATE_FEE_PER_DAY=2.50)
    def test_refresh_late_fee_persists_latest_value(self):
        today = timezone.localdate()
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today - timedelta(days=4),
        )

        updated = borrow.refresh_late_fee(as_of=today)
        borrow.refresh_from_db()

        self.assertEqual(updated, Decimal('10.00'))
        self.assertEqual(borrow.late_fee_amount, Decimal('10.00'))

    @override_settings(DUE_SOON_REMINDER_DAYS=2)
    def test_due_soon_reminder_condition_is_once_and_exact(self):
        today = timezone.localdate()
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today + timedelta(days=2),
        )

        self.assertTrue(borrow.should_send_due_soon_reminder(as_of=today))

        borrow.due_soon_reminder_sent_at = timezone.now()
        borrow.save(update_fields=['due_soon_reminder_sent_at'])

        self.assertFalse(borrow.should_send_due_soon_reminder(as_of=today))

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        DUE_SOON_REMINDER_DAYS=1,
        LIBRARY_WEB_URL='http://localhost:3000',
    )
    def test_send_due_soon_reminder_sends_email_and_notification(self):
        today = timezone.localdate()
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today + timedelta(days=1),
        )

        sent = borrow.send_due_soon_reminder(as_of=today)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, [self.user.email])
        self.assertIn("Open your library account here: http://localhost:3000/my-books", email.body)
        self.assertTrue(email.alternatives)
        self.assertIn('Book Return Reminder', email.alternatives[0][0])
        self.assertTrue(
            Notification.objects.filter(
                user=self.user,
                notification_type='DUE_SOON',
            ).exists()
        )

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        DUE_SOON_REMINDER_DAYS=1,
    )
    def test_run_borrow_automation_sends_due_soon_email_only_once(self):
        today = timezone.localdate()
        BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today + timedelta(days=1),
        )

        first_run = run_borrow_automation(as_of=today, send_reminders=True)
        second_run = run_borrow_automation(as_of=today, send_reminders=True)

        self.assertEqual(first_run['reminders_sent'], 1)
        self.assertEqual(second_run['reminders_sent'], 0)
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(LATE_FEE_PER_DAY=1.00)
    def test_run_borrow_automation_updates_fees(self):
        today = timezone.localdate()
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today - timedelta(days=2),
        )

        stats = run_borrow_automation(as_of=today, send_reminders=False)
        borrow.refresh_from_db()

        self.assertEqual(stats['processed'], 1)
        self.assertEqual(stats['fees_updated'], 1)
        self.assertEqual(stats['reminders_sent'], 0)
        self.assertEqual(stats['reminder_failures'], 0)
        self.assertEqual(borrow.late_fee_amount, Decimal('2.00'))

    @override_settings(LATE_FEE_PER_DAY=5.00)
    def test_run_borrow_automation_creates_pending_fine_for_active_overdue_borrow(self):
        today = timezone.localdate()
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today - timedelta(days=3),
        )

        run_borrow_automation(as_of=today, send_reminders=False)

        fine_payment = FinePayment.objects.get(borrow_request=borrow, status=FinePayment.STATUS_PENDING)
        self.assertEqual(fine_payment.amount, Decimal('15.00'))

    @override_settings(LATE_FEE_PER_DAY=5.00)
    def test_run_borrow_automation_tracks_only_remaining_balance_after_payment(self):
        today = timezone.localdate()
        librarian = get_user_model().objects.create_user(
            username='librarian-balance',
            password='test-pass-123',
            full_name='Librarian Balance',
            staff_id='L-2001',
            email='librarian-balance@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        borrow = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=today - timedelta(days=1),
        )

        run_borrow_automation(as_of=today, send_reminders=False)
        first_payment = FinePayment.objects.get(borrow_request=borrow, status=FinePayment.STATUS_PENDING)
        self.assertEqual(first_payment.amount, Decimal('5.00'))

        first_payment.mark_paid(processed_by=librarian, payment_method='CASH', reference='ADV-001')

        run_borrow_automation(as_of=today + timedelta(days=1), send_reminders=False)

        pending_payments = FinePayment.objects.filter(
            borrow_request=borrow,
            status=FinePayment.STATUS_PENDING,
        )
        self.assertEqual(pending_payments.count(), 1)
        self.assertEqual(pending_payments.first().amount, Decimal('5.00'))


class BorrowRenewalApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='renew-student',
            password='test-pass-123',
            full_name='Renew Student',
            student_id='S-1201',
            email='renew-student@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.other_user = user_model.objects.create_user(
            username='renew-other',
            password='test-pass-123',
            full_name='Renew Other',
            student_id='S-1202',
            email='renew-other@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='renew-librarian',
            password='test-pass-123',
            full_name='Renew Librarian',
            staff_id='L-1201',
            email='renew-librarian@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Renewable Systems',
            author='Circulation Team',
            isbn='9781234567011',
            published_date=timezone.localdate(),
            genre='Operations',
        )
        self.copy = BookCopy.objects.create(book=self.book, status=BookCopy.STATUS_BORROWED)
        self.borrow_request = BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            copy=self.copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            due_date=timezone.localdate() + timedelta(days=2),
            due_soon_reminder_sent_at=timezone.now(),
            requested_borrow_days=4,
            max_renewals=2,
            renewal_count=0,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @override_settings(RENEWAL_DURATION_DAYS=4)
    def test_student_can_submit_renewal_request(self):
        original_due_date = self.borrow_request.due_date

        response = self.client.post(
            f'/api/books/borrow-requests/{self.borrow_request.id}/renew/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.borrow_request.refresh_from_db()
        renewal_request = RenewalRequest.objects.get(borrow_request=self.borrow_request)

        self.assertEqual(self.borrow_request.due_date, original_due_date)
        self.assertEqual(self.borrow_request.renewal_count, 0)
        self.assertEqual(renewal_request.status, RenewalRequest.STATUS_PENDING)
        self.assertEqual(renewal_request.requested_extension_days, 4)
        self.assertEqual(response.data['request']['renewal_duration_days'], 4)
        self.assertFalse(response.data['request']['can_renew'])
        self.assertEqual(
            response.data['request']['pending_renewal_request_id'],
            renewal_request.pk,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.user,
                notification_type='RENEWAL_REQUEST_SUBMITTED',
            ).exists()
        )

    def test_student_cannot_submit_renewal_request_when_return_request_is_pending(self):
        ReturnRequest.objects.create(
            borrow_request=self.borrow_request,
            status=ReturnRequest.STATUS_PENDING,
        )

        response = self.client.post(
            f'/api/books/borrow-requests/{self.borrow_request.id}/renew/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['detail'],
            'A return request is already pending for this book.',
        )

    def test_student_cannot_submit_renewal_request_when_another_reservation_is_waiting(self):
        Reservation.objects.create(
            user=self.other_user,
            book=self.book,
            status=Reservation.STATUS_PENDING,
        )

        response = self.client.post(
            f'/api/books/borrow-requests/{self.borrow_request.id}/renew/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['detail'],
            'This book already has a pending reservation.',
        )

    @override_settings(RENEWAL_DURATION_DAYS=4)
    def test_librarian_can_approve_pending_renewal_request(self):
        renewal_request = RenewalRequest.objects.create(
            borrow_request=self.borrow_request,
            requested_extension_days=4,
        )
        old_due_date = self.borrow_request.due_date

        self.client.force_authenticate(user=self.librarian)
        response = self.client.post(
            f'/api/books/renewal-requests/{renewal_request.id}/approve/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        renewal_request.refresh_from_db()
        self.borrow_request.refresh_from_db()
        self.assertEqual(renewal_request.status, RenewalRequest.STATUS_APPROVED)
        self.assertEqual(self.borrow_request.due_date, old_due_date + timedelta(days=4))
        self.assertEqual(self.borrow_request.renewal_count, 1)
        self.assertIsNone(self.borrow_request.get_pending_renewal_request())
        self.assertTrue(
            Notification.objects.filter(
                user=self.user,
                notification_type='RENEWAL_SUCCESS',
            ).exists()
        )

    def test_librarian_can_reject_pending_renewal_request(self):
        renewal_request = RenewalRequest.objects.create(
            borrow_request=self.borrow_request,
            requested_extension_days=4,
        )

        self.client.force_authenticate(user=self.librarian)
        response = self.client.post(
            f'/api/books/renewal-requests/{renewal_request.id}/reject/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        renewal_request.refresh_from_db()
        self.borrow_request.refresh_from_db()
        self.assertEqual(renewal_request.status, RenewalRequest.STATUS_REJECTED)
        self.assertEqual(self.borrow_request.renewal_count, 0)
        self.assertTrue(
            Notification.objects.filter(
                user=self.user,
                notification_type='RENEWAL_REQUEST_REJECTED',
            ).exists()
        )


class DailyBorrowAutomationMiddlewareTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='middleware-student',
            password='test-pass-123',
            full_name='Middleware Student',
            student_id='S-1101',
            email='middleware-student@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Middleware Reminder',
            author='QA Bot',
            isbn='9781234567881',
            published_date=timezone.localdate(),
            genre='Testing',
        )
        BorrowRequest.objects.create(
            user=self.user,
            book=self.book,
            status=BorrowRequest.STATUS_APPROVED,
            due_date=timezone.localdate() + timedelta(days=1),
        )
        self.factory = RequestFactory()

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        AUTO_RUN_BORROW_AUTOMATION_DAILY=True,
        DUE_SOON_REMINDER_DAYS=1,
        LIBRARY_WEB_URL='http://localhost:3000',
    )
    def test_daily_borrow_automation_middleware_runs_once_per_day(self):
        middleware = DailyBorrowAutomationMiddleware(lambda request: HttpResponse('ok'))

        first_response = middleware(self.factory.get('/api/books/books/'))
        second_response = middleware(self.factory.get('/api/books/books/'))

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        checkpoint = AutomationCheckpoint.objects.get(key='borrow_automation_daily')
        self.assertEqual(checkpoint.last_run_on, timezone.localdate())
        self.assertEqual(checkpoint.last_attempted_on, timezone.localdate())
        self.assertEqual(checkpoint.last_stats.get('reminders_sent'), 1)


class BookCopiesManagementTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin_user = user_model.objects.create_user(
            username='admin-user',
            password='test-pass-123',
            full_name='Admin User',
            role='ADMIN',
            is_active=True,
        )
        self.student_user = user_model.objects.create_user(
            username='student-user',
            password='test-pass-123',
            full_name='Student User',
            role='STUDENT',
            student_id='S-2001',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Inventory Control',
            author='Library Team',
            isbn='9781234567800',
            published_date=timezone.localdate(),
            genre='Operations',
        )
        self.client = APIClient()
        self.url = f'/api/books/books/{self.book.id}/set-copies-total/'

    def test_admin_can_increase_total_copies(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(self.url, {'copies_total': 3}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.book.refresh_from_db()
        self.assertEqual(self.book.copies.count(), 3)
        self.assertEqual(self.book.copies_available, 3)
        self.assertTrue(self.book.available)

    def test_cannot_reduce_below_non_available_copies(self):
        self.client.force_authenticate(user=self.admin_user)

        available_copy = BookCopy.objects.create(book=self.book, status=BookCopy.STATUS_AVAILABLE)
        BookCopy.objects.create(book=self.book, status=BookCopy.STATUS_AVAILABLE)
        available_copy.status = BookCopy.STATUS_BORROWED
        available_copy.save(update_fields=['status'])

        response = self.client.post(self.url, {'copies_total': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cannot reduce copies below 1', str(response.data.get('detail')))
        self.assertEqual(self.book.copies.count(), 2)

    def test_student_cannot_set_total_copies(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(self.url, {'copies_total': 2}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MobileFlowEnhancementTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.student = user_model.objects.create_user(
            username='student-main',
            password='test-pass-123',
            full_name='Student Main',
            student_id='S-3001',
            email='student-main@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.other_student = user_model.objects.create_user(
            username='student-other',
            password='test-pass-123',
            full_name='Student Other',
            student_id='S-3002',
            email='student-other@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='librarian-main',
            password='test-pass-123',
            full_name='Librarian Main',
            staff_id='L-1001',
            email='librarian@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Mobile Flows',
            author='Integration QA',
            isbn='9781234567011',
            published_date=timezone.localdate(),
            genre='Testing',
        )
        self.copy = BookCopy.objects.create(book=self.book, status=BookCopy.STATUS_AVAILABLE)
        self.client = APIClient()

    @override_settings(MAX_UNPAID_FINE_AMOUNT=50.00, LATE_FEE_PER_DAY=5.00)
    def test_student_borrow_blocked_when_unpaid_fines_exceed_limit(self):
        overdue_book = Book.objects.create(
            title='Overdue Ledger',
            author='QA Team',
            isbn='9781234567012',
            published_date=timezone.localdate(),
            genre='Testing',
        )
        overdue_copy = BookCopy.objects.create(book=overdue_book, status=BookCopy.STATUS_BORROWED)
        overdue_request = BorrowRequest.objects.create(
            user=self.student,
            book=overdue_book,
            copy=overdue_copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            due_date=timezone.localdate() - timedelta(days=11),
        )
        FinePayment.objects.create(
            borrow_request=overdue_request,
            amount=Decimal('75.00'),
            status=FinePayment.STATUS_PENDING,
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/books/books/{self.book.id}/borrow/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unpaid fines', str(response.data.get('detail')).lower())
        self.assertEqual(
            FinePayment.objects.get(
                borrow_request=overdue_request,
                status=FinePayment.STATUS_PENDING,
            ).amount,
            Decimal('55.00'),
        )

    def test_student_can_cancel_pending_reservation(self):
        self.copy.status = BookCopy.STATUS_BORROWED
        self.copy.save(update_fields=['status'])

        self.client.force_authenticate(user=self.student)
        create_response = self.client.post(
            '/api/books/reservations/',
            {'book_id': self.book.id},
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        reservation_id = create_response.data['reservation']['id']

        cancel_response = self.client.post(
            f'/api/books/reservations/{reservation_id}/cancel/',
            {},
            format='json',
        )
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        reservation = Reservation.objects.get(pk=reservation_id)
        self.assertEqual(reservation.status, Reservation.STATUS_CANCELLED)

    def test_return_approval_notifies_next_reservation(self):
        self.copy.status = BookCopy.STATUS_BORROWED
        self.copy.save(update_fields=['status'])

        borrow_request = BorrowRequest.objects.create(
            user=self.other_student,
            book=self.book,
            copy=self.copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            due_date=timezone.localdate() - timedelta(days=2),
        )
        return_request = ReturnRequest.objects.create(borrow_request=borrow_request)
        reservation = Reservation.objects.create(
            user=self.student,
            book=self.book,
            status=Reservation.STATUS_PENDING,
            position=1,
        )

        self.client.force_authenticate(user=self.librarian)
        response = self.client.post(
            f'/api/books/return-requests/{return_request.id}/approve/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.STATUS_NOTIFIED)
        self.assertIsNotNone(reservation.expires_at)
        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                notification_type='RESERVATION_AVAILABLE',
            ).exists()
        )

    @override_settings(LATE_FEE_PER_DAY=5.00)
    def test_return_approval_reuses_existing_pending_fine_payment(self):
        self.copy.status = BookCopy.STATUS_BORROWED
        self.copy.save(update_fields=['status'])

        borrow_request = BorrowRequest.objects.create(
            user=self.student,
            book=self.book,
            copy=self.copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            due_date=timezone.localdate() - timedelta(days=2),
        )
        run_borrow_automation(as_of=timezone.localdate(), send_reminders=False)
        self.assertEqual(
            FinePayment.objects.filter(
                borrow_request=borrow_request,
                status=FinePayment.STATUS_PENDING,
            ).count(),
            1,
        )

        return_request = ReturnRequest.objects.create(borrow_request=borrow_request)
        self.client.force_authenticate(user=self.librarian)
        response = self.client.post(
            f'/api/books/return-requests/{return_request.id}/approve/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            FinePayment.objects.filter(
                borrow_request=borrow_request,
                status=FinePayment.STATUS_PENDING,
            ).count(),
            1,
        )

    @override_settings(LATE_FEE_PER_DAY=5.00)
    def test_student_can_view_fine_summary(self):
        overdue_book = Book.objects.create(
            title='Fine Summary Source',
            author='QA Team',
            isbn='9781234567013',
            published_date=timezone.localdate(),
            genre='Testing',
        )
        overdue_copy = BookCopy.objects.create(book=overdue_book, status=BookCopy.STATUS_BORROWED)
        overdue_request = BorrowRequest.objects.create(
            user=self.student,
            book=overdue_book,
            copy=overdue_copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            due_date=timezone.localdate() - timedelta(days=4),
        )
        FinePayment.objects.create(
            borrow_request=overdue_request,
            amount=Decimal('20.00'),
            status=FinePayment.STATUS_PENDING,
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/books/fine-payments/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unpaid_total'], '20.00')
        self.assertEqual(response.data['pending_count'], 1)

    @override_settings(MAX_UNPAID_FINE_AMOUNT=50.00, LATE_FEE_PER_DAY=5.00)
    def test_overdue_balance_is_created_before_return_and_blocks_new_borrow(self):
        overdue_book = Book.objects.create(
            title='Pre Return Fine Source',
            author='QA Team',
            isbn='9781234567014',
            published_date=timezone.localdate(),
            genre='Testing',
        )
        overdue_copy = BookCopy.objects.create(book=overdue_book, status=BookCopy.STATUS_BORROWED)
        overdue_request = BorrowRequest.objects.create(
            user=self.student,
            book=overdue_book,
            copy=overdue_copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            due_date=timezone.localdate() - timedelta(days=11),
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/books/books/{self.book.id}/borrow/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unpaid fines', str(response.data.get('detail')).lower())
        pending_payment = FinePayment.objects.get(
            borrow_request=overdue_request,
            status=FinePayment.STATUS_PENDING,
        )
        self.assertEqual(pending_payment.amount, Decimal('55.00'))


class TeacherBorrowingTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.teacher = user_model.objects.create_user(
            username='teacher-main',
            password='test-pass-123',
            full_name='Teacher Main',
            staff_id='T-3001',
            email='teacher@example.com',
            role='TEACHER',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='teacher-librarian',
            password='test-pass-123',
            full_name='Teacher Librarian',
            staff_id='L-3001',
            email='teacher-librarian@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Faculty Research Methods',
            author='Campus Press',
            isbn='9781234567123',
            published_date=timezone.localdate(),
            genre='Education',
        )
        self.copy = BookCopy.objects.create(book=self.book, status=BookCopy.STATUS_AVAILABLE)
        self.client = APIClient()

    def test_teacher_borrow_approval_has_no_due_date_and_sets_reporting_schedule(self):
        self.client.force_authenticate(user=self.teacher)
        borrow_response = self.client.post(
            f'/api/books/books/{self.book.id}/borrow/',
            {'reporting_frequency': 'WEEKLY'},
            format='json',
        )

        self.assertEqual(borrow_response.status_code, status.HTTP_200_OK)
        borrow_request = BorrowRequest.objects.get(pk=borrow_response.data['request']['id'])
        self.assertEqual(borrow_request.requested_borrow_days, 0)
        self.assertEqual(borrow_request.reporting_frequency, BorrowRequest.REPORT_WEEKLY)

        self.client.force_authenticate(user=self.librarian)
        approve_response = self.client.post(
            f'/api/books/borrow-requests/{borrow_request.id}/approve/',
            {},
            format='json',
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        borrow_request.refresh_from_db()
        self.assertEqual(borrow_request.status, BorrowRequest.STATUS_APPROVED)
        self.assertIsNone(borrow_request.due_date)
        self.assertEqual(borrow_request.max_renewals, 0)
        self.assertEqual(
            borrow_request.next_report_due_date,
            borrow_request.processed_at.date() + timedelta(days=7),
        )

    def test_teacher_can_submit_periodic_report_for_active_borrow(self):
        self.copy.status = BookCopy.STATUS_BORROWED
        self.copy.save(update_fields=['status'])
        borrow_request = BorrowRequest.objects.create(
            user=self.teacher,
            book=self.book,
            copy=self.copy,
            status=BorrowRequest.STATUS_APPROVED,
            processed_at=timezone.now(),
            reporting_frequency=BorrowRequest.REPORT_MONTHLY,
            requested_borrow_days=0,
            max_renewals=0,
        )
        borrow_request.update_next_report_due_date(reference_dt=borrow_request.processed_at)
        borrow_request.save(update_fields=['next_report_due_date'])

        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(
            f'/api/books/borrow-requests/{borrow_request.id}/submit-report/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        borrow_request.refresh_from_db()
        self.assertIsNotNone(borrow_request.last_reported_at)
        self.assertEqual(
            borrow_request.next_report_due_date,
            borrow_request.last_reported_at.date() + timedelta(days=30),
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.teacher,
                notification_type='REPORT_SUBMITTED',
            ).exists()
        )


class WorkingStudentBorrowingTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.working_student = user_model.objects.create_user(
            username='working-student-main',
            password='test-pass-123',
            full_name='Working Student Main',
            student_id='S-8801',
            role='STUDENT',
            is_working_student=True,
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Circulation Practice',
            author='Library Operations',
            isbn='9781234567999',
            published_date=timezone.localdate(),
            genre='Operations',
        )
        BookCopy.objects.create(book=self.book, status=BookCopy.STATUS_AVAILABLE)
        self.client = APIClient()

    def test_working_student_can_submit_borrow_request_as_student(self):
        self.client.force_authenticate(user=self.working_student)
        response = self.client.post(f'/api/books/books/{self.book.id}/borrow/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['request']['status'], BorrowRequest.STATUS_PENDING)


class BookReviewApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.student = user_model.objects.create_user(
            username='review-student',
            password='test-pass-123',
            full_name='Review Student',
            student_id='S-4001',
            email='review-student@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.other_student = user_model.objects.create_user(
            username='review-other',
            password='test-pass-123',
            full_name='Review Other',
            student_id='S-4002',
            email='review-other@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.book = Book.objects.create(
            title='Review Routes',
            author='API QA',
            isbn='9781234567999',
            published_date=timezone.localdate(),
            genre='Testing',
        )
        self.client = APIClient()
        self.list_url = f'/api/books/books/{self.book.id}/reviews/'

    def test_public_can_list_book_reviews_from_nested_route(self):
        BookReview.objects.create(
            user=self.other_student,
            book=self.book,
            rating=4,
            review_text='Helpful and clear.',
        )

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['rating'], 4)
        self.assertEqual(response.data[0]['book'], self.book.id)

    def test_student_can_create_review_from_nested_route_after_return(self):
        BorrowRequest.objects.create(
            user=self.student,
            book=self.book,
            status=BorrowRequest.STATUS_RETURNED,
            due_date=timezone.localdate(),
        )
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            self.list_url,
            {'rating': 5, 'review_text': 'I like the story.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['rating'], 5)
        self.assertEqual(response.data['book'], self.book.id)
        self.assertTrue(
            BookReview.objects.filter(user=self.student, book=self.book, rating=5).exists()
        )


class BookRecommendationApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.student = user_model.objects.create_user(
            username='recommend-student',
            password='test-pass-123',
            full_name='Recommend Student',
            student_id='S-5001',
            email='recommend-student@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.other_student = user_model.objects.create_user(
            username='recommend-other',
            password='test-pass-123',
            full_name='Recommend Other',
            student_id='S-5002',
            email='recommend-other@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.client = APIClient()

        self.science = Category.objects.create(name='Science')
        self.history = Category.objects.create(name='History')

        self.anchor = Book.objects.create(
            title='Applied Physics',
            author='Dr. Newton',
            isbn='9781234567101',
            published_date=timezone.localdate(),
            genre='Science',
            language='English',
        )
        self.anchor.categories.set([self.science])
        BookCopy.objects.create(book=self.anchor, status=BookCopy.STATUS_AVAILABLE)

        self.similar_pick = Book.objects.create(
            title='Advanced Physics',
            author='Dr. Newton',
            isbn='9781234567102',
            published_date=timezone.localdate(),
            genre='Science',
            language='English',
        )
        self.similar_pick.categories.set([self.science])
        BookCopy.objects.create(book=self.similar_pick, status=BookCopy.STATUS_AVAILABLE)

        self.history_source = Book.objects.create(
            title='World History Primer',
            author='Archive Press',
            isbn='9781234567103',
            published_date=timezone.localdate(),
            genre='History',
            language='English',
        )
        self.history_source.categories.set([self.history])
        BookCopy.objects.create(book=self.history_source, status=BookCopy.STATUS_BORROWED)

        self.history_match = Book.objects.create(
            title='Modern History Atlas',
            author='Archive Press',
            isbn='9781234567104',
            published_date=timezone.localdate(),
            genre='History',
            language='English',
        )
        self.history_match.categories.set([self.history])
        BookCopy.objects.create(book=self.history_match, status=BookCopy.STATUS_AVAILABLE)

        self.off_target = Book.objects.create(
            title='Painting Basics',
            author='Studio House',
            isbn='9781234567105',
            published_date=timezone.localdate(),
            genre='Arts',
            language='English',
        )
        BookCopy.objects.create(book=self.off_target, status=BookCopy.STATUS_AVAILABLE)

    def test_public_can_view_book_recommendations_from_nested_route(self):
        BorrowRequest.objects.create(
            user=self.other_student,
            book=self.similar_pick,
            status=BorrowRequest.STATUS_RETURNED,
            due_date=timezone.localdate(),
        )
        BookReview.objects.create(
            user=self.other_student,
            book=self.similar_pick,
            rating=5,
            review_text='Strong follow-up to the first title.',
        )

        response = self.client.get(f'/api/books/books/{self.anchor.id}/recommendations/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['book']['id'], self.similar_pick.id)
        self.assertIn('Shared category', response.data['results'][0]['reason'])

    def test_personalized_recommendations_use_borrow_history_and_exclude_previous_titles(self):
        BorrowRequest.objects.create(
            user=self.student,
            book=self.history_source,
            status=BorrowRequest.STATUS_RETURNED,
            due_date=timezone.localdate(),
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/books/books/recommendations/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['based_on_history'])
        recommended_ids = [item['book']['id'] for item in response.data['for_you']]
        self.assertIn(self.history_match.id, recommended_ids)
        self.assertNotIn(self.history_source.id, recommended_ids)
