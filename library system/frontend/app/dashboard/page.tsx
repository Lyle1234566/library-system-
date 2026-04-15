'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookCopy,
  BookmarkPlus,
  Clock3,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import {
  BorrowRequest,
  Notification,
  PersonalizedBookRecommendations,
  Reservation,
  booksApi,
  notificationsApi,
} from '@/lib/api';
import { getUserRoleLabel, hasStaffDeskAccess, isWorkingStudent } from '@/lib/roles';

function formatDate(dateString?: string | null) {
  if (!dateString) {
    return 'Unknown';
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T00:00:00` : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysUntil(dateString?: string | null) {
  if (!dateString) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T00:00:00` : dateString;
  const target = new Date(normalized);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (Math.abs(diffSeconds) < 60) {
    return 'Just now';
  }
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const intervals = [
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ] as const;

  for (const [unit, amount] of intervals) {
    if (Math.abs(diffSeconds) >= amount) {
      return formatter.format(Math.round(diffSeconds / amount), unit);
    }
  }
  return 'Just now';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recommendations, setRecommendations] = useState<PersonalizedBookRecommendations | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showLibrarianDesk = !!user && ['LIBRARIAN', 'ADMIN'].includes(user.role);
  const showStaffDesk = hasStaffDeskAccess(user);
  const staffDeskTitle = isWorkingStudent(user) ? 'Working Student Desk' : 'Staff Desk';

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      const [requestResponse, reservationResponse, notificationResponse, recommendationResponse] = await Promise.all([
        booksApi.getBorrowRequests(),
        booksApi.getReservations(),
        notificationsApi.getNotifications({ limit: 6 }),
        booksApi.getRecommendations(),
      ]);

      if (!isActive) {
        return;
      }

      setRequests(requestResponse.data ?? []);
      setReservations(reservationResponse.data ?? []);
      setNotifications(notificationResponse.data?.results ?? []);
      setRecommendations(
        recommendationResponse.data ?? {
          for_you: [],
          popular_now: [],
          based_on_history: false,
        }
      );
      setUnreadCount(notificationResponse.data?.unread_count ?? 0);

      const firstError =
        requestResponse.error ||
        reservationResponse.error ||
        notificationResponse.error ||
        recommendationResponse.error;
      setError(firstError ?? null);
      setLoading(false);
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const activeBorrows = requests.filter((request) => request.status === 'APPROVED');
    const pendingBorrows = requests.filter((request) => request.status === 'PENDING');
    const returnedBorrows = requests.filter((request) => request.status === 'RETURNED');
    const activeReservations = reservations.filter(
      (reservation) => reservation.status === 'PENDING' || reservation.status === 'NOTIFIED'
    );
    const dueSoon = activeBorrows.filter((request) => {
      const daysLeft = getDaysUntil(request.due_date);
      return daysLeft !== null && daysLeft <= 3;
    });

    return {
      activeBorrows,
      pendingBorrows,
      returnedBorrows,
      activeReservations,
      dueSoon,
    };
  }, [requests, reservations]);

  const spotlightLoans = useMemo(() => {
    return [...stats.activeBorrows]
      .sort((a, b) => {
        const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })
      .slice(0, 3);
  }, [stats.activeBorrows]);

  const quickActions = useMemo(() => {
    const actions = [
      {
        title: 'My Books',
        description: 'Review borrow status, renewals, and return activity.',
        href: '/my-books',
      },
      {
        title: 'Reservations',
        description: 'Track queue position and claim notified reservations.',
        href: '/reservations',
      },
      {
        title: 'Notifications',
        description: 'Read approvals, due reminders, and reservation updates.',
        href: '/notifications',
      },
      {
        title: 'Settings',
        description: 'Manage your recovery email, session, and security actions.',
        href: '/settings',
      },
    ];

    if (showLibrarianDesk) {
      actions.push({
        title: 'Librarian Desk',
        description: 'Approve members and manage circulation operations.',
        href: '/librarian',
      });
    }

    if (showStaffDesk) {
      actions.push({
        title: staffDeskTitle,
        description: 'Process returns, requests, and daily front-desk tasks.',
        href: '/staff',
      });
    }

    return actions;
  }, [showLibrarianDesk, showStaffDesk, staffDeskTitle]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="relative overflow-hidden pt-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute right-0 top-1/4 h-[30rem] w-[30rem] rounded-full bg-amber-400/10 blur-3xl" />
          </div>

          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#091120] via-[#0d172b] to-[#0b1324]">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">Dashboard</p>
              <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Welcome back, {user?.full_name ?? 'Reader'}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                    This workspace shows your current loans, reservation activity, and account updates in one place.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/82">
                      {getUserRoleLabel(user)}
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/68">
                      {user?.email_verified ? 'Email verified' : 'Email verification pending'}
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/68">
                      {user?.is_active ? 'Account active' : 'Waiting for approval'}
                    </span>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/12 bg-white/6 p-6 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/48">Attention now</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-white/58">Unread notifications</p>
                      <p className="mt-3 text-3xl font-semibold text-white">{unreadCount}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-white/58">Due soon</p>
                      <p className="mt-3 text-3xl font-semibold text-white">{stats.dueSoon.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative -mt-10 z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
            {loading ? (
              <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] px-6 py-5 shadow-[0_24px_70px_rgba(2,8,23,0.44)] backdrop-blur-2xl">
                <div className="flex items-center gap-3 text-white/72">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                  Loading dashboard activity...
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="rounded-[1.6rem] border border-rose-300/25 bg-rose-500/12 px-5 py-4 text-sm text-rose-100">
                    Some dashboard data could not be loaded completely: {error}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[1.7rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-5 shadow-[0_24px_60px_rgba(2,8,23,0.36)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/14 text-sky-200">
                      <BookCopy className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-white/58">Active borrows</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{stats.activeBorrows.length}</p>
                  </div>

                  <div className="rounded-[1.7rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-5 shadow-[0_24px_60px_rgba(2,8,23,0.36)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/14 text-amber-100">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-white/58">Pending requests</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{stats.pendingBorrows.length}</p>
                  </div>

                  <div className="rounded-[1.7rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-5 shadow-[0_24px_60px_rgba(2,8,23,0.36)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-200">
                      <BookmarkPlus className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-white/58">Active reservations</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{stats.activeReservations.length}</p>
                  </div>

                  <div className="rounded-[1.7rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-5 shadow-[0_24px_60px_rgba(2,8,23,0.36)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/14 text-violet-100">
                      <Bell className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-white/58">Unread updates</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{unreadCount}</p>
                  </div>

                  <div className="rounded-[1.7rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-5 shadow-[0_24px_60px_rgba(2,8,23,0.36)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-white/58">Returned titles</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{stats.returnedBorrows.length}</p>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-white/46">Current focus</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">Loans that need attention</h2>
                      </div>
                      <Link href="/my-books" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
                        Open My Books
                      </Link>
                    </div>

                    <div className="mt-6 space-y-4">
                      {spotlightLoans.length === 0 ? (
                        <div className="rounded-[1.6rem] border border-dashed border-white/14 bg-white/[0.03] px-5 py-8 text-center">
                          <p className="text-white/72">No active loans right now.</p>
                          <p className="mt-2 text-sm text-white/48">Browse the catalog when you are ready for your next borrow request.</p>
                        </div>
                      ) : (
                        spotlightLoans.map((request) => {
                          const daysLeft = getDaysUntil(request.due_date);
                          const dueState =
                            daysLeft === null
                              ? 'Schedule unavailable'
                              : daysLeft < 0
                                ? `${Math.abs(daysLeft)} day(s) overdue`
                                : daysLeft === 0
                                  ? 'Due today'
                                  : `${daysLeft} day(s) left`;

                          return (
                            <div
                              key={request.id}
                              className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5"
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold text-white">{request.book.title}</h3>
                                  <p className="mt-1 text-sm text-white/60">{request.book.author}</p>
                                  <p className="mt-3 text-sm text-white/68">
                                    Due date: <span className="font-semibold text-white">{formatDate(request.due_date)}</span>
                                  </p>
                                  <p
                                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                      daysLeft !== null && daysLeft < 0
                                        ? 'bg-rose-500/15 text-rose-100'
                                        : daysLeft !== null && daysLeft <= 3
                                          ? 'bg-amber-500/15 text-amber-100'
                                          : 'bg-sky-500/15 text-sky-100'
                                    }`}
                                  >
                                    {dueState}
                                  </p>
                                </div>
                                <Link
                                  href={`/books/${request.book.id}`}
                                  className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/10 hover:text-white"
                                >
                                  View book
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-white/46">For you</p>
                          <h2 className="mt-2 text-xl font-semibold text-white">
                            {recommendations?.based_on_history
                              ? 'Borrowing-based recommendations'
                              : 'Popular books to start with'}
                          </h2>
                        </div>
                        <Link href="/books" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
                          Open catalog
                        </Link>
                      </div>

                      <div className="mt-6 space-y-4">
                        {(recommendations?.for_you ?? []).length === 0 ? (
                          <div className="rounded-[1.6rem] border border-dashed border-white/14 bg-white/[0.03] px-5 py-8 text-center">
                            <p className="text-white/72">No recommendations yet.</p>
                            <p className="mt-2 text-sm text-white/48">
                              Borrow or review a few books and the dashboard will tune these suggestions.
                            </p>
                          </div>
                        ) : (
                          recommendations?.for_you.slice(0, 3).map((item) => (
                            <Link
                              key={item.book.id}
                              href={`/books/${item.book.id}`}
                              className="block rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/16 hover:bg-white/[0.07]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{item.book.title}</p>
                                  <p className="mt-1 text-sm text-white/58">{item.book.author}</p>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                    item.book.available
                                      ? 'bg-emerald-500/15 text-emerald-100'
                                      : 'bg-amber-500/15 text-amber-100'
                                  }`}
                                >
                                  {item.book.available ? 'Available' : 'Queued'}
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-white/64">{item.reason}</p>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-white/46">Recent updates</p>
                          <h2 className="mt-2 text-xl font-semibold text-white">Latest account activity</h2>
                        </div>
                        <Link href="/notifications" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
                          Open notifications
                        </Link>
                      </div>

                      <div className="mt-6 space-y-4">
                        {notifications.length === 0 ? (
                          <div className="rounded-[1.6rem] border border-dashed border-white/14 bg-white/[0.03] px-5 py-8 text-center">
                            <p className="text-white/72">No recent updates yet.</p>
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <div key={notification.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{notification.title}</p>
                                  <p className="mt-2 text-sm leading-6 text-white/64">{notification.message}</p>
                                </div>
                                {!notification.is_read && (
                                  <span className="rounded-full bg-sky-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="mt-3 text-xs text-white/42">{formatRelativeTime(notification.created_at)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl">
                      <p className="text-xs uppercase tracking-[0.28em] text-white/46">Popular now</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">High-demand titles in the catalog</h2>
                      <div className="mt-6 grid gap-3">
                        {(recommendations?.popular_now ?? []).slice(0, 3).map((item) => (
                          <Link
                            key={item.book.id}
                            href={`/books/${item.book.id}`}
                            className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/16 hover:bg-white/[0.07]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.book.title}</p>
                                <p className="mt-1 text-sm text-white/60">{item.book.author}</p>
                                <p className="mt-3 text-sm leading-6 text-white/60">{item.reason}</p>
                              </div>
                              <ArrowRight className="mt-0.5 h-4 w-4 text-white/35" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl">
                      <p className="text-xs uppercase tracking-[0.28em] text-white/46">Quick actions</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">Open your main workspace</h2>
                      <div className="mt-6 grid gap-3">
                        {quickActions.map((action) => (
                          <Link
                            key={action.href}
                            href={action.href}
                            className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/16 hover:bg-white/[0.07]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{action.title}</p>
                                <p className="mt-1 text-sm leading-6 text-white/60">{action.description}</p>
                              </div>
                              <ArrowRight className="mt-0.5 h-4 w-4 text-white/35" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
