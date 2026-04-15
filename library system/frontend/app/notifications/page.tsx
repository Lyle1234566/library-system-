'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import { Notification, notificationsApi } from '@/lib/api';
import { emitUnreadCountUpdated } from '@/lib/notificationEvents';

type FilterMode = 'all' | 'unread';

const filterLabels: Record<FilterMode, string> = {
  all: 'All updates',
  unread: 'Unread only',
};

const NOTIFICATION_POLL_INTERVAL_MS = 15000;

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
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
}

function getNotificationCategory(notification: Notification) {
  if (notification.notification_type.startsWith('RESERVATION')) {
    return 'reservation';
  }
  if (
    notification.notification_type.startsWith('BORROW') ||
    notification.notification_type.startsWith('RETURN') ||
    notification.notification_type.startsWith('RENEWAL') ||
    notification.notification_type.startsWith('REPORT')
  ) {
    return 'circulation';
  }
  if (notification.notification_type.startsWith('FINE') || notification.notification_type === 'DUE_SOON') {
    return 'reminder';
  }
  return 'account';
}

function getNotificationHref(notification: Notification) {
  const maybeBookId = notification.data?.book_id;
  const bookId = typeof maybeBookId === 'number' ? maybeBookId : null;
  const category = getNotificationCategory(notification);

  if (category === 'reservation') {
    return bookId ? `/books/${bookId}` : '/reservations';
  }
  if (category === 'circulation' || category === 'reminder') {
    return bookId ? `/books/${bookId}` : '/my-books';
  }
  return '/settings';
}

function getToneClasses(category: ReturnType<typeof getNotificationCategory>, isRead: boolean) {
  const base = isRead
    ? 'border-white/10 bg-white/[0.03]'
    : 'border-sky-300/25 bg-sky-500/[0.09] shadow-[0_18px_40px_rgba(14,165,233,0.12)]';

  if (category === 'reservation') {
    return `${base} before:bg-emerald-400`;
  }
  if (category === 'reminder') {
    return `${base} before:bg-amber-400`;
  }
  if (category === 'account') {
    return `${base} before:bg-violet-400`;
  }
  return `${base} before:bg-sky-400`;
}

export default function NotificationsPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const requestVersionRef = useRef(0);

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await notificationsApi.getNotifications({
        unread: filter === 'unread',
        limit: 80,
      });

      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      if (response.error || !response.data) {
        setNotifications([]);
        setUnreadCount(0);
        emitUnreadCountUpdated(0);
        setError(response.error ?? 'Unable to load notifications right now.');
        return;
      }

      setNotifications(response.data.results ?? []);
      setUnreadCount(response.data.unread_count ?? 0);
      emitUnreadCountUpdated(response.data.unread_count ?? 0);
      setError(null);
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
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
  }, [loadNotifications]);

  const summary = useMemo(() => {
    return notifications.reduce(
      (acc, notification) => {
        const category = getNotificationCategory(notification);
        acc.total += 1;
        acc[category] += 1;
        if (!notification.is_read) {
          acc.unread += 1;
        }
        return acc;
      },
      {
        total: 0,
        unread: 0,
        reservation: 0,
        circulation: 0,
        reminder: 0,
        account: 0,
      }
    );
  }, [notifications]);

  const handleMarkAsRead = async (notificationId: number) => {
    requestVersionRef.current += 1;
    setMarkingId(notificationId);
    const response = await notificationsApi.markAsRead(notificationId);
    setMarkingId(null);

    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              is_read: true,
              read_at: notification.read_at ?? new Date().toISOString(),
            }
          : notification
      )
    );
    const nextUnreadCount = response.data?.unread_count ?? Math.max(unreadCount - 1, 0);
    setUnreadCount(nextUnreadCount);
    emitUnreadCountUpdated(nextUnreadCount);
    showToast(response.data?.message ?? 'Notification marked as read.', 'success');
  };

  const handleMarkAllRead = async () => {
    requestVersionRef.current += 1;
    setMarkingAll(true);
    const response = await notificationsApi.markAllAsRead();
    setMarkingAll(false);

    if (response.error) {
      showToast(response.error, 'error');
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
    setUnreadCount(0);
    emitUnreadCountUpdated(0);
    showToast(response.data?.message ?? 'All notifications marked as read.', 'success');
  };

  return (
    <ProtectedRoute>
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="relative overflow-hidden pt-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl" />
          </div>

          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#091120] via-[#0d172b] to-[#0b1324]">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">Account Center</p>
              <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.95fr)] lg:items-end">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Notifications and library updates
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                    Track approvals, due-date reminders, reservations, and account updates in one place.
                    Mark items as read as you clear them.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-200">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Unread</p>
                        <p className="text-2xl font-semibold text-white">{unreadCount}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-100">
                        <CheckCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Total</p>
                        <p className="text-2xl font-semibold text-white">{summary.total}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative -mt-10 z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.92)_0%,rgba(12,22,41,0.96)_100%)] p-6 shadow-[0_30px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl sm:p-8">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-200">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Circulation</p>
                      <p className="text-xl font-semibold text-white">{summary.circulation}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-200">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Reservations</p>
                      <p className="text-xl font-semibold text-white">{summary.reservation}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-100">
                      <CircleAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Reminders</p>
                      <p className="text-xl font-semibold text-white">{summary.reminder}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Account</p>
                      <p className="text-xl font-semibold text-white">{summary.account}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(filterLabels) as FilterMode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        filter === value
                          ? 'bg-amber-400 text-[#10203a]'
                          : 'border border-white/12 bg-white/6 text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {filterLabels[value]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  disabled={markingAll || unreadCount === 0}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {markingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                  Mark all as read
                </button>
              </div>

              {loading && (
                <div className="mt-8 flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-white/70">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                  Loading notifications...
                </div>
              )}

              {error && !loading && (
                <div className="mt-8 rounded-[1.5rem] border border-rose-300/25 bg-rose-500/12 px-5 py-4 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {!loading && !error && notifications.length === 0 && (
                <div className="mt-8 rounded-[1.8rem] border border-dashed border-white/15 bg-[#10203a]/62 px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-sky-200">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-white">No notifications yet</h2>
                  <p className="mt-2 text-sm text-white/65">
                    Once the library sends updates for borrowing, returns, reservations, or reminders, they will appear here.
                  </p>
                  <Link
                    href="/books"
                    className="mt-5 inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-[#132036] transition hover:bg-amber-300"
                  >
                    Browse books
                  </Link>
                </div>
              )}

              {!loading && !error && notifications.length > 0 && (
                <div className="mt-8 space-y-4">
                  {notifications.map((notification) => {
                    const category = getNotificationCategory(notification);
                    const href = getNotificationHref(notification);
                    return (
                      <article
                        key={notification.id}
                        className={`relative overflow-hidden rounded-[1.7rem] border p-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${getToneClasses(category, notification.is_read)}`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                                  notification.is_read
                                    ? 'border border-white/10 bg-white/[0.04] text-white/55'
                                    : 'bg-sky-400/15 text-sky-100 ring-1 ring-sky-300/20'
                                }`}
                              >
                                {notification.is_read ? 'Read' : 'Unread'}
                              </span>
                              <span className="text-xs uppercase tracking-[0.22em] text-white/42">
                                {notification.notification_type.replaceAll('_', ' ')}
                              </span>
                            </div>

                            <h2 className="mt-3 text-lg font-semibold text-white">{notification.title}</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/72">{notification.message}</p>

                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/45">
                              <span>{formatRelativeTime(notification.created_at)}</span>
                              <span className="h-1 w-1 rounded-full bg-white/20" />
                              <span>{formatTimestamp(notification.created_at)}</span>
                              {notification.read_at && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-white/20" />
                                  <span>Read {formatRelativeTime(notification.read_at)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-3">
                            <Link
                              href={href}
                              className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/10 hover:text-white"
                            >
                              Open related page
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                            {!notification.is_read && (
                              <button
                                type="button"
                                onClick={() => void handleMarkAsRead(notification.id)}
                                disabled={markingId === notification.id}
                                className="inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-[#112038] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {markingId === notification.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCheck className="mr-2 h-4 w-4" />
                                )}
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
