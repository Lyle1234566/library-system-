from datetime import timedelta

from django.db.models import Q
from rest_framework import serializers
from .models import (
    Book,
    BookCopy,
    BookReview,
    BorrowRequest,
    Category,
    FinePayment,
    RenewalRequest,
    Reservation,
    ReturnRequest,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name')


class BookSerializer(serializers.ModelSerializer):
    categories = CategorySerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='categories',
    )
    copies_total = serializers.SerializerMethodField()
    copies_available = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()
    is_borrowed_by_user = serializers.SerializerMethodField()
    has_pending_borrow_request = serializers.SerializerMethodField()
    has_pending_return_request = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    user_review = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = '__all__'
        read_only_fields = (
            'available',
            'copies_total',
            'copies_available',
            'is_borrowed_by_user',
            'has_pending_borrow_request',
            'has_pending_return_request',
            'average_rating',
            'review_count',
            'user_review',
        )

    def get_copies_total(self, obj):
        total = getattr(obj, 'copies_total', None)
        if total is not None:
            return total
        return obj.copies.count()

    def get_copies_available(self, obj):
        available_count = getattr(obj, 'copies_available_count', None)
        if available_count is not None:
            return available_count
        return obj.copies.filter(
            status=BookCopy.STATUS_AVAILABLE,
            is_reference_only=False,
        ).count()

    def get_available(self, obj):
        return self.get_copies_available(obj) > 0

    def get_is_borrowed_by_user(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return BorrowRequest.objects.filter(
            user=request.user,
            book=obj,
            status=BorrowRequest.STATUS_APPROVED,
        ).exists()

    def get_has_pending_borrow_request(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return BorrowRequest.objects.filter(
            user=request.user,
            book=obj,
            status=BorrowRequest.STATUS_PENDING,
        ).exists()

    def get_has_pending_return_request(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return ReturnRequest.objects.filter(
            borrow_request__user=request.user,
            borrow_request__book=obj,
            status=ReturnRequest.STATUS_PENDING,
        ).exists()

    def get_average_rating(self, obj):
        annotated = getattr(obj, 'average_rating_value', None)
        if annotated is not None:
            return round(float(annotated), 1)
        return obj.average_rating

    def get_review_count(self, obj):
        annotated = getattr(obj, 'review_count_value', None)
        if annotated is not None:
            return annotated
        return obj.review_count

    def get_user_review(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        review = BookReview.objects.filter(book=obj, user=request.user).first()
        if review:
            return {
                'id': review.id,
                'rating': review.rating,
                'review_text': review.review_text,
            }
        return None


class BorrowRequestSerializer(serializers.ModelSerializer):
    book = BookSerializer(read_only=True)
    user = serializers.SerializerMethodField()
    processed_by = serializers.SerializerMethodField()
    late_fee_amount = serializers.SerializerMethodField()
    overdue_days = serializers.SerializerMethodField()
    returned_at = serializers.SerializerMethodField()
    can_renew = serializers.SerializerMethodField()
    renewal_block_reason = serializers.SerializerMethodField()
    remaining_renewals = serializers.SerializerMethodField()
    renewal_duration_days = serializers.SerializerMethodField()
    pending_renewal_request_id = serializers.SerializerMethodField()
    pending_renewal_requested_at = serializers.SerializerMethodField()
    is_report_due = serializers.SerializerMethodField()
    report_overdue_days = serializers.SerializerMethodField()

    class Meta:
        model = BorrowRequest
        fields = (
            'id',
            'receipt_number',
            'book',
            'user',
            'status',
            'requested_at',
            'processed_at',
            'due_date',
            'returned_at',
            'late_fee_amount',
            'overdue_days',
            'renewal_count',
            'max_renewals',
            'remaining_renewals',
            'can_renew',
            'renewal_block_reason',
            'renewal_duration_days',
            'pending_renewal_request_id',
            'pending_renewal_requested_at',
            'last_renewed_at',
            'requested_borrow_days',
            'reporting_frequency',
            'last_reported_at',
            'next_report_due_date',
            'is_report_due',
            'report_overdue_days',
            'processed_by',
        )
        read_only_fields = fields

    def _user_summary(self, user):
        if not user:
            return None
        return {
            'id': user.id,
            'student_id': user.student_id,
            'staff_id': getattr(user, 'staff_id', None),
            'full_name': user.full_name,
            'role': user.role,
        }

    def get_user(self, obj):
        return self._user_summary(obj.user)

    def get_processed_by(self, obj):
        return self._user_summary(obj.processed_by)

    def get_late_fee_amount(self, obj):
        # Active borrows are calculated live; returned borrows use frozen amount.
        return str(obj.calculate_late_fee_amount())

    def get_overdue_days(self, obj):
        return obj.get_overdue_days()

    def get_returned_at(self, obj):
        if obj.status != BorrowRequest.STATUS_RETURNED:
            return None
        approved_return = obj.return_requests.filter(
            status=ReturnRequest.STATUS_APPROVED,
            processed_at__isnull=False,
        ).order_by('-processed_at').first()
        if approved_return:
            return approved_return.processed_at
        return obj.processed_at

    def get_can_renew(self, obj):
        return obj.can_renew()

    def get_renewal_block_reason(self, obj):
        return obj.get_renewal_block_reason()

    def get_remaining_renewals(self, obj):
        return obj.get_remaining_renewals()

    def get_renewal_duration_days(self, obj):
        return obj.get_renewal_duration_days()

    def get_pending_renewal_request_id(self, obj):
        pending_request = obj.get_pending_renewal_request()
        return pending_request.pk if pending_request else None

    def get_pending_renewal_requested_at(self, obj):
        pending_request = obj.get_pending_renewal_request()
        return pending_request.requested_at if pending_request else None

    def get_is_report_due(self, obj):
        return obj.is_report_due()

    def get_report_overdue_days(self, obj):
        return obj.get_report_overdue_days()


class ReturnRequestSerializer(serializers.ModelSerializer):
    borrow_request_id = serializers.IntegerField(read_only=True)
    receipt_number = serializers.CharField(source='borrow_request.receipt_number', read_only=True)
    book = BookSerializer(source='borrow_request.book', read_only=True)
    user = serializers.SerializerMethodField()
    processed_by = serializers.SerializerMethodField()

    class Meta:
        model = ReturnRequest
        fields = (
            'id',
            'borrow_request_id',
            'receipt_number',
            'book',
            'user',
            'status',
            'requested_at',
            'processed_at',
            'processed_by',
        )
        read_only_fields = fields

    def _user_summary(self, user):
        if not user:
            return None
        return {
            'id': user.id,
            'student_id': user.student_id,
            'staff_id': getattr(user, 'staff_id', None),
            'full_name': user.full_name,
            'role': user.role,
        }

    def get_user(self, obj):
        return self._user_summary(obj.borrow_request.user)

    def get_processed_by(self, obj):
        return self._user_summary(obj.processed_by)




class RenewalRequestSerializer(serializers.ModelSerializer):
    borrow_request_id = serializers.IntegerField(read_only=True)
    receipt_number = serializers.CharField(source='borrow_request.receipt_number', read_only=True)
    book = BookSerializer(source='borrow_request.book', read_only=True)
    user = serializers.SerializerMethodField()
    processed_by = serializers.SerializerMethodField()
    current_due_date = serializers.DateField(source='borrow_request.due_date', read_only=True)
    projected_due_date = serializers.SerializerMethodField()

    class Meta:
        model = RenewalRequest
        fields = (
            'id',
            'borrow_request_id',
            'receipt_number',
            'book',
            'user',
            'status',
            'requested_extension_days',
            'current_due_date',
            'projected_due_date',
            'requested_at',
            'processed_at',
            'processed_by',
        )
        read_only_fields = fields

    def _user_summary(self, user):
        if not user:
            return None
        return {
            'id': user.id,
            'student_id': user.student_id,
            'staff_id': getattr(user, 'staff_id', None),
            'full_name': user.full_name,
            'role': user.role,
        }

    def get_user(self, obj):
        return self._user_summary(obj.borrow_request.user)

    def get_processed_by(self, obj):
        return self._user_summary(obj.processed_by)

    def get_projected_due_date(self, obj):
        due_date = obj.borrow_request.due_date
        if not due_date:
            return None
        if obj.status != RenewalRequest.STATUS_PENDING:
            return due_date
        extension_days = obj.requested_extension_days or obj.borrow_request.get_renewal_duration_days()
        return due_date + timedelta(days=extension_days)


class FinePaymentSerializer(serializers.ModelSerializer):
    borrow_request_id = serializers.IntegerField(read_only=True)
    user = serializers.SerializerMethodField()
    book = BookSerializer(source='borrow_request.book', read_only=True)
    receipt_number = serializers.CharField(source='borrow_request.receipt_number', read_only=True)

    class Meta:
        model = FinePayment
        fields = (
            'id',
            'borrow_request_id',
            'receipt_number',
            'book',
            'user',
            'amount',
            'status',
            'payment_method',
            'payment_reference',
            'paid_at',
            'processed_by',
            'notes',
            'created_at',
        )
        read_only_fields = fields

    def get_user(self, obj):
        user = getattr(obj.borrow_request, 'user', None)
        if not user:
            return None
        return {
            'id': user.id,
            'student_id': user.student_id,
            'staff_id': getattr(user, 'staff_id', None),
            'full_name': user.full_name,
            'role': user.role,
        }


class ReservationSerializer(serializers.ModelSerializer):
    book = BookSerializer(read_only=True)
    user = serializers.SerializerMethodField()
    current_position = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = (
            'id',
            'book',
            'user',
            'status',
            'created_at',
            'notified_at',
            'expires_at',
            'position',
            'current_position',
        )
        read_only_fields = fields

    def get_user(self, obj):
        user = obj.user
        return {
            'id': user.id,
            'student_id': user.student_id,
            'staff_id': getattr(user, 'staff_id', None),
            'full_name': user.full_name,
            'role': user.role,
        }

    def get_current_position(self, obj):
        if obj.status != Reservation.STATUS_PENDING:
            return None
        return Reservation.objects.filter(
            book=obj.book,
            status=Reservation.STATUS_PENDING,
        ).filter(
            Q(created_at__lt=obj.created_at) | Q(created_at=obj.created_at, id__lte=obj.id)
        ).count()


class BookReviewSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = BookReview
        fields = ('id', 'user', 'book', 'rating', 'review_text', 'created_at', 'updated_at')
        read_only_fields = ('user', 'book', 'created_at', 'updated_at')

    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'full_name': obj.user.full_name,
            'avatar': obj.user.avatar.url if obj.user.avatar else None,
        }

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        validated_data['book_id'] = self.context['view'].kwargs.get('book_id')
        return super().create(validated_data)
