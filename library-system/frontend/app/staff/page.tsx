'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/lib/api-config';
import { authApi, tokenStorage, User as AuthUser } from '@/lib/auth';
import { emitUnreadCountUpdated } from '@/lib/notificationEvents';
import { getUserRoleLabel, isWorkingStudent } from '@/lib/roles';
import { emitPendingCountsUpdated } from '@/lib/pendingCounts';
import {
  getNotificationActionLabel,
  getNotificationCategory,
  getNotificationHref,
} from '@/lib/notificationRouting';
import {
  BookDown,
  BookUp,
  CheckCheck,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Loader2,
  PanelLeft,
  RefreshCw,
  Trash2,
  UserPlus,
  Bell,
  ArrowRight,
  ArrowUpRight,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  booksApi,
  BorrowRequest,
  RenewalRequest,
  ReturnRequest,
  getRenewalRequests,
  getReturnRequests,
  approveBorrowRequest,
  approveRenewalRequest,
  rejectBorrowRequest,
  rejectRenewalRequest,
  approveReturnRequest,
  rejectReturnRequest,
  notificationsApi,
  Notification,
} from '@/lib/api';

type SectionState = 'idle' | 'loading' | 'error';
type StaffDeskNavItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};
type StaffDeskNavGroup = {
  label: string;
  items: StaffDeskNavItem[];
};
const NOTIFICATION_POLL_INTERVAL_MS = 15000;

const statusPill: Record<BorrowRequest['status'], string> = {
  PENDING: 'border border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  APPROVED: 'border border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
  REJECTED: 'border border-rose-300/20 bg-rose-400/10 text-rose-100',
  RETURNED: 'border border-white/10 bg-white/10 text-slate-200',
};

const returnStatusPill: Record<ReturnRequest['status'], string> = {
  PENDING: 'border border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  APPROVED: 'border border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
  REJECTED: 'border border-rose-300/20 bg-rose-400/10 text-rose-100',
};

const renewalStatusPill: Record<RenewalRequest['status'], string> = {
  PENDING: 'border border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  APPROVED: 'border border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
  REJECTED: 'border border-rose-300/20 bg-rose-400/10 text-rose-100',
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = date.getTime() - Date.now();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  if (absSeconds < 60) {
    return 'Just now';
  }

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ] as const;

  for (const [unit, seconds] of units) {
    if (absSeconds >= seconds) {
      return formatter.format(Math.round(diffMs / 1000 / seconds), unit);
    }
  }

  return 'Just now';
};

function StaffDeskPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const [pendingStudents, setPendingStudents] = useState<AuthUser[]>([]);
  const [workingStudentApprovals, setWorkingStudentApprovals] = useState<Record<number, boolean>>({});
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [approvedBorrowRequests, setApprovedBorrowRequests] = useState<BorrowRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [studentsState, setStudentsState] = useState<SectionState>('idle');
  const [borrowsState, setBorrowsState] = useState<SectionState>('idle');
  const [overdueState, setOverdueState] = useState<SectionState>('idle');
  const [returnsState, setReturnsState] = useState<SectionState>('idle');
  const [renewalsState, setRenewalsState] = useState<SectionState>('idle');
  const [notificationsState, setNotificationsState] = useState<SectionState>('idle');

  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [borrowsError, setBorrowsError] = useState<string | null>(null);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [renewalsError, setRenewalsError] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const [activeSectionId, setActiveSectionId] = useState('desk-dashboard');
  const [studentActionBusy, setStudentActionBusy] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [returnActionBusy, setReturnActionBusy] = useState<number | null>(null);
  const [renewalActionBusy, setRenewalActionBusy] = useState<number | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationTotalCount, setNotificationTotalCount] = useState(0);
  const [notificationActionBusy, setNotificationActionBusy] = useState(false);
  const [notificationNavigationId, setNotificationNavigationId] = useState<number | null>(null);
  const [notificationDeleteId, setNotificationDeleteId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const isWorkingStudentDesk = isWorkingStudent(user);

  const overdueRequests = useMemo(
    () =>
      approvedBorrowRequests
        .filter((request) => (request.overdue_days ?? 0) > 0)
        .sort((a, b) => (b.overdue_days ?? 0) - (a.overdue_days ?? 0)),
    [approvedBorrowRequests]
  );

  const totalOverdueFees = useMemo(
    () =>
      overdueRequests.reduce((sum, request) => {
        const fee = Number.parseFloat(request.late_fee_amount ?? '0');
        return sum + (Number.isFinite(fee) ? fee : 0);
      }, 0),
    [overdueRequests]
  );

  const totalQueue = borrowRequests.length + returnRequests.length + renewalRequests.length;

  useEffect(() => {
    emitPendingCountsUpdated({
      pendingAccounts: isWorkingStudentDesk ? pendingStudents.length : 0,
      borrowRequests: borrowRequests.length,
      returnRequests: returnRequests.length,
      renewalRequests: renewalRequests.length,
      overdueBooks: overdueRequests.length,
    });
  }, [
    isWorkingStudentDesk,
    pendingStudents.length,
    borrowRequests.length,
    returnRequests.length,
    renewalRequests.length,
    overdueRequests.length,
  ]);
  const recentNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications]
  );
  const staffDeskNavGroups = useMemo<StaffDeskNavGroup[]>(() => {
    const groups: StaffDeskNavGroup[] = [
      {
        label: 'Overview',
        items: [
          {
            id: 'desk-dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            badge: String(
              totalQueue + overdueRequests.length + (isWorkingStudentDesk ? pendingStudents.length : 0)
            ),
          },
        ],
      },
    ];

    const requestItems: StaffDeskNavItem[] = [];
    if (isWorkingStudentDesk) {
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
          id: 'desk-overdue',
          label: 'Overdue Books',
          icon: Clock3,
          badge: String(overdueRequests.length),
        },
      ],
    });
    groups.push({
      label: 'Updates',
      items: [
        {
          id: 'desk-notifications',
          label: 'Notifications',
          icon: Bell,
          badge: String(notificationUnreadCount),
        },
      ],
    });

    return groups;
  }, [
    borrowRequests.length,
    isWorkingStudentDesk,
    notificationUnreadCount,
    overdueRequests.length,
    pendingStudents.length,
    renewalRequests.length,
    returnRequests.length,
    totalQueue,
  ]);
  const staffDeskNavItems = useMemo(
    () => staffDeskNavGroups.flatMap((group) => group.items),
    [staffDeskNavGroups]
  );
  const resolvedActiveSectionId = useMemo(() => {
    if (staffDeskNavItems.some((item) => item.id === activeSectionId)) {
      return activeSectionId;
    }
    return staffDeskNavItems[0]?.id ?? '';
  }, [activeSectionId, staffDeskNavItems]);
  const spotlightStats = [
    ...(isWorkingStudentDesk
      ? [
          {
            label: 'Pending accounts',
            value: pendingStudents.length,
            hint: 'New library accounts waiting for approval',
            accent: 'from-amber-300/30 via-orange-400/15 to-transparent',
          },
        ]
      : []),
    {
      label: 'Pending borrows',
      value: borrowRequests.length,
      hint: 'Requests waiting for a decision',
      accent: 'from-cyan-300/30 via-sky-400/15 to-transparent',
    },
    {
      label: 'Pending returns',
      value: returnRequests.length,
      hint: 'Books queued for check-in',
      accent: 'from-emerald-300/30 via-teal-400/15 to-transparent',
    },
    {
      label: 'Pending renewals',
      value: renewalRequests.length,
      hint: 'Extensions ready for review',
      accent: 'from-amber-300/30 via-orange-400/15 to-transparent',
    },
    {
      label: 'Total queue',
      value: totalQueue,
      hint: 'Live requests across the desk',
      accent: 'from-fuchsia-300/25 via-violet-400/10 to-transparent',
    },
    {
      label: 'Overdue books',
      value: overdueRequests.length,
      hint: 'Loans that need follow-up today',
      accent: 'from-rose-300/30 via-pink-400/15 to-transparent',
    },
    {
      label: 'Estimated fines',
      value: formatCurrency(totalOverdueFees),
      hint: 'Potential collection exposure',
      accent: 'from-yellow-300/25 via-amber-400/15 to-transparent',
    },
  ];

  useEffect(() => {
    const requestedSection = searchParams?.get('section');
    if (!requestedSection) {
      return;
    }
    if (!staffDeskNavItems.some((item) => item.id === requestedSection)) {
      return;
    }
    setActiveSectionId(requestedSection);
  }, [searchParams, staffDeskNavItems]);

  useEffect(() => {
    if (staffDeskNavItems.some((item) => item.id === activeSectionId)) {
      return;
    }
    setActiveSectionId(staffDeskNavItems[0]?.id ?? 'desk-dashboard');
  }, [activeSectionId, staffDeskNavItems]);

  const loadPendingStudents = useCallback(async () => {
    if (!isWorkingStudentDesk) {
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
  }, [isWorkingStudentDesk]);

  const loadBorrowRequests = async () => {
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
  };

  const loadOverdueRequests = async () => {
    setOverdueState('loading');
    const response = await booksApi.getBorrowRequests('APPROVED');
    if (response.error || !response.data) {
      setOverdueError(response.error ?? 'Unable to load overdue books.');
      setApprovedBorrowRequests([]);
      setOverdueState('error');
      return;
    }
    setOverdueError(null);
    setApprovedBorrowRequests(response.data);
    setOverdueState('idle');
  };

  const loadReturnRequests = async () => {
    setReturnsState('loading');
    const response = typeof booksApi.getReturnRequests === 'function'
      ? await booksApi.getReturnRequests('PENDING')
      : await getReturnRequests('PENDING');
    if (response.error || !response.data) {
      setReturnsError(response.error ?? 'Unable to load return requests.');
      setReturnRequests([]);
      setReturnsState('error');
      return;
    }
    setReturnsError(null);
    setReturnRequests(response.data);
    setReturnsState('idle');
  };

  const loadRenewalRequests = async () => {
    setRenewalsState('loading');
    const response = typeof booksApi.getRenewalRequests === 'function'
      ? await booksApi.getRenewalRequests('PENDING')
      : await getRenewalRequests('PENDING');
    if (response.error || !response.data) {
      setRenewalsError(response.error ?? 'Unable to load renewal requests.');
      setRenewalRequests([]);
      setRenewalsState('error');
      return;
    }
    setRenewalsError(null);
    setRenewalRequests(response.data);
    setRenewalsState('idle');
  };

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setNotificationsState('loading');
    }

    const response = await notificationsApi.getNotifications({ limit: 40 });
    if (response.error || !response.data) {
      setNotifications([]);
      setNotificationUnreadCount(0);
      setNotificationTotalCount(0);
      emitUnreadCountUpdated(0);
      setNotificationsError(response.error ?? 'Unable to load notifications.');
      setNotificationsState('error');
      return;
    }

    const loadedNotifications = response.data.results ?? [];
    const nextUnreadCount = response.data.unread_count ?? 0;
    setNotifications(loadedNotifications);
    setNotificationUnreadCount(nextUnreadCount);
    setNotificationTotalCount(response.data.total_count ?? loadedNotifications.length);
    emitUnreadCountUpdated(nextUnreadCount);
    setNotificationsError(null);
    setNotificationsState('idle');
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      if (isWorkingStudentDesk) {
        void loadPendingStudents();
      }
      void loadBorrowRequests();
      void loadOverdueRequests();
      void loadReturnRequests();
      void loadRenewalRequests();
      void loadNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, isWorkingStudentDesk, loadNotifications, loadPendingStudents]);

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
  }, [loadNotifications, user]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (notificationActionBusy || notificationUnreadCount === 0) {
      return;
    }

    setNotificationActionBusy(true);
    const response = await notificationsApi.markAllAsRead();
    setNotificationActionBusy(false);

    if (response.error) {
      setNotificationsError(response.error);
      return;
    }

    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at ?? now,
      }))
    );
    setNotificationUnreadCount(0);
    emitUnreadCountUpdated(0);
    setNotificationsError(null);
  }, [notificationActionBusy, notificationUnreadCount]);

  const handleMarkNotificationRead = useCallback(async (notification: Notification) => {
    if (notification.is_read) {
      return true;
    }

    const response = await notificationsApi.markAsRead(notification.id);
    if (response.error) {
      setNotificationsError(response.error);
      return false;
    }

    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((currentNotification) =>
        currentNotification.id === notification.id
          ? {
              ...currentNotification,
              is_read: true,
              read_at: currentNotification.read_at ?? now,
            }
          : currentNotification
      )
    );
    const nextUnreadCount =
      response.data?.unread_count ?? Math.max(notificationUnreadCount - 1, 0);
    setNotificationUnreadCount(nextUnreadCount);
    emitUnreadCountUpdated(nextUnreadCount);
    setNotificationsError(null);
    return true;
  }, [notificationUnreadCount]);

  const handleNotificationNavigation = useCallback(async (notification: Notification) => {
    const href = getNotificationHref(notification);

    setNotificationNavigationId(notification.id);
    try {
      const markedRead = await handleMarkNotificationRead(notification);
      if (!markedRead) {
        return;
      }
      router.push(href);
    } finally {
      setNotificationNavigationId(null);
    }
  }, [handleMarkNotificationRead, router]);

  const handleDeleteNotification = useCallback(async (notification: Notification) => {
    if (notificationDeleteId === notification.id) {
      return;
    }

    setNotificationDeleteId(notification.id);
    const response = await notificationsApi.deleteNotification(notification.id);
    setNotificationDeleteId(null);

    if (response.error) {
      setNotificationsError(response.error);
      return;
    }

    setNotifications((current) =>
      current.filter((currentNotification) => currentNotification.id !== notification.id)
    );
    const nextUnreadCount =
      response.data?.unread_count ??
      (notification.is_read ? notificationUnreadCount : Math.max(notificationUnreadCount - 1, 0));
    const nextTotalCount =
      response.data?.total_count ?? Math.max(notificationTotalCount - 1, 0);
    setNotificationUnreadCount(nextUnreadCount);
    setNotificationTotalCount(nextTotalCount);
    emitUnreadCountUpdated(nextUnreadCount);
    setNotificationsError(null);
  }, [notificationDeleteId, notificationTotalCount, notificationUnreadCount]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setIsNotificationMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleApproveStudent = async (studentId: number) => {
    setStudentActionBusy(studentId);
    const response = await authApi.approveStudent(studentId, {
      is_working_student: Boolean(workingStudentApprovals[studentId]),
    });

    if (response.error || !response.data) {
      setStudentsError(response.error ?? 'Unable to approve account.');
    } else {
      setStudentsError(null);
      setPendingStudents((prev) => prev.filter((student) => student.id !== studentId));
      setWorkingStudentApprovals((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }

    setStudentActionBusy(null);
  };

  const handleRejectStudent = async (studentId: number) => {
    if (!window.confirm('Are you sure you want to reject this account? This action cannot be undone.')) {
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
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      let errorDetail: string | null = null;
      try {
        const payload = (await response.json()) as { detail?: string } | null;
        errorDetail = payload?.detail ?? null;
      } catch {}

      if (!response.ok) {
        setStudentsError(errorDetail ?? 'Unable to reject account.');
      } else {
        setStudentsError(null);
        setPendingStudents((prev) => prev.filter((student) => student.id !== studentId));
        setWorkingStudentApprovals((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
      }
    } catch (error) {
      setStudentsError(error instanceof Error ? error.message : 'Unable to reject account.');
    }

    setStudentActionBusy(null);
  };

  const handleBorrowDecision = async (requestId: number, approve: boolean) => {
    setActionBusy(requestId);
    const response =
      approve
        ? (typeof booksApi.approveBorrowRequest === 'function'
            ? await booksApi.approveBorrowRequest(requestId)
            : await approveBorrowRequest(requestId))
        : (typeof booksApi.rejectBorrowRequest === 'function'
            ? await booksApi.rejectBorrowRequest(requestId)
            : await rejectBorrowRequest(requestId));
    if (response.error || !response.data) {
      setBorrowsError(response.error ?? 'Unable to update borrow request.');
    } else {
      setBorrowRequests((prev) => prev.filter((request) => request.id !== requestId));
    }
    setActionBusy(null);
  };

  const handleReturnDecision = async (requestId: number, approve: boolean) => {
    setReturnActionBusy(requestId);
    const response =
      approve
        ? (typeof booksApi.approveReturnRequest === 'function'
            ? await booksApi.approveReturnRequest(requestId)
            : await approveReturnRequest(requestId))
        : (typeof booksApi.rejectReturnRequest === 'function'
            ? await booksApi.rejectReturnRequest(requestId)
            : await rejectReturnRequest(requestId));
    if (response.error || !response.data) {
      setReturnsError(response.error ?? 'Unable to update return request.');
    } else {
      setReturnRequests((prev) => prev.filter((request) => request.id !== requestId));
      void loadOverdueRequests();
    }
    setReturnActionBusy(null);
  };

  const handleRenewalDecision = async (requestId: number, approve: boolean) => {
    setRenewalActionBusy(requestId);
    const response =
      approve
        ? (typeof booksApi.approveRenewalRequest === 'function'
            ? await booksApi.approveRenewalRequest(requestId)
            : await approveRenewalRequest(requestId))
        : (typeof booksApi.rejectRenewalRequest === 'function'
            ? await booksApi.rejectRenewalRequest(requestId)
            : await rejectRenewalRequest(requestId));
    if (response.error || !response.data) {
      setRenewalsError(response.error ?? 'Unable to update renewal request.');
    } else {
      setRenewalRequests((prev) => prev.filter((request) => request.id !== requestId));
      void loadOverdueRequests();
    }
    setRenewalActionBusy(null);
  };

  return (
    <ProtectedRoute requiredRoles={['WORKING', 'STAFF', 'ADMIN']}>
      <div className="min-h-screen bg-[#060b16] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative flex min-h-screen">
          {/* Mobile overlay */}
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsSidebarOpen(false)}
            className={`fixed inset-0 z-30 bg-[#020611]/70 backdrop-blur-sm transition-opacity md:hidden ${
              isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />

          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col overflow-y-auto border-r border-white/8 bg-[linear-gradient(180deg,rgba(6,14,24,0.98),rgba(8,17,30,0.96))] px-2.5 py-3.5 shadow-[20px_0_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition-transform duration-300 md:translate-x-0 ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex flex-col gap-3 px-1 py-1.5">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-2.5 min-w-0 px-1">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/[0.04]">
                  <Image
                    src="/logo%20lib.png"
                    alt="SCSIT Library System logo"
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="block truncate text-[0.78rem] font-semibold tracking-tight text-white">SCSIT Library System</span>
                  <span className="block truncate text-[0.58rem] font-medium uppercase tracking-[0.22em] text-white/40">Working Student Desk</span>
                </div>
              </Link>
            </div>

            <div className="px-2 mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100/70">Desk Navigation</p>
            </div>

            <nav className="mt-4 space-y-5">
                  {staffDeskNavGroups.map((group) => (
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
                              onClick={() => { setActiveSectionId(item.id); setIsSidebarOpen(false); }}
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

          {/* Main content */}
          <div className="flex min-h-screen flex-1 flex-col md:pl-[220px]">
            {/* Top header */}
            <header className="sticky top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(4,11,24,0.94)_0%,rgba(6,14,28,0.88)_100%)] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
              <div className="relative flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-white/80 transition hover:bg-white/[0.09] hover:text-white md:hidden"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h1 className="text-[1.05rem] font-bold tracking-[-0.02em] text-white">Working Student Desk</h1>
                    <p className="text-[11px] text-slate-300/60">Assist the circulation desk and keep the library moving.</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                    title="Back to Home"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </Link>
                  <div ref={notificationMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => { setIsNotificationMenuOpen((prev) => !prev); setIsProfileMenuOpen(false); }}
                      className="relative inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {notificationUnreadCount > 0 && (
                        <span className="absolute right-1.5 top-1.5 min-w-[16px] rounded-full bg-amber-400 px-1 py-0.5 text-[9px] font-semibold text-black">
                          {notificationUnreadCount}
                        </span>
                      )}
                    </button>

                    {isNotificationMenuOpen && (
                      <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[22rem] rounded-3xl border border-white/10 bg-[#081221]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Notifications</p>
                              <p className="mt-1 text-xs text-white/55">{notificationUnreadCount} unread</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleMarkAllNotificationsRead()}
                              disabled={notificationActionBusy || notificationUnreadCount === 0}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300/15 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-50 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {notificationActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Mark read
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {notificationsState === 'loading' && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/60">Loading...</div>
                          )}
                          {notificationsError && notificationsState !== 'loading' && (
                            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{notificationsError}</div>
                          )}
                          {notificationsState !== 'loading' && !notificationsError && recentNotifications.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/60">No notifications.</div>
                          )}
                          {notificationsState !== 'loading' && !notificationsError && recentNotifications.map((notification) => (
                            <button
                              type="button"
                              key={notification.id}
                              onClick={() => { setIsNotificationMenuOpen(false); void handleNotificationNavigation(notification); }}
                              disabled={notificationNavigationId === notification.id}
                              className="block w-full rounded-2xl border border-white/10 bg-[#0b1729]/88 px-4 py-3.5 text-left transition hover:border-sky-300/20 hover:bg-sky-400/10 disabled:opacity-70"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-white">{notification.title}</p>
                                    {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-white/60 line-clamp-2">{notification.message}</p>
                                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/38">{formatRelativeTime(notification.created_at)}</p>
                                </div>
                                {notificationNavigationId === notification.id
                                  ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-100" />
                                  : <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => { setIsNotificationMenuOpen(false); setActiveSectionId('desk-notifications'); }}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-400/10 px-3 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/15"
                          >
                            View all notifications
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={profileMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => { setIsProfileMenuOpen((prev) => !prev); setIsNotificationMenuOpen(false); }}
                      className="flex items-center gap-2.5 rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-2 text-left transition hover:bg-white/[0.09]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-[16px] bg-gradient-to-br from-cyan-400/90 to-sky-300 text-[0.85rem] font-bold text-[#05111f]">
                        {(user?.full_name ?? 'W')
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? '')
                          .join('')}
                      </div>
                      <div className="hidden min-w-0 sm:block">
                        <p className="truncate text-[13px] font-semibold leading-tight text-white">
                          {user?.full_name ?? 'Working Student'}
                        </p>
                        <p className="truncate text-[10px] uppercase tracking-[0.22em] text-white/45">
                          {user?.role ?? 'Working'}
                        </p>
                      </div>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-white/50 sm:block" />
                    </button>

                    {isProfileMenuOpen && (
                      <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-64 rounded-3xl border border-white/10 bg-[#081221]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-sm font-semibold text-white">{user?.full_name ?? 'Working Student'}</p>
                          <p className="mt-1 text-xs text-white/55">{user?.email ?? 'No email on file'}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">
                            {user?.student_id ?? user?.staff_id ?? '-'}
                          </p>
                        </div>
                        <div className="mt-2 space-y-1">
                          <Link
                            href="/profile"
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            View profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => { setIsProfileMenuOpen(false); logout(); }}
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

            <main className="flex-1 px-3 py-5 sm:px-5 lg:px-7">
              <div className="space-y-6">
              {resolvedActiveSectionId === 'desk-dashboard' && (
              <div className="space-y-6">
              <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,21,39,0.94),rgba(10,17,31,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.26)] sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100/70">Command Center</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Circulation snapshot</h2>
                    <p className="mt-2 text-sm text-slate-300/80">Track the desk load and keep every request moving with confidence.</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                    {totalQueue} requests live
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {spotlightStats.map((stat) => (
                    <div key={stat.label} className="relative overflow-hidden rounded-[1.45rem] border border-white/8 bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent}`} />
                      <div className="relative">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300/60">{stat.label}</p>
                        <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
                        <p className="mt-2 text-sm text-slate-300/70">{stat.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Notifications */}
              <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,21,39,0.94),rgba(10,17,31,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.26)] sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100/70">Updates</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Recent notifications</h2>
                    <p className="mt-2 text-sm text-slate-300/80">Stay informed about library activities and updates.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSectionId('desk-notifications')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-amber-100"
                  >
                    Open desk notifications
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {notificationsState === 'loading' && (
                  <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                    Loading notifications...
                  </div>
                )}

                {notificationsError && notificationsState !== 'loading' && (
                  <div className="mt-6 rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {notificationsError}
                  </div>
                )}

                {notificationsState !== 'loading' && !notificationsError && recentNotifications.length === 0 && (
                  <div className="mt-6 rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                    <Bell className="mx-auto h-8 w-8 text-white/30" />
                    <p className="mt-3">No recent notifications</p>
                  </div>
                )}

                {notificationsState !== 'loading' && !notificationsError && recentNotifications.length > 0 && (
                  <div className="mt-6 space-y-3">
                    {recentNotifications.map((notification) => {
                      const category = getNotificationCategory(notification);
                      const categoryColors = {
                        reservation: 'border-emerald-300/20 bg-emerald-400/10',
                        reminder: 'border-amber-300/20 bg-amber-400/10',
                        account: 'border-violet-300/20 bg-violet-400/10',
                        circulation: 'border-sky-300/20 bg-sky-400/10',
                      };
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => void handleNotificationNavigation(notification)}
                          disabled={notificationNavigationId === notification.id}
                          className={`block w-full rounded-[1.5rem] border p-4 text-left transition hover:border-white/20 ${notification.is_read ? 'border-white/10 bg-white/[0.03]' : categoryColors[category]}}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {!notification.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                                )}
                                <p className="text-sm font-semibold text-white truncate">{notification.title}</p>
                              </div>
                              <p className="mt-1 text-xs text-slate-300/70 line-clamp-2">{notification.message}</p>
                              <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-slate-400/60">
                                {new Date(notification.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center text-slate-300/60">
                              {notificationNavigationId === notification.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              </div>
              )}

                {resolvedActiveSectionId === 'desk-notifications' && (
              <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,43,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)] sm:p-8 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-100/75">Communication</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Notifications</h2>
                    <p className="mt-2 text-sm text-slate-300/80">
                      Review alerts for the working student and staff desk, then open the related queue directly.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href="/notifications"
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-white/20 hover:bg-white/[0.07]"
                    >
                      Full page
                    </Link>
                    <button
                      type="button"
                      onClick={() => void loadNotifications()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-sky-300/35 hover:bg-sky-400/10 hover:text-sky-100"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${notificationsState === 'loading' ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMarkAllNotificationsRead()}
                      disabled={notificationActionBusy || notificationUnreadCount === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-50 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {notificationActionBusy ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Clearing...
                        </>
                      ) : (
                        <>
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark all read
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300/50">Unread</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{notificationUnreadCount}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300/50">Total</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{notificationTotalCount}</p>
                  </div>
                </div>

                {notificationsState === 'loading' && (
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                    Loading notifications...
                  </div>
                )}

                {notificationsError && notificationsState !== 'loading' && (
                  <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {notificationsError}
                  </div>
                )}

                {notificationsState !== 'loading' && !notificationsError && notifications.length === 0 && (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                    No notifications found for this account.
                  </div>
                )}

                <div className="space-y-4">
                  {notificationsState !== 'loading' && !notificationsError && notifications.map((notification) => (
                    <article
                      key={notification.id}
                      className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.2)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="truncate text-base font-semibold text-white">
                              {notification.title}
                            </h3>
                            {!notification.is_read && (
                              <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-slate-300/75">{notification.message}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-400/70">
                            <span>{formatRelativeTime(notification.created_at)}</span>
                            <span className="h-1 w-1 rounded-full bg-white/20" />
                            <span>{getNotificationActionLabel(notification)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400/60">
                            {formatDate(notification.created_at)}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNotification(notification)}
                            disabled={
                              notificationDeleteId === notification.id ||
                              notificationNavigationId === notification.id
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {notificationDeleteId === notification.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleNotificationNavigation(notification)}
                            disabled={
                              notificationNavigationId === notification.id ||
                              notificationDeleteId === notification.id
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-50 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {notificationNavigationId === notification.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="h-3.5 w-3.5" />
                            )}
                            {getNotificationActionLabel(notification)}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

                {isWorkingStudentDesk && resolvedActiveSectionId === 'desk-accounts' && (
              <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,43,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)] sm:p-8 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">Approval Desk</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Pending accounts</h2>
                    <p className="mt-2 text-sm text-slate-300/80">
                      Review new account requests and approve them directly from the working student desk.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadPendingStudents}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-amber-100"
                  >
                    Refresh
                  </button>
                </div>

                {studentsState === 'loading' && (
                  <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-slate-300/80">
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-amber-300"></div>
                    Loading pending accounts...
                  </div>
                )}

                {studentsError && (
                  <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {studentsError}
                  </div>
                )}

                {studentsState !== 'loading' && pendingStudents.length === 0 && !studentsError && (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                    No pending accounts right now.
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {pendingStudents.map((student) => (
                    <div key={student.id} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.2)] space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{student.full_name}</p>
                          <p className="mt-1 text-sm text-slate-400">{getUserRoleLabel(student)}</p>
                        </div>
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                          Pending
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">
                            {student.role === 'TEACHER' ? 'Faculty ID' : 'Student ID'}
                          </p>
                          <p className="mt-2 font-medium text-white">{student.staff_id ?? student.student_id ?? '-'}</p>
                        </div>
                        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Joined</p>
                          <p className="mt-2 font-medium text-white">{formatDate(student.date_joined)}</p>
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Email</p>
                        <p className="mt-2 font-medium text-white break-all">{student.email ?? 'No email provided'}</p>
                      </div>

                      {student.role === 'STUDENT' && (
                        <label className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
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

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          disabled={studentActionBusy === student.id}
                          onClick={() => handleApproveStudent(student.id)}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-400 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={studentActionBusy === student.id}
                          onClick={() => handleRejectStudent(student.id)}
                          className="rounded-full border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

                {resolvedActiveSectionId === 'desk-overdue' && (
            <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,43,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)] sm:p-8 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-rose-200/70">Risk Watch</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Overdue books</h2>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Review overdue loans so staff can verify who needs follow-up.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadOverdueRequests}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100"
                >
                  Refresh
                </button>
              </div>

              {overdueState === 'loading' && (
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-slate-300/80">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-cyan-300"></div>
                  Loading overdue books...
                </div>
              )}

              {overdueError && (
                <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {overdueError}
                </div>
              )}

              {overdueState !== 'loading' && overdueRequests.length === 0 && (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                  No overdue books right now.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {overdueRequests.map((request) => {
                  const fine = Number.parseFloat(request.late_fee_amount ?? '0');
                  const resolvedFine = Number.isFinite(fine) ? fine : 0;

                  return (
                    <div key={request.id} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.2)] space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{request.book.title}</p>
                          <p className="mt-1 text-sm text-slate-400">{request.book.author}</p>
                        </div>
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                          {request.overdue_days ?? 0} day{request.overdue_days === 1 ? '' : 's'} overdue
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Borrower</p>
                          <p className="mt-2 font-medium text-white">{request.user?.full_name ?? 'Unknown'}</p>
                          <p className="mt-1 text-xs text-slate-400">{request.user?.student_id ?? request.user?.staff_id ?? '-'}</p>
                        </div>
                        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Due date</p>
                          <p className="mt-2 font-medium text-white">{formatDate(request.due_date)}</p>
                          {request.receipt_number ? <p className="mt-1 text-xs text-slate-400">Receipt: {request.receipt_number}</p> : null}
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Estimated fine</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(resolvedFine)}</p>
                        <p className="mt-2 text-sm text-slate-300/70">
                          Verify the loan status and follow up with the borrower.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
                )}

                {resolvedActiveSectionId === 'desk-borrows' && (
            <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,43,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)] sm:p-8 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100/70">Decision Lane</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Borrow requests</h2>
                  <p className="mt-2 text-sm text-slate-300/80">Approve or reject pending borrows.</p>
                </div>
                <button
                  type="button"
                  onClick={loadBorrowRequests}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100"
                >
                  Refresh
                </button>
              </div>

              {borrowsState === 'loading' && (
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-slate-300/80">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-cyan-300"></div>
                  Loading borrow requests...
                </div>
              )}

              {borrowsError && (
                <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {borrowsError}
                </div>
              )}

              {borrowsState !== 'loading' && borrowRequests.length === 0 && (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                  No pending borrow requests.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {borrowRequests.map((request) => (
                  <div key={request.id} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.2)] space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{request.book.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{request.book.author}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${statusPill[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Borrower</p>
                        <p className="mt-2 font-medium text-white">{request.user?.full_name ?? 'Unknown'}</p>
                        <p className="mt-1 text-xs text-slate-400">{request.user?.student_id ?? '-'}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Requested</p>
                        <p className="mt-2 font-medium text-white">{formatDate(request.requested_at)}</p>
                        <p className="mt-1 text-xs text-slate-400">Decision ready for processing</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={actionBusy === request.id}
                        onClick={() => handleBorrowDecision(request.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === request.id}
                        onClick={() => handleBorrowDecision(request.id, false)}
                        className="rounded-full border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
                )}

                {resolvedActiveSectionId === 'desk-renewals' && (
            <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,43,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)] sm:p-8 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100/70">Extension Lane</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Renewal requests</h2>
                  <p className="mt-2 text-sm text-slate-300/80">Approve or reject requested extensions.</p>
                </div>
                <button
                  type="button"
                  onClick={loadRenewalRequests}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100"
                >
                  Refresh
                </button>
              </div>

              {renewalsState === 'loading' && (
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-slate-300/80">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-cyan-300"></div>
                  Loading renewal requests...
                </div>
              )}

              {renewalsError && (
                <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {renewalsError}
                </div>
              )}

              {renewalsState !== 'loading' && renewalRequests.length === 0 && (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                  No pending renewal requests.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {renewalRequests.map((request) => (
                  <div key={request.id} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.2)] space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{request.book.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{request.book.author}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${renewalStatusPill[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Borrower</p>
                        <p className="mt-2 font-medium text-white">{request.user?.full_name ?? 'Unknown'}</p>
                        <p className="mt-1 text-xs text-slate-400">{request.user?.student_id ?? request.user?.staff_id ?? '-'}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Timeline</p>
                        <p className="mt-2 font-medium text-white">{formatDate(request.current_due_date)} → {formatDate(request.projected_due_date)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Extension: {request.requested_extension_days} day
                          {request.requested_extension_days === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>Requested: {formatDate(request.requested_at)}</p>
                      {request.receipt_number ? <p>Receipt: {request.receipt_number}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={renewalActionBusy === request.id}
                        onClick={() => handleRenewalDecision(request.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={renewalActionBusy === request.id}
                        onClick={() => handleRenewalDecision(request.id, false)}
                        className="rounded-full border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
                )}

                {resolvedActiveSectionId === 'desk-returns' && (
            <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,43,0.96),rgba(8,15,28,0.94))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.24)] sm:p-8 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-100/70">Check-In Lane</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Return requests</h2>
                  <p className="mt-2 text-sm text-slate-300/80">Process pending returns.</p>
                </div>
                <button
                  type="button"
                  onClick={loadReturnRequests}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100"
                >
                  Refresh
                </button>
              </div>

              {returnsState === 'loading' && (
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-slate-300/80">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-cyan-300"></div>
                  Loading return requests...
                </div>
              )}

              {returnsError && (
                <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {returnsError}
                </div>
              )}

              {returnsState !== 'loading' && returnRequests.length === 0 && (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300/70">
                  No pending return requests.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {returnRequests.map((request) => (
                  <div key={request.id} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.2)] space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{request.book.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{request.book.author}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${returnStatusPill[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Borrower</p>
                        <p className="mt-2 font-medium text-white">{request.user?.full_name ?? 'Unknown'}</p>
                        <p className="mt-1 text-xs text-slate-400">{request.user?.student_id ?? '-'}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">Requested</p>
                        <p className="mt-2 font-medium text-white">{formatDate(request.requested_at)}</p>
                        {request.receipt_number ? <p className="mt-1 text-xs text-slate-400">Receipt: {request.receipt_number}</p> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={returnActionBusy === request.id}
                        onClick={() => handleReturnDecision(request.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={returnActionBusy === request.id}
                        onClick={() => handleReturnDecision(request.id, false)}
                        className="rounded-full border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function StaffDeskPage() {
  return (
    <Suspense>
      <StaffDeskPageInner />
    </Suspense>
  );
}
