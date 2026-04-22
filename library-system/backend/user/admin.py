from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html_join

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import ContactMessage, EnrollmentRecord, Notification, TeacherRecord, User
from books.models import BorrowRequest

class UserAdmin(BaseUserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    list_display = (
        'username',
        'student_id',
        'staff_id',
        'email',
        'full_name',
        'role',
        'is_working_student',
        'is_active',
        'is_staff',
        'date_joined',
    )
    list_filter = ('role', 'is_working_student', 'is_active', 'is_staff', 'date_joined')
    search_fields = ('username', 'student_id', 'staff_id', 'email', 'full_name')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'student_id', 'staff_id', 'email', 'role', 'is_working_student')}),
        ('Borrowing Proof', {'fields': ('borrow_receipts',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username',
                'student_id',
                'staff_id',
                'email',
                'full_name',
                'role',
                'is_working_student',
                'password1',
                'password2',
            ),
        }),
    )
    
    readonly_fields = ('date_joined', 'last_login', 'borrow_receipts')
    filter_horizontal = ('groups', 'user_permissions')

    def borrow_receipts(self, obj):
        requests = (
            BorrowRequest.objects.filter(
                user=obj,
                status__in=[BorrowRequest.STATUS_APPROVED, BorrowRequest.STATUS_RETURNED],
            )
            .select_related('book')
            .order_by('-processed_at', '-requested_at')[:10]
        )
        if not requests:
            return 'No approved borrows.'
        return format_html_join(
            '<br>',
            '{} - {} ({})',
            ((request.receipt_number or '-', request.book.title, request.get_status_display()) for request in requests),
        )

    borrow_receipts.short_description = 'Borrowing proof'

    class Media:
        js = ('user/admin-user-role.js',)

admin.site.register(User, UserAdmin)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'sender_role', 'sender_identifier', 'status', 'subject', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = (
        'name',
        'email',
        'subject',
        'message',
        'internal_notes',
        'user__full_name',
        'user__student_id',
        'user__staff_id',
    )
    readonly_fields = ('created_at', 'handled_at')
    ordering = ('-created_at',)

    def sender_role(self, obj):
        if not obj.user:
            return 'Guest'
        if obj.user.role == 'WORKING' or (obj.user.role == 'STUDENT' and obj.user.is_working_student):
            return 'Working Student'
        return obj.user.get_role_display()

    def sender_identifier(self, obj):
        if not obj.user:
            return '-'
        return obj.user.staff_id or obj.user.student_id or '-'

    sender_role.short_description = 'Sender role'
    sender_identifier.short_description = 'Account ID'


@admin.register(EnrollmentRecord)
class EnrollmentRecordAdmin(admin.ModelAdmin):
    list_display = (
        'student_id',
        'full_name',
        'school_email',
        'program',
        'year_level',
        'academic_term',
        'is_currently_enrolled',
        'updated_at',
    )
    list_filter = ('is_currently_enrolled', 'academic_term', 'year_level')
    search_fields = ('student_id', 'full_name', 'school_email', 'program')
    ordering = ('student_id',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TeacherRecord)
class TeacherRecordAdmin(admin.ModelAdmin):
    list_display = (
        'staff_id',
        'full_name',
        'school_email',
        'department',
        'academic_term',
        'is_active',
        'updated_at',
    )
    list_filter = ('is_active', 'department', 'academic_term')
    search_fields = ('staff_id', 'full_name', 'school_email', 'department')
    ordering = ('staff_id',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'title', 'is_read', 'created_at', 'read_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('user__full_name', 'user__student_id', 'user__staff_id', 'title', 'message')
    readonly_fields = ('created_at', 'read_at')
