'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, tokenStorage, User as AuthUser } from '@/lib/auth';
import { emitUnreadCountUpdated } from '@/lib/notificationEvents';
import { hasStaffDeskAccess, isWorkingStudent } from '@/lib/roles';
import {
  API_BASE_URL,
  API_ORIGIN,
  booksApi,
  Book as ApiBook,
  BorrowRequest,
  RenewalRequest,
  ReturnRequest,
  FinePayment,
  Category,
  getRenewalRequests,
  getReturnRequests,
  approveBorrowRequest,
  approveRenewalRequest,
  rejectBorrowRequest,
  rejectRenewalRequest,
  approveReturnRequest,
  rejectReturnRequest,
  resolveMediaUrl,
} from '@/lib/api';

import {
  LayoutDashboard,
  Library,
  PanelLeft,
  BookCopy,
  Archive,
  UserPlus,
  Users,
  User,
  Mail,
  Calendar,
  GraduationCap,
  RefreshCw,
  BookDown,
  BookUp,
  Book,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  ChevronDown,
  AlertCircle,
  BarChart3,
  BellRing,
  X,
  ArrowUpRight,
  ArrowLeft,
  Clock3,
  ReceiptText,
  MessageSquare,
  Trophy,
  Sparkles,
  Pencil,
  Trash2,
} from 'lucide-react';

type SectionState = 'idle' | 'loading' | 'error';
type FinePaymentDraft = {
  paymentReference: string;
  notes: string;
};
type DashboardNavItem = {
  id: string;
  label: string;
  icon: typeof Library;
  badge?: string;
};
type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};
type NotificationRecord = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};
type NotificationListResponse = {
  results?: NotificationRecord[];
  unread_count?: number;
  detail?: string;
  message?: string;
};

const NOTIFICATION_POLL_INTERVAL_MS = 15000;

const statusPill: Record<BorrowRequest['status'], string> = {
  PENDING: 'bg-sky-500/20 text-sky-100 border border-sky-300/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30',
  REJECTED: 'bg-rose-500/20 text-rose-100 border border-rose-300/30',
  RETURNED: 'bg-white/10 text-white/70 border border-white/20',
};

const returnStatusPill: Record<ReturnRequest['status'], string> = {
  PENDING: 'bg-sky-500/20 text-sky-100 border border-sky-300/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30',
  REJECTED: 'bg-rose-500/20 text-rose-100 border border-rose-300/30',
};

const renewalStatusPill: Record<RenewalRequest['status'], string> = {
  PENDING: 'bg-sky-500/20 text-sky-100 border border-sky-300/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30',
  REJECTED: 'bg-rose-500/20 text-rose-100 border border-rose-300/30',
};

const fineStatusPill: Record<FinePayment['status'], string> = {
  PENDING: 'bg-rose-500/20 text-rose-100 border border-rose-300/30',
  PAID: 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30',
  WAIVED: 'bg-amber-500/20 text-amber-100 border border-amber-300/30',
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'Unknown';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T00:00:00`
    : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const toTimestamp = (dateString?: string | null) => {
  if (!dateString) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T00:00:00`
    : dateString;
  const date = new Date(normalized);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const isInSameMonth = (dateString: string | null | undefined, reference: Date) => {
  if (!dateString) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T00:00:00`
    : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  );
};

const formatUserIdentifier = (
  user?: { student_id?: string | null; staff_id?: string | null } | null
) => user?.student_id ?? user?.staff_id ?? '-';

const getRequestUserAvatarUrl = (user?: { avatar?: string | null } | null) =>
  resolveMediaUrl(user?.avatar) ?? '/student-avatar.svg';

const BorrowerAvatar = ({
  user,
  sizeClass = 'h-10 w-10',
}: {
  user?: { avatar?: string | null; full_name?: string | null } | null;
  sizeClass?: string;
}) => (
  <div
    className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10`}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={getRequestUserAvatarUrl(user)}
      alt={user?.full_name ? `${user.full_name} avatar` : 'Borrower avatar'}
      className="h-full w-full object-cover"
    />
  </div>
);

const BookCoverPreview = ({
  book,
  sizeClass = 'h-24 w-16',
  roundedClass = 'rounded-2xl',
}: {
  book?: { title?: string | null; cover_image?: string | null } | null;
  sizeClass?: string;
  roundedClass?: string;
}) => {
  const coverUrl = resolveMediaUrl(book?.cover_image) ?? null;

  if (coverUrl) {
    return (
      <div
        className={`relative ${sizeClass} shrink-0 overflow-hidden ${roundedClass} border border-white/10 bg-white/5`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={book?.title ? `${book.title} cover` : 'Book cover'}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden ${roundedClass} border border-white/10 bg-white/5`}
    >
      <Book className="h-5 w-5 text-white/35" />
    </div>
  );
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

async function parseResponseData<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function LibrarianDeskPage() {
  const { user, logout } = useAuth();
  const [pendingStudents, setPendingStudents] = useState<AuthUser[]>([]);
  const [workingStudentApprovals, setWorkingStudentApprovals] = useState<Record<number, boolean>>({});
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);
  const [finePayments, setFinePayments] = useState<FinePayment[]>([]);
  const [finePaymentHistory, setFinePaymentHistory] = useState<FinePayment[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [analyticsBorrowRequests, setAnalyticsBorrowRequests] = useState<BorrowRequest[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<ApiBook[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [studentsState, setStudentsState] = useState<SectionState>('idle');
  const [borrowsState, setBorrowsState] = useState<SectionState>('idle');
  const [returnsState, setReturnsState] = useState<SectionState>('idle');
  const [renewalsState, setRenewalsState] = useState<SectionState>('idle');
  const [finePaymentsState, setFinePaymentsState] = useState<SectionState>('idle');
  const [notificationsState, setNotificationsState] = useState<SectionState>('idle');
  const [analyticsState, setAnalyticsState] = useState<SectionState>('idle');
  const [inventoryState, setInventoryState] = useState<SectionState>('idle');
  const [, setCategoriesState] = useState<SectionState>('idle');

  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [borrowsError, setBorrowsError] = useState<string | null>(null);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [renewalsError, setRenewalsError] = useState<string | null>(null);
  const [finePaymentsError, setFinePaymentsError] = useState<string | null>(null);
  const [finePaymentsSuccess, setFinePaymentsSuccess] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [returnActionBusy, setReturnActionBusy] = useState<number | null>(null);
  const [renewalActionBusy, setRenewalActionBusy] = useState<number | null>(null);
  const [fineActionBusyId, setFineActionBusyId] = useState<number | null>(null);
  const [fineActionType, setFineActionType] = useState<'paid' | 'waived' | null>(null);
  const [notificationActionBusy, setNotificationActionBusy] = useState(false);
  const [studentActionBusy, setStudentActionBusy] = useState<number | null>(null);
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [inventoryBusyId, setInventoryBusyId] = useState<number | null>(null);
  const [bookBusy, setBookBusy] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('desk-dashboard');
  const [isDeskMenuOpen, setIsDeskMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isPendingAccountsOpen, setIsPendingAccountsOpen] = useState(true);
  const [isPerformanceOverviewOpen, setIsPerformanceOverviewOpen] = useState(true);
  const [isBorrowRequestsOpen, setIsBorrowRequestsOpen] = useState(true);
  const [isRenewalRequestsOpen, setIsRenewalRequestsOpen] = useState(true);
  const [isReturnRequestsOpen, setIsReturnRequestsOpen] = useState(true);
  const [isFinePaymentsOpen, setIsFinePaymentsOpen] = useState(true);
  const [isInventoryManagerOpen, setIsInventoryManagerOpen] = useState(true);
  const [hideCurrentMonthHistory, setHideCurrentMonthHistory] = useState(false);
  const currentMonthReference = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(
    () =>
      currentMonthReference.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [currentMonthReference]
  );
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [finePaymentDrafts, setFinePaymentDrafts] = useState<Record<number, FinePaymentDraft>>({});
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [bookEditForm, setBookEditForm] = useState({
    title: '',
    author: '',
    genre: '',
    location_shelf: '',
    copies_total: '0',
  });

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const deskNotificationsPanelRef = useRef<HTMLElement | null>(null);
  const notificationsRequestVersionRef = useRef(0);

  const canManageBooks = useMemo(
    () => user?.role === 'LIBRARIAN' || user?.role === 'ADMIN',
    [user?.role]
  );
  const canManageEnrollmentRecords = useMemo(
    () => user?.role === 'LIBRARIAN' || user?.role === 'ADMIN',
    [user?.role]
  );
  const canApproveStudents = useMemo(
    () => user?.role === 'ADMIN' || user?.role === 'LIBRARIAN' || isWorkingStudent(user),
    [user]
  );
  const canManageFinePayments = useMemo(() => {
    return Boolean(user && (user.role === 'ADMIN' || user.role === 'LIBRARIAN' || hasStaffDeskAccess(user)));
  }, [user]);
  const dashboardNavGroups = useMemo<DashboardNavGroup[]>(() => {
    const activeBorrowedCount = analyticsBorrowRequests.filter(
      (request) => request.status === 'APPROVED'
    ).length;
    const overdueCount = analyticsBorrowRequests.filter(
      (request) => request.status === 'APPROVED' && (request.overdue_days ?? 0) > 0
    ).length;
    const totalCopyCount = catalogBooks.reduce(
      (sum, book) => sum + (book.copies_total ?? book.copies_available),
      0
    );

    const groups: DashboardNavGroup[] = [
      {
        label: 'Dashboard',
        items: [
          {
            id: 'desk-dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            badge: String(
              borrowRequests.length +
                renewalRequests.length +
                returnRequests.length +
                overdueCount +
                (canApproveStudents ? pendingStudents.length : 0)
            ),
          },
          {
            id: 'desk-notifications',
            label: 'Notifications',
            icon: BellRing,
            badge: String(notificationUnreadCount),
          },
        ],
      },
    ];

    if (canManageBooks) {
      groups.push({
        label: 'Library Management',
        items: [
          {
            id: 'desk-books',
            label: 'Books',
            icon: Book,
            badge: String(catalogBooks.length),
          },
          {
            id: 'desk-book-copies',
            label: 'Book Copies',
            icon: BookCopy,
            badge: String(totalCopyCount),
          },
          {
            id: 'desk-categories',
            label: 'Categories',
            icon: Sparkles,
            badge: String(categories.length),
          },
        ],
      });
    }

    const requestItems: DashboardNavItem[] = [];
    if (canApproveStudents) {
      requestItems.push({
        id: 'desk-accounts',
        label: 'Pending Accounts',
        icon: UserPlus,
        badge: String(pendingStudents.length),
      });
    }
    requestItems.push(
      {
        id: 'desk-borrows',
        label: 'Borrow Requests',
        icon: BookDown,
        badge: String(borrowRequests.length),
      },
      {
        id: 'desk-renewals',
        label: 'Renewal Requests',
        icon: RefreshCw,
        badge: String(renewalRequests.length),
      },
      {
        id: 'desk-returns',
        label: 'Return Requests',
        icon: BookUp,
        badge: String(returnRequests.length),
      }
    );
    groups.push({
      label: 'Requests',
      items: requestItems,
    });

    groups.push({
      label: 'Monitoring',
      items: [
        {
          id: 'desk-borrowed',
          label: 'Borrowed Books',
          icon: Archive,
          badge: String(activeBorrowedCount),
        },
        {
          id: 'desk-overdue',
          label: 'Overdue Books',
          icon: Clock3,
          badge: String(overdueCount),
        },
      ],
    });

    if (canManageFinePayments) {
      groups.push({
        label: 'Finance',
        items: [
          {
            id: 'desk-fines',
            label: 'Fine Payments',
            icon: ReceiptText,
            badge: String(finePayments.length),
          },
        ],
      });
    }
    return groups;
  }, [
    analyticsBorrowRequests,
    borrowRequests.length,
    canApproveStudents,
    canManageBooks,
    canManageFinePayments,
    catalogBooks,
    categories.length,
    finePayments.length,
    notificationUnreadCount,
    pendingStudents.length,
    renewalRequests.length,
    returnRequests.length,
  ]);

  const dashboardNavItems = useMemo(
    () => dashboardNavGroups.flatMap((group) => group.items),
    [dashboardNavGroups]
  );

  const resolvedActiveSectionId = useMemo(() => {
    if (dashboardNavItems.some((item) => item.id === activeSectionId)) {
      return activeSectionId;
    }
    return dashboardNavItems[0]?.id ?? '';
  }, [activeSectionId, dashboardNavItems]);

  const combinedBorrowActivity = useMemo(
    () => [...analyticsBorrowRequests, ...borrowRequests],
    [analyticsBorrowRequests, borrowRequests]
  );

  const mostBorrowedBooks = useMemo(() => {
    const counts = new Map<number, { id: number; title: string; author: string; count: number }>();

    analyticsBorrowRequests.forEach((request) => {
      if (request.status !== 'APPROVED' && request.status !== 'RETURNED') return;

      const existing = counts.get(request.book.id);
      if (existing) {
        existing.count += 1;
        return;
      }

      counts.set(request.book.id, {
        id: request.book.id,
        title: request.book.title,
        author: request.book.author,
        count: 1,
      });
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      .slice(0, 5);
  }, [analyticsBorrowRequests]);

  const mostActiveStudents = useMemo(() => {
    const counts = new Map<number, { id: number; fullName: string; studentId: string; requests: number; overdue: number }>();

    combinedBorrowActivity.forEach((request) => {
      if (!request.user) return;

      const existing = counts.get(request.user.id);
      if (existing) {
        existing.requests += 1;
        existing.overdue += request.overdue_days && request.overdue_days > 0 ? 1 : 0;
        return;
      }

      counts.set(request.user.id, {
        id: request.user.id,
        fullName: request.user.full_name,
        studentId: request.user.student_id ?? '-',
        requests: 1,
        overdue: request.overdue_days && request.overdue_days > 0 ? 1 : 0,
      });
    });

    return Array.from(counts.values())
      .sort((a, b) => b.requests - a.requests || a.fullName.localeCompare(b.fullName))
      .slice(0, 5);
  }, [combinedBorrowActivity]);

  const overdueRequests = useMemo(
    () =>
      analyticsBorrowRequests
        .filter((request) => request.status === 'APPROVED' && (request.overdue_days ?? 0) > 0)
        .sort((a, b) => (b.overdue_days ?? 0) - (a.overdue_days ?? 0)),
    [analyticsBorrowRequests]
  );

  const borrowHistory = useMemo(() => {
    let rows = [...analyticsBorrowRequests].sort(
      (a, b) => toTimestamp(b.requested_at) - toTimestamp(a.requested_at)
    );
    if (hideCurrentMonthHistory) {
      rows = rows.filter(
        (request) => !isInSameMonth(request.requested_at, currentMonthReference)
      );
    }
    return rows.slice(0, 10);
  }, [analyticsBorrowRequests, hideCurrentMonthHistory, currentMonthReference]);

  const returnHistory = useMemo(() => {
    let rows = analyticsBorrowRequests
      .filter((request) => request.status === 'RETURNED')
      .sort(
        (a, b) =>
          toTimestamp(b.returned_at ?? b.processed_at ?? b.requested_at) -
          toTimestamp(a.returned_at ?? a.processed_at ?? a.requested_at)
      )
      ;
    if (hideCurrentMonthHistory) {
      rows = rows.filter((request) => {
        const eventDate = request.returned_at ?? request.processed_at ?? request.requested_at;
        return !isInSameMonth(eventDate, currentMonthReference);
      });
    }
    return rows.slice(0, 10);
  }, [analyticsBorrowRequests, hideCurrentMonthHistory, currentMonthReference]);

  const overdueHistory = useMemo(() => {
    let rows = analyticsBorrowRequests
      .filter(
        (request) =>
          Number.parseFloat(request.late_fee_amount ?? '0') > 0
      )
      .sort(
        (a, b) =>
          toTimestamp(b.returned_at ?? b.processed_at ?? b.requested_at) -
          toTimestamp(a.returned_at ?? a.processed_at ?? a.requested_at)
      )
      ;
    if (hideCurrentMonthHistory) {
      rows = rows.filter((request) => {
        const eventDate = request.returned_at ?? request.processed_at ?? request.requested_at;
        return !isInSameMonth(eventDate, currentMonthReference);
      });
    }
    return rows.slice(0, 10);
  }, [analyticsBorrowRequests, hideCurrentMonthHistory, currentMonthReference]);

  const activeBorrowedRequests = useMemo(
    () =>
      analyticsBorrowRequests
        .filter((request) => request.status === 'APPROVED')
        .sort(
          (a, b) =>
            new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
        ),
    [analyticsBorrowRequests]
  );

  const totalOverdueFees = useMemo(
    () =>
      overdueRequests.reduce((sum, request) => {
        const fee = Number.parseFloat(request.late_fee_amount ?? '0');
        return sum + (Number.isFinite(fee) ? fee : 0);
      }, 0),
    [overdueRequests]
  );

  const pendingFineTotal = useMemo(
    () =>
      finePayments.reduce((sum, payment) => {
        const amount = Number.parseFloat(payment.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [finePayments]
  );

  const fineHistoryMetrics = useMemo(() => {
    return finePaymentHistory.reduce(
      (acc, payment) => {
        const amount = Number.parseFloat(payment.amount);
        if (payment.status === 'PAID') {
          acc.paidCount += 1;
          acc.paidTotal += Number.isFinite(amount) ? amount : 0;
        } else if (payment.status === 'WAIVED') {
          acc.waivedCount += 1;
        }
        return acc;
      },
      { paidCount: 0, waivedCount: 0, paidTotal: 0 }
    );
  }, [finePaymentHistory]);

  const fineHistoryRows = useMemo(() => {
    let rows = [...finePaymentHistory].sort(
      (a, b) =>
        toTimestamp(b.paid_at ?? b.created_at) - toTimestamp(a.paid_at ?? a.created_at)
    );
    if (hideCurrentMonthHistory) {
      rows = rows.filter(
        (payment) => !isInSameMonth(payment.paid_at ?? payment.created_at, currentMonthReference)
      );
    }
    return rows.slice(0, 10);
  }, [finePaymentHistory, hideCurrentMonthHistory, currentMonthReference]);

  const totalCatalogCopies = useMemo(
    () =>
      catalogBooks.reduce(
        (sum, book) => sum + (book.copies_total ?? book.copies_available),
        0
      ),
    [catalogBooks]
  );

  const totalAvailableCopies = useMemo(
    () => catalogBooks.reduce((sum, book) => sum + book.copies_available, 0),
    [catalogBooks]
  );

  const copyUtilizationRows = useMemo(
    () =>
      [...catalogBooks]
        .map((book) => {
          const totalCopies = book.copies_total ?? book.copies_available;
          const inUse = Math.max(0, totalCopies - book.copies_available);
          return {
            ...book,
            totalCopies,
            inUse,
            utilization:
              totalCopies > 0 ? Math.round((inUse / totalCopies) * 100) : 0,
          };
        })
        .sort((a, b) => b.inUse - a.inUse || a.title.localeCompare(b.title)),
    [catalogBooks]
  );

  const adminLinks = useMemo(
    () => ({
      dashboard: `${API_ORIGIN}/admin/`,
      contactMessages: `${API_ORIGIN}/admin/user/contactmessage/`,
      notifications: `${API_ORIGIN}/admin/user/notification/`,
      books: `${API_ORIGIN}/admin/books/`,
    }),
    []
  );

  const recentNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications]
  );

  const pendingQueueCount = useMemo(
    () => borrowRequests.length + renewalRequests.length + returnRequests.length,
    [borrowRequests.length, renewalRequests.length, returnRequests.length]
  );

  const recentDeskTransactions = useMemo(
    () =>
      [
        ...borrowRequests.map((request) => ({ ...request, _source: 'pending' as const })),
        ...analyticsBorrowRequests,
      ]
        .sort((a, b) => toTimestamp(b.requested_at) - toTimestamp(a.requested_at))
        .slice(0, 5),
    [analyticsBorrowRequests, borrowRequests]
  );

  const latestDeskActivityLabel = useMemo(() => {
    if (recentDeskTransactions.length === 0) return 'Waiting for first circulation event';
    return formatDate(recentDeskTransactions[0].requested_at);
  }, [recentDeskTransactions]);

  const categoryPopularity = useMemo(() => {
    const counts = new Map<number, { id: number; name: string; count: number }>();

    analyticsBorrowRequests.forEach((request) => {
      if (request.status !== 'APPROVED' && request.status !== 'RETURNED') return;

      (request.book.categories ?? []).forEach((category) => {
        const existing = counts.get(category.id);
        if (existing) {
          existing.count += 1;
          return;
        }
        counts.set(category.id, { id: category.id, name: category.name, count: 1 });
      });
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [analyticsBorrowRequests]);

  const performanceSeries = useMemo(() => {
    const monthsBack = 6;
    const now = new Date();
    const points: {
      key: string;
      label: string;
      mostBorrowed: number;
      activeStudents: number;
      overdueReports: number;
      estimatedFines: number;
      approved: number;
      returned: number;
      pending: number;
      overdue: number;
    }[] = [];

    const indexByKey = new Map<string, number>();
    const bookBorrowCountsByMonth = new Map<string, Map<number, number>>();
    const uniqueUsersByMonth = new Map<string, Set<number>>();

    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = toMonthKey(monthDate);
      indexByKey.set(key, points.length);
      bookBorrowCountsByMonth.set(key, new Map<number, number>());
      uniqueUsersByMonth.set(key, new Set<number>());
      points.push({
        key,
        label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        mostBorrowed: 0,
        activeStudents: 0,
        overdueReports: 0,
        estimatedFines: 0,
        approved: 0,
        returned: 0,
        pending: 0,
        overdue: 0,
      });
    }

    analyticsBorrowRequests.forEach((request) => {
      const requestedAt = new Date(request.requested_at);
      if (Number.isNaN(requestedAt.getTime())) return;

      const targetIndex = indexByKey.get(toMonthKey(requestedAt));
      if (targetIndex === undefined) return;

      const point = points[targetIndex];
      if (request.status === 'APPROVED') point.approved += 1;
      if (request.status === 'RETURNED') point.returned += 1;

      const monthBookCounts = bookBorrowCountsByMonth.get(point.key);
      if (monthBookCounts && (request.status === 'APPROVED' || request.status === 'RETURNED')) {
        monthBookCounts.set(request.book.id, (monthBookCounts.get(request.book.id) ?? 0) + 1);
      }

      const monthUsers = uniqueUsersByMonth.get(point.key);
      if (monthUsers && request.user?.id) {
        monthUsers.add(request.user.id);
      }

      if ((request.overdue_days ?? 0) > 0) {
        point.overdue += 1;
        point.overdueReports += 1;
        const fee = Number.parseFloat(request.late_fee_amount ?? '0');
        point.estimatedFines += Number.isFinite(fee) ? fee : 0;
      }
    });

    borrowRequests.forEach((request) => {
      const requestedAt = new Date(request.requested_at);
      if (Number.isNaN(requestedAt.getTime())) return;

      const targetIndex = indexByKey.get(toMonthKey(requestedAt));
      if (targetIndex === undefined) return;

      points[targetIndex].pending += 1;
      const monthUsers = uniqueUsersByMonth.get(points[targetIndex].key);
      if (monthUsers && request.user?.id) {
        monthUsers.add(request.user.id);
      }
    });

    points.forEach((point) => {
      const monthBookCounts = bookBorrowCountsByMonth.get(point.key);
      point.mostBorrowed = monthBookCounts
        ? Math.max(0, ...Array.from(monthBookCounts.values()))
        : 0;

      const monthUsers = uniqueUsersByMonth.get(point.key);
      point.activeStudents = monthUsers ? monthUsers.size : 0;

      point.estimatedFines = Number(point.estimatedFines.toFixed(2));
    });

    return points;
  }, [analyticsBorrowRequests, borrowRequests]);

  const performanceChart = useMemo(() => {
    const chartWidth = 760;
    const chartHeight = 240;
    const padding = {
      top: 16,
      right: 16,
      bottom: 30,
      left: 36,
    };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    const baselineY = padding.top + innerHeight;

    const maxCountValue = Math.max(
      1,
      ...performanceSeries.map((point) =>
        Math.max(point.mostBorrowed, point.activeStudents, point.overdueReports)
      )
    );
    const maxFinesValue = Math.max(
      1,
      ...performanceSeries.map((point) => point.estimatedFines)
    );

    const toCountY = (value: number) =>
      baselineY - (value / maxCountValue) * innerHeight;
    const toFinesY = (value: number) =>
      baselineY - (value / maxFinesValue) * innerHeight;

    const stepX =
      performanceSeries.length > 1
        ? innerWidth / (performanceSeries.length - 1)
        : 0;

    const points = performanceSeries.map((point, index) => {
      const x = padding.left + index * stepX;
      return {
        ...point,
        x,
        yMostBorrowed: toCountY(point.mostBorrowed),
        yActiveStudents: toCountY(point.activeStudents),
        yOverdueReports: toCountY(point.overdueReports),
        yEstimatedFines: toFinesY(point.estimatedFines),
      };
    });

    const linePath = (
      key:
        | 'yMostBorrowed'
        | 'yActiveStudents'
        | 'yOverdueReports'
        | 'yEstimatedFines'
    ) =>
      points
        .map((point, index) =>
          `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point[key].toFixed(2)}`
        )
        .join(' ');

    const areaPath =
      points.length === 0
        ? ''
        : `M${points[0].x.toFixed(2)},${baselineY.toFixed(2)} ${points
            .map((point) => `L${point.x.toFixed(2)},${point.yMostBorrowed.toFixed(2)}`)
            .join(' ')} L${points[points.length - 1].x.toFixed(2)},${baselineY.toFixed(
            2
          )} Z`;

    const countGridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(maxCountValue * ratio),
      y: baselineY - ratio * innerHeight,
    }));
    const finesGridValues = [0, 0.5, 1].map((ratio) => ({
      value: Number((maxFinesValue * ratio).toFixed(2)),
      y: baselineY - ratio * innerHeight,
    }));

    return {
      chartWidth,
      chartHeight,
      padding,
      baselineY,
      maxCountValue,
      maxFinesValue,
      points,
      mostBorrowedPath: linePath('yMostBorrowed'),
      activeStudentsPath: linePath('yActiveStudents'),
      overdueReportsPath: linePath('yOverdueReports'),
      estimatedFinesPath: linePath('yEstimatedFines'),
      areaPath,
      countGridValues,
      finesGridValues,
    };
  }, [performanceSeries]);

  const latestPerformancePoint = useMemo(
    () => performanceSeries[performanceSeries.length - 1] ?? null,
    [performanceSeries]
  );

  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    published_date: '',
    genre: '',
    location_shelf: '',
    language: '',
    grade_level: '',
    description: '',
    copies_available: '1',
    category_ids: [] as number[],
  });

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((category) => {
        if (!query) return true;
        return category.name.toLowerCase().includes(query);
      });
  }, [categories, categorySearch]);

  const selectedCategoryNames = useMemo(() => {
    if (bookForm.category_ids.length === 0) return [];
    const selected = categories.filter((category) =>
      bookForm.category_ids.includes(category.id)
    );
    return selected.map((category) => category.name);
  }, [bookForm.category_ids, categories]);

  const getBookCoverUrl = useCallback(
    (book?: { cover_image?: string | null } | null) =>
      resolveMediaUrl(book?.cover_image) ?? null,
    []
  );

  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverBackFile, setCoverBackFile] = useState<File | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const coverBackInputRef = useRef<HTMLInputElement | null>(null);

  // ────────────────────────────────────────────────
  // Data Loading
  // ────────────────────────────────────────────────

  const loadPendingStudents = useCallback(async () => {
    if (!canApproveStudents) {
      setStudentsError(null);
      setPendingStudents([]);
      setWorkingStudentApprovals({});
      setStudentsState('idle');
      return;
    }
    setStudentsState('loading');
    const response = await authApi.getPendingStudents();
    if (response.error || !response.data) {
      setStudentsError(response.error ?? 'Unable to load pending accounts.');
      setPendingStudents([]);
      setWorkingStudentApprovals({});
      setStudentsState('error');
      return;
    }
    setStudentsError(null);
    setPendingStudents(response.data);
    setWorkingStudentApprovals(
      response.data.reduce<Record<number, boolean>>((acc, account) => {
        acc[account.id] = Boolean(account.is_working_student);
        return acc;
      }, {})
    );
    setStudentsState('idle');
  }, [canApproveStudents]);

  const loadBorrowRequests = useCallback(async () => {
    setBorrowsState('loading');
    const response = await booksApi.getBorrowRequests('PENDING');
    if (response.error || !response.data) {
      setBorrowsError(response.error ?? 'Unable to load borrow requests.');
      setBorrowRequests([]);
      setBorrowsState('error');
      return;
    }
    setBorrowsError(null);
    setBorrowRequests(response.data);
    setBorrowsState('idle');
  }, []);

  const loadBorrowAnalytics = useCallback(async () => {
    setAnalyticsState('loading');

    const responses = await Promise.all([
      booksApi.getBorrowRequests('APPROVED'),
      booksApi.getBorrowRequests('RETURNED'),
    ]);

    const failedResponse = responses.find((response) => response.error || !response.data);
    if (failedResponse) {
      setAnalyticsError(failedResponse.error ?? 'Unable to load analytics data.');
      setAnalyticsBorrowRequests([]);
      setAnalyticsState('error');
      return;
    }

    const analyticsById = new Map<number, BorrowRequest>();
    responses.forEach((response) => {
      (response.data ?? []).forEach((request) => {
        analyticsById.set(request.id, request);
      });
    });

    setAnalyticsError(null);
    setAnalyticsBorrowRequests(Array.from(analyticsById.values()));
    setAnalyticsState('idle');
  }, []);

  const loadReturnRequests = useCallback(async () => {
    setReturnsState('loading');
    const response = await (typeof booksApi.getReturnRequests === 'function'
      ? booksApi.getReturnRequests('PENDING')
      : getReturnRequests('PENDING'));
    if (response.error || !response.data) {
      setReturnsError(response.error ?? 'Unable to load return requests.');
      setReturnRequests([]);
      setReturnsState('error');
      return;
    }
    setReturnsError(null);
    setReturnRequests(response.data);
    setReturnsState('idle');
  }, []);

  const loadRenewalRequests = useCallback(async () => {
    setRenewalsState('loading');
    const response = await (typeof booksApi.getRenewalRequests === 'function'
      ? booksApi.getRenewalRequests('PENDING')
      : getRenewalRequests('PENDING'));
    if (response.error || !response.data) {
      setRenewalsError(response.error ?? 'Unable to load renewal requests.');
      setRenewalRequests([]);
      setRenewalsState('error');
      return;
    }
    setRenewalsError(null);
    setRenewalRequests(response.data);
    setRenewalsState('idle');
  }, []);

  const loadFinePayments = useCallback(async () => {
    if (!canManageFinePayments) {
      setFinePayments([]);
      setFinePaymentHistory([]);
      setFinePaymentsError(null);
      setFinePaymentsState('idle');
      return;
    }

    setFinePaymentsState('loading');
    const response = await booksApi.getFinePayments();
    if (response.error || !response.data) {
      setFinePaymentsError(response.error ?? 'Unable to load fine payments.');
      setFinePayments([]);
      setFinePaymentHistory([]);
      setFinePaymentsState('error');
      return;
    }

    const pendingPayments = response.data.filter(
      (payment) => payment.status === 'PENDING'
    );
    const historyPayments = response.data.filter(
      (payment) => payment.status !== 'PENDING'
    );

    setFinePaymentsError(null);
    setFinePayments(pendingPayments);
    setFinePaymentHistory(historyPayments);
    setFinePaymentDrafts((prev) => {
      const next: Record<number, FinePaymentDraft> = {};
      pendingPayments.forEach((payment) => {
        next[payment.id] = {
          paymentReference: prev[payment.id]?.paymentReference ?? payment.payment_reference ?? '',
          notes: prev[payment.id]?.notes ?? payment.notes ?? '',
        };
      });
      return next;
    });
    setFinePaymentsState('idle');
  }, [canManageFinePayments]);

  const loadCategories = useCallback(async () => {
    if (!canManageBooks) return;
    setCategoriesState('loading');
    const response = await booksApi.getCategories();
    if (response.error || !response.data) {
      setCategories([]);
      setCategoriesState('error');
      return;
    }
    setCategories(response.data);
    setCategoriesState('idle');
  }, [canManageBooks]);

  const loadCatalogBooks = useCallback(async () => {
    if (!canManageBooks) return;
    setInventoryState('loading');

    const response = await booksApi.getAll();
    if (response.error || !response.data) {
      setInventoryError(response.error ?? 'Unable to load catalog.');
      setCatalogBooks([]);
      setInventoryState('error');
      return;
    }

    setInventoryError(null);
    setCatalogBooks(
      [...response.data].sort((a, b) => a.title.localeCompare(b.title))
    );
    setInventoryState('idle');
  }, [canManageBooks]);

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;

    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) {
      notificationsRequestVersionRef.current += 1;
      setNotifications([]);
      setNotificationUnreadCount(0);
      emitUnreadCountUpdated(0);
      setNotificationsError('Not authenticated.');
      setNotificationsState('error');
      return;
    }

    const requestVersion = notificationsRequestVersionRef.current + 1;
    notificationsRequestVersionRef.current = requestVersion;
    if (!options?.silent) {
      setNotificationsState('loading');
    }

    try {
      const requestNotifications = async () =>
        fetch(`${API_BASE_URL}/auth/notifications/?limit=8`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${tokenStorage.getAccessToken()}`,
          },
        });

      let response = await requestNotifications();
      if (response.status === 401) {
        const refreshResult = await authApi.refreshToken();
        if (refreshResult.error) {
          if (notificationsRequestVersionRef.current !== requestVersion) return;
          setNotifications([]);
          setNotificationUnreadCount(0);
          emitUnreadCountUpdated(0);
          setNotificationsError(refreshResult.error);
          setNotificationsState('error');
          return;
        }
        response = await requestNotifications();
      }

      const data = await parseResponseData<NotificationListResponse>(response);
      if (!response.ok) {
        if (notificationsRequestVersionRef.current !== requestVersion) return;
        setNotifications([]);
        setNotificationUnreadCount(0);
        emitUnreadCountUpdated(0);
        setNotificationsError(data?.detail ?? 'Unable to load notifications.');
        setNotificationsState('error');
        return;
      }

      if (notificationsRequestVersionRef.current !== requestVersion) return;
      setNotifications(data?.results ?? []);
      setNotificationUnreadCount(data?.unread_count ?? 0);
      emitUnreadCountUpdated(data?.unread_count ?? 0);
      setNotificationsError(null);
      setNotificationsState('idle');
    } catch (error) {
      if (notificationsRequestVersionRef.current !== requestVersion) return;
      setNotifications([]);
      setNotificationUnreadCount(0);
      emitUnreadCountUpdated(0);
      setNotificationsError(
        error instanceof Error ? error.message : 'Unable to load notifications.'
      );
      setNotificationsState('error');
    }
  }, [user]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken || notificationActionBusy) return;

    notificationsRequestVersionRef.current += 1;
    setNotificationActionBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/notifications/mark-all-read/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await parseResponseData<NotificationListResponse>(response);
      if (!response.ok) {
        setNotificationsError(data?.detail ?? 'Unable to mark notifications as read.');
        setNotificationActionBusy(false);
        return;
      }

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );
      setNotificationUnreadCount(0);
      emitUnreadCountUpdated(0);
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : 'Unable to mark notifications as read.'
      );
    } finally {
      setNotificationActionBusy(false);
    }
  }, [notificationActionBusy]);

  useEffect(() => {
    if (!user) return;

    const refreshNotifications = () => {
      void loadNotifications({ silent: true });
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    }, NOTIFICATION_POLL_INTERVAL_MS);

    const handleFocus = () => {
      refreshNotifications();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, loadNotifications]);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      await Promise.all([
        ...(canApproveStudents ? [loadPendingStudents()] : []),
        loadBorrowRequests(),
        loadRenewalRequests(),
        loadReturnRequests(),
        ...(canManageFinePayments ? [loadFinePayments()] : []),
        loadBorrowAnalytics(),
        ...(canManageBooks ? [loadCatalogBooks()] : []),
        ...(canManageBooks ? [loadCategories()] : []),
        loadNotifications(),
      ]);
    })();
  }, [
    user,
    canApproveStudents,
    canManageBooks,
    canManageFinePayments,
    loadPendingStudents,
    loadBorrowRequests,
    loadRenewalRequests,
    loadReturnRequests,
    loadFinePayments,
    loadBorrowAnalytics,
    loadCatalogBooks,
    loadCategories,
    loadNotifications,
  ]);

  const openNotificationCenter = useCallback(() => {
    setActiveSectionId('desk-notifications');
    setIsProfileMenuOpen(false);
  }, []);

  const focusDashboardNotifications = useCallback(() => {
    setActiveSectionId('desk-dashboard');
    setIsProfileMenuOpen(false);

    window.setTimeout(() => {
      deskNotificationsPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, resolvedActiveSectionId === 'desk-dashboard' ? 0 : 120);
  }, [resolvedActiveSectionId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  // ────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────

  const handleApproveStudent = async (studentId: number) => {
    setStudentActionBusy(studentId);
    const response = await authApi.approveStudent(studentId, {
      is_working_student: Boolean(workingStudentApprovals[studentId]),
    });
    if (response.error || !response.data) {
      setStudentsError(response.error ?? 'Unable to approve account.');
    } else {
      setPendingStudents((prev) => prev.filter((s) => s.id !== studentId));
      setWorkingStudentApprovals((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
    setStudentActionBusy(null);
  };

  const handleRejectStudent = async (studentId: number) => {
    if (!confirm('Are you sure you want to reject this account? This action cannot be undone.')) {
      return;
    }
    
    setStudentActionBusy(studentId);
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) {
      setStudentsError('Not authenticated.');
      setStudentActionBusy(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reject-account/${studentId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await parseResponseData<{ message?: string; detail?: string }>(response);
      
      if (!response.ok) {
        setStudentsError(data?.detail ?? 'Unable to reject account.');
      } else {
        setPendingStudents((prev) => prev.filter((s) => s.id !== studentId));
        setWorkingStudentApprovals((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
      }
    } catch (error) {
      setStudentsError(
        error instanceof Error ? error.message : 'Unable to reject account.'
      );
    }
    setStudentActionBusy(null);
  };

  const handleBorrowDecision = async (requestId: number, approve: boolean) => {
    setActionBusy(requestId);
    const fn = approve ? approveBorrowRequest : rejectBorrowRequest;
    const response = await fn(requestId);
    if (response.error || !response.data) {
      setBorrowsError(response.error ?? 'Unable to update borrow request.');
    } else {
      setBorrowRequests((prev) => prev.filter((r) => r.id !== requestId));
      void loadBorrowAnalytics();
      if (canManageBooks) {
        void loadCatalogBooks();
      }
    }
    setActionBusy(null);
  };

  const handleReturnDecision = async (requestId: number, approve: boolean) => {
    setReturnActionBusy(requestId);
    const fn = approve ? approveReturnRequest : rejectReturnRequest;
    const response = await fn(requestId);
    if (response.error || !response.data) {
      setReturnsError(response.error ?? 'Unable to update return request.');
    } else {
      setReturnRequests((prev) => prev.filter((r) => r.id !== requestId));
      void loadBorrowAnalytics();
      if (canManageFinePayments) {
        void loadFinePayments();
      }
      if (canManageBooks) {
        void loadCatalogBooks();
      }
    }
    setReturnActionBusy(null);
  };

  const handleRenewalDecision = async (requestId: number, approve: boolean) => {
    setRenewalActionBusy(requestId);
    const fn = approve ? approveRenewalRequest : rejectRenewalRequest;
    const response = await fn(requestId);
    if (response.error || !response.data) {
      setRenewalsError(response.error ?? 'Unable to update renewal request.');
    } else {
      setRenewalRequests((prev) => prev.filter((r) => r.id !== requestId));
      void loadBorrowAnalytics();
    }
    setRenewalActionBusy(null);
  };

  const updateFinePaymentDraft = (
    paymentId: number,
    field: keyof FinePaymentDraft,
    value: string
  ) => {
    setFinePaymentDrafts((prev) => ({
      ...prev,
      [paymentId]: {
        paymentReference: prev[paymentId]?.paymentReference ?? '',
        notes: prev[paymentId]?.notes ?? '',
        [field]: value,
      },
    }));
  };

  const handleFinePaymentAction = async (paymentId: number, action: 'paid' | 'waived') => {
    if (!canManageFinePayments) return;

    setFineActionBusyId(paymentId);
    setFineActionType(action);
    setFinePaymentsError(null);
    setFinePaymentsSuccess(null);

    const draft = finePaymentDrafts[paymentId] ?? { paymentReference: '', notes: '' };
    const paymentReference = draft.paymentReference.trim();
    const notes = draft.notes.trim();

    const response =
      action === 'paid'
        ? await booksApi.markFinePaid(paymentId, {
            payment_reference: paymentReference,
            notes,
          })
        : await booksApi.waiveFine(paymentId, notes);

    if (response.error || !response.data?.fine_payment) {
      setFinePaymentsError(
        response.error ??
          (action === 'paid'
            ? 'Unable to mark fine payment as paid.'
            : 'Unable to waive fine payment.')
      );
      setFineActionBusyId(null);
      setFineActionType(null);
      return;
    }

    setFinePaymentsSuccess(
      action === 'paid' ? 'Fine payment marked as paid.' : 'Fine payment waived.'
    );
    await Promise.all([loadFinePayments(), loadBorrowAnalytics()]);
    setFineActionBusyId(null);
    setFineActionType(null);
  };

  const toggleCategory = (categoryId: number) => {
    setBookForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId],
    }));
  };

  const handleCreateCategory = async () => {
    if (!canManageBooks || categoryBusy) return;

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setCategorySuccess(null);
      setCategoryError('Category name is required.');
      return;
    }

    const exists = categories.some(
      (category) => category.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setCategorySuccess(null);
      setCategoryError('Category already exists.');
      return;
    }

    setCategoryBusy(true);
    setCategoryError(null);
    setCategorySuccess(null);

    const response = await booksApi.createCategory({ name: trimmedName });
    if (response.error || !response.data) {
      setCategoryError(response.error ?? 'Unable to create category.');
      setCategoryBusy(false);
      return;
    }

    const createdCategory = response.data;
    setCategories((prev) => {
      const alreadyIncluded = prev.some(
        (category) =>
          category.id === createdCategory.id ||
          category.name.trim().toLowerCase() === createdCategory.name.trim().toLowerCase()
      );
      const merged = alreadyIncluded ? prev : [...prev, createdCategory];
      return [...merged].sort((a, b) => a.name.localeCompare(b.name));
    });
    setBookForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(createdCategory.id)
        ? prev.category_ids
        : [...prev.category_ids, createdCategory.id],
    }));
    setIsCategoryDropdownOpen(true);
    setCategorySearch('');
    setNewCategoryName('');
    setCategorySuccess(`Category "${createdCategory.name}" added.`);
    setCategoryBusy(false);
  };

  const handleBookChange = (field: keyof typeof bookForm, value: string) => {
    setBookForm((prev) => ({ ...prev, [field]: value }));
  };

  const isAllowedBookImage = (file: File) => {
    const lowerFileName = file.name.toLowerCase();
    return (
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      lowerFileName.endsWith('.jpg') ||
      lowerFileName.endsWith('.jpeg') ||
      lowerFileName.endsWith('.png')
    );
  };

  const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      setCoverImageFile(null);
      return;
    }

    if (!isAllowedBookImage(selectedFile)) {
      setBookError('Only JPG and PNG files are allowed for book covers.');
      setCoverImageFile(null);
      event.target.value = '';
      return;
    }

    setBookError(null);
    setCoverImageFile(selectedFile);
  };

  const handleCoverBackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      setCoverBackFile(null);
      return;
    }

    if (!isAllowedBookImage(selectedFile)) {
      setBookError('Only JPG and PNG files are allowed for book covers.');
      setCoverBackFile(null);
      event.target.value = '';
      return;
    }

    setBookError(null);
    setCoverBackFile(selectedFile);
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageBooks) return;

    setBookBusy(true);
    setBookError(null);
    setBookSuccess(null);
    const initialCopiesTotal = Math.max(
      0,
      Number.parseInt(bookForm.copies_available, 10) || 0
    );

    const payload = new FormData();
    payload.append('title', bookForm.title.trim());
    payload.append('author', bookForm.author.trim());
    payload.append('isbn', bookForm.isbn.trim());
    payload.append('published_date', bookForm.published_date);
    payload.append('genre', bookForm.genre.trim());

    const locationShelf = bookForm.location_shelf.trim();
    if (locationShelf) {
      payload.append('location_shelf', locationShelf);
    }

    const language = bookForm.language.trim();
    if (language) {
      payload.append('language', language);
    }

    const gradeLevel = bookForm.grade_level.trim();
    if (gradeLevel) {
      payload.append('grade_level', gradeLevel);
    }

    if (coverImageFile) {
      payload.append('cover_image', coverImageFile);
    }

    if (coverBackFile) {
      payload.append('cover_back', coverBackFile);
    }

    bookForm.category_ids.forEach((categoryId) => {
      payload.append('category_ids', String(categoryId));
    });

    const response = await booksApi.create(payload);
    if (response.error) {
      setBookError(response.error);
    } else {
      let successMessage = 'Book added successfully!';
      if (response.data && initialCopiesTotal > 0) {
        const copiesResponse = await booksApi.setCopiesTotal(
          response.data.id,
          initialCopiesTotal
        );
        if (copiesResponse.error || !copiesResponse.data) {
          successMessage =
            'Book added, but initial copies were not set. You can edit this book and set total copies.';
        }
      }

      setBookSuccess(successMessage);
      setBookForm({
        title: '',
        author: '',
        isbn: '',
        published_date: '',
        genre: '',
        location_shelf: '',
        language: '',
        grade_level: '',
        description: '',
        copies_available: '1',
        category_ids: [],
      });
      setCategorySearch('');
      setIsCategoryDropdownOpen(false);
      setCoverImageFile(null);
      setCoverBackFile(null);
      if (coverImageInputRef.current) {
        coverImageInputRef.current.value = '';
      }
      if (coverBackInputRef.current) {
        coverBackInputRef.current.value = '';
      }
      // Refresh catalog immediately after adding book
      if (canManageBooks) {
        await loadCatalogBooks();
      }
    }
    setBookBusy(false);
  };

  const startBookEdit = (book: ApiBook) => {
    setEditingBookId(book.id);
    setBookEditForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      location_shelf: book.location_shelf ?? '',
      copies_total: String(book.copies_total ?? book.copies_available ?? 0),
    });
  };

  const cancelBookEdit = () => {
    setEditingBookId(null);
    setBookEditForm({
      title: '',
      author: '',
      genre: '',
      location_shelf: '',
      copies_total: '0',
    });
  };

  const handleBookEditChange = (field: keyof typeof bookEditForm, value: string) => {
    setBookEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveBookEdit = async (bookId: number) => {
    if (!canManageBooks || inventoryBusyId === bookId) return;

    const targetCopiesTotal = Number.parseInt(bookEditForm.copies_total, 10);
    if (!Number.isInteger(targetCopiesTotal) || targetCopiesTotal < 0) {
      setInventoryError('Total copies must be a non-negative whole number.');
      return;
    }

    setInventoryBusyId(bookId);
    setInventoryError(null);

    const payload = {
      title: bookEditForm.title.trim(),
      author: bookEditForm.author.trim(),
      genre: bookEditForm.genre.trim(),
      location_shelf: bookEditForm.location_shelf.trim(),
    };

    const response = await booksApi.update(bookId, payload);
    if (response.error || !response.data) {
      setInventoryError(response.error ?? 'Unable to update book details.');
      setInventoryBusyId(null);
      return;
    }

    const copiesResponse = await booksApi.setCopiesTotal(bookId, targetCopiesTotal);
    if (copiesResponse.error || !copiesResponse.data) {
      setCatalogBooks((prev) =>
        prev.map((book) => (book.id === bookId ? { ...book, ...response.data } : book))
      );
      setInventoryError(
        copiesResponse.error ??
          'Book details were updated, but total copies could not be changed.'
      );
      setInventoryBusyId(null);
      return;
    }

    setCatalogBooks((prev) =>
      prev.map((book) =>
        book.id === bookId ? { ...book, ...response.data, ...copiesResponse.data?.book } : book
      )
    );
    cancelBookEdit();
    setInventoryBusyId(null);
  };

  const handleDeleteBook = async (book: ApiBook) => {
    if (!canManageBooks || inventoryBusyId === book.id) return;

    setInventoryBusyId(book.id);
    setInventoryError(null);

    const response = await booksApi.delete(book.id);
    if (response.error) {
      setInventoryError(response.error);
      setInventoryBusyId(null);
      return;
    }

    setCatalogBooks((prev) => prev.filter((item) => item.id !== book.id));
    if (editingBookId === book.id) {
      cancelBookEdit();
    }
    setInventoryBusyId(null);
  };

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  return (
    <ProtectedRoute requiredRoles={['LIBRARIAN', 'WORKING', 'STAFF', 'ADMIN']}>
      <div className="min-h-screen bg-[#060b16] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%)]" />
        </div>

        <div className="relative flex min-h-screen">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsDeskMenuOpen(false)}
            className={`fixed inset-0 z-30 bg-[#020611]/70 backdrop-blur-sm transition-opacity md:hidden ${
              isDeskMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />

          <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col overflow-y-auto border-r border-white/8 bg-[linear-gradient(180deg,rgba(6,14,24,0.98),rgba(8,17,30,0.96))] px-2.5 py-3.5 shadow-[20px_0_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition-transform duration-300 md:translate-x-0 ${
              isDeskMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex flex-col gap-3">
              <Link
                href="/"
                onClick={() => setIsDeskMenuOpen(false)}
                className="inline-flex items-center gap-2 rounded-[16px] border border-white/10 bg-transparent px-3 py-2 text-[12px] font-medium text-white/72 transition hover:border-cyan-300/20 hover:bg-white/[0.03] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Landing Page
              </Link>

              <div className="flex items-start justify-between gap-3">
                <Link
                  href="/"
                  onClick={() => setIsDeskMenuOpen(false)}
                  className="flex min-w-0 items-center gap-2.5 rounded-2xl px-1 py-1.5 transition hover:bg-white/[0.03]"
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.06] shadow-lg shadow-black/30">
                    <Image
                      src="/logo%20lib.png"
                      alt="Salazar Library System logo"
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white/92">Salazar Library System</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/34">
                      Admin Desk
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsDeskMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <nav className="mt-6 space-y-5">
              {dashboardNavGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 text-[9px] font-medium uppercase tracking-[0.34em] text-white/28">
                    {group.label}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = resolvedActiveSectionId === item.id;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setActiveSectionId(item.id);
                            setIsDeskMenuOpen(false);
                          }}
                          className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[16px] px-3 py-3 text-left transition ${
                            isActive
                              ? 'bg-cyan-400/[0.08] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.14),0_0_24px_rgba(34,211,238,0.10)]'
                              : 'text-white/66 hover:bg-white/[0.03] hover:text-white'
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full transition ${
                              isActive
                                ? 'bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.7)]'
                                : 'bg-transparent'
                            }`}
                          />
                          <span
                            className={`inline-flex items-center justify-center transition ${
                              isActive
                                ? 'text-cyan-200'
                                : 'text-white/42 group-hover:text-white/70'
                            }`}
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium tracking-[0.01em]">
                              {item.label}
                            </span>
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[9px] font-semibold ${
                                isActive
                                  ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-50'
                                  : 'border-white/10 bg-white/[0.04] text-white/52 group-hover:border-white/15 group-hover:text-white/72'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

          </aside>

          <div className="flex min-h-screen flex-1 flex-col bg-gradient-to-b from-[#031020] via-[#07101d] to-[#0a1322] md:pl-[220px]">
            <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060d18]/82 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-7">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsDeskMenuOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-white/80 transition hover:bg-white/[0.09] hover:text-white md:hidden"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <Link
                    href="/"
                    aria-label="Back to landing page"
                    className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] font-medium text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </Link>
                  <button
                    type="button"
                    onClick={focusDashboardNotifications}
                    aria-label="Open dashboard notifications"
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    {notificationUnreadCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 min-w-[16px] rounded-full bg-rose-400 px-1.5 py-0.5 text-[9px] font-semibold text-[#220610]">
                        {notificationUnreadCount}
                      </span>
                    )}
                  </button>
                  <div ref={profileMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen((prev) => !prev);
                      }}
                      className="flex items-center gap-2.5 rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-2 text-left transition hover:bg-white/[0.09]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-[18px] bg-gradient-to-br from-sky-400/90 to-cyan-300 text-[0.95rem] font-bold text-[#05111f]">
                        {(user?.full_name ?? 'L')
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? '')
                          .join('')}
                      </div>
                      <div className="hidden min-w-0 sm:block">
                        <p className="truncate text-[13px] font-semibold leading-tight text-white">
                          {user?.full_name ?? 'Library Staff'}
                        </p>
                        <p className="truncate text-[10px] uppercase tracking-[0.22em] text-white/45">
                          {user?.role ?? 'Librarian'}
                        </p>
                      </div>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-white/50 sm:block" />
                    </button>

                    {isProfileMenuOpen && (
                      <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-3xl border border-white/10 bg-[#081221]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-sm font-semibold text-white">
                            {user?.full_name ?? 'Library Staff'}
                          </p>
                          <p className="mt-1 text-xs text-white/55">
                            {user?.email ?? 'No email on file'}
                          </p>
                          <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-sky-200/70">
                            {user?.role ?? 'Librarian'} - {formatUserIdentifier(user)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              openNotificationCenter();
                            }}
                            className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            Notification Center
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                          <a
                            href={adminLinks.dashboard}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            Django Admin
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              logout();
                            }}
                            className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-rose-100 transition hover:bg-rose-400/10"
                          >
                            Sign out
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="min-h-[calc(100vh-89px)] flex-1 px-3 py-5 sm:px-5 lg:px-7 lg:py-6">
              <div className="flex min-h-[calc(100vh-137px)] flex-col rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-4 lg:p-5">
                <div className="min-w-0 flex-1 space-y-6">
                {resolvedActiveSectionId === 'desk-dashboard' && (
                  <div className="space-y-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.74fr)_minmax(300px,0.9fr)]">
                    <section
                      ref={deskNotificationsPanelRef}
                      className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-5"
                    >
                      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,24,40,0.96),rgba(18,31,48,0.86))] px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-200/70">
                          Operations Overview
                          </p>
                          <div className="mt-2 flex flex-nowrap items-center gap-2 overflow-hidden">
                            <h2 className="min-w-0 truncate font-serif text-[1.85rem] font-semibold leading-none text-white md:text-[2rem]">
                              Welcome back, {(user?.full_name ?? 'Librarian').split(' ')[0]}
                            </h2>
                            <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                              Desk shift
                            </span>
                          </div>
                          <p className="mt-2 max-w-2xl text-sm text-white/65">
                            Monitor circulation, clear pending work, and keep the library desk moving.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                        <article className="flex min-h-[162px] flex-col rounded-[20px] border border-sky-300/15 bg-gradient-to-br from-sky-400/16 via-sky-300/10 to-transparent p-3">
                          <div className="flex items-center justify-between gap-2.5">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[13px] bg-sky-400/15 text-sky-100">
                              <LayoutDashboard className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/45">
                              Queue
                            </span>
                          </div>
                          <p className="mt-2.5 text-[1.55rem] font-semibold leading-none text-white">
                            {pendingQueueCount}
                          </p>
                          <p className="mt-2 flex-1 text-[13px] leading-5 text-white/65">
                            Requests waiting for borrow, renewal, and return review.
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
                            <span>{borrowRequests.length} borrow</span>
                            <span>{renewalRequests.length} renewal</span>
                            <span>{returnRequests.length} return</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSectionId('desk-borrows')}
                            className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100 transition hover:bg-sky-400/15"
                          >
                            View all requests
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </article>

                        <article className="flex min-h-[162px] flex-col rounded-[20px] border border-amber-300/15 bg-gradient-to-br from-amber-300/16 via-amber-200/10 to-transparent p-3">
                          <div className="flex items-center justify-between gap-2.5">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[13px] bg-amber-300/15 text-amber-100">
                              <Archive className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/45">
                              Borrowed
                            </span>
                          </div>
                          <p className="mt-2.5 text-[1.55rem] font-semibold leading-none text-white">
                            {activeBorrowedRequests.length}
                          </p>
                          <p className="mt-2 flex-1 text-[13px] leading-5 text-white/65">
                            Books currently checked out and circulating with readers.
                          </p>
                          <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
                            Renewal queue: {renewalRequests.length}
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSectionId('desk-borrowed')}
                            className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-300/15"
                          >
                            Open borrowed
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </article>

                        <article className={`flex min-h-[162px] flex-col rounded-[20px] border p-3 ${
                          overdueRequests.length > 0
                            ? 'border-orange-400/30 bg-gradient-to-br from-orange-500/22 via-rose-500/14 to-transparent ring-1 ring-orange-400/15'
                            : 'border-rose-300/15 bg-gradient-to-br from-rose-300/16 via-rose-200/10 to-transparent'
                        }`}>
                          <div className="flex items-center justify-between gap-2.5">
                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[13px] ${
                              overdueRequests.length > 0 ? 'bg-orange-400/20 text-orange-100' : 'bg-rose-300/15 text-rose-100'
                            }`}>
                              <Clock3 className="h-3.5 w-3.5" />
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                              overdueRequests.length > 0 ? 'bg-orange-400/15 text-orange-100' : 'bg-white/8 text-white/55'
                            }`}>
                              {overdueRequests.length > 0 ? 'Priority' : 'Stable'}
                            </span>
                          </div>
                          <p className={`mt-2.5 text-[1.55rem] font-semibold leading-none ${
                            overdueRequests.length > 0 ? 'text-orange-200' : 'text-white'
                          }`}>
                            {overdueRequests.length}
                          </p>
                          <p className="mt-2 flex-1 text-[13px] leading-5 text-white/65">
                            Estimated fee exposure sits at {formatCurrency(totalOverdueFees)}.
                          </p>
                          <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                            Inventory recovery {overdueRequests.length > 0 ? 'needed now' : 'on track'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSectionId('desk-overdue')}
                            className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                              overdueRequests.length > 0
                                ? 'border-orange-300/20 bg-orange-400/10 text-orange-100 hover:bg-orange-400/15'
                                : 'border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15'
                            }`}
                          >
                            Manage overdue
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </article>

                        <article className="flex min-h-[162px] flex-col rounded-[20px] border border-indigo-300/15 bg-gradient-to-br from-indigo-300/16 via-indigo-200/10 to-transparent p-3">
                          <div className="flex items-center justify-between gap-2.5">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[13px] bg-indigo-300/15 text-indigo-100">
                              <ReceiptText className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/45">
                              Finance
                            </span>
                          </div>
                          <p className="mt-2.5 text-[1.55rem] font-semibold leading-none text-white">
                            {finePayments.length}
                          </p>
                          <p className="mt-2 flex-1 text-[13px] leading-5 text-white/65">
                            Fine settlements waiting to be reviewed or recorded.
                          </p>
                          <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                            Pending total: {formatCurrency(pendingFineTotal)}
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSectionId('desk-fines')}
                            className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-indigo-300/20 bg-indigo-300/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-100 transition hover:bg-indigo-300/15"
                          >
                            Open finance
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </article>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[#081423]/94">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Recent Transactions</p>
                            <h3 className="mt-1 text-base font-semibold text-white">Last 5 circulation events</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                              Latest: {latestDeskActivityLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveSectionId('desk-borrowed')}
                              className="inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-400/15"
                            >
                              View all
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[600px] text-sm">
                            <thead>
                              <tr className="border-b border-white/8">
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">Book Title</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">Student</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">Date</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {analyticsState === 'loading' && (
                                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-white/45">Loading activity feed...</td></tr>
                              )}
                              {analyticsState !== 'loading' && recentDeskTransactions.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-white/45">No circulation activity yet. Approve a request to populate the feed.</td></tr>
                              )}
                              {analyticsState !== 'loading' && recentDeskTransactions.map((req) => (
                                  <tr key={req.id} className="hover:bg-white/[0.03] transition-colors">
                                    <td className="px-4 py-3.5">
                                      <p className="max-w-[210px] truncate font-medium text-white">{req.book.title}</p>
                                      <p className="truncate text-xs text-white/45">{req.book.author}</p>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <p className="max-w-[150px] truncate text-white/80">{req.user?.full_name ?? 'No borrower'}</p>
                                      <p className="text-xs text-white/40">{formatUserIdentifier(req.user)}</p>
                                    </td>
                                    <td className="px-4 py-3.5 text-white/60">{formatDate(req.requested_at)}</td>
                                    <td className="px-4 py-3.5">
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                        req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30' :
                                        req.status === 'RETURNED' ? 'bg-white/10 text-white/70 border border-white/20' :
                                        req.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-100 border border-rose-300/30' :
                                        'bg-sky-500/20 text-sky-100 border border-sky-300/30'
                                      }`}>
                                        {req.status === 'APPROVED' ? 'Borrowed' : req.status === 'PENDING' ? 'Pending' : req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </section>

                    <aside className="space-y-4">
                      <section className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-sky-400/12 text-sky-100">
                              <BarChart3 className="h-4.5 w-4.5" />
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                              Collection Activity
                              </p>
                              <h3 className="mt-1 text-lg font-semibold text-white">
                                High-traffic books
                              </h3>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                            Top 4
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {mostBorrowedBooks.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                              Borrow analytics will appear here after approved circulation activity.
                            </p>
                          ) : (
                            mostBorrowedBooks.slice(0, 4).map((book, index) => (
                              <div
                                key={book.id}
                                className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#0b1729]/88 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {index + 1}. {book.title}
                                  </p>
                                  <p className="truncate text-xs text-white/55">
                                    {book.author}
                                  </p>
                                </div>
                                <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-100">
                                  {book.count} loans
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/8 text-white">
                              <Users className="h-4.5 w-4.5" />
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                              Reader Activity
                              </p>
                              <h3 className="mt-1 text-lg font-semibold text-white">
                                Most active borrowers
                              </h3>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                            Top 4
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {mostActiveStudents.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                              Borrow activity will populate after circulation starts.
                            </p>
                          ) : (
                            mostActiveStudents.slice(0, 4).map((student) => (
                              <div
                                key={student.id}
                                className="rounded-[20px] border border-white/10 bg-[#0b1729]/88 px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {student.fullName}
                                    </p>
                                    <p className="truncate text-xs text-white/55">
                                      {student.studentId}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    {student.overdue > 0 && (
                                      <span className="rounded-full bg-orange-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                                        {student.overdue} overdue
                                      </span>
                                    )}
                                    <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75">
                                      {student.requests} loans
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                    </aside>
                    </div>

                    <section className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-sky-400/12 text-sky-100">
                            <BellRing className="h-4.5 w-4.5" />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                              Desk Notifications
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-white">
                              Recent alerts
                            </h3>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                            {notificationUnreadCount} unread
                          </span>
                          <button
                            type="button"
                            onClick={openNotificationCenter}
                            className="inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-400/15"
                          >
                            View all
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void loadNotifications()}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${
                              notificationsState === 'loading' ? 'animate-spin' : ''
                            }`}
                          />
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMarkAllNotificationsRead()}
                          disabled={notificationActionBusy || notificationUnreadCount === 0}
                          className="inline-flex items-center gap-2 rounded-xl border border-sky-300/15 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-50 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {notificationActionBusy ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Clearing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark all read
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                        {notificationsState === 'loading' && (
                          <div className="rounded-[20px] border border-white/10 bg-[#0b1729]/88 px-4 py-6 text-sm text-white/60 lg:col-span-2 xl:col-span-3">
                            Loading notifications...
                          </div>
                        )}

                        {notificationsError && notificationsState !== 'loading' && (
                          <div className="rounded-[20px] border border-rose-300/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100 lg:col-span-2 xl:col-span-3">
                            {notificationsError}
                          </div>
                        )}

                        {notificationsState !== 'loading' &&
                          !notificationsError &&
                          recentNotifications.length === 0 && (
                            <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.04] px-4 py-6 text-sm text-white/60 lg:col-span-2 xl:col-span-3">
                              No notifications found for this account.
                            </div>
                          )}

                        {notificationsState !== 'loading' &&
                          !notificationsError &&
                          recentNotifications.map((notification) => (
                            <button
                              type="button"
                              key={notification.id}
                              onClick={openNotificationCenter}
                              className="block rounded-[20px] border border-white/10 bg-[#0b1729]/88 px-4 py-4 text-left transition hover:border-sky-300/20 hover:bg-sky-400/10"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {notification.title}
                                    </p>
                                    {!notification.is_read && (
                                      <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                                        New
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-white/60">
                                    {notification.message}
                                  </p>
                                </div>
                                <p className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/35">
                                  {formatDate(notification.created_at)}
                                </p>
                              </div>
                            </button>
                          ))}
                      </div>
                    </section>
                  </div>
                )}

                {canManageBooks && resolvedActiveSectionId === 'desk-books' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                          Library Management
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Catalog and Books
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          Update metadata, adjust availability, and add new titles without leaving the desk.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={loadCatalogBooks}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddBookOpen((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/15"
                        >
                          <Plus className="h-4 w-4" />
                          {isAddBookOpen ? 'Hide add form' : 'Add new book'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Catalog Titles</p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {catalogBooks.length}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Total Copies</p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {totalCatalogCopies}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Available Now</p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {totalAvailableCopies}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {canManageBooks && resolvedActiveSectionId === 'desk-book-copies' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                          Monitoring
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Book Copy Utilization
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          See which titles are fully checked out, lightly used, or ready for more copies.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={loadCatalogBooks}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh copies
                      </button>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-4">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Tracked Titles</p>
                        <p className="mt-3 text-3xl font-semibold text-white">{catalogBooks.length}</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Total Copies</p>
                        <p className="mt-3 text-3xl font-semibold text-white">{totalCatalogCopies}</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Checked Out</p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {Math.max(0, totalCatalogCopies - totalAvailableCopies)}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Available</p>
                        <p className="mt-3 text-3xl font-semibold text-white">{totalAvailableCopies}</p>
                      </div>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0b1729]/88">
                      <div className="overflow-x-auto">
                        <div className="min-w-[560px]">
                          <div className="grid grid-cols-[minmax(0,1.5fr)_110px_110px_120px] gap-4 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Title</span>
                            <span>Total</span>
                            <span>In Use</span>
                            <span>Load</span>
                          </div>
                          <div className="divide-y divide-white/8">
                            {inventoryState === 'loading' && (
                              <div className="px-4 py-10 text-center text-sm text-white/55">
                                Loading copy utilization...
                              </div>
                            )}
                            {inventoryState !== 'loading' && copyUtilizationRows.length === 0 && (
                              <div className="px-4 py-10 text-center text-sm text-white/55">
                                No catalog titles available for copy monitoring yet.
                              </div>
                            )}
                            {inventoryState !== 'loading' &&
                              copyUtilizationRows.slice(0, 12).map((book) => (
                                <div
                                  key={book.id}
                                  className="grid grid-cols-[minmax(0,1.5fr)_110px_110px_120px] gap-4 px-4 py-4"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-white">{book.title}</p>
                                    <p className="truncate text-xs text-white/55">{book.author}</p>
                                  </div>
                                  <p className="text-sm text-white/75">{book.totalCopies}</p>
                                  <p className="text-sm text-white/75">{book.inUse}</p>
                                  <div className="space-y-2">
                                    <div className="h-2 rounded-full bg-white/8">
                                      <div
                                        className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
                                        style={{ width: `${Math.min(book.utilization, 100)}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-white/55">{book.utilization}% in use</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {canManageBooks && resolvedActiveSectionId === 'desk-categories' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                          Library Management
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Categories
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          Keep subject labels clean so students can filter and discover titles faster.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/65">
                        {categories.length} categories configured
                      </div>
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)]">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                          Add Category
                        </p>
                        <div className="mt-4 space-y-3">
                          <input
                            value={newCategoryName}
                            onChange={(event) => {
                              setNewCategoryName(event.target.value);
                              if (categoryError) setCategoryError(null);
                              if (categorySuccess) setCategorySuccess(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleCreateCategory();
                              }
                            }}
                            className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-sky-300/30 focus:bg-white/[0.07]"
                            placeholder="e.g. Philippine History"
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={categoryBusy || !newCategoryName.trim()}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {categoryBusy ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                Create category
                              </>
                            )}
                          </button>
                          {categoryError && (
                            <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                              {categoryError}
                            </p>
                          )}
                          {categorySuccess && (
                            <p className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                              {categorySuccess}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                            Active Categories
                          </p>
                          <span className="text-sm text-white/55">
                            Top borrowed tags appear first
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {categories.length === 0 ? (
                            <p className="text-sm text-white/55">
                              No categories created yet.
                            </p>
                          ) : (
                            [...categories]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((category) => (
                                <span
                                  key={category.id}
                                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/80"
                                >
                                  {category.name}
                                </span>
                              ))
                          )}
                        </div>
                        <div className="mt-6">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                            Borrow Trends
                          </p>
                          <div className="mt-3 space-y-3">
                            {categoryPopularity.length === 0 ? (
                              <p className="text-sm text-white/55">
                                Category borrowing trends will appear after circulation history builds up.
                              </p>
                            ) : (
                              categoryPopularity.map((category) => (
                                <div
                                  key={category.id}
                                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                                >
                                  <p className="font-medium text-white">{category.name}</p>
                                  <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-100">
                                    {category.count} borrows
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {resolvedActiveSectionId === 'desk-borrowed' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                          Monitoring
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Borrowed Books
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          Current loans, borrower details, and upcoming due dates in one place.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={loadBorrowAnalytics}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh monitoring
                      </button>
                    </div>

                    <div className="mt-6 space-y-4">
                      {analyticsState === 'loading' && (
                        <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 px-4 py-8 text-center text-sm text-white/55">
                          Loading borrowed book activity...
                        </div>
                      )}
                      {analyticsState !== 'loading' && activeBorrowedRequests.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-[#0b1729]/88 px-4 py-8 text-center text-sm text-white/55">
                          No active borrowed books right now.
                        </div>
                      )}
                      {analyticsState !== 'loading' &&
                        activeBorrowedRequests.map((request) => (
                          <article
                            key={request.id}
                            className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <BookCoverPreview book={request.book} />
                                <div>
                                  <h3 className="text-lg font-semibold text-white">
                                    {request.book.title}
                                  </h3>
                                  <p className="mt-1 text-sm text-white/55">
                                    {request.book.author}
                                  </p>
                                </div>
                              </div>
                              <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">
                                Approved
                              </span>
                            </div>
                            <div className="mt-5 grid gap-4 md:grid-cols-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Borrower
                                </p>
                                <div className="mt-2 flex items-center gap-3">
                                  <BorrowerAvatar user={request.user} />
                                  <p className="text-sm text-white">
                                    {request.user?.full_name ?? 'Unknown'}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  ID
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {formatUserIdentifier(request.user)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Due Date
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {formatDate(request.due_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Receipt
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {request.receipt_number ?? 'Pending receipt'}
                                </p>
                              </div>
                            </div>
                          </article>
                        ))}
                    </div>

                    <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          History
                        </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            Borrow History
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            Latest approved and returned borrowing records.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                            {borrowHistory.length} records
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setHideCurrentMonthHistory((prev) => !prev)
                            }
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20 transition-all"
                          >
                            {hideCurrentMonthHistory
                              ? `Show ${currentMonthLabel}`
                              : `Hide ${currentMonthLabel}`}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {analyticsState === 'loading' && (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                            Loading history...
                          </div>
                        )}
                        {analyticsState !== 'loading' && borrowHistory.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                            No borrow history available yet.
                          </div>
                        )}
                        {analyticsState !== 'loading' &&
                          borrowHistory.map((request) => (
                            <div
                              key={request.id}
                              className="rounded-2xl border border-white/10 bg-[#0f1b2f]/70 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <BookCoverPreview
                                    book={request.book}
                                    sizeClass="h-20 w-14"
                                    roundedClass="rounded-xl"
                                  />
                                  <div>
                                  <p className="text-sm font-semibold text-white">
                                    {request.book.title}
                                  </p>
                                  <p className="mt-1 text-xs text-white/55">
                                    {request.book.author}
                                  </p>
                                  <div className="mt-3 flex items-center gap-2">
                                    <BorrowerAvatar
                                      user={request.user}
                                      sizeClass="h-8 w-8"
                                    />
                                    <div>
                                      <p className="text-xs font-medium text-white">
                                        {request.user?.full_name ?? 'Unknown'}
                                      </p>
                                      <p className="text-[11px] text-white/45">
                                        {formatUserIdentifier(request.user)}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="hidden text-xs text-white/55">
                                    {request.user?.full_name ?? 'Unknown'} ·{' '}
                                    {formatUserIdentifier(request.user)}
                                  </p>
                                  </div>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                                    statusPill[request.status]
                                  }`}
                                >
                                  {request.status}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 text-xs text-white/60 sm:grid-cols-3">
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Requested
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {formatDate(request.requested_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Due Date
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {formatDate(request.due_date)}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Returned
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {request.status === 'RETURNED'
                                      ? formatDate(request.returned_at ?? request.processed_at)
                                      : '—'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="mt-3 text-xs text-white/45">
                        {hideCurrentMonthHistory
                          ? `Current month hidden (${currentMonthLabel}). Showing the 10 most recent older records.`
                          : 'Showing the 10 most recent borrow records.'}
                      </p>
                    </div>
                  </section>
                )}

                {resolvedActiveSectionId === 'desk-overdue' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200/70">
                          Monitoring
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Overdue Books
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          Prioritize follow-up, confirm returns, and estimate outstanding penalties.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
                        {formatCurrency(totalOverdueFees)} estimated fines
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {analyticsState === 'loading' && (
                        <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 px-4 py-8 text-center text-sm text-white/55">
                          Loading overdue records...
                        </div>
                      )}
                      {analyticsState !== 'loading' && overdueRequests.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-[#0b1729]/88 px-4 py-8 text-center text-sm text-white/55">
                          No overdue books at the moment.
                        </div>
                      )}
                      {analyticsState !== 'loading' &&
                        overdueRequests.map((request) => (
                          <article
                            key={request.id}
                            className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <BookCoverPreview book={request.book} />
                                <div>
                                  <h3 className="text-lg font-semibold text-white">
                                    {request.book.title}
                                  </h3>
                                  <p className="mt-1 text-sm text-white/55">
                                    {request.book.author}
                                  </p>
                                  <div className="mt-3 flex items-center gap-3">
                                    <BorrowerAvatar user={request.user} />
                                    <p className="text-sm text-white">
                                      {request.user?.full_name ?? 'Unknown borrower'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-100">
                                  {(request.overdue_days ?? 0)} days overdue
                                </span>
                                <p className="mt-3 text-lg font-semibold text-white">
                                  {formatCurrency(
                                    Number.parseFloat(request.late_fee_amount ?? '0')
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="mt-5 grid gap-4 md:grid-cols-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Due Date
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {formatDate(request.due_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Borrower ID
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {formatUserIdentifier(request.user)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Receipt
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {request.receipt_number ?? 'Pending receipt'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  Action
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActiveSectionId('desk-fines')}
                                  className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
                                >
                                  Review fine
                                  <ArrowUpRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                    </div>

                    <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            History
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            Overdue History
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                          Records with late fees applied (active and resolved).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                          {overdueHistory.length} records
                        </span>
                        <button
                          type="button"
                          onClick={() => setHideCurrentMonthHistory((prev) => !prev)}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20 transition-all"
                        >
                          {hideCurrentMonthHistory
                            ? `Show ${currentMonthLabel}`
                            : `Hide ${currentMonthLabel}`}
                        </button>
                      </div>
                    </div>
                      <div className="mt-4 space-y-3">
                        {analyticsState === 'loading' && (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                            Loading overdue history...
                          </div>
                        )}
                        {analyticsState !== 'loading' && overdueHistory.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                            No overdue history available yet.
                          </div>
                        )}
                        {analyticsState !== 'loading' &&
                          overdueHistory.map((request) => (
                            <div
                              key={request.id}
                              className="rounded-2xl border border-white/10 bg-[#0f1b2f]/70 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <BookCoverPreview
                                    book={request.book}
                                    sizeClass="h-20 w-14"
                                    roundedClass="rounded-xl"
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      {request.book.title}
                                    </p>
                                    <p className="mt-1 text-xs text-white/55">
                                      {request.book.author}
                                    </p>
                                    <div className="mt-3 flex items-center gap-2">
                                    <BorrowerAvatar
                                      user={request.user}
                                      sizeClass="h-8 w-8"
                                    />
                                    <div>
                                      <p className="text-xs font-medium text-white">
                                        {request.user?.full_name ?? 'Unknown'}
                                      </p>
                                      <p className="text-[11px] text-white/45">
                                        {formatUserIdentifier(request.user)}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="hidden text-xs text-white/55">
                                    {request.user?.full_name ?? 'Unknown'} ·{' '}
                                    {formatUserIdentifier(request.user)}
                                  </p>
                                </div>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                                    statusPill[request.status]
                                  }`}
                                >
                                  {request.status}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 text-xs text-white/60 sm:grid-cols-4">
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Due Date
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {formatDate(request.due_date)}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Returned
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {request.status === 'RETURNED'
                                      ? formatDate(request.returned_at ?? request.processed_at)
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Late Fee
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {formatCurrency(
                                      Number.parseFloat(request.late_fee_amount ?? '0')
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Receipt
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {request.receipt_number ?? '—'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="mt-3 text-xs text-white/45">
                        {hideCurrentMonthHistory
                          ? `Current month hidden (${currentMonthLabel}). Showing the 10 most recent older records.`
                          : 'Showing the 10 most recent overdue records.'}
                      </p>
                    </div>
                  </section>
                )}

                {resolvedActiveSectionId === 'desk-contact' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                          Communication
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Contact Messages
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          Contact messages are currently managed from Django admin. Use the quick links below to open the inbox and related notification records.
                        </p>
                      </div>
                      <a
                        href={adminLinks.contactMessages}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/15"
                      >
                        Open contact inbox
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <a
                        href={adminLinks.contactMessages}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5 transition hover:border-sky-300/20 hover:bg-sky-400/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <MessageSquare className="h-5 w-5 text-sky-100" />
                          <ArrowUpRight className="h-4 w-4 text-white/55" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">Contact Messages</h3>
                        <p className="mt-2 text-sm text-white/60">
                          Open the admin inbox to review website messages, subjects, and sender details.
                        </p>
                      </a>

                      <a
                        href={adminLinks.notifications}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5 transition hover:border-sky-300/20 hover:bg-sky-400/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <BellRing className="h-5 w-5 text-sky-100" />
                          <ArrowUpRight className="h-4 w-4 text-white/55" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">Notification Records</h3>
                        <p className="mt-2 text-sm text-white/60">
                          Open stored system notifications in Django admin for deeper record review.
                        </p>
                      </a>
                    </div>
                  </section>
                )}

                {resolvedActiveSectionId === 'desk-notifications' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                          Communication
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          Notifications
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/65">
                          Review your librarian alerts and clear unread notifications when they have been handled.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void loadNotifications()}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMarkAllNotificationsRead()}
                          disabled={notificationActionBusy || notificationUnreadCount === 0}
                          className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {notificationActionBusy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Clearing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Mark all read
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Unread</p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {notificationUnreadCount}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Loaded</p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {notifications.length}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-4">
                        <p className="text-sm text-white/55">Admin Records</p>
                        <a
                          href={adminLinks.notifications}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-100"
                        >
                          Open full notification admin
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {notificationsState === 'loading' && (
                        <div className="rounded-3xl border border-white/10 bg-[#0b1729]/88 px-4 py-8 text-center text-sm text-white/55">
                          Loading notifications...
                        </div>
                      )}
                      {notificationsError && notificationsState !== 'loading' && (
                        <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
                          {notificationsError}
                        </div>
                      )}
                      {notificationsState !== 'loading' &&
                        !notificationsError &&
                        notifications.length === 0 && (
                          <div className="rounded-3xl border border-dashed border-white/10 bg-[#0b1729]/88 px-4 py-8 text-center text-sm text-white/55">
                            No notifications found for this account.
                          </div>
                        )}
                      {notificationsState !== 'loading' &&
                        notifications.map((notification) => (
                          <article
                            key={notification.id}
                            className="rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <h3 className="truncate text-lg font-semibold text-white">
                                    {notification.title}
                                  </h3>
                                  {!notification.is_read && (
                                    <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                                      Unread
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 text-sm text-white/60">
                                  {notification.message}
                                </p>
                              </div>
                              <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                                {formatDate(notification.created_at)}
                              </p>
                            </div>
                          </article>
                        ))}
                    </div>
                  </section>
                )}

            {/* Top row: Approvals + Stats */}
            {(resolvedActiveSectionId === 'desk-status' ||
              resolvedActiveSectionId === 'desk-accounts') && (
            <div className="grid gap-6 xl:grid-cols-12">
              {/* Quick Stats */}
              {resolvedActiveSectionId === 'desk-status' && (
              <div
                id="desk-status"
                className="xl:col-span-12 scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
              >
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-semibold text-white">Book Status</h2>
                  <p className="mt-1 text-sm text-white/70">Current request workload</p>
                </div>
                <div className={`grid gap-4 ${canApproveStudents ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {canApproveStudents && (
                    <div className="group relative overflow-hidden rounded-2xl border border-amber-200/30 bg-gradient-to-br from-[#f9b76e] via-[#f39c58] to-[#ed8752] p-5 shadow-lg shadow-amber-500/25 transition-all duration-200 hover:-translate-y-0.5">
                      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/20 blur-xl" />
                      <div className="relative flex items-center justify-between gap-4">
                        <div>
                          <p className="text-3xl md:text-4xl font-bold leading-none text-white">{pendingStudents.length}</p>
                          <p className="mt-4 text-sm font-medium text-white/90">Pending Accounts</p>
                        </div>
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[#ef8a4e] ring-1 ring-white/60">
                          <UserPlus className="h-6 w-6" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="group relative overflow-hidden rounded-2xl border border-indigo-200/30 bg-gradient-to-br from-[#7567dd] via-[#6a72e1] to-[#5f89e8] p-5 shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5">
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/20 blur-xl" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div>
                        <p className="text-3xl md:text-4xl font-bold leading-none text-white">{borrowRequests.length}</p>
                        <p className="mt-4 text-sm font-medium text-white/90">Borrow Requests</p>
                      </div>
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[#6678e6] ring-1 ring-white/60">
                        <BookDown className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                  <div className="group relative overflow-hidden rounded-2xl border border-cyan-200/30 bg-gradient-to-br from-[#2bbad3] via-[#26afd2] to-[#35c7e4] p-5 shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:-translate-y-0.5">
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/20 blur-xl" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div>
                        <p className="text-3xl md:text-4xl font-bold leading-none text-white">{returnRequests.length}</p>
                        <p className="mt-4 text-sm font-medium text-white/90">Return Requests</p>
                      </div>
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[#27b8d8] ring-1 ring-white/60">
                        <BookUp className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                  <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/30 bg-gradient-to-br from-[#2b8f72] via-[#237d65] to-[#2ea783] p-5 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5">
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/20 blur-xl" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div>
                        <p className="text-3xl md:text-4xl font-bold leading-none text-white">{renewalRequests.length}</p>
                        <p className="mt-4 text-sm font-medium text-white/90">Renewal Requests</p>
                      </div>
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[#237d65] ring-1 ring-white/60">
                        <RefreshCw className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Pending Accounts */}
              {canApproveStudents && resolvedActiveSectionId === 'desk-accounts' && (
                <div
                  id="desk-accounts"
                  className="xl:col-span-12 scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
                >
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-sky-500/20 p-3">
                        <UserPlus className="h-6 w-6 text-sky-200" />
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-semibold text-white">Pending Accounts</h2>
                        <p className="text-white/70">
                          {pendingStudents.length} accounts waiting
                        </p>
                      </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageEnrollmentRecords && (
                          <Link
                            href="/librarian/enrollment"
                            className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/15"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Upload Enrollment CSV
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsPendingAccountsOpen((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                      >
                        {isPendingAccountsOpen ? 'Hide List' : 'Show List'}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isPendingAccountsOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={loadPendingStudents}
                        className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                      >
                        <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
                        Refresh
                      </button>
                    </div>
                  </div>

                  {isPendingAccountsOpen && (
                    <>
                      {studentsState === 'loading' && (
                        <div className="flex items-center justify-center gap-3 py-12 text-white/60">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          Loading students...
                        </div>
                      )}

                      {studentsError && (
                        <div className="rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 flex-shrink-0" />
                          {studentsError}
                        </div>
                      )}

                      {studentsState !== 'loading' && pendingStudents.length === 0 && !studentsError && (
                        <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-10 text-center text-white/60">
                          No pending accounts at the moment.
                        </div>
                      )}

                      <div className="mt-6 space-y-4">
                        {pendingStudents.map((student) => (
                          <div
                            key={student.id}
                            className="group flex flex-col gap-5 rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5 shadow-lg shadow-black/20 hover:border-sky-300/40 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-start gap-4">
                              <User className="h-6 w-6 text-sky-200 mt-1" />
                              <div>
                                <p className="font-semibold text-white">{student.full_name}</p>
                                <div className="mt-1 space-y-0.5 text-sm text-white/70">
                                  <div className="flex items-center gap-1.5">
                                    <GraduationCap className="h-4 w-4" />
                                    {student.role === 'TEACHER' ? 'Faculty ID' : 'Student ID'}:{' '}
                                    {student.staff_id ?? student.student_id ?? '-'}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-4 w-4" />
                                    Role: {student.role === 'TEACHER' ? 'Teacher' : 'Student'}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="h-4 w-4" />
                                    {student.email ?? 'No email provided'}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4" />
                                    Joined: {formatDate(student.date_joined)}
                                  </div>
                                </div>
                                {student.role === 'STUDENT' && (
                                  <label className="mt-4 inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-white/30 bg-transparent text-amber-400 focus:ring-amber-300"
                                      disabled={studentActionBusy === student.id}
                                      checked={Boolean(workingStudentApprovals[student.id])}
                                      onChange={(event) =>
                                        setWorkingStudentApprovals((prev) => ({
                                          ...prev,
                                          [student.id]: event.target.checked,
                                        }))
                                      }
                                    />
                                    Approve as working student
                                  </label>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                              <button
                                disabled={studentActionBusy === student.id}
                                onClick={() => handleApproveStudent(student.id)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-[#1a1b1f] shadow-sm hover:bg-amber-400 disabled:opacity-60 transition-all active:scale-95 sm:min-w-[140px]"
                              >
                                {studentActionBusy === student.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Approve
                                  </>
                                )}
                              </button>
                              <button
                                disabled={studentActionBusy === student.id}
                                onClick={() => handleRejectStudent(student.id)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/40 px-6 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60 transition-all active:scale-95 sm:min-w-[140px]"
                              >
                                {studentActionBusy === student.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            )}

            {resolvedActiveSectionId === 'desk-analytics' && (
            <div
              id="desk-analytics"
              className="scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-sky-500/20 p-3 ring-1 ring-sky-300/30">
                    <BarChart3 className="h-6 w-6 text-sky-200" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                      Librarian Analytics Dashboard
                    </p>
                    <h2 className="mt-2 text-xl md:text-2xl font-semibold text-white">
                      Performance Overview
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPerformanceOverviewOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                  >
                    {isPerformanceOverviewOpen ? 'Hide Overview' : 'Show Overview'}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isPerformanceOverviewOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      void Promise.all([
                        loadBorrowRequests(),
                        loadReturnRequests(),
                        loadBorrowAnalytics(),
                      ]);
                    }}
                    className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                  >
                    <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
                    Refresh
                  </button>
                </div>
              </div>

              {isPerformanceOverviewOpen && (
                <>
                  {analyticsState === 'loading' && (
                    <div className="mt-6 flex items-center justify-center gap-3 py-6 text-white/60">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading analytics...
                    </div>
                  )}

                  {analyticsError && (
                    <div className="mt-6 rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      {analyticsError}
                    </div>
                  )}

                  {!analyticsError && (
                    <>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-4">
                      <p className="text-xs uppercase tracking-widest text-white/60">Most Borrowed</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {mostBorrowedBooks[0]?.count ?? 0}
                      </p>
                      <p className="mt-1 text-sm text-white/70 line-clamp-1">
                        {mostBorrowedBooks[0]?.title ?? 'No borrow activity yet'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-4">
                      <p className="text-xs uppercase tracking-widest text-white/60">Active Students</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {mostActiveStudents.length}
                      </p>
                      <p className="mt-1 text-sm text-white/70">Students with borrowing activity</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-4">
                      <p className="text-xs uppercase tracking-widest text-white/60">Overdue Reports</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{overdueRequests.length}</p>
                      <p className="mt-1 text-sm text-white/70">Currently overdue borrows</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-4">
                      <p className="text-xs uppercase tracking-widest text-white/60">Estimated Fines</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatCurrency(totalOverdueFees)}
                      </p>
                      <p className="mt-1 text-sm text-white/70">Based on active overdue requests</p>
                    </div>
                  </div>

                  <article className="mt-6 rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          KPI Trend
                        </h3>
                        <p className="text-xs text-white/60">
                          Last 6 months for most borrowed, active students, overdue reports, and estimated fines
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-sky-300" />
                          Most Borrowed
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-300" />
                          Active Students
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-300" />
                          Overdue Reports
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-300" />
                          Estimated Fines
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <div className="min-w-[680px]">
                        <svg
                          viewBox={`0 0 ${performanceChart.chartWidth} ${performanceChart.chartHeight}`}
                          className="h-64 w-full"
                          role="img"
                          aria-label="KPI trend chart for most borrowed, active students, overdue reports, and estimated fines"
                        >
                          <defs>
                            <linearGradient id="kpi-most-borrowed-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.38" />
                              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" />
                            </linearGradient>
                          </defs>

                          {performanceChart.countGridValues.map((grid) => (
                            <g key={`grid-${grid.y}`}>
                              <line
                                x1={performanceChart.padding.left}
                                y1={grid.y}
                                x2={performanceChart.chartWidth - performanceChart.padding.right}
                                y2={grid.y}
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth="1"
                              />
                              <text
                                x={8}
                                y={grid.y + 4}
                                fill="rgba(255,255,255,0.55)"
                                fontSize="11"
                              >
                                {grid.value}
                              </text>
                            </g>
                          ))}

                          {performanceChart.finesGridValues.map((grid) => (
                            <text
                              key={`fines-${grid.y}`}
                              x={performanceChart.chartWidth - 6}
                              y={grid.y + 4}
                              textAnchor="end"
                              fill="rgba(255,255,255,0.55)"
                              fontSize="11"
                            >
                              {formatCurrency(grid.value)}
                            </text>
                          ))}

                          {performanceChart.areaPath && (
                            <path d={performanceChart.areaPath} fill="url(#kpi-most-borrowed-fill)" />
                          )}

                          <path
                            d={performanceChart.mostBorrowedPath}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d={performanceChart.activeStudentsPath}
                            fill="none"
                            stroke="#86efac"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d={performanceChart.overdueReportsPath}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="6 5"
                          />
                          <path
                            d={performanceChart.estimatedFinesPath}
                            fill="none"
                            stroke="#fda4af"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="3 4"
                          />

                          {performanceChart.points.map((point) => (
                            <g key={point.key}>
                              <circle cx={point.x} cy={point.yMostBorrowed} r="4" fill="#38bdf8" />
                              <circle cx={point.x} cy={point.yActiveStudents} r="3.6" fill="#86efac" />
                              <circle cx={point.x} cy={point.yOverdueReports} r="3.2" fill="#fbbf24" />
                              <circle cx={point.x} cy={point.yEstimatedFines} r="3" fill="#fda4af" />
                              <text
                                x={point.x}
                                y={performanceChart.chartHeight - 8}
                                textAnchor="middle"
                                fill="rgba(255,255,255,0.7)"
                                fontSize="11"
                              >
                                {point.label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </div>

                    {latestPerformancePoint && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-widest text-white/50">Most Borrowed</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {latestPerformancePoint.mostBorrowed}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-widest text-white/50">Active Students</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {latestPerformancePoint.activeStudents}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-widest text-white/50">Overdue Reports</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {latestPerformancePoint.overdueReports}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-widest text-white/50">Estimated Fines</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {formatCurrency(latestPerformancePoint.estimatedFines)}
                          </p>
                        </div>
                      </div>
                    )}
                  </article>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                      <h3 className="text-base font-semibold text-white">Most Borrowed Books</h3>
                      <div className="mt-3 space-y-2">
                        {mostBorrowedBooks.length === 0 && (
                          <p className="text-sm text-white/60">No approved borrow history yet.</p>
                        )}
                        {mostBorrowedBooks.map((book, index) => (
                          <div
                            key={book.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">
                                {index + 1}. {book.title}
                              </p>
                              <p className="text-xs text-white/60">{book.author}</p>
                            </div>
                            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                              {book.count} borrows
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                      <h3 className="text-base font-semibold text-white">Most Active Students</h3>
                      <div className="mt-3 space-y-2">
                        {mostActiveStudents.length === 0 && (
                          <p className="text-sm text-white/60">No student activity yet.</p>
                        )}
                        {mostActiveStudents.map((student, index) => (
                          <div
                            key={student.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">
                                {index + 1}. {student.fullName}
                              </p>
                              <p className="text-xs text-white/60">ID: {student.studentId}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-sky-200">
                                {student.requests} requests
                              </p>
                              <p className="text-xs text-white/60">{student.overdue} overdue</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                      <h3 className="text-base font-semibold text-white">Overdue Reports</h3>
                      <div className="mt-3 space-y-2">
                        {overdueRequests.length === 0 && (
                          <p className="text-sm text-white/60">No overdue books right now.</p>
                        )}
                        {overdueRequests.slice(0, 5).map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">{request.book.title}</p>
                              <p className="text-xs text-white/60">
                                {request.user?.full_name ?? 'Unknown student'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-amber-200">
                                {request.overdue_days ?? 0} days overdue
                              </p>
                              <p className="text-xs text-white/60">
                                {formatCurrency(
                                  Number.isFinite(Number.parseFloat(request.late_fee_amount ?? '0'))
                                    ? Number.parseFloat(request.late_fee_amount ?? '0')
                                    : 0
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                      <h3 className="text-base font-semibold text-white">Category Popularity</h3>
                      <div className="mt-3 space-y-2">
                        {categoryPopularity.length === 0 && (
                          <p className="text-sm text-white/60">No category trends yet.</p>
                        )}
                        {categoryPopularity.map((category, index) => (
                          <div
                            key={category.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <p className="text-sm font-medium text-white">
                              {index + 1}. {category.name}
                            </p>
                            <span className="rounded-full bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-100">
                              {category.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </>
              )}
                </>
              )}
            </div>
              )}

            {(resolvedActiveSectionId === 'desk-borrows' ||
              resolvedActiveSectionId === 'desk-renewals' ||
              resolvedActiveSectionId === 'desk-returns') && (
            <div className="grid gap-6 xl:grid-cols-3 xl:items-start">
              {/* Borrow Requests */}
              <div
                id="desk-borrows"
                className={`h-full scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08] ${
                  resolvedActiveSectionId === 'desk-borrows' ? '' : 'hidden'
                }`}
              >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-500/20 p-3">
                    <BookDown className="h-6 w-6 text-emerald-200" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-semibold text-white">Borrow Requests</h2>
                    <p className="text-white/70">Pending book borrow approvals</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBorrowRequestsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                  >
                    {isBorrowRequestsOpen ? 'Hide Borrows' : 'Show Borrows'}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isBorrowRequestsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      void Promise.all([loadBorrowRequests(), loadBorrowAnalytics()]);
                    }}
                    className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                  >
                    <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
                    Refresh
                  </button>
                </div>
              </div>

              {isBorrowRequestsOpen && (
                <>
              {borrowsState === 'loading' && (
                <div className="flex items-center justify-center gap-3 py-12 text-white/60">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Loading borrow requests...
                </div>
              )}

              {borrowsError && (
                <div className="rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {borrowsError}
                </div>
              )}

              {borrowsState !== 'loading' && borrowRequests.length === 0 && !borrowsError && (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-10 text-center text-white/60">
                  No pending borrow requests right now.
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                {borrowRequests.map((req) => (
                  <div
                    key={req.id}
                    className="group rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-6 shadow-lg shadow-black/20 hover:shadow-xl hover:border-emerald-300/40 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-emerald-500/10 shadow-sm">
                          {getBookCoverUrl(req.book) ? (
                            <Image
                              src={getBookCoverUrl(req.book) as string}
                              alt={req.book.title}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-emerald-200/80">
                              <Book className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white line-clamp-2">{req.book.title}</p>
                          <p className="text-sm text-white/70 mt-0.5">{req.book.author}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPill[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-emerald-500/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getRequestUserAvatarUrl(req.user)}
                            alt={req.user?.full_name ?? 'Student'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {req.user?.full_name ?? 'Unknown student'}
                          </p>
                          <p className="text-xs text-white/60">
                            ID: {formatUserIdentifier(req.user)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-white/70 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-medium">Student:</span>
                        <span>{req.user?.full_name ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">ID:</span>
                        <span>{formatUserIdentifier(req.user)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Requested:</span>
                        <span>{formatDate(req.requested_at)}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        disabled={actionBusy === req.id}
                        onClick={() => handleBorrowDecision(req.id, true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm sm:flex-1"
                      >
                        {actionBusy === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        disabled={actionBusy === req.id}
                        onClick={() => handleBorrowDecision(req.id, false)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/40 px-5 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60 transition-all active:scale-95 sm:flex-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
	                ))}
	              </div>
	                </>
	              )}
	            </div>

            <div
              id="desk-renewals"
              className={`h-full scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08] ${
                resolvedActiveSectionId === 'desk-renewals' ? '' : 'hidden'
              }`}
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-500/20 p-3">
                    <RefreshCw className="h-6 w-6 text-emerald-200" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-semibold text-white">Renewal Requests</h2>
                    <p className="text-white/70">Pending due-date extension approvals</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRenewalRequestsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                  >
                    {isRenewalRequestsOpen ? 'Hide Renewals' : 'Show Renewals'}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isRenewalRequestsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      void Promise.all([loadRenewalRequests(), loadBorrowAnalytics()]);
                    }}
                    className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                  >
                    <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
                    Refresh
                  </button>
                </div>
              </div>

              {isRenewalRequestsOpen && (
                <>
              {renewalsState === 'loading' && (
                <div className="flex items-center justify-center gap-3 py-12 text-white/60">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Loading renewal requests...
                </div>
              )}

              {renewalsError && (
                <div className="rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {renewalsError}
                </div>
              )}

              {renewalsState !== 'loading' && renewalRequests.length === 0 && !renewalsError && (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-10 text-center text-white/60">
                  No pending renewal requests at the moment.
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                {renewalRequests.map((req) => (
                  <div
                    key={req.id}
                    className="group rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-6 shadow-lg shadow-black/20 hover:shadow-xl hover:border-emerald-300/40 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-emerald-500/10 shadow-sm">
                          {getBookCoverUrl(req.book) ? (
                            <Image
                              src={getBookCoverUrl(req.book) as string}
                              alt={req.book.title}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-emerald-200/80">
                              <Book className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white line-clamp-2">{req.book.title}</p>
                          <p className="text-sm text-white/70 mt-0.5">{req.book.author}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${renewalStatusPill[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-emerald-500/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getRequestUserAvatarUrl(req.user)}
                            alt={req.user?.full_name ?? 'Student'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {req.user?.full_name ?? 'Unknown student'}
                          </p>
                          <p className="text-xs text-white/60">
                            ID: {formatUserIdentifier(req.user)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-white/70 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-medium">Student:</span>
                        <span>{req.user?.full_name ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">ID:</span>
                        <span>{formatUserIdentifier(req.user)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Requested:</span>
                        <span>{formatDate(req.requested_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Current due:</span>
                        <span>{formatDate(req.current_due_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Projected due:</span>
                        <span>{formatDate(req.projected_due_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Extension:</span>
                        <span>
                          {req.requested_extension_days} day
                          {req.requested_extension_days === 1 ? '' : 's'}
                        </span>
                      </div>
                      {req.receipt_number && (
                        <div className="flex justify-between">
                          <span className="font-medium">Receipt:</span>
                          <span>{req.receipt_number}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        disabled={renewalActionBusy === req.id}
                        onClick={() => handleRenewalDecision(req.id, true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm sm:flex-1"
                      >
                        {renewalActionBusy === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        disabled={renewalActionBusy === req.id}
                        onClick={() => handleRenewalDecision(req.id, false)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/40 px-5 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60 transition-all active:scale-95 sm:flex-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
                </>
              )}
            </div>

            {/* Return Requests – similar structure */}
            <div
              id="desk-returns"
              className={`h-full scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08] ${
                resolvedActiveSectionId === 'desk-returns' ? '' : 'hidden'
              }`}
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-500/20 p-3">
                    <BookUp className="h-6 w-6 text-amber-200" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-semibold text-white">Return Requests</h2>
                    <p className="text-white/70">Pending book return processing</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReturnRequestsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                  >
                    {isReturnRequestsOpen ? 'Hide Returns' : 'Show Returns'}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isReturnRequestsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      void Promise.all([loadReturnRequests(), loadBorrowAnalytics()]);
                    }}
                    className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                  >
                    <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Loading, error, empty states – same pattern as borrow */}
              {isReturnRequestsOpen && (
                <>
              {returnsState === 'loading' && (
                <div className="flex items-center justify-center gap-3 py-12 text-white/60">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Loading return requests...
                </div>
              )}

              {returnsError && (
                <div className="rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {returnsError}
                </div>
              )}

              {returnsState !== 'loading' && returnRequests.length === 0 && !returnsError && (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-10 text-center text-white/60">
                  No pending return requests at the moment.
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                {returnRequests.map((req) => (
                  <div
                    key={req.id}
                    className="group rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-6 shadow-lg shadow-black/20 hover:shadow-xl hover:border-amber-300/40 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-amber-500/10 shadow-sm">
                          {getBookCoverUrl(req.book) ? (
                            <Image
                              src={getBookCoverUrl(req.book) as string}
                              alt={req.book.title}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-amber-200/80">
                              <Book className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white line-clamp-2">{req.book.title}</p>
                          <p className="text-sm text-white/70 mt-0.5">{req.book.author}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${returnStatusPill[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-amber-500/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getRequestUserAvatarUrl(req.user)}
                            alt={req.user?.full_name ?? 'Student'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {req.user?.full_name ?? 'Unknown student'}
                          </p>
                          <p className="text-xs text-white/60">
                            ID: {formatUserIdentifier(req.user)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-white/70 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-medium">Student:</span>
                        <span>{req.user?.full_name ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">ID:</span>
                        <span>{formatUserIdentifier(req.user)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Requested:</span>
                        <span>{formatDate(req.requested_at)}</span>
                      </div>
                      {req.receipt_number && (
                        <div className="flex justify-between">
                          <span className="font-medium">Receipt:</span>
                          <span>{req.receipt_number}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        disabled={returnActionBusy === req.id}
                        onClick={() => handleReturnDecision(req.id, true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm sm:flex-1"
                      >
                        {returnActionBusy === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        disabled={returnActionBusy === req.id}
                        onClick={() => handleReturnDecision(req.id, false)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/40 px-5 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60 transition-all active:scale-95 sm:flex-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                      History
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      Return History
                    </h3>
                    <p className="mt-1 text-sm text-white/60">
                      Recently completed return transactions.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                      {returnHistory.length} records
                    </span>
                    <button
                      type="button"
                      onClick={() => setHideCurrentMonthHistory((prev) => !prev)}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20 transition-all"
                    >
                      {hideCurrentMonthHistory
                        ? `Show ${currentMonthLabel}`
                        : `Hide ${currentMonthLabel}`}
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {analyticsState === 'loading' && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                      Loading return history...
                    </div>
                  )}
                  {analyticsState !== 'loading' && returnHistory.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                      No return history available yet.
                    </div>
                  )}
                  {analyticsState !== 'loading' &&
                    returnHistory.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-white/10 bg-[#0f1b2f]/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {request.book.title}
                            </p>
                            <p className="text-xs text-white/55">
                              {request.user?.full_name ?? 'Unknown'} ·{' '}
                              {formatUserIdentifier(request.user)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                              statusPill[request.status]
                            }`}
                          >
                            Returned
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 text-xs text-white/60 sm:grid-cols-4">
                          <div>
                            <p className="uppercase tracking-[0.2em] text-white/40">
                              Returned
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {formatDate(request.returned_at ?? request.processed_at)}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.2em] text-white/40">
                              Due Date
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {formatDate(request.due_date)}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.2em] text-white/40">
                              Receipt
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {request.receipt_number ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-[0.2em] text-white/40">
                              Late Fee
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {formatCurrency(
                                Number.parseFloat(request.late_fee_amount ?? '0')
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <p className="mt-3 text-xs text-white/45">
                  {hideCurrentMonthHistory
                    ? `Current month hidden (${currentMonthLabel}). Showing the 10 most recent older records.`
                    : 'Showing the 10 most recent return records.'}
                </p>
              </div>
                </>
              )}
            </div>
            </div>
            )}

            {canManageFinePayments && resolvedActiveSectionId === 'desk-fines' && (
              <div
                id="desk-fines"
                className="scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-rose-500/20 p-3">
                      <AlertCircle className="h-6 w-6 text-rose-200" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-semibold text-white">
                        Fine Payments
                      </h2>
                      <p className="mt-1 text-sm text-white/70">
                        Review overdue balances, record payments, or waive charges.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white/80">
                          {finePayments.length} pending
                        </span>
                        <span className="rounded-full border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-rose-100">
                          {formatCurrency(pendingFineTotal)} outstanding
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFinePaymentsOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                    >
                      {isFinePaymentsOpen ? 'Hide Fines' : 'Show Fines'}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isFinePaymentsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void Promise.all([loadFinePayments(), loadBorrowAnalytics()]);
                      }}
                      className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                    >
                      <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
                      Refresh
                    </button>
                  </div>
                </div>

                {isFinePaymentsOpen && (
                  <>
                    {finePaymentsSuccess && (
                      <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 text-sm text-emerald-100">
                        {finePaymentsSuccess}
                      </div>
                    )}

                    {finePaymentsState === 'loading' && (
                      <div className="mt-6 flex items-center justify-center gap-3 py-12 text-white/60">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        Loading fine payments...
                      </div>
                    )}

                    {finePaymentsError && (
                      <div className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-500/15 p-5 text-rose-100 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        {finePaymentsError}
                      </div>
                    )}

                    {finePaymentsState !== 'loading' &&
                      finePayments.length === 0 &&
                      !finePaymentsError && (
                        <div className="mt-6 rounded-2xl border border-dashed border-white/25 bg-white/5 p-10 text-center text-white/60">
                          No pending fine payments right now.
                        </div>
                      )}

                    <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
                      {finePayments.map((payment) => {
                        const draft = finePaymentDrafts[payment.id] ?? {
                          paymentReference: payment.payment_reference ?? '',
                          notes: payment.notes ?? '',
                        };
                        const amount = Number.parseFloat(payment.amount);

                        return (
                          <div
                            key={payment.id}
                            className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-6 shadow-lg shadow-black/20"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-base font-semibold text-white line-clamp-2">
                                  {payment.book.title}
                                </p>
                                <p className="mt-1 text-sm text-white/70">
                                  {payment.book.author}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100">
                                  {payment.status}
                                </span>
                                <p className="mt-2 text-lg font-semibold text-white">
                                  {formatCurrency(Number.isFinite(amount) ? amount : 0)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                              <div className="flex justify-between gap-3 sm:block">
                                <span className="font-medium text-white/85">Borrower</span>
                                <p>{payment.user?.full_name ?? '-'}</p>
                              </div>
                              <div className="flex justify-between gap-3 sm:block">
                                <span className="font-medium text-white/85">ID</span>
                                <p>{formatUserIdentifier(payment.user)}</p>
                              </div>
                              <div className="flex justify-between gap-3 sm:block">
                                <span className="font-medium text-white/85">Borrow receipt</span>
                                <p>{payment.receipt_number ?? '-'}</p>
                              </div>
                              <div className="flex justify-between gap-3 sm:block">
                                <span className="font-medium text-white/85">Created</span>
                                <p>{formatDate(payment.created_at)}</p>
                              </div>
                            </div>

                            <div className="mt-5 space-y-3">
                              <div>
                                <label
                                  htmlFor={`fine-reference-${payment.id}`}
                                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/55"
                                >
                                  Receipt / Reference no.
                                </label>
                                <input
                                  id={`fine-reference-${payment.id}`}
                                  value={draft.paymentReference}
                                  onChange={(event) =>
                                    updateFinePaymentDraft(
                                      payment.id,
                                      'paymentReference',
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                                  placeholder="Enter OR number, receipt, or transfer reference"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`fine-notes-${payment.id}`}
                                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/55"
                                >
                                  Notes
                                </label>
                                <textarea
                                  id={`fine-notes-${payment.id}`}
                                  rows={3}
                                  value={draft.notes}
                                  onChange={(event) =>
                                    updateFinePaymentDraft(payment.id, 'notes', event.target.value)
                                  }
                                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                                  placeholder="Add payment remarks or waiver reason"
                                />
                              </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                              <button
                                type="button"
                                disabled={fineActionBusyId === payment.id}
                                onClick={() => handleFinePaymentAction(payment.id, 'paid')}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-all active:scale-95"
                              >
                                {fineActionBusyId === payment.id && fineActionType === 'paid' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                disabled={fineActionBusyId === payment.id}
                                onClick={() => handleFinePaymentAction(payment.id, 'waived')}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/40 px-5 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/15 disabled:opacity-60 transition-all active:scale-95"
                              >
                                {fineActionBusyId === payment.id && fineActionType === 'waived' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                                Waive
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-10 rounded-3xl border border-white/10 bg-[#0b1729]/88 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            History
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            Fine Payment History
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            Paid and waived fines for closed borrow records.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                            {fineHistoryMetrics.paidCount} paid
                          </span>
                          <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-amber-100">
                            {fineHistoryMetrics.waivedCount} waived
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white/80">
                            {formatCurrency(fineHistoryMetrics.paidTotal)} collected
                          </span>
                          <button
                            type="button"
                            onClick={() => setHideCurrentMonthHistory((prev) => !prev)}
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20 transition-all"
                          >
                            {hideCurrentMonthHistory
                              ? `Show ${currentMonthLabel}`
                              : `Hide ${currentMonthLabel}`}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {finePaymentsState === 'loading' && (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                            Loading fine history...
                          </div>
                        )}
                        {finePaymentsState !== 'loading' && finePaymentsError && (
                          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                            {finePaymentsError}
                          </div>
                        )}
                        {finePaymentsState !== 'loading' &&
                          !finePaymentsError &&
                          fineHistoryRows.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                            No fine history records available yet.
                          </div>
                        )}
                        {finePaymentsState !== 'loading' &&
                          !finePaymentsError &&
                          fineHistoryRows.map((payment) => (
                            <div
                              key={payment.id}
                              className="rounded-2xl border border-white/10 bg-[#0f1b2f]/70 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {payment.book.title}
                                  </p>
                                  <p className="text-xs text-white/55">
                                    {payment.user?.full_name ?? 'Unknown'} ·{' '}
                                    {formatUserIdentifier(payment.user)}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                                    fineStatusPill[payment.status]
                                  }`}
                                >
                                  {payment.status}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 text-xs text-white/60 sm:grid-cols-4">
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Amount
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {formatCurrency(
                                      Number.parseFloat(payment.amount)
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Processed
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {formatDate(payment.paid_at ?? payment.created_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Receipt
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {payment.receipt_number ?? '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.2em] text-white/40">
                                    Reference
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    {payment.payment_reference || '—'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="mt-3 text-xs text-white/45">
                        {hideCurrentMonthHistory
                          ? `Current month hidden (${currentMonthLabel}). Showing the 10 most recent older records.`
                          : 'Showing the 10 most recent fine history records.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {canManageBooks && resolvedActiveSectionId === 'desk-books' && (
              <div
                id="desk-inventory"
                className="scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                      Book Inventory
                    </p>
                    <h2 className="mt-2 text-xl md:text-2xl font-semibold text-white">
                      Inventory Manager
                    </h2>
                    <p className="mt-1 text-sm text-white/70">
                      Update book details, track copies, and remove damaged or lost books.
                    </p>
                  </div>
	                  <div className="flex items-center gap-2">
	                    <button
	                      type="button"
	                      onClick={() => setIsInventoryManagerOpen((prev) => !prev)}
	                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
	                    >
	                      {isInventoryManagerOpen ? 'Hide Inventory' : 'Show Inventory'}
	                      <ChevronDown
	                        className={`h-4 w-4 transition-transform duration-200 ${
	                          isInventoryManagerOpen ? 'rotate-180' : ''
	                        }`}
	                      />
	                    </button>
	                    <button
	                      onClick={loadCatalogBooks}
	                      className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
	                    >
	                      <RefreshCw className="h-4 w-4 group-hover:animate-spin-slow" />
	                      Refresh
	                    </button>
	                  </div>
	                </div>

	                {isInventoryManagerOpen && (
	                  <>
	                {inventoryState === 'loading' && (
	                  <div className="mt-6 flex items-center justify-center gap-3 py-8 text-white/60">
	                    <Loader2 className="h-5 w-5 animate-spin" />
	                    Loading catalog...
	                  </div>
	                )}

                {inventoryError && (
                  <div className="mt-6 rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    {inventoryError}
                  </div>
                )}

                {inventoryState !== 'loading' && catalogBooks.length === 0 && !inventoryError && (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/25 bg-white/5 p-10 text-center text-white/60">
                    No books found in inventory.
                  </div>
                )}

                <div className="mt-6 space-y-3">
	                  {catalogBooks.map((book) => (
                    <div
                      key={book.id}
                      className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-4"
                    >
                      {editingBookId === book.id ? (
                        <div className="grid gap-3 md:grid-cols-12">
                          <input
                            value={bookEditForm.title}
                            onChange={(event) => handleBookEditChange('title', event.target.value)}
                            className="md:col-span-4 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                            placeholder="Title"
                          />
                          <input
                            value={bookEditForm.author}
                            onChange={(event) => handleBookEditChange('author', event.target.value)}
                            className="md:col-span-3 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                            placeholder="Author"
                          />
                          <input
                            value={bookEditForm.genre}
                            onChange={(event) => handleBookEditChange('genre', event.target.value)}
                            className="md:col-span-3 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                            placeholder="Genre"
                          />
                          <input
                            type="number"
                            min="0"
                            value={bookEditForm.copies_total}
                            onChange={(event) => handleBookEditChange('copies_total', event.target.value)}
                            className="md:col-span-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                            placeholder="Total copies"
                          />
                          <input
                            value={bookEditForm.location_shelf}
                            onChange={(event) =>
                              handleBookEditChange('location_shelf', event.target.value)
                            }
                            className="md:col-span-12 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                            placeholder="Book shelf (optional)"
                          />
                          <div className="md:col-span-12 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={inventoryBusyId === book.id}
                              onClick={() => handleSaveBookEdit(book.id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-all"
                            >
                              {inventoryBusyId === book.id && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={inventoryBusyId === book.id}
                              onClick={cancelBookEdit}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative h-20 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-lg shadow-black/20">
                              {getBookCoverUrl(book) ? (
                                <Image
                                  src={getBookCoverUrl(book) as string}
                                  alt={book.title}
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                                  No Cover
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-white">{book.title}</p>
                              <p className="text-sm text-white/70">
                                {book.author} - {book.genre || 'Uncategorized'}
                              </p>
                              <p className="mt-1 text-xs text-white/55">
                                ISBN: {book.isbn} | Shelf:{' '}
                                {book.location_shelf?.trim() ? book.location_shelf : 'Unassigned'} | Total copies:{' '}
                                {book.copies_total ?? book.copies_available} | Available: {book.copies_available}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startBookEdit(book)}
                              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition-all"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={inventoryBusyId === book.id}
                              onClick={() => handleDeleteBook(book)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60 transition-all"
                            >
                              {inventoryBusyId === book.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
	                  ))}
	                </div>
	                  </>
	                )}
	              </div>
	            )}

            {resolvedActiveSectionId === 'desk-modules' && (
            <div
              id="desk-modules"
              className="scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Librarian Modules
                </p>
                <h2 className="mt-2 text-xl md:text-2xl font-semibold text-white">
                  Admin Panel Capability Map
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Active modules and backend-extension targets for librarian operations.
                </p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                  <h3 className="text-base font-semibold text-white">User Management</h3>
                  <div className="mt-3 space-y-2 text-sm text-white/80">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      Approve pending student and teacher accounts
                    </p>
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-300" />
                      Add / edit / delete students (needs dedicated API)
                    </p>
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-300" />
                      Assign per-user borrowing limits (needs policy endpoint)
                    </p>
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-300" />
                      Block users with unpaid fines (needs user status workflow)
                    </p>
                  </div>
                </article>

                <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                  <h3 className="text-base font-semibold text-white">Notification System</h3>
                  <div className="mt-3 space-y-2 text-sm text-white/80">
                    <p className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-sky-300" />
                      Due-date reminders via borrow automation
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      Overdue monitoring and fine calculation
                    </p>
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-300" />
                      Reservation-availability alerts (needs reservation module)
                    </p>
                  </div>
                </article>

                <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                  <h3 className="text-base font-semibold text-white">Reward & Scoring</h3>
                  <div className="mt-3 space-y-2 text-sm text-white/80">
                    <p className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-300" />
                      Monitor reading score (backend extension needed)
                    </p>
                    <p className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-300" />
                      Assign badges (backend extension needed)
                    </p>
                    <p className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-300" />
                      View leaderboard (backend extension needed)
                    </p>
                  </div>
                </article>

                <article className="rounded-2xl border border-white/15 bg-[#0f1b2f]/80 p-5">
                  <h3 className="text-base font-semibold text-white">Recommendation Engine</h3>
                  <div className="mt-3 space-y-2 text-sm text-white/80">
                    <p className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sky-300" />
                      Manage recommendation rules (backend extension needed)
                    </p>
                    <p className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sky-300" />
                      View trending suggestions (backend extension needed)
                    </p>
                    <p className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sky-300" />
                      Approve featured books (backend extension needed)
                    </p>
                  </div>
                </article>
              </div>
            </div>
            )}

            {/* Add Book Form */}
            {canManageBooks && resolvedActiveSectionId === 'desk-books' && (
              <div
                id="desk-add-book"
                className="scroll-mt-28 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/30 p-5 md:p-6 lg:p-8 transition-all duration-300 hover:bg-white/[0.08]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-sky-500/20 p-3 ring-1 ring-sky-300/30">
                      <Plus className="h-6 w-6 text-sky-200" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                        Catalog Entry
                      </p>
                      <h2 className="mt-2 text-xl md:text-2xl font-semibold text-white">Add New Book</h2>
                      <p className="mt-1 text-sm text-white/70">
                        Create a clean, consistent record for the library catalog.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAddBookOpen && (
                      <div className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
                        Required fields are marked with *
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddBookOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                    >
                      {isAddBookOpen ? 'Hide Form' : 'Add Book'}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isAddBookOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {isAddBookOpen && (
                  <>
                    <div className="mt-6 h-px bg-white/15" />

                    <form onSubmit={handleBookSubmit} className="mt-6 grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-12">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-sm font-medium text-white/80">Title *</label>
                      <span className="text-xs text-white/45">Primary display name</span>
                    </div>
                    <input
                      value={bookForm.title}
                      onChange={(e) => handleBookChange('title', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="The Design of Everyday Things"
                      required
                    />
                  </div>

                  <div className="lg:col-span-6 space-y-2">
                    <label className="text-sm font-medium text-white/80">Author *</label>
                    <input
                      value={bookForm.author}
                      onChange={(e) => handleBookChange('author', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="Don Norman"
                      required
                    />
                  </div>

                  <div className="lg:col-span-3 space-y-2">
                    <label className="text-sm font-medium text-white/80">ISBN *</label>
                    <input
                      value={bookForm.isbn}
                      onChange={(e) => handleBookChange('isbn', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="9780139372069"
                      required
                    />
                  </div>

                  <div className="lg:col-span-3 space-y-2">
                    <label className="text-sm font-medium text-white/80">Published Date *</label>
                    <input
                      type="date"
                      value={bookForm.published_date}
                      onChange={(e) => handleBookChange('published_date', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      required
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-2">
                    <label className="text-sm font-medium text-white/80">Genre *</label>
                    <input
                      value={bookForm.genre}
                      onChange={(e) => handleBookChange('genre', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="Design, Technology"
                      required
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-2">
                    <label className="text-sm font-medium text-white/80">Initial Total Copies *</label>
                    <input
                      type="number"
                      min="0"
                      value={bookForm.copies_available}
                      onChange={(e) => handleBookChange('copies_available', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      required
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-2">
                    <label className="text-sm font-medium text-white/80">Book Shelf (optional)</label>
                    <input
                      value={bookForm.location_shelf}
                      onChange={(e) => handleBookChange('location_shelf', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="e.g., Shelf B3"
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-2">
                    <label className="text-sm font-medium text-white/80">Language (optional)</label>
                    <input
                      value={bookForm.language}
                      onChange={(e) => handleBookChange('language', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="English"
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-2">
                    <label className="text-sm font-medium text-white/80">Grade Level (optional)</label>
                    <input
                      value={bookForm.grade_level}
                      onChange={(e) => handleBookChange('grade_level', e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                      placeholder="College"
                    />
                  </div>

                  <div className="lg:col-span-12 space-y-2">
                    <label className="text-sm font-medium text-white/80">Description (optional)</label>
                    <textarea
                      value={bookForm.description}
                      onChange={(e) => handleBookChange('description', e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all resize-none"
                      placeholder="Brief summary or description of the book..."
                    />
                  </div>

                  <div className="lg:col-span-6 space-y-2">
                    <label className="text-sm font-medium text-white/80">Cover Image (optional JPG/PNG)</label>
                    <input
                      ref={coverImageInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleCoverImageChange}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:text-[#1a1b1f] hover:file:bg-amber-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                    />
                    {coverImageFile && (
                      <p className="text-xs text-white/60">Selected: {coverImageFile.name}</p>
                    )}
                  </div>

                  <div className="lg:col-span-6 space-y-2">
                    <label className="text-sm font-medium text-white/80">Back Cover (optional JPG/PNG)</label>
                    <input
                      ref={coverBackInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleCoverBackChange}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:text-[#1a1b1f] hover:file:bg-amber-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                    />
                    {coverBackFile && (
                      <p className="text-xs text-white/60">Selected: {coverBackFile.name}</p>
                    )}
                  </div>

                  <div className="lg:col-span-12 space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-sm font-medium text-white/80">Categories</label>
                      <span className="text-xs text-white/45">Optional, but recommended</span>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/5 p-3 sm:p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Create category
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={newCategoryName}
                          onChange={(event) => {
                            setNewCategoryName(event.target.value);
                            if (categoryError) {
                              setCategoryError(null);
                            }
                            if (categorySuccess) {
                              setCategorySuccess(null);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleCreateCategory();
                            }
                          }}
                          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                          placeholder="e.g., Science Fiction"
                        />
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          disabled={categoryBusy || !newCategoryName.trim()}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                        >
                          {categoryBusy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              Add Category
                            </>
                          )}
                        </button>
                      </div>
                      {categoryError && (
                        <p className="mt-2 text-xs text-rose-200">{categoryError}</p>
                      )}
                      {categorySuccess && (
                        <p className="mt-2 text-xs text-emerald-200">{categorySuccess}</p>
                      )}
                    </div>
                    {categories.length === 0 ? (
                      <p className="text-sm text-white/60">No categories available yet.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/15 bg-[#0f1b2f]/70 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-all"
                            >
                              {bookForm.category_ids.length === 0
                                ? 'Select categories'
                                : `${bookForm.category_ids.length} selected`}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  isCategoryDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {bookForm.category_ids.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setBookForm((prev) => ({
                                    ...prev,
                                    category_ids: [],
                                  }))
                                }
                                className="inline-flex items-center rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition-all"
                              >
                                Clear selection
                              </button>
                            )}
                          </div>

                          {isCategoryDropdownOpen && (
                            <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                              <input
                                value={categorySearch}
                                onChange={(event) => setCategorySearch(event.target.value)}
                                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/45 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30 transition-all"
                                placeholder="Search category name..."
                              />
                              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                                {filteredCategories.length === 0 ? (
                                  <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                                    No categories match your search.
                                  </p>
                                ) : (
                                  filteredCategories.map((cat) => (
                                    <label
                                      key={cat.id}
                                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-white/85 hover:border-white/15 hover:bg-white/10"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={bookForm.category_ids.includes(cat.id)}
                                        onChange={() => toggleCategory(cat.id)}
                                        className="h-4 w-4 rounded border-white/30 bg-transparent text-sky-400 focus:ring-sky-300/40"
                                      />
                                      <span>{cat.name}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {selectedCategoryNames.length > 0 && (
                          <p className="text-xs text-white/70">
                            Selected: {selectedCategoryNames.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {bookError && (
                    <div className="lg:col-span-12 rounded-2xl bg-rose-500/15 border border-rose-300/30 p-5 text-rose-100 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      {bookError}
                    </div>
                  )}

                  {bookSuccess && (
                    <div className="lg:col-span-12 rounded-2xl bg-emerald-500/15 border border-emerald-300/30 p-5 text-emerald-100 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                      {bookSuccess}
                    </div>
                  )}

                  <div className="lg:col-span-12 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-xs text-white/60">
                      Tip: consistent metadata helps students find the right book faster.
                    </p>
                    <button
                      type="submit"
                      disabled={bookBusy}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-3 text-sm font-semibold text-[#1a1b1f] shadow-md hover:bg-amber-400 disabled:opacity-60 transition-all active:scale-95"
                    >
                      {bookBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add Book
                        </>
                      )}
                    </button>
                  </div>
                    </form>
                  </>
                )}
              </div>
            )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
