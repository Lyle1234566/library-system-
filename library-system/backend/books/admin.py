from django import forms
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import Book, BookCopy, BorrowRequest, BorrowedBook, Category, FinePayment, ReturnRequest, sync_overdue_fine_payments, BookReview


class OverdueStatusFilter(admin.SimpleListFilter):
    title = 'overdue status'
    parameter_name = 'overdue_status'

    def lookups(self, request, model_admin):
        return (
            ('overdue', 'Overdue'),
            ('current', 'Not overdue'),
        )

    def queryset(self, request, queryset):
        today = timezone.localdate()
        value = self.value()
        if value == 'overdue':
            return queryset.filter(
                status=BorrowRequest.STATUS_APPROVED,
                due_date__isnull=False,
                due_date__lt=today,
            )
        if value == 'current':
            return queryset.filter(
                status=BorrowRequest.STATUS_APPROVED,
            ).filter(
                Q(due_date__isnull=True) | Q(due_date__gte=today)
            )
        return queryset


def can_manage_book_copies(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or getattr(user, 'role', None) == 'ADMIN')
    )


class BookAdminForm(forms.ModelForm):
    copies_total_input = forms.IntegerField(
        min_value=0,
        required=False,
        label='Total copies',
        help_text='Set the total number of physical copies for this book.',
    )

    class Meta:
        model = Book
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['copies_total_input'].initial = self.instance.copies.count()
        else:
            self.fields['copies_total_input'].initial = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    form = BookAdminForm
    list_display = (
        'cover_preview',
        'title',
        'author',
        'isbn',
        'copies_total',
        'copies_available_now',
        'available_now',
        'edit_link',
        'delete_link',
    )
    readonly_fields = (
        'copies_available_now',
        'available_now',
        'cover_preview',
        'cover_back_preview',
    )
    filter_horizontal = ('categories',)
    fields = (
        'title',
        'author',
        'isbn',
        'published_date',
        'genre',
        'description',
        'language',
        'grade_level',
        'location_shelf',
        'categories',
        'cover_image',
        'cover_preview',
        'cover_back',
        'cover_back_preview',
        'copies_total_input',
        'copies_available_now',
        'available_now',
    )
    inlines = []

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.annotate(
            copies_total_count=Count('copies', distinct=True),
            copies_available_count=Count(
                'copies',
                filter=Q(
                    copies__status=BookCopy.STATUS_AVAILABLE,
                    copies__is_reference_only=False,
                ),
                distinct=True,
            ),
        )

    def copies_total(self, obj):
        total = getattr(obj, 'copies_total_count', None)
        if total is not None:
            return total
        return obj.copies.count()

    copies_total.short_description = 'Total copies'

    def copies_available_now(self, obj):
        available = getattr(obj, 'copies_available_count', None)
        if available is not None:
            return available
        return obj.copies.filter(
            status=BookCopy.STATUS_AVAILABLE,
            is_reference_only=False,
        ).count()

    copies_available_now.short_description = 'Available copies'

    def available_now(self, obj):
        return self.copies_available_now(obj) > 0

    available_now.boolean = True
    available_now.short_description = 'Available'

    def cover_preview(self, obj):
        if not obj or not obj.cover_image:
            return 'No image'
        return format_html(
            '<img src="{}" style="max-height: 80px; max-width: 80px;" />',
            obj.cover_image.url,
        )

    cover_preview.short_description = 'Cover'

    def cover_back_preview(self, obj):
        if not obj or not obj.cover_back:
            return 'No image'
        return format_html(
            '<img src="{}" style="max-height: 80px; max-width: 80px;" />',
            obj.cover_back.url,
        )

    cover_back_preview.short_description = 'Back cover'

    def edit_link(self, obj):
        url = reverse('admin:books_book_change', args=[obj.pk])
        return format_html('<a class="button" href="{}">Edit</a>', url)

    edit_link.short_description = 'Edit'

    def delete_link(self, obj):
        url = reverse('admin:books_book_delete', args=[obj.pk])
        return format_html('<a class="button" href="{}">Delete</a>', url)

    delete_link.short_description = 'Delete'

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        copies_field = form.base_fields.get('copies_total_input')
        if copies_field and not can_manage_book_copies(request.user):
            copies_field.disabled = True
            copies_field.help_text = 'Only super admins can edit total copies.'
        return form

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        desired_total = form.cleaned_data.get('copies_total_input')
        if desired_total is None:
            return
        if not can_manage_book_copies(request.user):
            return

        try:
            updated = self._set_book_copies_total(form.instance, desired_total)
        except ValueError as exc:
            self.message_user(request, str(exc), level=messages.WARNING)
            return

        if updated:
            self.message_user(request, 'Total copies updated.', level=messages.SUCCESS)

    def _set_book_copies_total(self, book: Book, target_total: int) -> bool:
        with transaction.atomic():
            locked_book = Book.objects.select_for_update().get(pk=book.pk)
            copies = BookCopy.objects.select_for_update().filter(book=locked_book).order_by('-id')
            current_total = copies.count()

            if target_total == current_total:
                return False

            if target_total > current_total:
                for _ in range(target_total - current_total):
                    BookCopy.objects.create(book=locked_book, status=BookCopy.STATUS_AVAILABLE)
                return True

            copies_to_remove = current_total - target_total
            removable_ids = list(
                copies.filter(status=BookCopy.STATUS_AVAILABLE).values_list('id', flat=True)[:copies_to_remove]
            )
            if len(removable_ids) < copies_to_remove:
                minimum_total = current_total - copies.filter(status=BookCopy.STATUS_AVAILABLE).count()
                raise ValueError(
                    f'Cannot reduce copies below {minimum_total}. '
                    'Borrowed or maintenance copies cannot be removed.'
                )

            BookCopy.objects.filter(id__in=removable_ids).delete()
            return True


@admin.register(BorrowRequest)
class BorrowRequestAdmin(admin.ModelAdmin):
    list_display = (
        'book',
        'copy_barcode',
        'receipt_number',
        'user',
        'status',
        'requested_at',
        'processed_at',
        'due_date',
        'late_fee_amount',
        'processed_by',
        'approve_link',
        'reject_link',
    )
    list_filter = ('status', 'requested_at', 'processed_at')
    search_fields = ('book__title', 'book__isbn', 'user__student_id', 'user__full_name', 'copy__barcode', 'receipt_number')
    readonly_fields = (
        'status',
        'requested_at',
        'processed_at',
        'due_date',
        'late_fee_amount',
        'due_soon_reminder_sent_at',
        'processed_by',
        'copy',
        'receipt_number',
    )
    actions = ['approve_requests', 'reject_requests']

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.GET.get('status__exact'):
            return queryset
        return queryset.exclude(status=BorrowRequest.STATUS_RETURNED)

    def copy_barcode(self, obj):
        if not obj.copy:
            return '-'
        return obj.copy.barcode

    copy_barcode.short_description = 'Copy barcode'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:borrow_request_id>/approve/',
                self.admin_site.admin_view(self.process_approve),
                name='books_borrowrequest_approve',
            ),
            path(
                '<int:borrow_request_id>/reject/',
                self.admin_site.admin_view(self.process_reject),
                name='books_borrowrequest_reject',
            ),
        ]
        return custom_urls + urls

    def approve_link(self, obj):
        if obj.status != BorrowRequest.STATUS_PENDING:
            return '-'
        url = reverse('admin:books_borrowrequest_approve', args=[obj.pk])
        return format_html('<a class="button" href="{}">Approve</a>', url)

    approve_link.short_description = 'Approve'

    def reject_link(self, obj):
        if obj.status != BorrowRequest.STATUS_PENDING:
            return '-'
        url = reverse('admin:books_borrowrequest_reject', args=[obj.pk])
        return format_html('<a class="button" href="{}">Reject</a>', url)

    reject_link.short_description = 'Reject'

    def process_approve(self, request, borrow_request_id):
        if not self.has_change_permission(request):
            raise PermissionDenied
        borrow_request = get_object_or_404(BorrowRequest, pk=borrow_request_id)
        try:
            borrow_request.approve(processed_by=request.user)
            self.message_user(request, 'Borrow request approved.', level=messages.SUCCESS)
        except ValueError as exc:
            self.message_user(request, str(exc), level=messages.WARNING)
        return redirect(reverse('admin:books_borrowrequest_changelist'))

    def process_reject(self, request, borrow_request_id):
        if not self.has_change_permission(request):
            raise PermissionDenied
        borrow_request = get_object_or_404(BorrowRequest, pk=borrow_request_id)
        try:
            borrow_request.reject(processed_by=request.user)
            self.message_user(request, 'Borrow request rejected.', level=messages.SUCCESS)
        except ValueError as exc:
            self.message_user(request, str(exc), level=messages.WARNING)
        return redirect(reverse('admin:books_borrowrequest_changelist'))

    def approve_requests(self, request, queryset):
        approved = 0
        for borrow_request in queryset:
            try:
                borrow_request.approve(processed_by=request.user)
                approved += 1
            except ValueError as exc:
                self.message_user(
                    request,
                    f"Request {borrow_request.id}: {exc}",
                    level=messages.WARNING,
                )
        if approved:
            self.message_user(
                request,
                f"Approved {approved} request(s).",
                level=messages.SUCCESS,
            )

    approve_requests.short_description = 'Approve selected borrow requests'

    def reject_requests(self, request, queryset):
        rejected = 0
        for borrow_request in queryset:
            try:
                borrow_request.reject(processed_by=request.user)
                rejected += 1
            except ValueError as exc:
                self.message_user(
                    request,
                    f"Request {borrow_request.id}: {exc}",
                    level=messages.WARNING,
                )
        if rejected:
            self.message_user(
                request,
                f"Rejected {rejected} request(s).",
                level=messages.SUCCESS,
            )

    reject_requests.short_description = 'Reject selected borrow requests'


@admin.register(BorrowedBook)
class BorrowedBookAdmin(admin.ModelAdmin):
    list_display = (
        'book',
        'copy_barcode',
        'receipt_number',
        'user',
        'borrowed_at',
        'due_date',
        'overdue_days',
        'current_late_fee',
        'processed_by',
    )
    list_filter = (OverdueStatusFilter, 'processed_at', 'processed_by')
    search_fields = ('book__title', 'book__isbn', 'user__student_id', 'user__full_name', 'copy__barcode', 'receipt_number')
    readonly_fields = (
        'book',
        'copy',
        'receipt_number',
        'user',
        'status',
        'requested_at',
        'processed_at',
        'due_date',
        'late_fee_amount',
        'due_soon_reminder_sent_at',
        'processed_by',
    )
    date_hierarchy = 'processed_at'
    ordering = ('-processed_at',)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related('book', 'user', 'processed_by', 'copy')
            .filter(status=BorrowRequest.STATUS_APPROVED)
        )

    def copy_barcode(self, obj):
        if not obj.copy:
            return '-'
        return obj.copy.barcode

    copy_barcode.short_description = 'Copy barcode'

    def borrowed_at(self, obj):
        return obj.processed_at or obj.requested_at

    borrowed_at.short_description = 'Borrowed at'
    borrowed_at.admin_order_field = 'processed_at'

    def overdue_days(self, obj):
        return obj.get_overdue_days(as_of=timezone.localdate())

    overdue_days.short_description = 'Overdue days'

    def current_late_fee(self, obj):
        return obj.calculate_late_fee_amount(as_of=timezone.localdate())

    current_late_fee.short_description = 'Current late fee'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = (
        'borrow_request',
        'status',
        'requested_at',
        'processed_at',
        'processed_by',
        'approve_link',
        'reject_link',
    )
    list_filter = ('status', 'requested_at', 'processed_at')
    search_fields = ('borrow_request__book__title', 'borrow_request__book__isbn', 'borrow_request__user__student_id', 'borrow_request__user__full_name', 'borrow_request__copy__barcode')
    readonly_fields = ('borrow_request', 'status', 'requested_at', 'processed_at', 'processed_by')
    actions = ['approve_returns', 'reject_returns']

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:return_request_id>/approve/',
                self.admin_site.admin_view(self.process_approve),
                name='books_returnrequest_approve',
            ),
            path(
                '<int:return_request_id>/reject/',
                self.admin_site.admin_view(self.process_reject),
                name='books_returnrequest_reject',
            ),
        ]
        return custom_urls + urls

    def approve_link(self, obj):
        if obj.status != ReturnRequest.STATUS_PENDING:
            return '-'
        url = reverse('admin:books_returnrequest_approve', args=[obj.pk])
        return format_html('<a class="button" href="{}">Approve</a>', url)

    approve_link.short_description = 'Approve'

    def reject_link(self, obj):
        if obj.status != ReturnRequest.STATUS_PENDING:
            return '-'
        url = reverse('admin:books_returnrequest_reject', args=[obj.pk])
        return format_html('<a class="button" href="{}">Reject</a>', url)

    reject_link.short_description = 'Reject'

    def process_approve(self, request, return_request_id):
        if not self.has_change_permission(request):
            raise PermissionDenied
        return_request = get_object_or_404(ReturnRequest, pk=return_request_id)
        try:
            return_request.approve(processed_by=request.user)
            self.message_user(request, 'Return request approved.', level=messages.SUCCESS)
        except ValueError as exc:
            self.message_user(request, str(exc), level=messages.WARNING)
        return redirect(reverse('admin:books_returnrequest_changelist'))

    def process_reject(self, request, return_request_id):
        if not self.has_change_permission(request):
            raise PermissionDenied
        return_request = get_object_or_404(ReturnRequest, pk=return_request_id)
        try:
            return_request.reject(processed_by=request.user)
            self.message_user(request, 'Return request rejected.', level=messages.SUCCESS)
        except ValueError as exc:
            self.message_user(request, str(exc), level=messages.WARNING)
        return redirect(reverse('admin:books_returnrequest_changelist'))

    def approve_returns(self, request, queryset):
        approved = 0
        for return_request in queryset:
            try:
                return_request.approve(processed_by=request.user)
                approved += 1
            except ValueError as exc:
                self.message_user(
                    request,
                    f"Return request {return_request.id}: {exc}",
                    level=messages.WARNING,
                )
        if approved:
            self.message_user(
                request,
                f"Approved {approved} return request(s).",
                level=messages.SUCCESS,
            )

    approve_returns.short_description = 'Approve selected return requests'

    def reject_returns(self, request, queryset):
        rejected = 0
        for return_request in queryset:
            try:
                return_request.reject(processed_by=request.user)
                rejected += 1
            except ValueError as exc:
                self.message_user(
                    request,
                    f"Return request {return_request.id}: {exc}",
                    level=messages.WARNING,
                )
        if rejected:
            self.message_user(
                request,
                f"Rejected {rejected} return request(s).",
                level=messages.SUCCESS,
            )

    reject_returns.short_description = 'Reject selected return requests'


class BookCopyInline(admin.TabularInline):
    model = BookCopy
    extra = 0
    fields = ('barcode', 'status', 'location_room', 'location_shelf', 'is_reference_only')

    def has_view_permission(self, request, obj=None):
        return can_manage_book_copies(request.user) or super().has_view_permission(request, obj)

    def has_add_permission(self, request, obj=None):
        return can_manage_book_copies(request.user) or super().has_add_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        return can_manage_book_copies(request.user) or super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return can_manage_book_copies(request.user) or super().has_delete_permission(request, obj)


BookAdmin.inlines = [BookCopyInline]


@admin.register(FinePayment)
class FinePaymentAdmin(admin.ModelAdmin):
    list_display = ('borrow_request', 'amount', 'status', 'paid_at', 'processed_by')
    list_filter = ('status', 'paid_at')
    search_fields = ('borrow_request__user__full_name', 'payment_reference')
    readonly_fields = ('created_at',)

    def get_queryset(self, request):
        sync_overdue_fine_payments(as_of=timezone.localdate())
        return super().get_queryset(request)


@admin.register(BookReview)
class BookReviewAdmin(admin.ModelAdmin):
    list_display = ('book', 'user', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('book__title', 'user__username', 'review_text')
    readonly_fields = ('user', 'book', 'created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(BookCopy)
class BookCopyAdmin(admin.ModelAdmin):
    list_display = ('barcode', 'book', 'status', 'location_room', 'location_shelf', 'is_reference_only')
    list_filter = ('status', 'location_room', 'location_shelf', 'is_reference_only')
    search_fields = ('barcode', 'book__title', 'book__isbn')
