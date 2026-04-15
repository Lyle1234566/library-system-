'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';
import { booksApi, BorrowRequest, resolveMediaUrl } from '@/lib/api';

type FilterKey = 'ALL' | 'ACTIVE' | 'PENDING' | 'RETURNED' | 'REJECTED';
type DueAlertLevel = 'OVERDUE' | 'TODAY' | 'SOON';

const filterLabels: Record<FilterKey, string> = {
  ALL: 'All Books',
  ACTIVE: 'Borrowed',
  PENDING: 'Pending',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
};

const statusLabel: Record<BorrowRequest['status'], string> = {
  PENDING: 'Pending',
  APPROVED: 'Borrowed',
  REJECTED: 'Rejected',
  RETURNED: 'Returned',
};

const statusStyles: Record<BorrowRequest['status'], string> = {
  PENDING: 'border border-amber-300/35 bg-amber-500/15 text-amber-100',
  APPROVED: 'border border-sky-300/35 bg-sky-500/15 text-sky-100',
  RETURNED: 'border border-emerald-300/35 bg-emerald-500/15 text-emerald-100',
  REJECTED: 'border border-rose-300/35 bg-rose-500/15 text-rose-100',
};

function formatDate(dateString?: string | null) {
  if (!dateString) {
    return 'Unknown';
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T00:00:00`
    : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDaysUntil(dateString?: string | null) {
  if (!dateString) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T00:00:00`
    : dateString;
  const target = new Date(normalized);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatRelative(dateString?: string | null) {
  const days = getDaysUntil(dateString);
  if (days === null) {
    return '';
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Overdue by 1 day';
  return `Overdue by ${Math.abs(days)} days`;
}

function formatReportingFrequency(value?: string | null) {
  if (value === 'WEEKLY') return 'Weekly';
  if (value === 'MONTHLY') return 'Monthly';
  return 'None';
}

function isTeacherReportingRequest(request: BorrowRequest) {
  return Boolean(
    request.user?.role === 'TEACHER' &&
      request.status === 'APPROVED' &&
      request.reporting_frequency &&
      request.reporting_frequency !== 'NONE',
  );
}

export default function MyBooksPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportSubmittingId, setReportSubmittingId] = useState<number | null>(null);
  const [renewingId, setRenewingId] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadRequests = async () => {
      setLoading(true);
      const response = await booksApi.getBorrowRequests();

      if (!isActive) return;

      if (response.error || !response.data) {
        setError(response.error ?? 'Unable to load your books.');
        setRequests([]);
      } else {
        setError(null);
        setRequests(response.data);
      }
      setLoading(false);
    };

    loadRequests();

    return () => {
      isActive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const active = requests.filter((request) => request.status === 'APPROVED').length;
    const pending = requests.filter((request) => request.status === 'PENDING').length;
    const returned = requests.filter((request) => request.status === 'RETURNED').length;
    const rejected = requests.filter((request) => request.status === 'REJECTED').length;
    return { active, pending, returned, rejected, total: requests.length };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let data = requests;

    if (filter === 'ACTIVE') {
      data = data.filter((request) => request.status === 'APPROVED');
    } else if (filter === 'PENDING') {
      data = data.filter((request) => request.status === 'PENDING');
    } else if (filter === 'RETURNED') {
      data = data.filter((request) => request.status === 'RETURNED');
    } else if (filter === 'REJECTED') {
      data = data.filter((request) => request.status === 'REJECTED');
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      data = data.filter((request) => {
        const title = request.book.title.toLowerCase();
        const author = request.book.author?.toLowerCase() ?? '';
        const receipt = request.receipt_number?.toLowerCase() ?? '';
        return title.includes(term) || author.includes(term) || receipt.includes(term);
      });
    }

    return data;
  }, [requests, filter, search]);

  const dueAlerts = useMemo(() => {
    return requests
      .filter(
        (request) =>
          request.status === 'APPROVED' &&
          Boolean(
            isTeacherReportingRequest(request) ? request.next_report_due_date : request.due_date,
          ),
      )
      .map((request) => {
        const scheduleDate = isTeacherReportingRequest(request)
          ? request.next_report_due_date
          : request.due_date;
        const days = getDaysUntil(scheduleDate);
        if (days === null) {
          return null;
        }

        let level: DueAlertLevel | null = null;
        if (days < 0) {
          level = 'OVERDUE';
        } else if (days === 0) {
          level = 'TODAY';
        } else if (days <= 3) {
          level = 'SOON';
        }

        if (!level) {
          return null;
        }

        return {
          requestId: request.id,
          bookId: request.book.id,
          title: request.book.title,
          scheduleDate: scheduleDate as string,
          kind: isTeacherReportingRequest(request) ? 'REPORT' : 'DUE',
          level,
          days,
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
      .sort((a, b) => a.days - b.days);
  }, [requests]);

  const handleSubmitReport = async (requestId: number) => {
    if (reportSubmittingId) {
      return;
    }

    setReportSubmittingId(requestId);
    const response = await booksApi.submitBorrowReport(requestId);
    setReportSubmittingId(null);

    if (response.error || !response.data?.request) {
      setError(response.error ?? 'Unable to submit report.');
      return;
    }

    setError(null);
    setRequests((prev) =>
      prev.map((item) =>
        item.id === requestId ? { ...item, ...response.data!.request } : item,
      ),
    );
  };

  const handleRenewBorrow = async (requestId: number) => {
    if (renewingId !== null) {
      return;
    }

    setRenewingId(requestId);
    const response = await booksApi.renewBorrow(requestId);
    setRenewingId(null);

    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    setRequests((prev) =>
      prev.map((item) => {
        if (item.id !== requestId) {
          return item;
        }

        if (response.data?.request) {
          return { ...item, ...response.data.request };
        }
        return item;
      }),
    );

    showToast(response.data?.message ?? 'Renewal request submitted.', 'success');
  };

  return (
    <ProtectedRoute>
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />

        <main className="relative overflow-hidden pt-16 pb-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.12),transparent_40%)]" />
          </div>

          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0a1221] via-[#0e1629] to-[#0b1324] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.15),transparent_50%)]" />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80 font-semibold">My Library</p>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white">Books</h1>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-base text-white/75">
                Track your borrowed books, due dates, and reading journey.
              </p>
              {user && (
                <p className="mt-4 text-sm text-sky-200/90">
                  Welcome back, {user.full_name?.split(' ')[0] || 'there'}! 👋
                </p>
              )}
            </div>
          </section>

          <section className="-mt-8 relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="space-y-6 rounded-3xl border border-sky-500/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 p-6 shadow-2xl shadow-sky-500/10 backdrop-blur-xl sm:p-8">
              {(user?.role === 'LIBRARIAN' ||
                user?.role === 'WORKING' ||
                user?.role === 'STAFF' ||
                user?.role === 'ADMIN') && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 transition-all hover:border-white/20 hover:shadow-lg hover:shadow-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total Books</p>
                        <p className="mt-2 text-3xl font-bold text-white">{stats.total}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                        <svg className="h-6 w-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="group rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-sky-600/10 p-5 transition-all hover:border-sky-400/50 hover:shadow-lg hover:shadow-sky-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-sky-200/70">Borrowed</p>
                        <p className="mt-2 text-3xl font-bold text-sky-100">{stats.active}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-sky-400/20 flex items-center justify-center">
                        <svg className="h-6 w-6 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="group rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-600/10 p-5 transition-all hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-amber-200/70">Pending</p>
                        <p className="mt-2 text-3xl font-bold text-amber-100">{stats.pending}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-amber-400/20 flex items-center justify-center">
                        <svg className="h-6 w-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="group rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 p-5 transition-all hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-200/70">Returned</p>
                        <p className="mt-2 text-3xl font-bold text-emerald-100">{stats.returned}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-emerald-400/20 flex items-center justify-center">
                        <svg className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/14 bg-[#10203a]/70 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-white">
                    Borrow Alerts
                  </h2>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      dueAlerts.length > 0
                        ? 'border border-rose-300/35 bg-rose-500/20 text-rose-100'
                        : 'border border-white/15 bg-white/10 text-white/70'
                    }`}
                  >
                    {dueAlerts.length > 0
                      ? `${dueAlerts.length} alert${dueAlerts.length > 1 ? 's' : ''}`
                      : 'No urgent due dates'}
                  </span>
                </div>

                {dueAlerts.length === 0 ? (
                  <p className="mt-3 text-sm text-white/70">
                    No overdue or near-due borrow alerts right now.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {dueAlerts.map((alert) => (
                      <div
                        key={alert.requestId}
                        className="rounded-xl border border-white/14 bg-[#0f1b30]/80 px-4 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{alert.title}</p>
                            <p className="text-xs text-white/70">
                              {alert.kind === 'REPORT' ? 'Report due' : 'Due'}:{' '}
                              {formatDate(alert.scheduleDate)} - {formatRelative(alert.scheduleDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                alert.level === 'OVERDUE'
                                  ? 'border border-rose-300/35 bg-rose-500/20 text-rose-100'
                                  : alert.level === 'TODAY'
                                    ? 'border border-amber-300/35 bg-amber-500/20 text-amber-100'
                                    : 'border border-sky-300/35 bg-sky-500/20 text-sky-100'
                              }`}
                            >
                              {alert.level === 'OVERDUE'
                                ? alert.kind === 'REPORT'
                                  ? 'Report overdue'
                                  : 'Overdue'
                                : alert.level === 'TODAY'
                                  ? alert.kind === 'REPORT'
                                    ? 'Report today'
                                    : 'Due today'
                                  : alert.kind === 'REPORT'
                                    ? 'Report soon'
                                    : 'Due soon'}
                            </span>
                            <Link
                              href={`/books/${alert.bookId}`}
                              className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filterLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key as FilterKey)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-colors ${
                        filter === key
                          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                          : 'border border-white/15 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-white/15 bg-[#0f1b30]/85 px-4 py-2">
                  <svg
                    className="h-4 w-4 text-white/55"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                    />
                  </svg>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none"
                    placeholder="Search by title, author, or receipt"
                  />
                </div>
              </div>

              {loading && (
                <div className="flex items-center gap-3 text-white/70">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
                  Loading your books...
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-300/35 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {!loading && !error && filteredRequests.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/20 bg-[#10203a]/65 p-10 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sky-100">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">No books here yet</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Start borrowing to build your personal shelf.
                  </p>
                  <Link
                    href="/books"
                    className="mt-4 inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-[#1a1b1f] shadow-md hover:bg-amber-400"
                  >
                    Browse books
                  </Link>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {!loading &&
                  !error &&
                  filteredRequests.map((request) => {
                    const coverUrl = resolveMediaUrl(request.book.cover_image);
                    const isTeacherReporting = isTeacherReportingRequest(request);
                    const scheduleDate = isTeacherReporting
                      ? request.next_report_due_date
                      : request.due_date;
                    const dueLabel =
                      request.status === 'APPROVED' ? formatRelative(scheduleDate) : '';
                    const lateFeeValue = Number.parseFloat(request.late_fee_amount ?? '0');
                    const hasLateFee = Number.isFinite(lateFeeValue) && lateFeeValue > 0;
                    const renewalCount = request.renewal_count ?? 0;
                    const maxRenewals = request.max_renewals ?? 0;
                    const remainingRenewals =
                      request.remaining_renewals ??
                      Math.max(maxRenewals - renewalCount, 0);
                    const renewalDurationDays = request.renewal_duration_days ?? 0;
                    const canRenew = Boolean(request.can_renew);
                    const renewalBlockReason = request.renewal_block_reason;
                    const pendingRenewalRequestId = request.pending_renewal_request_id ?? null;
                    const pendingRenewalRequestedAt = request.pending_renewal_requested_at;
                    return (
                      <div
                        key={request.id}
                        className="group rounded-3xl border border-white/15 bg-[#0f1b2f]/85 shadow-xl shadow-black/25 transition-all hover:-translate-y-1 hover:border-sky-300/35"
                      >
                        <div className="flex gap-4 p-5">
                          <div className="relative h-28 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                            {coverUrl ? (
                              <Image
                                src={coverUrl}
                                alt={request.book.title}
                                fill
                                sizes="80px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-white/55">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="line-clamp-2 text-base font-semibold text-white">
                                  {request.book.title}
                                </h3>
                                <p className="text-sm text-white/70">{request.book.author}</p>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusStyles[request.status]}`}
                              >
                                {statusLabel[request.status]}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs text-white/65">
                              <p>Requested: {formatDate(request.requested_at)}</p>
                              {request.processed_at && (
                                <p>Processed: {formatDate(request.processed_at)}</p>
                              )}
                              {isTeacherReporting && (
                                <>
                                  <p className="text-indigo-100">No due date limit</p>
                                  <p>
                                    Reporting: {formatReportingFrequency(request.reporting_frequency)}
                                  </p>
                                </>
                              )}
                              {scheduleDate && (
                                <p className={dueLabel?.includes('Overdue') ? 'text-rose-200' : 'text-sky-100'}>
                                  {isTeacherReporting ? 'Next report' : 'Due'}: {formatDate(scheduleDate)}{' '}
                                  {dueLabel && `- ${dueLabel}`}
                                </p>
                              )}
                              {isTeacherReporting && request.last_reported_at && (
                                <p>Last report: {formatDate(request.last_reported_at)}</p>
                              )}
                              {hasLateFee && (
                                <p className="text-amber-100">
                                  Late fee: ₱{lateFeeValue.toFixed(2)}
                                </p>
                              )}
                              {request.status === 'APPROVED' && !isTeacherReporting && (
                                <p>
                                  Renewals: {renewalCount}/{maxRenewals} used
                                  {renewalDurationDays > 0
                                    ? ` - each approved renewal adds ${renewalDurationDays} day${renewalDurationDays === 1 ? '' : 's'}`
                                    : ''}
                                </p>
                              )}
                              {request.status === 'APPROVED' &&
                                !isTeacherReporting &&
                                pendingRenewalRequestId && (
                                <p className="text-sky-100">
                                  Renewal request pending since {formatDate(pendingRenewalRequestedAt)}
                                </p>
                              )}
                              {request.receipt_number && <p>Receipt: {request.receipt_number}</p>}
                            </div>
                            <div className="pt-2 flex items-center gap-3">
                              <Link
                                href={`/books/${request.book.id}`}
                                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                              >
                                View book details -&gt;
                              </Link>
                              {isTeacherReporting && request.status === 'APPROVED' && (
                                <button
                                  onClick={() => void handleSubmitReport(request.id)}
                                  disabled={reportSubmittingId === request.id}
                                  className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 disabled:cursor-not-allowed disabled:text-indigo-200/50"
                                >
                                  {reportSubmittingId === request.id
                                    ? 'Submitting report...'
                                    : `Submit ${formatReportingFrequency(request.reporting_frequency).toLowerCase()} report`}
                                </button>
                              )}
                              {request.status === 'APPROVED' &&
                                !isTeacherReporting && (
                                <button
                                  onClick={() => void handleRenewBorrow(request.id)}
                                  disabled={renewingId === request.id || !canRenew}
                                  className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:text-white/40"
                                >
                                  {renewingId === request.id
                                    ? 'Submitting...'
                                    : pendingRenewalRequestId
                                      ? 'Renewal requested'
                                      : canRenew
                                        ? `Request renewal (+${renewalDurationDays} day${renewalDurationDays === 1 ? '' : 's'}, ${remainingRenewals} left)`
                                        : 'Renewal unavailable'}
                                </button>
                              )}
                              {request.status === 'APPROVED' &&
                                !isTeacherReporting &&
                                !canRenew &&
                                renewalBlockReason && (
                                <span className="text-[11px] text-amber-100/90">
                                  {renewalBlockReason}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
