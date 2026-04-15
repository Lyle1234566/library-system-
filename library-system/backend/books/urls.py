from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BookViewSet,
    BorrowRequestViewSet,
    CategoryViewSet,
    ReturnRequestViewSet,
    RenewalRequestViewSet,
    FinePaymentViewSet,
    ReservationViewSet,
    BookReviewViewSet,
    PublicStatsView,
    ExportReportsView,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'books', BookViewSet)
router.register(r'borrow-requests', BorrowRequestViewSet, basename='borrow-request')
router.register(r'return-requests', ReturnRequestViewSet, basename='return-request')
router.register(r'renewal-requests', RenewalRequestViewSet, basename='renewal-request')
router.register(r'fine-payments', FinePaymentViewSet, basename='fine-payment')
router.register(r'reservations', ReservationViewSet, basename='reservation')

urlpatterns = [
    path('public-stats/', PublicStatsView.as_view(), name='books-public-stats'),
    path('export/', ExportReportsView.as_view(), name='books-export'),
    path(
        'books/<int:book_id>/reviews/',
        BookReviewViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='book-review-list',
    ),
    path(
        'books/<int:book_id>/reviews/<int:pk>/',
        BookReviewViewSet.as_view(
            {'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}
        ),
        name='book-review-detail',
    ),
    path('', include(router.urls)),
]
