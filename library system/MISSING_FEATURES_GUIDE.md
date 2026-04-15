# Historical Missing Features Guide

Status note on March 29, 2026:
- This guide is a historical implementation plan and much of it has already been completed.
- Do not use it as the current project status.
- Use `IMPLEMENTATION_STATUS.md`, `TODO.md`, and `README.md` for current state.
- Barcode/QR copy display and scanner work are still genuinely open.

---

## 🎯 **Priority 1: Book Renewal System**

### **What it does:**
Allows students to extend the due date of borrowed books (e.g., extend by 14 more days).

### **Backend Implementation**

#### 1. Add renewal fields to BorrowRequest model
Edit `backend/books/models.py`:

```python
class BorrowRequest(models.Model):
    # ... existing fields ...
    
    renewal_count = models.PositiveIntegerField(default=0)
    max_renewals = models.PositiveIntegerField(default=2)  # Allow 2 renewals
    last_renewed_at = models.DateTimeField(blank=True, null=True)
    
    def can_renew(self) -> bool:
        """Check if book can be renewed"""
        if self.status != self.STATUS_APPROVED:
            return False
        if self.renewal_count >= self.max_renewals:
            return False
        if not self.due_date:
            return False
        # Don't allow renewal if overdue
        if self.get_overdue_days() > 0:
            return False
        return True
    
    def renew(self, processed_by=None):
        """Renew the borrow request"""
        if not self.can_renew():
            raise ValueError('This book cannot be renewed.')
        
        renewal_days = getattr(settings, 'RENEWAL_DURATION_DAYS', 14)
        self.due_date = self.due_date + timedelta(days=renewal_days)
        self.renewal_count += 1
        self.last_renewed_at = timezone.now()
        self.save(update_fields=['due_date', 'renewal_count', 'last_renewed_at'])
        return self
```

#### 2. Add renewal endpoint
Edit `backend/books/views.py`:

```python
class BorrowRequestViewSet(viewsets.ReadOnlyModelViewSet):
    # ... existing code ...
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def renew(self, request, pk=None):
        borrow_request = self.get_object()
        
        # Check if user owns this request
        if borrow_request.user != request.user:
            return Response(
                {'detail': 'You can only renew your own books.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            borrow_request.renew(processed_by=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        
        request_data = BorrowRequestSerializer(
            borrow_request,
            context=self.get_serializer_context(),
        ).data
        
        return Response(
            {
                'message': f'Book renewed successfully. New due date: {borrow_request.due_date}',
                'request': request_data,
            },
            status=status.HTTP_200_OK,
        )
```

#### 3. Run migrations
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### **Frontend Implementation**

#### 1. Add renewal API function
Edit `frontend/lib/api.ts`:

```typescript
export const booksApi = {
  // ... existing methods ...
  
  async renewBorrow(id: number): Promise<ApiResponse<{ message: string; request: BorrowRequest }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/books/borrow-requests/${id}/renew/`, {
        method: 'POST',
        headers: buildHeaders(),
      });

      const { data, text } = await parseJsonResponse<{ message: string; request: BorrowRequest }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};
```

#### 2. Add Renew button to My Books page
Edit `frontend/app/my-books/page.tsx`:

Add this inside the book card where you show borrowed books:

```tsx
{request.status === 'APPROVED' && request.renewal_count < 2 && (
  <button
    onClick={async () => {
      const response = await booksApi.renewBorrow(request.id);
      if (response.error) {
        alert(response.error);
      } else {
        alert(response.data?.message);
        // Refresh the list
        window.location.reload();
      }
    }}
    className="text-xs font-semibold text-sky-300 hover:text-sky-200"
  >
    Renew ({2 - request.renewal_count} left)
  </button>
)}
```

---

## 🎯 **Priority 2: Book Reservation System**

### **What it does:**
Students can reserve books that are currently unavailable. They get notified when the book becomes available.

### **Backend Implementation**

#### 1. Create Reservation model
Edit `backend/books/models.py`:

```python
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
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reservations',
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='reservations',
    )
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
        return f"{self.user} reserved {self.book} ({self.status})"
```

#### 2. Add reservation endpoints
Create `backend/books/serializers.py` (add to existing):

```python
class ReservationSerializer(serializers.ModelSerializer):
    book = BookSerializer(read_only=True)
    user = BorrowRequestUserSerializer(read_only=True)
    
    class Meta:
        model = Reservation
        fields = '__all__'
```

Edit `backend/books/views.py`:

```python
class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if can_view_all_borrow_requests(user):
            return Reservation.objects.all()
        return Reservation.objects.filter(user=user)
    
    def create(self, request):
        book_id = request.data.get('book_id')
        if not book_id:
            return Response({'detail': 'book_id is required'}, status=400)
        
        try:
            book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Book not found'}, status=404)
        
        if book.available:
            return Response({'detail': 'Book is available. Request borrow instead.'}, status=400)
        
        # Check if already reserved
        if Reservation.objects.filter(user=request.user, book=book, status='PENDING').exists():
            return Response({'detail': 'You already have a pending reservation for this book.'}, status=400)
        
        # Calculate position in queue
        position = Reservation.objects.filter(book=book, status='PENDING').count() + 1
        
        reservation = Reservation.objects.create(
            user=request.user,
            book=book,
            position=position
        )
        
        return Response(
            ReservationSerializer(reservation).data,
            status=201
        )
```

#### 3. Add to URLs
Edit `backend/books/urls.py`:

```python
router.register(r'reservations', views.ReservationViewSet, basename='reservation')
```

---

## 🎯 **Priority 3: Fine Payment Tracking**

### **Backend Implementation**

#### 1. Create Payment model
Edit `backend/books/models.py`:

```python
class FinePayment(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_PAID = 'PAID'
    STATUS_WAIVED = 'WAIVED'
    
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_PAID, 'Paid'),
        (STATUS_WAIVED, 'Waived'),
    )
    
    borrow_request = models.ForeignKey(
        BorrowRequest,
        on_delete=models.CASCADE,
        related_name='fine_payments',
    )
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
        null=True,
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
    
    def __str__(self):
        return f"Fine ${self.amount} for {self.borrow_request}"
```

#### 2. Add unpaid fines check
Edit `backend/user/models.py`:

```python
class User(AbstractBaseUser, PermissionsMixin):
    # ... existing fields ...
    
    def get_unpaid_fines(self):
        """Get total unpaid fines for this user"""
        from books.models import FinePayment
        total = FinePayment.objects.filter(
            borrow_request__user=self,
            status='PENDING'
        ).aggregate(total=models.Sum('amount'))['total']
        return total or Decimal('0.00')
    
    def can_borrow(self):
        """Check if user can borrow books"""
        if not self.is_active:
            return False, "Account is inactive"
        
        max_unpaid = getattr(settings, 'MAX_UNPAID_FINES', Decimal('50.00'))
        unpaid = self.get_unpaid_fines()
        if unpaid > max_unpaid:
            return False, f"Unpaid fines (${unpaid}) exceed limit (${max_unpaid})"
        
        return True, ""
```

---

## 🎯 **Priority 4: Reading History**

### **Backend Implementation**

Simply filter returned books:

```python
# In BorrowRequestViewSet
@action(detail=False, methods=['get'])
def history(self, request):
    """Get user's reading history (returned books)"""
    queryset = BorrowRequest.objects.filter(
        user=request.user,
        status=BorrowRequest.STATUS_RETURNED
    ).order_by('-processed_at')
    
    serializer = self.get_serializer(queryset, many=True)
    return Response(serializer.data)
```

### **Frontend Implementation**

Create `frontend/app/reading-history/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { booksApi, BorrowRequest } from '@/lib/api';

export default function ReadingHistoryPage() {
  const [history, setHistory] = useState<BorrowRequest[]>([]);
  
  useEffect(() => {
    async function load() {
      const response = await booksApi.getBorrowRequests('RETURNED');
      if (response.data) {
        setHistory(response.data);
      }
    }
    load();
  }, []);
  
  return (
    <div>
      <h1>Reading History</h1>
      <p>You've read {history.length} books!</p>
      {/* Display books */}
    </div>
  );
}
```

---

## 🎯 **Priority 5: Barcode System**

### **Backend Implementation**

Barcodes are already generated! Each `BookCopy` has a unique barcode in format: `{ISBN}-{ID}`

Example: `9780743273565-0001`

### **Frontend Implementation**

#### 1. Install QR code library
```bash
cd frontend
npm install qrcode.react
```

#### 2. Display QR codes in admin
Create a component to show QR codes for book copies.

---

## 📊 **Implementation Priority Order**

1. **Book Renewal** (1-2 days) - Most requested feature
2. **Fine Payment Tracking** (2-3 days) - Important for accountability
3. **Book Reservation** (3-4 days) - Improves user experience
4. **Reading History** (1 day) - Easy win, students love it
5. **Barcode System** (2-3 days) - Nice to have for physical operations

---

## 🚀 **Quick Wins (Can implement in 1 hour each)**

1. **Export to CSV**: Add export buttons in librarian dashboard
2. **Book Recommendations**: Show "Similar books" based on category
3. **Popular Books**: Add "Most borrowed this month" section
4. **User Statistics**: Show "Books read this year" on profile
5. **Email Notifications**: Already have infrastructure, just add more triggers

---

## 💡 **Tips for Implementation**

1. **Start with backend**: Always implement the API first
2. **Test with Postman**: Test API endpoints before frontend
3. **Use existing patterns**: Copy structure from similar features
4. **Add migrations**: Don't forget `makemigrations` and `migrate`
5. **Update serializers**: Add new fields to serializers
6. **Test thoroughly**: Test happy path and error cases

---

## 📝 **After Each Feature**

- [ ] Write tests
- [ ] Update API documentation
- [ ] Add to admin panel if needed
- [ ] Update frontend UI
- [ ] Test end-to-end
- [ ] Update IMPLEMENTATION_STATUS.md

---

## 🎓 **Learning Resources**

- **Django REST Framework**: https://www.django-rest-framework.org/
- **Next.js**: https://nextjs.org/docs
- **TypeScript**: https://www.typescriptlang.org/docs/

---

**Ready to implement? Start with Book Renewal - it's the most impactful feature!** 🚀
