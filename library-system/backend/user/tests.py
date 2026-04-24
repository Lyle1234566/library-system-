import base64
import re
import shutil
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user.models import ContactMessage, EnrollmentRecord, Notification, PasswordResetCode, TeacherRecord

VALID_TEACHER_PASSWORD = 'TeacherPass123!'
VALID_STUDENT_PASSWORD = 'StudentPass123!'


class NotificationApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='notif-student',
            password='test-pass-123',
            full_name='Notif Student',
            student_id='S-9001',
            role='STUDENT',
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.notification = Notification.objects.create(
            user=self.user,
            notification_type=Notification.TYPE_BORROW_APPROVED,
            title='Borrow approved',
            message='Your borrow request has been approved.',
        )

    def test_list_notifications_and_unread_count(self):
        response = self.client.get('/api/auth/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 1)
        self.assertEqual(response.data['total_count'], 1)
        self.assertEqual(len(response.data['results']), 1)

    def test_mark_notification_read(self):
        response = self.client.post(
            f'/api/auth/notifications/{self.notification.id}/mark-read/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notification.refresh_from_db()
        self.assertTrue(self.notification.is_read)

    def test_mark_all_notifications_read(self):
        Notification.objects.create(
            user=self.user,
            notification_type=Notification.TYPE_DUE_SOON,
            title='Due soon',
            message='A book is due soon.',
        )
        response = self.client.post('/api/auth/notifications/mark-all-read/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.user.get_unread_notifications_count(), 0)

    def test_delete_notification(self):
        response = self.client.delete(f'/api/auth/notifications/{self.notification.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Notification.objects.filter(pk=self.notification.id).exists())
        self.assertEqual(response.data['unread_count'], 0)
        self.assertEqual(response.data['total_count'], 0)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    EMAIL_BRIDGE_URL='',
    EMAIL_BRIDGE_SECRET='',
    CONTACT_ADMIN_EMAIL='admin-contact@example.com',
)
class ContactMessageSubmissionTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.teacher = user_model.objects.create_user(
            username='contact-teacher',
            password=VALID_TEACHER_PASSWORD,
            full_name='Teacher Sender',
            staff_id='T-4401',
            email='teacher.sender@example.com',
            role='TEACHER',
            is_active=True,
        )
        self.admin_user = user_model.objects.create_user(
            username='contact-admin',
            password='AdminPass123!',
            full_name='Contact Admin',
            email='contact-admin@example.com',
            role='ADMIN',
            is_active=True,
        )
        self.librarian_user = user_model.objects.create_user(
            username='contact-librarian',
            password='LibrarianPass123!',
            full_name='Contact Librarian',
            staff_id='L-4401',
            email='contact-librarian@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        self.staff_user = user_model.objects.create_user(
            username='contact-staff',
            password='StaffPass123!',
            full_name='Contact Staff User',
            staff_id='ST-4401',
            email='contact-staff@example.com',
            role='STAFF',
            is_active=True,
        )
        self.working_user = user_model.objects.create_user(
            username='contact-working',
            password='WorkingPass123!',
            full_name='Contact Working User',
            student_id='S-4402',
            email='contact-working@example.com',
            role='WORKING',
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def test_guest_reader_cannot_submit_contact_message(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            '/api/auth/contact/',
            {
                'name': 'Guest Reader',
                'email': 'guest.reader@example.com',
                'subject': 'Borrowing concern',
                'message': 'Please review the public inquiry.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(ContactMessage.objects.count(), 0)
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_teacher_can_submit_contact_message(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/auth/contact/',
                {
                    'name': 'Teacher Sender',
                    'email': 'teacher.sender@example.com',
                    'subject': 'Borrowing concern',
                    'message': 'Please review my teacher borrowing request.',
                },
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ContactMessage.objects.count(), 1)

        contact_message = ContactMessage.objects.get()
        self.assertEqual(contact_message.user, self.teacher)
        self.assertEqual(contact_message.subject, 'Borrowing concern')

        admin_notification = Notification.objects.get(
            user=self.admin_user,
            notification_type=Notification.TYPE_CONTACT_MESSAGE_RECEIVED,
        )
        self.assertEqual(admin_notification.data['dashboard_section'], 'desk-contact')
        self.assertEqual(admin_notification.data['sender_role'], 'Teacher')
        self.assertEqual(admin_notification.data['sender_identifier'], 'T-4401')
        self.assertEqual(admin_notification.data['contact_message_id'], contact_message.id)

        recipients = sorted(email.to[0] for email in mail.outbox)
        self.assertEqual(
            recipients,
            sorted([
                'admin-contact@example.com',
                'contact-admin@example.com',
                'contact-librarian@example.com',
            ]),
        )
        self.assertTrue(any('Borrowing concern' in email.subject for email in mail.outbox))
        self.assertTrue(any('Role: Teacher' in email.body for email in mail.outbox))
        self.assertTrue(any('Account ID: T-4401' in email.body for email in mail.outbox))

    def test_librarian_contact_message_notifies_admin_and_saves_message(self):
        self.client.force_authenticate(user=self.librarian_user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/auth/contact/',
                {
                    'name': 'Contact Librarian',
                    'email': 'contact-librarian@example.com',
                    'subject': 'Internal escalation',
                    'message': 'Please review this circulation desk issue.',
                },
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ContactMessage.objects.count(), 1)

        contact_message = ContactMessage.objects.get()
        self.assertEqual(contact_message.user, self.librarian_user)
        self.assertEqual(contact_message.subject, 'Internal escalation')
        self.assertEqual(contact_message.status, ContactMessage.STATUS_NEW)
        self.assertEqual(contact_message.internal_notes, '')

        admin_notification = Notification.objects.get(
            user=self.admin_user,
            notification_type=Notification.TYPE_CONTACT_MESSAGE_RECEIVED,
        )
        librarian_notification = Notification.objects.get(
            user=self.librarian_user,
            notification_type=Notification.TYPE_CONTACT_MESSAGE_RECEIVED,
        )
        self.assertEqual(admin_notification.data['dashboard_section'], 'desk-contact')
        self.assertEqual(admin_notification.data['sender_role'], 'Librarian')
        self.assertEqual(admin_notification.data['sender_identifier'], 'L-4401')
        self.assertEqual(admin_notification.data['contact_message_id'], contact_message.id)
        self.assertEqual(librarian_notification.data['dashboard_section'], 'desk-contact')
        self.assertEqual(librarian_notification.data['portal'], 'librarian')
        self.assertFalse(
            Notification.objects.filter(
                user=self.working_user,
                notification_type=Notification.TYPE_CONTACT_MESSAGE_RECEIVED,
            ).exists()
        )

        recipients = sorted(email.to[0] for email in mail.outbox)
        self.assertEqual(
            recipients,
            sorted([
                'admin-contact@example.com',
                'contact-admin@example.com',
                'contact-librarian@example.com',
            ]),
        )
        self.assertTrue(any('Internal escalation' in email.subject for email in mail.outbox))
        self.assertTrue(any('New contact message from Contact Librarian' in email.subject for email in mail.outbox))
        self.assertTrue(any('Role: Librarian' in email.body for email in mail.outbox))
        self.assertTrue(any('Account ID: L-4401' in email.body for email in mail.outbox))


class ContactMessageManagementApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.teacher = user_model.objects.create_user(
            username='contact-teacher-api',
            password=VALID_TEACHER_PASSWORD,
            full_name='Teacher Api Sender',
            staff_id='T-5501',
            email='teacher.api@example.com',
            role='TEACHER',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='contact-librarian-api',
            password='LibrarianPass123!',
            full_name='Librarian Api User',
            staff_id='L-5501',
            email='librarian.api@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        self.admin_user = user_model.objects.create_user(
            username='contact-admin-api',
            password='AdminPass123!',
            full_name='Admin Api User',
            email='admin.api@example.com',
            role='ADMIN',
            is_active=True,
        )
        self.working_user = user_model.objects.create_user(
            username='contact-working-api',
            password='WorkingPass123!',
            full_name='Working Api User',
            student_id='S-5501',
            email='working.api@example.com',
            role='WORKING',
            is_active=True,
        )
        self.contact_message = ContactMessage.objects.create(
            user=self.teacher,
            name='Teacher Api Sender',
            email='teacher.api@example.com',
            subject='API help',
            message='Need a contact inbox page.',
        )
        self.resolved_message = ContactMessage.objects.create(
            name='Guest Sender',
            email='guest.sender@example.com',
            subject='Guest feedback',
            message='Thank you for the service.',
            status=ContactMessage.STATUS_RESOLVED,
            internal_notes='Archived after reply.',
            handled_by=self.admin_user,
            handled_at=timezone.now(),
        )
        self.client = APIClient()

    def test_librarian_can_list_contact_messages(self):
        self.client.force_authenticate(user=self.librarian)

        response = self.client.get('/api/auth/contact/messages/?limit=10')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_count'], 2)
        self.assertEqual(response.data['filtered_count'], 2)
        self.assertEqual(response.data['status_counts']['NEW'], 1)
        self.assertEqual(response.data['status_counts']['RESOLVED'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.resolved_message.id)
        self.assertEqual(response.data['results'][1]['sender_role'], 'Teacher')
        self.assertEqual(response.data['results'][1]['sender_identifier'], 'T-5501')

    def test_librarian_can_update_contact_message_status_and_notes(self):
        self.client.force_authenticate(user=self.librarian)

        response = self.client.patch(
            f'/api/auth/contact/messages/{self.contact_message.id}/',
            {
                'status': ContactMessage.STATUS_IN_PROGRESS,
                'internal_notes': 'Followed up with the teacher by email.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.contact_message.refresh_from_db()
        self.assertEqual(self.contact_message.status, ContactMessage.STATUS_IN_PROGRESS)
        self.assertEqual(self.contact_message.internal_notes, 'Followed up with the teacher by email.')
        self.assertEqual(self.contact_message.handled_by, self.librarian)
        self.assertIsNotNone(self.contact_message.handled_at)

    def test_working_user_cannot_access_contact_messages(self):
        self.client.force_authenticate(user=self.working_user)

        list_response = self.client.get('/api/auth/contact/messages/')
        patch_response = self.client.patch(
            f'/api/auth/contact/messages/{self.contact_message.id}/',
            {'status': ContactMessage.STATUS_RESOLVED},
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)


class StudentApprovalPermissionTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.pending_student = user_model.objects.create_user(
            username='pending-student',
            password='test-pass-123',
            full_name='Pending Student',
            student_id='S-3001',
            email='pending-student@example.com',
            role='STUDENT',
            is_active=False,
        )
        self.pending_teacher = user_model.objects.create_user(
            username='pending-teacher',
            password='test-pass-123',
            full_name='Pending Teacher',
            staff_id='T-3001',
            email='pending-teacher@example.com',
            role='TEACHER',
            is_active=False,
        )
        self.admin_user = user_model.objects.create_user(
            username='admin-user',
            password='test-pass-123',
            full_name='Admin User',
            role='ADMIN',
            is_active=True,
        )
        self.librarian_user = user_model.objects.create_user(
            username='librarian-user',
            password='test-pass-123',
            full_name='Librarian User',
            role='LIBRARIAN',
            staff_id='F-2201',
            is_active=True,
        )
        self.working_user = user_model.objects.create_user(
            username='working-user',
            password='test-pass-123',
            full_name='Working User',
            role='STUDENT',
            student_id='S-4401',
            is_working_student=True,
            is_active=True,
        )
        self.staff_user = user_model.objects.create_user(
            username='staff-user',
            password='test-pass-123',
            full_name='Staff User',
            role='STAFF',
            staff_id='F-9901',
            is_active=True,
        )
        self.client = APIClient()

    def test_admin_can_view_and_approve_pending_students(self):
        self.client.force_authenticate(user=self.admin_user)

        list_response = self.client.get('/api/auth/pending-accounts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data['results']), 2)
        self.assertEqual(
            {account['role'] for account in list_response.data['results']},
            {'STUDENT', 'TEACHER'},
        )

        approve_response = self.client.post(
            f'/api/auth/approve-account/{self.pending_student.id}/',
            {},
            format='json',
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.pending_student.refresh_from_db()
        self.assertTrue(self.pending_student.is_active)

    def test_librarian_can_view_and_approve_pending_students(self):
        self.client.force_authenticate(user=self.librarian_user)

        list_response = self.client.get('/api/auth/pending-accounts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)

        approve_response = self.client.post(
            f'/api/auth/approve-account/{self.pending_teacher.id}/',
            {},
            format='json',
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.pending_teacher.refresh_from_db()
        self.assertTrue(self.pending_teacher.is_active)

    def test_working_student_can_view_and_approve_pending_students(self):
        user_model = get_user_model()
        pending_student = user_model.objects.create_user(
            username='pending-student-working',
            password='test-pass-123',
            full_name='Pending Student Working',
            student_id='S-3002',
            role='STUDENT',
            is_active=False,
        )
        self.client.force_authenticate(user=self.working_user)

        list_response = self.client.get('/api/auth/pending-accounts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)

        approve_response = self.client.post(
            f'/api/auth/approve-account/{pending_student.id}/',
            {},
            format='json',
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        pending_student.refresh_from_db()
        self.assertTrue(pending_student.is_active)

    def test_pending_student_can_be_approved_as_working_student(self):
        self.client.force_authenticate(user=self.librarian_user)

        approve_response = self.client.post(
            f'/api/auth/approve-account/{self.pending_student.id}/',
            {'is_working_student': True},
            format='json',
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.pending_student.refresh_from_db()
        self.assertTrue(self.pending_student.is_active)
        self.assertTrue(self.pending_student.is_working_student)

    def test_pending_working_account_is_listed_and_can_be_approved(self):
        user_model = get_user_model()
        pending_working = user_model.objects.create_user(
            username='pending-working-student',
            password='test-pass-123',
            full_name='Pending Working Student',
            student_id='S-3004',
            email='pending-working@example.com',
            role='WORKING',
            is_active=False,
        )
        self.client.force_authenticate(user=self.librarian_user)

        list_response = self.client.get('/api/auth/pending-accounts/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(
                account['id'] == pending_working.id and account['role'] == 'WORKING'
                for account in list_response.data['results']
            )
        )

        approve_response = self.client.post(
            f'/api/auth/approve-account/{pending_working.id}/',
            {},
            format='json',
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        pending_working.refresh_from_db()
        self.assertTrue(pending_working.is_active)
        self.assertTrue(pending_working.is_working_student)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        EMAIL_BRIDGE_URL='',
        EMAIL_BRIDGE_SECRET='',
        LIBRARY_WEB_URL='http://localhost:3000',
    )
    def test_account_approval_sends_email_to_approved_user(self):
        self.client.force_authenticate(user=self.librarian_user)

        with self.captureOnCommitCallbacks(execute=True):
            approve_response = self.client.post(
                f'/api/auth/approve-account/{self.pending_student.id}/',
                {},
                format='json',
            )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.pending_student.email])
        self.assertEqual(mail.outbox[0].subject, 'Library Account Approved')
        self.assertIn('approved', mail.outbox[0].body.lower())
        self.assertIn('http://localhost:3000/login', mail.outbox[0].body)

    def test_staff_cannot_view_or_approve_pending_students(self):
        user_model = get_user_model()
        pending_student = user_model.objects.create_user(
            username='pending-student-staff',
            password='test-pass-123',
            full_name='Pending Student Staff',
            student_id='S-3003',
            role='STUDENT',
            is_active=False,
        )
        self.client.force_authenticate(user=self.staff_user)

        list_response = self.client.get('/api/auth/pending-accounts/')
        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)

        approve_response = self.client.post(
            f'/api/auth/approve-account/{pending_student.id}/',
            {},
            format='json',
        )
        self.assertEqual(approve_response.status_code, status.HTTP_403_FORBIDDEN)
        pending_student.refresh_from_db()
        self.assertFalse(pending_student.is_active)


class TeacherRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.librarian = get_user_model().objects.create_user(
            username='registration-librarian',
            password='test-pass-123',
            full_name='Registration Librarian',
            staff_id='L-8801',
            email='registration-librarian@example.com',
            role='LIBRARIAN',
            is_active=True,
        )
        self.working_reviewer = get_user_model().objects.create_user(
            username='registration-working-reviewer',
            password='test-pass-123',
            full_name='Working Reviewer',
            student_id='S-8800',
            email='registration-working-reviewer@example.com',
            role='STUDENT',
            is_working_student=True,
            is_active=True,
        )
        TeacherRecord.objects.create(
            staff_id='T-8801',
            full_name='Teacher Applicant',
            school_email='teacher-applicant@example.com',
            department='Education',
            academic_term='2025-2026',
            is_active=True,
        )
        TeacherRecord.objects.create(
            staff_id='T-8802',
            full_name='Teacher Applicant 2',
            school_email='teacher-applicant-2@example.com',
            department='Science',
            academic_term='2025-2026',
            is_active=True,
        )

    def test_teacher_can_register_with_faculty_id(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'TEACHER',
                'staff_id': 'T-8801',
                'full_name': 'Teacher Applicant',
                'email': 'teacher-applicant@example.com',
                'password': VALID_TEACHER_PASSWORD,
                'password_confirm': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['role'], 'TEACHER')
        self.assertEqual(response.data['user']['staff_id'], 'T-8801')
        self.assertFalse(response.data['user']['is_active'])
        self.assertNotIn('access', response.data)
        self.assertTrue(
            Notification.objects.filter(
                user=self.librarian,
                notification_type='ACCOUNT_PENDING_APPROVAL',
                data__user_id=response.data['user']['id'],
                data__portal='librarian',
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.working_reviewer,
                notification_type='ACCOUNT_PENDING_APPROVAL',
                data__user_id=response.data['user']['id'],
                data__portal='staff',
            ).exists()
        )

    def test_teacher_registration_requires_faculty_id(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'TEACHER',
                'full_name': 'Teacher Applicant',
                'email': 'teacher-applicant@example.com',
                'password': VALID_TEACHER_PASSWORD,
                'password_confirm': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('staff_id', response.data)

    def test_registration_requires_email_for_due_date_reminders(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'STUDENT',
                'student_id': 'S-8801',
                'full_name': 'Student Applicant',
                'password': VALID_TEACHER_PASSWORD,
                'password_confirm': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_registration_requires_number_and_special_character(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'TEACHER',
                'staff_id': 'T-8802',
                'full_name': 'Teacher Applicant',
                'email': 'teacher-applicant@example.com',
                'password': 'TeacherPassOnly',
                'password_confirm': 'TeacherPassOnly',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        self.assertIn('number', ' '.join(response.data['password']).lower())
        self.assertIn('special character', ' '.join(response.data['password']).lower())

    def test_teacher_identifier_check_reports_available_when_unused(self):
        response = self.client.get(
            '/api/auth/check-account-identifier/?role=TEACHER&identifier=T-8801'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['available'])
        self.assertEqual(response.data['reason'], 'available')
        self.assertIn('teacher records', response.data['message'].lower())

    def test_teacher_registration_rejects_unknown_faculty_id(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'TEACHER',
                'staff_id': 'T-9999',
                'full_name': 'Unknown Teacher',
                'email': 'unknown-teacher@example.com',
                'password': VALID_TEACHER_PASSWORD,
                'password_confirm': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('staff_id', response.data)
        self.assertIn('teacher records', str(response.data['staff_id'][0]).lower())

    def test_teacher_identifier_check_reports_inactive_teacher_record(self):
        TeacherRecord.objects.create(
            staff_id='T-8803',
            full_name='Inactive Teacher',
            school_email='inactive-teacher@example.com',
            department='Arts',
            academic_term='2025-2026',
            is_active=False,
        )

        response = self.client.get(
            '/api/auth/check-account-identifier/?role=TEACHER&identifier=T-8803'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])
        self.assertEqual(response.data['reason'], 'inactive_teacher_record')
        self.assertIn('active', response.data['message'].lower())

    def test_teacher_faculty_id_cannot_be_reused(self):
        create_response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'TEACHER',
                'staff_id': 'T-8801',
                'full_name': 'Teacher Applicant',
                'email': 'teacher-applicant@example.com',
                'password': VALID_TEACHER_PASSWORD,
                'password_confirm': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        check_response = self.client.get(
            '/api/auth/check-account-identifier/?role=TEACHER&identifier=T-8801'
        )
        self.assertEqual(check_response.status_code, status.HTTP_200_OK)
        self.assertFalse(check_response.data['available'])
        self.assertIn('already taken', check_response.data['message'].lower())

        second_response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'TEACHER',
                'staff_id': 'T-8801',
                'full_name': 'Teacher Applicant Copy',
                'email': 'teacher-applicant-copy@example.com',
                'password': VALID_TEACHER_PASSWORD,
                'password_confirm': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already', str(second_response.data['staff_id'][0]).lower())


class StudentEnrollmentVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_enrolled_student_can_register(self):
        EnrollmentRecord.objects.create(
            student_id='S-8801',
            full_name='Student Applicant',
            school_email='student-applicant@example.com',
            academic_term='2025-2026',
            is_currently_enrolled=True,
        )

        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'STUDENT',
                'student_id': 'S-8801',
                'full_name': 'Student Applicant',
                'email': 'student-applicant@example.com',
                'password': VALID_STUDENT_PASSWORD,
                'password_confirm': VALID_STUDENT_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['role'], 'STUDENT')
        self.assertEqual(response.data['user']['student_id'], 'S-8801')
        self.assertFalse(response.data['user']['is_active'])

    def test_student_registration_rejects_unknown_student_id(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'STUDENT',
                'student_id': 'S-8802',
                'full_name': 'Unknown Student',
                'email': 'unknown-student@example.com',
                'password': VALID_STUDENT_PASSWORD,
                'password_confirm': VALID_STUDENT_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('student_id', response.data)
        self.assertIn('current enrollment list', str(response.data['student_id'][0]).lower())

    def test_student_registration_rejects_inactive_enrollment(self):
        EnrollmentRecord.objects.create(
            student_id='S-8803',
            full_name='Inactive Student',
            is_currently_enrolled=False,
        )

        response = self.client.post(
            '/api/auth/register/',
            {
                'role': 'STUDENT',
                'student_id': 'S-8803',
                'full_name': 'Inactive Student',
                'email': 'inactive-student@example.com',
                'password': VALID_STUDENT_PASSWORD,
                'password_confirm': VALID_STUDENT_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('student_id', response.data)
        self.assertIn('currently enrolled', str(response.data['student_id'][0]).lower())

    def test_student_identifier_check_reports_enrollment_status(self):
        EnrollmentRecord.objects.create(
            student_id='S-8804',
            full_name='Eligible Student',
            is_currently_enrolled=True,
        )
        EnrollmentRecord.objects.create(
            student_id='S-8805',
            full_name='Inactive Student',
            is_currently_enrolled=False,
        )
        get_user_model().objects.create_user(
            username='taken-student',
            password=VALID_STUDENT_PASSWORD,
            full_name='Taken Student',
            student_id='S-8806',
            role='STUDENT',
            is_active=False,
        )

        available_response = self.client.get(
            '/api/auth/check-account-identifier/?role=STUDENT&identifier=S-8804'
        )
        self.assertEqual(available_response.status_code, status.HTTP_200_OK)
        self.assertTrue(available_response.data['available'])
        self.assertEqual(available_response.data['reason'], 'available')

        missing_response = self.client.get(
            '/api/auth/check-account-identifier/?role=STUDENT&identifier=S-9999'
        )
        self.assertEqual(missing_response.status_code, status.HTTP_200_OK)
        self.assertFalse(missing_response.data['available'])
        self.assertEqual(missing_response.data['reason'], 'not_enrolled')

        inactive_response = self.client.get(
            '/api/auth/check-account-identifier/?role=STUDENT&identifier=S-8805'
        )
        self.assertEqual(inactive_response.status_code, status.HTTP_200_OK)
        self.assertFalse(inactive_response.data['available'])
        self.assertEqual(inactive_response.data['reason'], 'inactive_enrollment')

        taken_response = self.client.get(
            '/api/auth/check-account-identifier/?role=STUDENT&identifier=S-8806'
        )
        self.assertEqual(taken_response.status_code, status.HTTP_200_OK)
        self.assertFalse(taken_response.data['available'])
        self.assertEqual(taken_response.data['reason'], 'taken')


class EnrollmentImportApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.librarian = user_model.objects.create_user(
            username='enrollment-librarian',
            password='test-pass-123',
            full_name='Enrollment Librarian',
            staff_id='LIB-2201',
            role='LIBRARIAN',
            is_active=True,
        )
        self.staff_user = user_model.objects.create_user(
            username='enrollment-staff',
            password='test-pass-123',
            full_name='Enrollment Staff',
            staff_id='STF-2201',
            role='STAFF',
            is_active=True,
        )
        self.client = APIClient()

    def test_librarian_can_upload_enrollment_csv(self):
        self.client.force_authenticate(user=self.librarian)
        upload = SimpleUploadedFile(
            'enrollment.csv',
            (
                'student_id,full_name,school_email,program,year_level,is_currently_enrolled\n'
                'S-1010,Jane Student,jane@example.com,BSIT,3,TRUE\n'
                'S-2020,John Student,john@example.com,BSCS,2,FALSE\n'
            ).encode('utf-8'),
            content_type='text/csv',
        )

        response = self.client.post(
            '/api/auth/enrollment-records/import/',
            {
                'file': upload,
                'academic_term': '2025-2026',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 2)
        self.assertEqual(response.data['updated_count'], 0)
        self.assertEqual(response.data['skipped_count'], 0)
        self.assertEqual(response.data['total_records'], 2)
        self.assertEqual(response.data['active_records'], 1)
        self.assertEqual(response.data['inactive_records'], 1)
        self.assertEqual(EnrollmentRecord.objects.filter(academic_term='2025-2026').count(), 2)

    def test_librarian_can_get_enrollment_summary(self):
        EnrollmentRecord.objects.create(
            student_id='S-3030',
            full_name='Ready Student',
            academic_term='2025-2026',
            is_currently_enrolled=True,
        )
        EnrollmentRecord.objects.create(
            student_id='S-4040',
            full_name='Inactive Student',
            academic_term='2025-2026',
            is_currently_enrolled=False,
        )
        self.client.force_authenticate(user=self.librarian)

        response = self.client.get('/api/auth/enrollment-records/import/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_records'], 2)
        self.assertEqual(response.data['active_records'], 1)
        self.assertEqual(response.data['inactive_records'], 1)
        self.assertEqual(response.data['latest_term'], '2025-2026')
        self.assertIn('student_id', response.data['template_columns'])

    def test_staff_cannot_upload_enrollment_csv(self):
        self.client.force_authenticate(user=self.staff_user)
        upload = SimpleUploadedFile(
            'enrollment.csv',
            b'student_id,full_name\nS-1010,Jane Student\n',
            content_type='text/csv',
        )

        response = self.client.post(
            '/api/auth/enrollment-records/import/',
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_upload_rejects_csv_without_student_id_column(self):
        self.client.force_authenticate(user=self.librarian)
        upload = SimpleUploadedFile(
            'invalid.csv',
            b'full_name,school_email\nJane Student,jane@example.com\n',
            content_type='text/csv',
        )

        response = self.client.post(
            '/api/auth/enrollment-records/import/',
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('student_id column', str(response.data['detail']).lower())


class ChangePasswordViewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.student = user_model.objects.create_user(
            username='change-student',
            password='OldPass123!',
            full_name='Change Student',
            student_id='S-6101',
            role='STUDENT',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='change-librarian',
            password='OldPass123!',
            full_name='Change Librarian',
            staff_id='F-6101',
            role='LIBRARIAN',
            is_active=True,
        )
        self.working = user_model.objects.create_user(
            username='change-working',
            password='OldPass123!',
            full_name='Change Working',
            student_id='S-6102',
            role='STUDENT',
            is_working_student=True,
            is_active=True,
        )
        self.client = APIClient()

    def assert_password_change_works(self, user, next_password: str):
        self.client.force_authenticate(user=user)

        response = self.client.post(
            '/api/auth/change-password/',
            {
                'old_password': 'OldPass123!',
                'new_password': next_password,
                'new_password_confirm': next_password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password(next_password))

    def test_student_can_change_password(self):
        self.assert_password_change_works(self.student, 'StudentPass456!')

    def test_librarian_can_change_password(self):
        self.assert_password_change_works(self.librarian, 'LibrarianPass456!')

    def test_working_user_can_change_password(self):
        self.assert_password_change_works(self.working, 'WorkingPass456!')

    def test_change_password_blacklists_existing_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.student)
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            '/api/auth/change-password/',
            {
                'old_password': 'OldPass123!',
                'new_password': 'StudentPass789!',
                'new_password_confirm': 'StudentPass789!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json',
        )
        self.assertNotEqual(refresh_response.status_code, status.HTTP_200_OK)


class TeacherPortalLoginTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.teacher = user_model.objects.create_user(
            username='teacher-login',
            password=VALID_TEACHER_PASSWORD,
            full_name='Teacher Login',
            staff_id='T-4401',
            email='teacher-login@example.com',
            email_verified=True,
            role='TEACHER',
            is_active=True,
        )
        self.client = APIClient()

    def test_teacher_can_login_through_teacher_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'portal': 'teacher',
                'student_id': self.teacher.staff_id,
                'password': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'TEACHER')
        self.assertIn('access', response.data)

    def test_teacher_is_rejected_from_student_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'portal': 'student',
                'student_id': self.teacher.staff_id,
                'password': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('cannot access', str(response.data['detail']).lower())


class WorkingStudentPortalLoginTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.working_student = user_model.objects.create_user(
            username='working-student-login',
            password='WorkingPass123',
            full_name='Working Student Login',
            student_id='S-5501',
            role='STUDENT',
            is_working_student=True,
            is_active=True,
        )
        self.client = APIClient()

    def test_working_student_can_login_through_staff_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'portal': 'staff',
                'student_id': self.working_student.student_id,
                'password': 'WorkingPass123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'STUDENT')
        self.assertTrue(response.data['user']['is_working_student'])

    def test_working_student_can_still_login_through_student_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'portal': 'student',
                'student_id': self.working_student.student_id,
                'password': 'WorkingPass123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'STUDENT')
        self.assertTrue(response.data['user']['is_working_student'])


class AutomaticRoleLoginTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.teacher = user_model.objects.create_user(
            username='teacher-auto-login',
            password=VALID_TEACHER_PASSWORD,
            full_name='Teacher Auto Login',
            staff_id='T-6601',
            role='TEACHER',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='librarian-auto-login',
            password='LibrarianPass123',
            full_name='Librarian Auto Login',
            staff_id='L-6601',
            role='LIBRARIAN',
            is_active=True,
        )
        self.working_student = user_model.objects.create_user(
            username='working-auto-login',
            password='WorkingPass123',
            full_name='Working Auto Login',
            student_id='S-6601',
            role='STUDENT',
            is_working_student=True,
            is_active=True,
        )
        self.client = APIClient()

    def test_teacher_can_login_without_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.teacher.staff_id,
                'password': VALID_TEACHER_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'TEACHER')

    def test_librarian_can_login_without_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.librarian.staff_id,
                'password': 'LibrarianPass123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'LIBRARIAN')

    def test_working_student_can_login_without_portal(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.working_student.student_id,
                'password': 'WorkingPass123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'STUDENT')
        self.assertTrue(response.data['user']['is_working_student'])


@override_settings(
    LOGIN_FAILURE_LIMIT=3,
    LOGIN_FAILURE_WINDOW_MINUTES=15,
    LOGIN_LOCKOUT_MINUTES=15,
)
class LoginLockoutTests(TestCase):
    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='lockout-student',
            password=VALID_STUDENT_PASSWORD,
            full_name='Lockout Student',
            student_id='S-6801',
            email='lockout-student@example.com',
            role='STUDENT',
            is_active=True,
            email_verified=True,
        )
        self.client = APIClient()

    def login(self, password: str):
        return self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.user.student_id,
                'password': password,
            },
            format='json',
        )

    def test_account_locks_after_repeated_failed_passwords(self):
        for _ in range(3):
            response = self.login('WrongPass123!')
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        locked_response = self.login(VALID_STUDENT_PASSWORD)
        self.assertEqual(locked_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Too many failed login attempts', locked_response.data['detail'])

    def test_successful_login_clears_previous_failed_attempts(self):
        failed_response = self.login('WrongPass123!')
        self.assertEqual(failed_response.status_code, status.HTTP_401_UNAUTHORIZED)

        success_response = self.login(VALID_STUDENT_PASSWORD)
        self.assertEqual(success_response.status_code, status.HTTP_200_OK)

        another_failed_response = self.login('WrongPass123!')
        self.assertEqual(another_failed_response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserEmailConstraintTests(TestCase):
    def test_user_email_is_normalized_on_save(self):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username='email-normalized-user',
            password=VALID_STUDENT_PASSWORD,
            full_name='Normalized Email User',
            student_id='S-6810',
            email=' MixedCase@Example.COM ',
            role='STUDENT',
            is_active=True,
        )

        self.assertEqual(user.email, 'mixedcase@example.com')

    def test_case_insensitive_email_uniqueness_is_enforced_in_database(self):
        user_model = get_user_model()
        user_model.objects.create_user(
            username='email-unique-user-1',
            password=VALID_STUDENT_PASSWORD,
            full_name='First Email User',
            student_id='S-6811',
            email='shared@example.com',
            role='STUDENT',
            is_active=True,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                user_model.objects.create_user(
                    username='email-unique-user-2',
                    password=VALID_STUDENT_PASSWORD,
                    full_name='Second Email User',
                    student_id='S-6812',
                    email='SHARED@EXAMPLE.COM',
                    role='STUDENT',
                    is_active=True,
                )


class ProfileUpdateSecurityTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.student = user_model.objects.create_user(
            username='profile-student',
            password='OldPass123!',
            full_name='Profile Student',
            student_id='S-7101',
            role='STUDENT',
            is_active=True,
        )
        self.librarian = user_model.objects.create_user(
            username='profile-librarian',
            password='OldPass123!',
            full_name='Profile Librarian',
            staff_id='F-7101',
            role='LIBRARIAN',
            is_active=True,
        )
        self.working = user_model.objects.create_user(
            username='profile-working',
            password='OldPass123!',
            full_name='Profile Working',
            student_id='S-7102',
            role='STUDENT',
            is_working_student=True,
            is_active=True,
        )
        self.client = APIClient()

    def assert_profile_email_update_is_rejected(self, user, email: str):
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            '/api/auth/profile/',
            {'email': email, 'full_name': user.full_name},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        user.refresh_from_db()
        self.assertNotEqual(user.email, email.lower())

    def test_student_cannot_change_email_from_profile(self):
        self.assert_profile_email_update_is_rejected(self.student, 'student-recovery@example.com')

    def test_librarian_cannot_change_email_from_profile(self):
        self.assert_profile_email_update_is_rejected(self.librarian, 'librarian-recovery@example.com')

    def test_working_user_cannot_change_email_from_profile(self):
        self.assert_profile_email_update_is_rejected(self.working, 'working-recovery@example.com')

    def test_profile_cannot_be_used_for_role_escalation(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            '/api/auth/profile/',
            {'role': 'ADMIN', 'full_name': self.student.full_name},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('role', response.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, 'STUDENT')

    def test_student_can_upload_profile_avatar(self):
        media_root = Path(__file__).resolve().parents[1] / 'test_media_profile_avatar'
        shutil.rmtree(media_root, ignore_errors=True)
        media_root.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(media_root, ignore_errors=True))
        self.client.force_authenticate(user=self.student)

        avatar = SimpleUploadedFile(
            'profile.gif',
            base64.b64decode('R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs='),
            content_type='image/gif',
        )

        with override_settings(MEDIA_ROOT=media_root):
            response = self.client.patch(
                '/api/auth/profile/',
                {
                    'full_name': self.student.full_name,
                    'avatar': avatar,
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertTrue(bool(self.student.avatar))


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PASSWORD_RESET_DEBUG_RETURN_CODE=False,
    PASSWORD_RESET_CODE_TTL_MINUTES=10,
    PASSWORD_RESET_WEB_URL='http://localhost:3000/forgot-password',
)
class PasswordResetFlowTests(TestCase):
    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='reset-student',
            password='OldPass123!',
            full_name='Reset Student',
            student_id='S-5001',
            email='reset@example.com',
            role='STUDENT',
            is_active=True,
        )
        self.client = APIClient()

    def request_reset_code(self, email='reset@example.com'):
        return self.client.post(
            '/api/auth/password-reset/request/',
            {'email': email},
            format='json',
        )

    def extract_code_from_last_email(self) -> str:
        self.assertTrue(mail.outbox)
        match = re.search(r'(\d{6})', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(1)

    def test_request_creates_hashed_code_and_sends_email(self):
        response = self.request_reset_code()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['code_length'], 6)
        self.assertEqual(response.data['expires_in_minutes'], 10)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, 'Password Reset Verification Code')

        reset_code = PasswordResetCode.objects.get(user=self.user)
        raw_code = self.extract_code_from_last_email()
        self.assertNotEqual(reset_code.code, raw_code)
        self.assertTrue(reset_code.matches(raw_code))
        self.assertIn(
            f"http://localhost:3000/forgot-password?{urlencode({'email': self.user.email, 'code': raw_code, 'source': 'email'})}",
            mail.outbox[0].body,
        )

    @override_settings(
        EMAIL_BRIDGE_URL='https://library.example.com/api/email',
        EMAIL_BRIDGE_SECRET='bridge-secret',
    )
    def test_request_falls_back_to_django_email_backend_when_bridge_fails(self):
        with patch(
            'backend.email_bridge._send_via_email_bridge',
            side_effect=RuntimeError('Bridge send failed'),
        ):
            response = self.request_reset_code()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertEqual(mail.outbox[0].subject, 'Password Reset Verification Code')

    def test_public_alias_endpoints_work(self):
        request_response = self.client.post(
            '/api/forgot-password/',
            {'email': self.user.email},
            format='json',
        )
        self.assertEqual(request_response.status_code, status.HTTP_200_OK)

        raw_code = self.extract_code_from_last_email()

        verify_response = self.client.post(
            '/api/verify-code/',
            {'email': self.user.email, 'code': raw_code},
            format='json',
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)

        reset_response = self.client.post(
            '/api/reset-password/',
            {
                'email': self.user.email,
                'code': raw_code,
                'new_password': 'AliasPass123!',
                'new_password_confirm': 'AliasPass123!',
            },
            format='json',
        )
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)

    def test_unknown_email_returns_generic_success(self):
        response = self.request_reset_code('missing@example.com')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['message'],
            'If that email is registered, a reset code has been sent.',
        )
        self.assertEqual(PasswordResetCode.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_verify_then_confirm_resets_password(self):
        self.request_reset_code()
        raw_code = self.extract_code_from_last_email()

        verify_response = self.client.post(
            '/api/auth/password-reset/verify/',
            {'email': self.user.email, 'code': raw_code},
            format='json',
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)

        reset_code = PasswordResetCode.objects.get(user=self.user)
        self.assertFalse(reset_code.is_used)

        confirm_response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'email': self.user.email,
                'code': raw_code,
                'new_password': 'NewPass123!',
                'new_password_confirm': 'NewPass123!',
            },
            format='json',
        )
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        reset_code.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass123!'))
        self.assertTrue(reset_code.is_used)

    def test_expired_code_is_rejected(self):
        self.request_reset_code()
        raw_code = self.extract_code_from_last_email()
        reset_code = PasswordResetCode.objects.get(user=self.user)
        reset_code.created_at = timezone.now() - timedelta(minutes=11)
        reset_code.save(update_fields=['created_at'])

        response = self.client.post(
            '/api/auth/password-reset/verify/',
            {'email': self.user.email, 'code': raw_code},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'This reset code has expired. Request a new one.')

    def test_invalid_code_increments_attempts_and_blocks_reuse(self):
        self.request_reset_code()

        for _ in range(5):
            response = self.client.post(
                '/api/auth/password-reset/verify/',
                {'email': self.user.email, 'code': '000000'},
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        reset_code = PasswordResetCode.objects.get(user=self.user)
        self.assertEqual(reset_code.attempt_count, 5)
        self.assertTrue(reset_code.is_used)

        blocked_response = self.client.post(
            '/api/auth/password-reset/verify/',
            {'email': self.user.email, 'code': '000000'},
            format='json',
        )
        self.assertEqual(blocked_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            blocked_response.data['detail'],
            'This reset code has already been used. Request a new one.',
        )

    def test_code_cannot_be_reused_after_successful_reset(self):
        self.request_reset_code()
        raw_code = self.extract_code_from_last_email()

        self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'email': self.user.email,
                'code': raw_code,
                'new_password': 'FreshPass123!',
                'new_password_confirm': 'FreshPass123!',
            },
            format='json',
        )

        second_response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'email': self.user.email,
                'code': raw_code,
                'new_password': 'AnotherPass123!',
                'new_password_confirm': 'AnotherPass123!',
            },
            format='json',
        )

        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            second_response.data['detail'],
            'This reset code has already been used. Request a new one.',
        )

    def test_password_reset_blacklists_existing_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        self.request_reset_code()
        raw_code = self.extract_code_from_last_email()

        response = self.client.post(
            '/api/auth/password-reset/confirm/',
            {
                'email': self.user.email,
                'code': raw_code,
                'new_password': 'ResetPass789!',
                'new_password_confirm': 'ResetPass789!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json',
        )
        self.assertNotEqual(refresh_response.status_code, status.HTTP_200_OK)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class LoginOtpChallengeSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='otp-student',
            password=VALID_STUDENT_PASSWORD,
            full_name='OTP Student',
            student_id='S-7701',
            email='otp-student@example.com',
            role='STUDENT',
            is_active=True,
            email_verified=False,
        )
        self.client = APIClient()

    def login_for_challenge(self) -> str:
        response = self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.user.student_id,
                'password': VALID_STUDENT_PASSWORD,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['requires_otp'])
        return response.data['otp_session']

    def extract_code_from_last_email(self) -> str:
        self.assertTrue(mail.outbox)
        match = re.search(r'(\d{6})', mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(1)

    def test_login_returns_signed_otp_session_instead_of_user_id(self):
        response = self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.user.student_id,
                'password': VALID_STUDENT_PASSWORD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['requires_otp'])
        self.assertIn('otp_session', response.data)
        self.assertNotIn('user_id', response.data)

    def test_update_pending_email_requires_verification_session(self):
        otp_session = self.login_for_challenge()

        missing_session_response = self.client.post(
            '/api/auth/update-email/',
            {
                'user_id': self.user.id,
                'email': 'otp-updated@example.com',
            },
            format='json',
        )
        self.assertEqual(missing_session_response.status_code, status.HTTP_401_UNAUTHORIZED)

        update_response = self.client.post(
            '/api/auth/update-email/',
            {
                'otp_session': otp_session,
                'email': 'otp-updated@example.com',
            },
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertIn('otp_session', update_response.data)

        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'otp-updated@example.com')
        self.assertFalse(self.user.email_verified)

        old_session_response = self.client.post(
            '/api/auth/login-otp/send/',
            {'otp_session': otp_session},
            format='json',
        )
        self.assertEqual(old_session_response.status_code, status.HTTP_400_BAD_REQUEST)

        rotated_session_response = self.client.post(
            '/api/auth/login-otp/send/',
            {'otp_session': update_response.data['otp_session']},
            format='json',
        )
        self.assertEqual(rotated_session_response.status_code, status.HTTP_200_OK)

    def test_verify_login_otp_requires_verification_session(self):
        otp_session = self.login_for_challenge()

        send_response = self.client.post(
            '/api/auth/login-otp/send/',
            {'otp_session': otp_session},
            format='json',
        )
        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        raw_code = self.extract_code_from_last_email()

        missing_session_response = self.client.post(
            '/api/auth/login-otp/verify/',
            {
                'user_id': self.user.id,
                'code': raw_code,
            },
            format='json',
        )
        self.assertEqual(missing_session_response.status_code, status.HTTP_400_BAD_REQUEST)

        verify_response = self.client.post(
            '/api/auth/login-otp/verify/',
            {
                'otp_session': otp_session,
                'code': raw_code,
            },
            format='json',
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', verify_response.data)
        self.assertIn('refresh', verify_response.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)


class LogoutBlacklistTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='logout-student',
            password=VALID_STUDENT_PASSWORD,
            full_name='Logout Student',
            student_id='S-9901',
            email='logout-student@example.com',
            role='STUDENT',
            is_active=True,
            email_verified=True,
        )
        self.client = APIClient()

    def test_logout_blacklists_refresh_token(self):
        login_response = self.client.post(
            '/api/auth/login/',
            {
                'student_id': self.user.student_id,
                'password': VALID_STUDENT_PASSWORD,
            },
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        access = login_response.data['access']
        refresh = login_response.data['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        logout_response = self.client.post(
            '/api/auth/logout/',
            {'refresh': refresh},
            format='json',
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': refresh},
            format='json',
        )
        self.assertNotEqual(refresh_response.status_code, status.HTTP_200_OK)
