from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html_join

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import ContactMessage, EnrollmentRecord, Notification, User
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
admin.site.register(ContactMessage)


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


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'title', 'is_read', 'created_at', 'read_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('user__full_name', 'user__student_id', 'user__staff_id', 'title', 'message')
    readonly_fields = ('created_at', 'read_at')
