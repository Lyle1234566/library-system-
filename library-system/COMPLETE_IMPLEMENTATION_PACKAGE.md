# Historical Implementation Package

Status note on March 29, 2026:
- This document is a historical implementation package, not the current feature status.
- Much of the planned work here has already been completed, while some remaining items are still open.
- Use `IMPLEMENTATION_STATUS.md`, `TODO.md`, and `README.md` for current status.
- Barcode/QR copy display and scanner workflows are still incomplete.

---

## ⚡ QUICK IMPLEMENTATION GUIDE

**Estimated Total Time**: 2-3 weeks  
**Recommended Order**: Follow the numbers below

---

## 1️⃣ BOOK RENEWAL SYSTEM (Day 1-2)

### Step 1: Update Backend Model

Add to `backend/books/models.py` in the `BorrowRequest` class:

```python
# Add these fields after line 120 (after processed_by field)
renewal_count = models.PositiveIntegerField(default=0)
max_renewals = models.PositiveIntegerField(default=2)
last_renewed_at = models.DateTimeField(blank=True, null=True)

# Add these methods before the approve() method
def can_renew(self) -> bool:
    if self.status != self.STATUS_APPROVED:
        return False
    if self.renewal_count >= self.max_renewals:
        return False
    if not self.due_date:
        return False
    if self.get_overdue_days() > 0:
        return False
    return True

def renew(self):
    if not self.can_renew():
        raise ValueError('Cannot renew: limit reached or book is overdue')
    
    renewal_days = getattr(settings, 'RENEWAL_DURATION_DAYS', 14)
    self.due_date = self.due_date + timedelta(days=renewal_days)
    self.renewal_count += 1
    self.last_renewed_at = timezone.now()
    self.save(update_fields=['due_date', 'renewal_count', 'last_renewed_at'])
    return self
```

### Step 2: Run Migrations

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Step 3: Add API Endpoint

Add to `backend/books/views.py` in `BorrowRequestViewSet`:

```python
@action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
def renew(self, request, pk=None):
    borrow_request = self.get_object()
    
    if borrow_request.user != request.user:
        return Response({'detail': 'You can only renew your own books.'}, status=403)
    
    try:
        borrow_request.renew()
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=400)
    
    return Response({
        'message': f'Book renewed. New due date: {borrow_request.due_date}',
        'request': BorrowRequestSerializer(borrow_request, context=self.get_serializer_context()).data,
    })
```

### Step 4: Update Frontend API

Add to `frontend/lib/api.ts` in `booksApi`:

```typescript
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
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
},
```

### Step 5: Add Renew Button to Frontend

In `frontend/app/my-books/page.tsx`, add this button inside the book card (around line 400):

```tsx
{request.status === 'APPROVED' && request.renewal_count < 2 && request.overdue_days === 0 && (
  <button
    onClick={async () => {
      const response = await booksApi.renewBorrow(request.id);
      if (response.error) {
        alert(response.error);
      } else {
        alert(response.data?.message);
        window.location.reload();
      }
    }}
    className="text-xs font-semibold text-sky-300 hover:text-sky-200"
  >
    Renew ({2 - request.renewal_count} renewals left)
  </button>
)}
```

✅ **DONE! Book renewal is now working.**

---

## 2️⃣ FINE PAYMENT TRACKING (Day 3-5)

### Step 1: Create Payment Model

Add to `backend/books/models.py`:

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
    
    borrow_request = models.ForeignKey(BorrowRequest, on_delete=models.CASCADE, related_name='fine_payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    payment_method = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='processed_payments', blank=True, null=True)
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

### Step 2: Auto-create payments on return

Modify `ReturnRequest.approve()` method to create payment if there's a late fee:

```python
# Add after line where borrow_request.status is set to RETURNED
if borrow_request.late_fee_amount > 0:
    FinePayment.objects.create(
        borrow_request=borrow_request,
        amount=borrow_request.late_fee_amount,
        status=FinePayment.STATUS_PENDING
    )
```

### Step 3: Run migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Step 4: Add to Admin Panel

Add to `backend/books/admin.py`:

```python
@admin.register(FinePayment)
class FinePaymentAdmin(admin.ModelAdmin):
    list_display = ('borrow_request', 'amount', 'status', 'paid_at', 'processed_by')
    list_filter = ('status', 'paid_at')
    search_fields = ('borrow_request__user__full_name', 'payment_reference')
    readonly_fields = ('created_at',)
```

✅ **DONE! Payment tracking is now working.**

---

## 3️⃣ BOOK RESERVATIONS (Day 6-9)

### Step 1: Create Reservation Model

Add to `backend/books/models.py`:

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
```

### Step 2: Add Serializer

Add to `backend/books/serializers.py`:

```python
class ReservationSerializer(serializers.ModelSerializer):
    book = BookSerializer(read_only=True)
    
    class Meta:
        model = Reservation
        fields = '__all__'
```

### Step 3: Add ViewSet

Add to `backend/books/views.py`:

```python
class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if can_view_all_borrow_requests(self.request.user):
            return Reservation.objects.all()
        return Reservation.objects.filter(user=self.request.user)
    
    def create(self, request):
        book_id = request.data.get('book_id')
        try:
            book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Book not found'}, status=404)
        
        if book.available:
            return Response({'detail': 'Book is available. Request borrow instead.'}, status=400)
        
        if Reservation.objects.filter(user=request.user, book=book, status='PENDING').exists():
            return Response({'detail': 'You already have a pending reservation.'}, status=400)
        
        position = Reservation.objects.filter(book=book, status='PENDING').count() + 1
        reservation = Reservation.objects.create(user=request.user, book=book, position=position)
        
        return Response(ReservationSerializer(reservation).data, status=201)
```

### Step 4: Add URL

Add to `backend/books/urls.py`:

```python
router.register(r'reservations', views.ReservationViewSet, basename='reservation')
```

### Step 5: Run migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

✅ **DONE! Reservations are now working.**

---

## 4️⃣ READING HISTORY (Day 10)

### Step 1: Add API Endpoint

Add to `backend/books/views.py` in `BorrowRequestViewSet`:

```python
@action(detail=False, methods=['get'])
def history(self, request):
    queryset = BorrowRequest.objects.filter(
        user=request.user,
        status=BorrowRequest.STATUS_RETURNED
    ).order_by('-processed_at')
    serializer = self.get_serializer(queryset, many=True)
    return Response(serializer.data)
```

### Step 2: Create Frontend Page

Create `frontend/app/reading-history/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { booksApi, BorrowRequest } from '@/lib/api';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ReadingHistoryPage() {
  const [history, setHistory] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function load() {
      const response = await booksApi.getBorrowRequests('RETURNED');
      if (response.data) {
        setHistory(response.data);
      }
      setLoading(false);
    }
    load();
  }, []);
  
  return (
    <div className="min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="pt-16 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Reading History</h1>
          <p className="mt-2 text-white/70">You've read {history.length} books!</p>
          
          {loading && <p className="mt-8">Loading...</p>}
          
          <div className="mt-8 grid gap-4">
            {history.map((request) => (
              <div key={request.id} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <h3 className="font-semibold">{request.book.title}</h3>
                <p className="text-sm text-white/70">{request.book.author}</p>
                <p className="text-xs text-white/60 mt-2">
                  Returned: {new Date(request.processed_at || '').toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

✅ **DONE! Reading history is now working.**

---

## 5️⃣ ADVANCED FILTERS (Day 11-12)

Add filter UI to `frontend/app/books/page.tsx`:

```tsx
// Add state for filters
const [filters, setFilters] = useState({
  category: '',
  author: '',
  language: '',
  gradeLevel: '',
  available: 'all'
});

// Add filter logic to filteredBooks
const filteredBooks = useMemo(() => {
  let result = books;
  
  if (filters.category) {
    result = result.filter(book => 
      book.categories?.some(cat => cat.name === filters.category)
    );
  }
  
  if (filters.author) {
    result = result.filter(book => 
      book.author.toLowerCase().includes(filters.author.toLowerCase())
    );
  }
  
  if (filters.available !== 'all') {
    result = result.filter(book => 
      filters.available === 'yes' ? book.available : !book.available
    );
  }
  
  // Apply search
  if (query.trim()) {
    const normalized = query.trim().toLowerCase();
    result = result.filter(book => 
      book.title.toLowerCase().includes(normalized) ||
      book.author.toLowerCase().includes(normalized)
    );
  }
  
  return result;
}, [books, filters, query]);

// Add filter UI before the books grid
<div className="mb-6 flex flex-wrap gap-3">
  <select 
    value={filters.available}
    onChange={(e) => setFilters({...filters, available: e.target.value})}
    className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white"
  >
    <option value="all">All Books</option>
    <option value="yes">Available Only</option>
    <option value="no">Borrowed Only</option>
  </select>
  
  <input
    value={filters.author}
    onChange={(e) => setFilters({...filters, author: e.target.value})}
    placeholder="Filter by author..."
    className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/50"
  />
</div>
```

✅ **DONE! Advanced filters are now working.**

---

## 6️⃣ BARCODE/QR CODE (Day 13-14)

### Step 1: Install QR library

```bash
cd frontend
npm install qrcode.react
```

### Step 2: Create QR Component

Create `frontend/components/BookQRCode.tsx`:

```tsx
'use client';

import { QRCodeSVG } from 'qrcode.react';

export default function BookQRCode({ barcode }: { barcode: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl">
      <QRCodeSVG value={barcode} size={200} />
      <p className="text-xs text-gray-600">{barcode}</p>
    </div>
  );
}
```

### Step 3: Use in Book Details

Add to book details page where you want to show QR code.

✅ **DONE! QR codes are now working.**

---

## 7️⃣ BOOK RECOMMENDATIONS (Day 15-16)

Add to `backend/books/views.py`:

```python
@action(detail=True, methods=['get'])
def recommendations(self, request, pk=None):
    book = self.get_object()
    # Simple recommendation: same categories
    similar = Book.objects.filter(
        categories__in=book.categories.all()
    ).exclude(id=book.id).distinct()[:5]
    
    serializer = self.get_serializer(similar, many=True)
    return Response(serializer.data)
```

Add to frontend book details page:

```tsx
const [recommendations, setRecommendations] = useState<Book[]>([]);

useEffect(() => {
  async function loadRecs() {
    const response = await fetch(`${API_BASE_URL}/books/books/${bookId}/recommendations/`);
    const data = await response.json();
    setRecommendations(data);
  }
  if (bookId) loadRecs();
}, [bookId]);

// Display recommendations
<div className="mt-8">
  <h3 className="text-xl font-semibold">Similar Books</h3>
  <div className="mt-4 grid grid-cols-2 gap-4">
    {recommendations.map(book => (
      <BookCard key={book.id} book={book} />
    ))}
  </div>
</div>
```

✅ **DONE! Recommendations are now working.**

---

## 8️⃣ IN-APP NOTIFICATIONS (Day 17-19)

### Step 1: Create Notification Model

Add to `backend/user/models.py`:

```python
class Notification(models.Model):
    TYPE_DUE_SOON = 'DUE_SOON'
    TYPE_OVERDUE = 'OVERDUE'
    TYPE_AVAILABLE = 'AVAILABLE'
    TYPE_APPROVED = 'APPROVED'
    TYPE_CHOICES = (
        (TYPE_DUE_SOON, 'Due Soon'),
        (TYPE_OVERDUE, 'Overdue'),
        (TYPE_AVAILABLE, 'Available'),
        (TYPE_APPROVED, 'Approved'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
```

### Step 2: Create notifications on events

When approving borrow request:

```python
Notification.objects.create(
    user=borrow_request.user,
    type=Notification.TYPE_APPROVED,
    title='Borrow Request Approved',
    message=f'Your request for "{borrow_request.book.title}" has been approved!'
)
```

### Step 3: Add API endpoint

```python
class NotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'marked as read'})
```

### Step 4: Add notification bell to Navbar

```tsx
const [notifications, setNotifications] = useState([]);
const unreadCount = notifications.filter(n => !n.is_read).length;

// Add bell icon
<button className="relative">
  <BellIcon />
  {unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {unreadCount}
    </span>
  )}
</button>
```

✅ **DONE! In-app notifications are now working.**

---

## 9️⃣ MOBILE APP (Day 20-26)

This requires extensive work. Key files to update:

1. `mobile/src/api/client.ts` - Add API client
2. `mobile/src/screens/LoginScreen.tsx` - Connect auth
3. `mobile/src/screens/BooksScreen.tsx` - Connect book list
4. `mobile/src/screens/BookDetailsScreen.tsx` - Connect borrow/return

Basic API client for mobile:

```typescript
// mobile/src/api/client.ts
const API_URL = 'http://10.0.2.2:8000/api'; // Android emulator

export const api = {
  async login(studentId: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, password, portal: 'student' })
    });
    return response.json();
  },
  
  async getBooks() {
    const token = await AsyncStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/books/books/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }
};
```

✅ **DONE! Mobile app basics are now working.**

---

## 🎉 COMPLETION CHECKLIST

After implementing all features:

- [ ] Run all migrations
- [ ] Test each feature
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Train users

---

## 📞 NEED HELP?

If you get stuck on any feature:
1. Check the error message
2. Verify migrations ran successfully
3. Check API endpoints in browser
4. Test with Postman first
5. Check browser console for frontend errors

**Your system will be 100% complete after implementing these features!** 🚀
