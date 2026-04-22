from collections import Counter
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Book,
    BookCopy,
    BorrowRequest,
    Category,
    FinePayment,
    RenewalRequest,
    Reservation,
    ReturnRequest,
    BookReview,
    create_user_notification,
    notify_librarian_dashboard,
    recalculate_pending_reservation_positions,
    sync_overdue_fine_payments,
)
from .serializers import (
    BookSerializer,
    BorrowRequestSerializer,
    CategorySerializer,
    FinePaymentSerializer,
    RenewalRequestSerializer,
    ReservationSerializer,
    ReturnRequestSerializer,
    BookReviewSerializer,
)


User = get_user_model()


def is_super_admin(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or getattr(user, 'role', None) == 'ADMIN')
    )


def has_role(user, roles: set[str]) -> bool:
    return bool(user and user.is_authenticated and getattr(user, 'role', None) in roles)


def is_librarian(user) -> bool:
    return has_role(user, {'LIBRARIAN'})


def is_teacher(user) -> bool:
    return has_role(user, {'TEACHER'})


def is_staff_member(user) -> bool:
    return has_role(user, {'STAFF'})


def is_working_student(user) -> bool:
    return bool(user and user.is_authenticated and getattr(user, 'has_working_student_access', lambda: False)())


def is_circulation_staff(user) -> bool:
    return bool(
        is_super_admin(user)
        or is_librarian(user)
        or is_staff_member(user)
        or is_working_student(user)
    )


def can_view_all_borrow_requests(user) -> bool:
    return bool(is_circulation_staff(user))


def can_manage_borrow_requests(user) -> bool:
    return bool(is_circulation_staff(user))


def can_view_all_return_requests(user) -> bool:
    return bool(is_circulation_staff(user))


def can_manage_return_requests(user) -> bool:
    return bool(is_circulation_staff(user))


def can_view_all_renewal_requests(user) -> bool:
    return bool(is_circulation_staff(user))


def can_manage_renewal_requests(user) -> bool:
    return bool(is_circulation_staff(user))


def can_manage_fine_payments(user) -> bool:
    return bool(is_circulation_staff(user))


def can_manage_books(user, action: str | None = None) -> bool:
    if is_super_admin(user) or is_librarian(user):
        return True
    return False


def can_manage_categories(user, action: str | None = None) -> bool:
    if is_super_admin(user) or is_librarian(user):
        return True
    return False


def can_request_patron_borrow(user) -> bool:
    return has_role(user, {'STUDENT', 'TEACHER'}) or is_working_student(user)


def can_request_patron_return(user) -> bool:
    return can_request_patron_borrow(user)


def can_request_patron_reservation(user) -> bool:
    return can_request_patron_borrow(user)


class CanManageBorrowRequests(BasePermission):
    def has_permission(self, request, view):
        return can_manage_borrow_requests(request.user)


class CanManageReturnRequests(BasePermission):
    def has_permission(self, request, view):
        return can_manage_return_requests(request.user)


class CanManageRenewalRequests(BasePermission):
    def has_permission(self, request, view):
        return can_manage_renewal_requests(request.user)


class CanManageFinePayments(BasePermission):
    def has_permission(self, request, view):
        return can_manage_fine_payments(request.user)


class CanManageBooks(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return can_manage_books(request.user, getattr(view, 'action', None))


class CanManageCategories(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return can_manage_categories(request.user, getattr(view, 'action', None))


def get_unpaid_fine_block_limit() -> Decimal:
    raw = getattr(settings, 'MAX_UNPAID_FINE_AMOUNT', Decimal('50.00'))
    try:
        return Decimal(str(raw)).quantize(Decimal('0.01'))
    except Exception:
        return Decimal('50.00')


def expire_stale_reservations(book_id: int | None = None) -> set[int]:
    now = timezone.now()
    stale_qs = Reservation.objects.filter(
        status=Reservation.STATUS_NOTIFIED,
        expires_at__isnull=False,
        expires_at__lte=now,
    )
    if book_id is not None:
        stale_qs = stale_qs.filter(book_id=book_id)

    stale_items = list(stale_qs.select_related('book'))
    if not stale_items:
        return set()

    affected_book_ids: set[int] = set()
    for reservation in stale_items:
        if reservation.status != Reservation.STATUS_NOTIFIED:
            continue
        reservation.status = Reservation.STATUS_EXPIRED
        reservation.save(update_fields=['status'])
        affected_book_ids.add(reservation.book_id)
        create_user_notification(
            user_id=reservation.user_id,
            notification_type='RESERVATION_EXPIRED',
            title='Reservation expired',
            message=(
                f"Your reservation for '{reservation.book.title}' has expired."
            ),
            data={
                'reservation_id': reservation.pk,
                'book_id': reservation.book_id,
            },
        )
    return affected_book_ids


def get_books_catalog_queryset():
    successful_borrow_statuses = [
        BorrowRequest.STATUS_APPROVED,
        BorrowRequest.STATUS_RETURNED,
    ]
    return Book.objects.all().prefetch_related('categories').annotate(
        copies_total=Count('copies', distinct=True),
        copies_available_count=Count(
            'copies',
            filter=Q(
                copies__status=BookCopy.STATUS_AVAILABLE,
                copies__is_reference_only=False,
            ),
            distinct=True,
        ),
        circulation_count=Count(
            'borrow_requests',
            filter=Q(borrow_requests__status__in=successful_borrow_statuses),
            distinct=True,
        ),
        average_rating_value=Avg('reviews__rating'),
        review_count_value=Count('reviews', distinct=True),
    ).distinct()


def normalize_recommendation_value(value: str | None) -> str:
    return (value or '').strip().lower()


def get_book_rating_value(book: Book) -> float:
    annotated = getattr(book, 'average_rating_value', None)
    if annotated is not None:
        return round(float(annotated), 1)
    return float(book.average_rating or 0)


def rank_recommendation_items(items: list[dict], limit: int) -> list[dict]:
    ranked = sorted(
        items,
        key=lambda item: (
            -item['score'],
            -int(getattr(item['book'], 'copies_available_count', 0) > 0),
            -getattr(item['book'], 'circulation_count', 0),
            -get_book_rating_value(item['book']),
            item['book'].title.lower(),
        ),
    )
    return ranked[:limit]


def serialize_recommendation_items(items: list[dict], context: dict) -> list[dict]:
    books = [item['book'] for item in items]
    serialized_books = BookSerializer(books, many=True, context=context).data
    return [
        {
            'book': book_data,
            'reason': item['reason'],
        }
        for item, book_data in zip(items, serialized_books)
    ]


def build_user_recommendation_profile(user):
    if not user or not user.is_authenticated:
        return None

    history = list(
        BorrowRequest.objects.filter(
            user=user,
            status__in=[BorrowRequest.STATUS_APPROVED, BorrowRequest.STATUS_RETURNED],
        )
        .select_related('book')
        .prefetch_related('book__categories')
        .order_by('-requested_at')[:30]
    )

    category_counter: Counter[int] = Counter()
    author_counter: Counter[str] = Counter()
    genre_counter: Counter[str] = Counter()
    language_counter: Counter[str] = Counter()
    grade_counter: Counter[str] = Counter()

    for borrow in history:
        book = borrow.book
        if not book:
            continue
        for category in book.categories.all():
            category_counter[category.id] += 1

        author_key = normalize_recommendation_value(book.author)
        genre_key = normalize_recommendation_value(book.genre)
        language_key = normalize_recommendation_value(book.language)
        grade_key = normalize_recommendation_value(book.grade_level)

        if author_key:
            author_counter[author_key] += 1
        if genre_key:
            genre_counter[genre_key] += 1
        if language_key:
            language_counter[language_key] += 1
        if grade_key:
            grade_counter[grade_key] += 1

    excluded_book_ids = set(
        BorrowRequest.objects.filter(
            user=user,
            status__in=[
                BorrowRequest.STATUS_PENDING,
                BorrowRequest.STATUS_APPROVED,
                BorrowRequest.STATUS_RETURNED,
            ],
        ).values_list('book_id', flat=True)
    )

    return {
        'has_history': bool(history),
        'category_counter': category_counter,
        'author_counter': author_counter,
        'genre_counter': genre_counter,
        'language_counter': language_counter,
        'grade_counter': grade_counter,
        'excluded_book_ids': excluded_book_ids,
    }


def build_popular_recommendations(*, exclude_ids: set[int] | None = None, limit: int = 6) -> list[dict]:
    excluded = exclude_ids or set()
    items: list[dict] = []

    for candidate in get_books_catalog_queryset().exclude(pk__in=excluded):
        available_now = getattr(candidate, 'copies_available_count', 0) > 0
        circulation_count = getattr(candidate, 'circulation_count', 0)
        rating_value = get_book_rating_value(candidate)
        review_count = getattr(candidate, 'review_count_value', 0) or 0

        score = (
            (3.0 if available_now else 0.0)
            + min(circulation_count, 10) * 1.3
            + min(rating_value, 5.0)
            + min(review_count, 5) * 0.4
        )

        reasons = []
        if circulation_count:
            reasons.append('Frequently borrowed')
        if rating_value >= 4:
            reasons.append('Well reviewed')
        if available_now:
            reasons.append('Available now')

        items.append(
            {
                'book': candidate,
                'score': score,
                'reason': '; '.join(reasons[:2]) or 'Popular with readers',
            }
        )

    return rank_recommendation_items(items, limit)


def build_book_recommendations(reference_book: Book, user=None, *, limit: int = 6) -> list[dict]:
    reference_categories = {category.id: category.name for category in reference_book.categories.all()}
    profile = build_user_recommendation_profile(user)
    items: list[dict] = []

    for candidate in get_books_catalog_queryset().exclude(pk=reference_book.pk):
        candidate_categories = list(candidate.categories.all())
        shared_categories = [
            category.name for category in candidate_categories if category.id in reference_categories
        ]
        same_author = bool(
            normalize_recommendation_value(candidate.author)
            and normalize_recommendation_value(candidate.author)
            == normalize_recommendation_value(reference_book.author)
        )
        same_genre = bool(
            normalize_recommendation_value(candidate.genre)
            and normalize_recommendation_value(candidate.genre)
            == normalize_recommendation_value(reference_book.genre)
        )
        same_language = bool(
            normalize_recommendation_value(candidate.language)
            and normalize_recommendation_value(candidate.language)
            == normalize_recommendation_value(reference_book.language)
        )
        same_grade = bool(
            normalize_recommendation_value(candidate.grade_level)
            and normalize_recommendation_value(candidate.grade_level)
            == normalize_recommendation_value(reference_book.grade_level)
        )
        available_now = getattr(candidate, 'copies_available_count', 0) > 0
        circulation_count = getattr(candidate, 'circulation_count', 0)
        rating_value = get_book_rating_value(candidate)

        history_alignment = 0.0
        if profile and profile['has_history']:
            for category in candidate_categories:
                history_alignment += profile['category_counter'].get(category.id, 0) * 0.8
            history_alignment += (
                profile['author_counter'].get(normalize_recommendation_value(candidate.author), 0) * 1.0
            )
            history_alignment += (
                profile['genre_counter'].get(normalize_recommendation_value(candidate.genre), 0) * 0.9
            )

        score = (
            len(shared_categories) * 10.0
            + (8.0 if same_author else 0.0)
            + (5.0 if same_genre else 0.0)
            + (3.0 if same_language else 0.0)
            + (2.0 if same_grade else 0.0)
            + (1.5 if available_now else 0.0)
            + min(circulation_count, 5) * 0.8
            + min(rating_value, 5.0) * 0.6
            + history_alignment
        )

        reasons = []
        if shared_categories:
            reasons.append(f"Shared category: {shared_categories[0]}")
        if same_author:
            reasons.append('Same author')
        if same_genre and candidate.genre:
            reasons.append(f"{candidate.genre} match")
        if same_language and candidate.language:
            reasons.append(f"{candidate.language} language match")
        if same_grade and candidate.grade_level:
            reasons.append(f"{candidate.grade_level} reading level")
        if not reasons and available_now:
            reasons.append('Available now')
        if not reasons and circulation_count:
            reasons.append('Popular with readers')

        items.append(
            {
                'book': candidate,
                'score': score,
                'reason': '; '.join(reasons[:2]) or 'Recommended next read',
            }
        )

    ranked = rank_recommendation_items(items, limit)
    if ranked:
        return ranked
    return build_popular_recommendations(exclude_ids={reference_book.pk}, limit=limit)


def build_personalized_recommendations(user, *, limit: int = 6) -> tuple[list[dict], bool, set[int]]:
    profile = build_user_recommendation_profile(user)
    excluded_book_ids = set(profile['excluded_book_ids']) if profile else set()

    if not profile or not profile['has_history']:
        return (
            build_popular_recommendations(exclude_ids=excluded_book_ids, limit=limit),
            False,
            excluded_book_ids,
        )

    items: list[dict] = []
    for candidate in get_books_catalog_queryset().exclude(pk__in=excluded_book_ids):
        candidate_categories = list(candidate.categories.all())
        matched_categories = [
            category.name
            for category in candidate_categories
            if profile['category_counter'].get(category.id, 0)
        ]
        category_score = sum(
            profile['category_counter'].get(category.id, 0) * 6.0 for category in candidate_categories
        )
        author_hits = profile['author_counter'].get(normalize_recommendation_value(candidate.author), 0)
        genre_hits = profile['genre_counter'].get(normalize_recommendation_value(candidate.genre), 0)
        language_hits = profile['language_counter'].get(normalize_recommendation_value(candidate.language), 0)
        grade_hits = profile['grade_counter'].get(normalize_recommendation_value(candidate.grade_level), 0)
        available_now = getattr(candidate, 'copies_available_count', 0) > 0
        circulation_count = getattr(candidate, 'circulation_count', 0)
        rating_value = get_book_rating_value(candidate)

        score = (
            category_score
            + author_hits * 5.0
            + genre_hits * 4.0
            + language_hits * 2.0
            + grade_hits * 2.0
            + (2.0 if available_now else 0.0)
            + min(circulation_count, 5) * 1.0
            + min(rating_value, 5.0) * 0.7
        )

        reasons = []
        if matched_categories:
            reasons.append(f"Matches your interest in {matched_categories[0]}")
        if author_hits:
            reasons.append('By an author you already borrow')
        elif genre_hits and candidate.genre:
            reasons.append(f"Fits your {candidate.genre} reading pattern")
        elif available_now:
            reasons.append('Available now')
        elif circulation_count:
            reasons.append('Popular with readers')

        items.append(
            {
                'book': candidate,
                'score': score,
                'reason': '; '.join(reasons[:2]) or 'Recommended from your borrowing history',
            }
        )

    ranked = rank_recommendation_items(items, limit)
    if ranked:
        return ranked, True, excluded_book_ids
    return (
        build_popular_recommendations(exclude_ids=excluded_book_ids, limit=limit),
        True,
        excluded_book_ids,
    )


class PublicStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        books_cataloged = Book.objects.count()
        active_students = User.objects.filter(role='STUDENT', is_active=True).count()

        successful_statuses = [BorrowRequest.STATUS_APPROVED, BorrowRequest.STATUS_RETURNED]
        decided_statuses = [BorrowRequest.STATUS_APPROVED, BorrowRequest.STATUS_RETURNED, BorrowRequest.STATUS_REJECTED]
        successful_total = BorrowRequest.objects.filter(status__in=successful_statuses).count()
        decided_total = BorrowRequest.objects.filter(status__in=decided_statuses).count()

        borrow_success_rate = 0.0
        if decided_total > 0:
            borrow_success_rate = round((successful_total / decided_total) * 100, 1)

        processing_rows = BorrowRequest.objects.filter(
            status__in=successful_statuses,
            processed_at__isnull=False,
        ).values_list('requested_at', 'processed_at')

        total_minutes = 0.0
        processing_count = 0
        for requested_at, processed_at in processing_rows.iterator():
            if not requested_at or not processed_at:
                continue
            diff_seconds = (processed_at - requested_at).total_seconds()
            if diff_seconds < 0:
                continue
            total_minutes += diff_seconds / 60.0
            processing_count += 1

        average_pickup_minutes = 0
        if processing_count > 0:
            average_pickup_minutes = int(round(total_minutes / processing_count))

        return Response(
            {
                'books_cataloged': books_cataloged,
                'active_students': active_students,
                'average_pickup_minutes': average_pickup_minutes,
                'borrow_success_rate': borrow_success_rate,
            },
            status=status.HTTP_200_OK,
        )


class ExportReportsView(APIView):
    """Export library reports as CSV."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('type', 'borrow_history')
        
        # Check permissions - only librarians and admins can export
        if not is_circulation_staff(request.user):
            return Response(
                {'detail': 'You do not have permission to export reports.'},
                status=status.HTTP_403_FORBIDDEN
            )

        import csv
        from django.http import HttpResponse

        if report_type == 'borrow_history':
            # Export all borrow requests
            borrow_requests = BorrowRequest.objects.select_related('user', 'book').all()
            
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="borrow_history.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'ID', 'Receipt Number', 'Student ID', 'Student Name', 
                'Book Title', 'ISBN', 'Status', 'Requested At', 
                'Processed At', 'Due Date', 'Returned At', 'Late Fee'
            ])
            
            for br in borrow_requests:
                writer.writerow([
                    br.id,
                    br.receipt_number or '',
                    br.user.student_id or '',
                    br.user.full_name,
                    br.book.title,
                    br.book.isbn,
                    br.status,
                    br.requested_at.isoformat() if br.requested_at else '',
                    br.processed_at.isoformat() if br.processed_at else '',
                    br.due_date.isoformat() if br.due_date else '',
                    br.returned_at.isoformat() if br.returned_at else '',
                    str(br.late_fee_amount) if br.late_fee_amount else '0.00',
                ])
            
            return response

        elif report_type == 'overdue_books':
            # Export overdue books
            from django.utils import timezone
            now = timezone.now()
            overdue_requests = BorrowRequest.objects.select_related('user', 'book').filter(
                status=BorrowRequest.STATUS_APPROVED,
                due_date__lt=now,
            )
            
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="overdue_books.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'ID', 'Student ID', 'Student Name', 'Book Title', 
                'ISBN', 'Due Date', 'Days Overdue', 'Late Fee'
            ])
            
            for br in overdue_requests:
                days_overdue = (now.date() - br.due_date).days
                writer.writerow([
                    br.id,
                    br.user.student_id or '',
                    br.user.full_name,
                    br.book.title,
                    br.book.isbn,
                    br.due_date.isoformat() if br.due_date else '',
                    days_overdue,
                    str(br.late_fee_amount) if br.late_fee_amount else '0.00',
                ])
            
            return response

        elif report_type == 'fine_payments':
            # Export fine payments
            fine_payments = FinePayment.objects.select_related(
                'borrow_request__user', 'borrow_request__book'
            ).all()
            
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="fine_payments.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'ID', 'Student ID', 'Student Name', 'Book Title',
                'Amount', 'Status', 'Payment Method', 'Reference',
                'Paid At', 'Processed By'
            ])
            
            for fp in fine_payments:
                writer.writerow([
                    fp.id,
                    fp.borrow_request.user.student_id or '',
                    fp.borrow_request.user.full_name,
                    fp.borrow_request.book.title,
                    str(fp.amount),
                    fp.status,
                    fp.payment_method or '',
                    fp.payment_reference or '',
                    fp.paid_at.isoformat() if fp.paid_at else '',
                    fp.processed_by.full_name if fp.processed_by else '',
                ])
            
            return response

        elif report_type == 'reading_history':
            # Export reading history (returned books)
            returned_requests = BorrowRequest.objects.select_related('user', 'book').filter(
                status=BorrowRequest.STATUS_RETURNED,
            ).order_by('-returned_at')
            
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="reading_history.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'ID', 'Student ID', 'Student Name', 'Book Title',
                'Author', 'ISBN', 'Borrowed Date', 'Returned Date',
                'Days Borrowed', 'Late Fee'
            ])
            
            for br in returned_requests:
                days_borrowed = 0
                if br.processed_at and br.requested_at:
                    days_borrowed = (br.processed_at.date() - br.requested_at.date()).days
                
                writer.writerow([
                    br.id,
                    br.user.student_id or '',
                    br.user.full_name,
                    br.book.title,
                    br.book.author,
                    br.book.isbn,
                    br.requested_at.isoformat() if br.requested_at else '',
                    br.processed_at.isoformat() if br.processed_at else '',
                    days_borrowed,
                    str(br.late_fee_amount) if br.late_fee_amount else '0.00',
                ])
            
            return response

        else:
            return Response(
                {'detail': f'Invalid report type: {report_type}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [CanManageCategories]


class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [CanManageBooks]
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'author', 'isbn']

    def get_queryset(self):
        queryset = get_books_catalog_queryset()

        params = self.request.query_params
        author = params.get('author')
        if author:
            queryset = queryset.filter(author__icontains=author)

        category = params.get('category')
        if category:
            if category.isdigit():
                queryset = queryset.filter(categories__id=int(category))
            else:
                queryset = queryset.filter(categories__name__iexact=category)

        grade_level = params.get('grade_level')
        if grade_level:
            queryset = queryset.filter(grade_level__iexact=grade_level)

        language = params.get('language')
        if language:
            queryset = queryset.filter(language__iexact=language)

        publication_year = params.get('publication_year')
        if publication_year and publication_year.isdigit():
            queryset = queryset.filter(published_date__year=int(publication_year))

        available_param = params.get('available')
        if available_param is not None:
            normalized = available_param.strip().lower()
            if normalized in ('true', '1', 'yes'):
                queryset = queryset.filter(copies_available_count__gt=0)
            elif normalized in ('false', '0', 'no'):
                queryset = queryset.filter(copies_available_count=0)

        location_room = params.get('location_room')
        if location_room:
            queryset = queryset.filter(copies__location_room__iexact=location_room)

        location_shelf = params.get('location_shelf')
        if location_shelf:
            queryset = queryset.filter(copies__location_shelf__iexact=location_shelf)

        return queryset.distinct()

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='recommendations')
    def book_recommendations(self, request, pk=None):
        book = self.get_object()
        user = request.user if request.user.is_authenticated else None
        items = build_book_recommendations(book, user=user, limit=6)
        return Response(
            {
                'results': serialize_recommendation_items(
                    items,
                    self.get_serializer_context(),
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='recommendations')
    def personalized_recommendations(self, request):
        for_you_items, based_on_history, excluded_book_ids = build_personalized_recommendations(
            request.user,
            limit=6,
        )
        featured_ids = {
            item['book'].pk for item in for_you_items
        } | set(excluded_book_ids)
        popular_items = build_popular_recommendations(exclude_ids=featured_ids, limit=4)

        return Response(
            {
                'for_you': serialize_recommendation_items(
                    for_you_items,
                    self.get_serializer_context(),
                ),
                'popular_now': serialize_recommendation_items(
                    popular_items,
                    self.get_serializer_context(),
                ),
                'based_on_history': based_on_history,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanManageBooks], url_path='set-copies-total')
    def set_copies_total(self, request, pk=None):
        book = self.get_object()
        raw_target = request.data.get('copies_total')
        if raw_target is None:
            return Response(
                {'detail': 'copies_total is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_total = int(raw_target)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'copies_total must be a non-negative integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target_total < 0:
            return Response(
                {'detail': 'copies_total must be a non-negative integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            locked_book = Book.objects.select_for_update().get(pk=book.pk)
            copy_queryset = BookCopy.objects.select_for_update().filter(book=locked_book).order_by('-id')
            current_total = copy_queryset.count()

            if target_total > current_total:
                copies_to_add = target_total - current_total
                for _ in range(copies_to_add):
                    BookCopy.objects.create(book=locked_book, status=BookCopy.STATUS_AVAILABLE)
            elif target_total < current_total:
                copies_to_remove = current_total - target_total
                removable_ids = list(
                    copy_queryset.filter(status=BookCopy.STATUS_AVAILABLE).values_list('id', flat=True)[:copies_to_remove]
                )
                if len(removable_ids) < copies_to_remove:
                    minimum_total = current_total - copy_queryset.filter(status=BookCopy.STATUS_AVAILABLE).count()
                    return Response(
                        {
                            'detail': (
                                f'Cannot reduce copies below {minimum_total}. '
                                'Borrowed or maintenance copies cannot be removed.'
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                BookCopy.objects.filter(id__in=removable_ids).delete()

        updated_book = Book.objects.prefetch_related('categories').get(pk=book.pk)
        book_data = BookSerializer(updated_book, context=self.get_serializer_context()).data
        return Response(
            {
                'message': 'Book copies updated successfully.',
                'book': book_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def borrow(self, request, pk=None):
        book = self.get_object()
        is_teacher_borrow = getattr(request.user, 'role', None) == 'TEACHER'

        if not can_request_patron_borrow(request.user):
            return Response(
                {'detail': 'Only students and teachers can request to borrow books.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.is_active:
            return Response(
                {'detail': 'User account is inactive.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        reporting_frequency = BorrowRequest.REPORT_NONE
        if is_teacher_borrow:
            reporting_frequency = str(
                request.data.get('reporting_frequency') or BorrowRequest.REPORT_MONTHLY
            ).strip().upper()
            if reporting_frequency not in {
                BorrowRequest.REPORT_WEEKLY,
                BorrowRequest.REPORT_MONTHLY,
            }:
                return Response(
                    {'detail': 'reporting_frequency must be WEEKLY or MONTHLY for teachers.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            requested_borrow_days = 0
        else:
            requested_days_raw = request.data.get(
                'borrow_days',
                getattr(settings, 'BORROW_DURATION_DAYS', 14),
            )
            try:
                requested_borrow_days = int(requested_days_raw)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'borrow_days must be a positive integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            max_borrow_days = getattr(settings, 'MAX_BORROW_DURATION_DAYS', 30)
            if requested_borrow_days < 1 or requested_borrow_days > max_borrow_days:
                return Response(
                    {'detail': f'borrow_days must be between 1 and {max_borrow_days}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            with transaction.atomic():
                locked_user = User.objects.select_for_update().get(pk=request.user.pk)
                locked_book = Book.objects.select_for_update().get(pk=book.pk)
                for affected_book_id in expire_stale_reservations(book_id=locked_book.id):
                    recalculate_pending_reservation_positions(affected_book_id)

                if not locked_user.is_active:
                    return Response(
                        {'detail': 'User account is inactive.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                existing_approved = BorrowRequest.objects.select_for_update().filter(
                    user=locked_user,
                    book=locked_book,
                    status=BorrowRequest.STATUS_APPROVED,
                ).exists()
                if existing_approved:
                    return Response(
                        {'detail': 'You already borrowed this book.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                pending_request = BorrowRequest.objects.select_for_update().filter(
                    user=locked_user,
                    book=locked_book,
                    status=BorrowRequest.STATUS_PENDING,
                ).exists()
                if pending_request:
                    return Response(
                        {'detail': 'Borrow request already pending.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                sync_overdue_fine_payments(user_id=locked_user.pk, as_of=timezone.localdate())
                unpaid_total = locked_user.get_unpaid_fines_total()
                unpaid_limit = get_unpaid_fine_block_limit()
                if unpaid_total > unpaid_limit:
                    return Response(
                        {
                            'detail': (
                                'Borrowing is blocked due to unpaid fines. '
                                f'Current unpaid balance: {unpaid_total}. '
                                f'Limit: {unpaid_limit}.'
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                max_active = getattr(settings, 'MAX_ACTIVE_BORROWS', 3)
                active_borrows = BorrowRequest.objects.select_for_update().filter(
                    user=locked_user,
                    status=BorrowRequest.STATUS_APPROVED,
                ).count()
                if active_borrows >= max_active:
                    return Response(
                        {'detail': 'Borrow limit reached.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                has_available_copy = BookCopy.objects.select_for_update().filter(
                    book=locked_book,
                    status=BookCopy.STATUS_AVAILABLE,
                    is_reference_only=False,
                ).exists()
                if not has_available_copy:
                    return Response(
                        {'detail': 'No copies available for borrowing.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                borrow_request = BorrowRequest.objects.create(
                    user=locked_user,
                    book=locked_book,
                    requested_borrow_days=requested_borrow_days,
                    reporting_frequency=reporting_frequency,
                    max_renewals=(
                        0
                        if is_teacher_borrow
                        else BorrowRequest.get_default_max_renewals()
                    ),
                )

                reservation = Reservation.objects.select_for_update().filter(
                    user=locked_user,
                    book=locked_book,
                    status__in=[Reservation.STATUS_PENDING, Reservation.STATUS_NOTIFIED],
                ).order_by('created_at', 'id').first()
                if reservation:
                    reservation.status = Reservation.STATUS_FULFILLED
                    reservation.save(update_fields=['status'])
                    recalculate_pending_reservation_positions(locked_book.id)
        except IntegrityError:
            return Response(
                {'detail': 'Borrow request already pending.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        book_data = BookSerializer(book, context=self.get_serializer_context()).data
        request_data = BorrowRequestSerializer(
            borrow_request,
            context=self.get_serializer_context(),
        ).data
        notify_librarian_dashboard(
            notification_type='BORROW_REQUEST_SUBMITTED',
            title='New borrow request',
            message=f"{borrow_request.user.full_name} requested '{borrow_request.book.title}'.",
            data={
                'portal': 'librarian',
                'dashboard_section': 'desk-borrows',
                'borrow_request_id': borrow_request.pk,
                'book_id': borrow_request.book_id,
                'user_id': borrow_request.user_id,
            },
        )
        return Response(
            {
                'message': (
                    'Teacher borrow request submitted. '
                    'No due date will be applied after approval; reporting will be tracked.'
                    if is_teacher_borrow
                    else 'Borrow request submitted. Await library staff approval.'
                ),
                'book': book_data,
                'request': request_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='return')
    def return_book(self, request, pk=None):
        book = self.get_object()

        if not can_request_patron_return(request.user):
            return Response(
                {'detail': 'Only students and teachers can request to return books.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                locked_book = Book.objects.select_for_update().get(pk=book.pk)
                borrow_request = BorrowRequest.objects.select_for_update().filter(
                    user=request.user,
                    book=locked_book,
                    status=BorrowRequest.STATUS_APPROVED,
                ).order_by('-requested_at').first()
                if not borrow_request:
                    return Response(
                        {'detail': 'No active borrow found for this book.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                pending_return = ReturnRequest.objects.select_for_update().filter(
                    borrow_request=borrow_request,
                    status=ReturnRequest.STATUS_PENDING,
                ).exists()
                if pending_return:
                    return Response(
                        {'detail': 'Return request already pending.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                return_request = ReturnRequest.objects.create(borrow_request=borrow_request)
        except IntegrityError:
            return Response(
                {'detail': 'Return request already pending.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request_data = ReturnRequestSerializer(
            return_request,
            context=self.get_serializer_context(),
        ).data
        book_data = BookSerializer(book, context=self.get_serializer_context()).data
        notify_librarian_dashboard(
            notification_type='RETURN_REQUEST_SUBMITTED',
            title='New return request',
            message=(
                f"{borrow_request.user.full_name} requested to return '{borrow_request.book.title}'."
            ),
            data={
                'portal': 'librarian',
                'dashboard_section': 'desk-returns',
                'return_request_id': return_request.pk,
                'borrow_request_id': borrow_request.pk,
                'book_id': borrow_request.book_id,
                'user_id': borrow_request.user_id,
            },
        )
        return Response(
            {
                'message': 'Return request submitted. Await library staff approval.',
                'return_request': request_data,
                'book': book_data,
            },
            status=status.HTTP_200_OK,
        )


class BorrowRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BorrowRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = BorrowRequest.objects.select_related('book', 'user', 'processed_by').prefetch_related(
            'book__categories',
            'return_requests',
            'renewal_requests',
        )
        user = self.request.user
        can_view_all = can_view_all_borrow_requests(user)
        if not can_view_all:
            queryset = queryset.filter(user=user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        elif can_view_all:
            queryset = queryset.exclude(status=BorrowRequest.STATUS_RETURNED)
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[CanManageBorrowRequests])
    def approve(self, request, pk=None):
        borrow_request = self.get_object()
        try:
            borrow_request.approve(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        request_data = BorrowRequestSerializer(
            borrow_request,
            context=self.get_serializer_context(),
        ).data
        book_data = BookSerializer(
            borrow_request.book,
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Borrow request approved.',
                'request': request_data,
                'book': book_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanManageBorrowRequests])
    def reject(self, request, pk=None):
        borrow_request = self.get_object()
        try:
            borrow_request.reject(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        request_data = BorrowRequestSerializer(
            borrow_request,
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Borrow request rejected.',
                'request': request_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def renew(self, request, pk=None):
        borrow_request = self.get_object()
        if borrow_request.user != request.user:
            return Response({'detail': 'You can only renew your own books.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                locked_borrow = BorrowRequest.objects.select_for_update().get(pk=borrow_request.pk)
                reason = locked_borrow.get_renewal_block_reason()
                if reason:
                    raise ValueError(reason)
                renewal_request = RenewalRequest.objects.create(
                    borrow_request=locked_borrow,
                    requested_extension_days=locked_borrow.get_renewal_duration_days(),
                )
        except IntegrityError:
            return Response(
                {'detail': 'A renewal request is already pending for this book.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        create_user_notification(
            user_id=borrow_request.user_id,
            notification_type='RENEWAL_REQUEST_SUBMITTED',
            title='Renewal request submitted',
            message=(
                f"Your renewal request for '{borrow_request.book.title}' was submitted "
                'for librarian approval.'
            ),
            data={
                'borrow_request_id': borrow_request.pk,
                'book_id': borrow_request.book_id,
                'renewal_request_id': renewal_request.pk,
            },
        )
        notify_librarian_dashboard(
            notification_type='RENEWAL_REQUEST_SUBMITTED',
            title='New renewal request',
            message=(
                f"{borrow_request.user.full_name} requested to renew '{borrow_request.book.title}'."
            ),
            data={
                'portal': 'librarian',
                'dashboard_section': 'desk-renewals',
                'renewal_request_id': renewal_request.pk,
                'borrow_request_id': borrow_request.pk,
                'book_id': borrow_request.book_id,
                'user_id': borrow_request.user_id,
            },
        )

        return Response(
            {
                'message': 'Renewal request submitted. Await library staff approval.',
                'request': BorrowRequestSerializer(
                    renewal_request.borrow_request,
                    context=self.get_serializer_context(),
                ).data,
                'renewal_request': RenewalRequestSerializer(
                    renewal_request,
                    context=self.get_serializer_context(),
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='submit-report')
    def submit_report(self, request, pk=None):
        borrow_request = self.get_object()
        if borrow_request.user != request.user:
            return Response(
                {'detail': 'You can only submit reports for your own borrowed books.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            borrow_request.submit_report()
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        next_due = borrow_request.next_report_due_date
        frequency_label = borrow_request.get_reporting_frequency_display()
        return Response(
            {
                'message': (
                    f'{frequency_label} report submitted.'
                    + (f' Next report due: {next_due}.' if next_due else '')
                ),
                'request': BorrowRequestSerializer(
                    borrow_request,
                    context=self.get_serializer_context(),
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def history(self, request):
        queryset = BorrowRequest.objects.filter(
            user=request.user,
            status=BorrowRequest.STATUS_RETURNED
        ).select_related('book', 'processed_by').prefetch_related(
            'book__categories',
            'return_requests',
        ).order_by('-processed_at')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = BorrowRequestSerializer(page, many=True, context=self.get_serializer_context())
            return self.get_paginated_response(serializer.data)
        serializer = BorrowRequestSerializer(queryset, many=True, context=self.get_serializer_context())
        return Response(serializer.data)


class ReturnRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReturnRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ReturnRequest.objects.select_related(
            'borrow_request',
            'borrow_request__book',
            'borrow_request__user',
            'processed_by',
        ).prefetch_related('borrow_request__book__categories')
        user = self.request.user
        if not can_view_all_return_requests(user):
            queryset = queryset.filter(borrow_request__user=user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[CanManageReturnRequests])
    def approve(self, request, pk=None):
        return_request = self.get_object()
        try:
            return_request.approve(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        request_data = ReturnRequestSerializer(
            return_request,
            context=self.get_serializer_context(),
        ).data
        book_data = BookSerializer(
            return_request.borrow_request.book,
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Return request approved.',
                'return_request': request_data,
                'book': book_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanManageReturnRequests])
    def reject(self, request, pk=None):
        return_request = self.get_object()
        try:
            return_request.reject(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        request_data = ReturnRequestSerializer(
            return_request,
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Return request rejected.',
                'return_request': request_data,
            },
            status=status.HTTP_200_OK,
        )


class RenewalRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RenewalRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = RenewalRequest.objects.select_related(
            'borrow_request',
            'borrow_request__book',
            'borrow_request__user',
            'processed_by',
        ).prefetch_related('borrow_request__book__categories')
        user = self.request.user
        if not can_view_all_renewal_requests(user):
            queryset = queryset.filter(borrow_request__user=user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[CanManageRenewalRequests])
    def approve(self, request, pk=None):
        renewal_request = self.get_object()
        try:
            renewal_request.approve(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        request_data = RenewalRequestSerializer(
            renewal_request,
            context=self.get_serializer_context(),
        ).data
        borrow_data = BorrowRequestSerializer(
            renewal_request.borrow_request,
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Renewal request approved.',
                'renewal_request': request_data,
                'request': borrow_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanManageRenewalRequests])
    def reject(self, request, pk=None):
        renewal_request = self.get_object()
        try:
            renewal_request.reject(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        request_data = RenewalRequestSerializer(
            renewal_request,
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Renewal request rejected.',
                'renewal_request': request_data,
            },
            status=status.HTTP_200_OK,
        )


class FinePaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FinePaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sync_overdue_fine_payments(
            user_id=None if can_manage_fine_payments(self.request.user) else self.request.user.pk,
            as_of=timezone.localdate(),
        )
        queryset = FinePayment.objects.select_related(
            'borrow_request',
            'borrow_request__book',
            'borrow_request__user',
            'processed_by',
        ).prefetch_related('borrow_request__book__categories')
        if not can_manage_fine_payments(self.request.user):
            queryset = queryset.filter(borrow_request__user=self.request.user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def summary(self, request):
        sync_overdue_fine_payments(
            user_id=None if can_manage_fine_payments(request.user) else request.user.pk,
            as_of=timezone.localdate(),
        )
        unpaid_total = request.user.get_unpaid_fines_total()
        block_limit = get_unpaid_fine_block_limit()
        pending_count = FinePayment.objects.filter(
            borrow_request__user=request.user,
            status=FinePayment.STATUS_PENDING,
        ).count()
        return Response(
            {
                'unpaid_total': str(unpaid_total),
                'pending_count': pending_count,
                'block_threshold': str(block_limit),
                'is_borrow_blocked': unpaid_total > block_limit,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanManageFinePayments], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        payment = self.get_object()
        if payment.status != FinePayment.STATUS_PENDING:
            return Response(
                {'detail': 'Only pending fine payments can be marked paid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_method = str(request.data.get('payment_method') or '').strip()
        payment_reference = str(request.data.get('payment_reference') or '').strip()
        notes = str(request.data.get('notes') or '').strip()
        payment.mark_paid(
            processed_by=request.user,
            payment_method=payment_method,
            reference=payment_reference,
        )
        if notes:
            payment.notes = notes
            payment.save(update_fields=['notes'])

        data = FinePaymentSerializer(payment, context=self.get_serializer_context()).data
        return Response(
            {
                'message': 'Fine payment marked as paid.',
                'fine_payment': data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[CanManageFinePayments])
    def waive(self, request, pk=None):
        payment = self.get_object()
        if payment.status != FinePayment.STATUS_PENDING:
            return Response(
                {'detail': 'Only pending fine payments can be waived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        notes = str(request.data.get('notes') or '').strip()
        payment.mark_waived(processed_by=request.user, notes=notes)
        data = FinePaymentSerializer(payment, context=self.get_serializer_context()).data
        return Response(
            {
                'message': 'Fine payment waived.',
                'fine_payment': data,
            },
            status=status.HTTP_200_OK,
        )


class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        affected_book_ids = expire_stale_reservations()
        for affected_book_id in affected_book_ids:
            recalculate_pending_reservation_positions(affected_book_id)

        queryset = Reservation.objects.select_related('book', 'user').order_by('-created_at')
        if not can_view_all_borrow_requests(self.request.user):
            queryset = queryset.filter(user=self.request.user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def create(self, request):
        if not can_request_patron_reservation(request.user):
            return Response(
                {'detail': 'Only students and teachers can reserve books.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        book_id = request.data.get('book_id')
        try:
            book_id = int(book_id)
        except (TypeError, ValueError):
            return Response({'detail': 'book_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                locked_user = User.objects.select_for_update().get(pk=request.user.pk)
                book = Book.objects.select_for_update().get(pk=book_id)
                for affected_book_id in expire_stale_reservations(book_id=book.id):
                    recalculate_pending_reservation_positions(affected_book_id)

                if not locked_user.is_active:
                    return Response(
                        {'detail': 'User account is inactive.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                has_available_copy = BookCopy.objects.select_for_update().filter(
                    book=book,
                    status=BookCopy.STATUS_AVAILABLE,
                    is_reference_only=False,
                ).exists()
                if has_available_copy:
                    return Response(
                        {'detail': 'Book is available. Request borrow instead.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if Reservation.objects.select_for_update().filter(
                    user=locked_user,
                    book=book,
                    status__in=[Reservation.STATUS_PENDING, Reservation.STATUS_NOTIFIED],
                ).exists():
                    return Response(
                        {'detail': 'You already have an active reservation for this book.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                position = Reservation.objects.select_for_update().filter(
                    book=book,
                    status=Reservation.STATUS_PENDING,
                ).count() + 1

                reservation = Reservation.objects.create(
                    user=locked_user,
                    book=book,
                    position=position,
                )
                create_user_notification(
                    user_id=locked_user.id,
                    notification_type='RESERVATION_CREATED',
                    title='Reservation submitted',
                    message=f"Reservation created for '{book.title}'. Queue position: {position}.",
                    data={
                        'reservation_id': reservation.pk,
                        'book_id': book.id,
                        'position': position,
                    },
                )
        except Book.DoesNotExist:
            return Response({'detail': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

        reservation_data = ReservationSerializer(reservation, context=self.get_serializer_context()).data
        return Response(
            {
                'message': 'Reservation created',
                'position': position,
                'reservation': reservation_data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        can_manage_all = can_view_all_borrow_requests(request.user)
        if reservation.user != request.user and not can_manage_all:
            return Response(
                {'detail': 'You cannot cancel this reservation.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if reservation.status not in {Reservation.STATUS_PENDING, Reservation.STATUS_NOTIFIED}:
            return Response(
                {'detail': 'Only active reservations can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            locked = Reservation.objects.select_for_update().select_related('book').get(pk=reservation.pk)
            if locked.status not in {Reservation.STATUS_PENDING, Reservation.STATUS_NOTIFIED}:
                return Response(
                    {'detail': 'Only active reservations can be cancelled.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            locked.status = Reservation.STATUS_CANCELLED
            locked.save(update_fields=['status'])
            recalculate_pending_reservation_positions(locked.book_id)

        actor = request.user.full_name or request.user.username
        create_user_notification(
            user_id=reservation.user_id,
            notification_type='RESERVATION_CANCELLED',
            title='Reservation cancelled',
            message=(
                f"Reservation for '{reservation.book.title}' was cancelled by {actor}."
                if can_manage_all and reservation.user != request.user
                else f"Reservation for '{reservation.book.title}' was cancelled."
            ),
            data={
                'reservation_id': reservation.pk,
                'book_id': reservation.book_id,
            },
        )

        data = ReservationSerializer(
            Reservation.objects.select_related('book', 'user').get(pk=reservation.pk),
            context=self.get_serializer_context(),
        ).data
        return Response(
            {
                'message': 'Reservation cancelled.',
                'reservation': data,
            },
            status=status.HTTP_200_OK,
        )


class BookReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet for book reviews and ratings.
    Users can only review books they've returned.
    """
    serializer_class = BookReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        book_id = self.kwargs.get('book_id')
        if book_id:
            return BookReview.objects.filter(book_id=book_id).select_related('user')
        return BookReview.objects.none()

    def create(self, request, *args, **kwargs):
        book_id = self.kwargs.get('book_id')
        if not book_id:
            return Response(
                {'detail': 'Book ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user has returned this book
        if not request.user.can_review_book(book_id):
            return Response(
                {'detail': 'You can only review books you have returned.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user already reviewed this book
        existing = BookReview.objects.filter(user=request.user, book_id=book_id).first()
        if existing:
            return Response(
                {'detail': 'You have already reviewed this book.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, book_id=book_id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        if review.user != request.user:
            return Response(
                {'detail': 'You can only edit your own reviews.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if review.user != request.user:
            return Response(
                {'detail': 'You can only delete your own reviews.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)
