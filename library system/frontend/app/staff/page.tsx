'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { isWorkingStudent } from '@/lib/roles';
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
} from '@/lib/api';

type SectionState = 'idle' | 'loading' | 'error';

const statusPill: Record<BorrowRequest['status'], string> = {
  PENDING: 'bg-[color:var(--accent)]/15 text-[color:var(--accent-strong)]',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-600',
  RETURNED: 'bg-[color:var(--surface-muted)] text-ink',
};

const returnStatusPill: Record<ReturnRequest['status'], string> = {
  PENDING: 'bg-[color:var(--accent)]/15 text-[color:var(--accent-strong)]',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-600',
};

const renewalStatusPill: Record<RenewalRequest['status'], string> = {
  PENDING: 'bg-[color:var(--accent)]/15 text-[color:var(--accent-strong)]',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-600',
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

export default function StaffDeskPage() {
  const { user } = useAuth();
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [approvedBorrowRequests, setApprovedBorrowRequests] = useState<BorrowRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);

  const [borrowsState, setBorrowsState] = useState<SectionState>('idle');
  const [overdueState, setOverdueState] = useState<SectionState>('idle');
  const [returnsState, setReturnsState] = useState<SectionState>('idle');
  const [renewalsState, setRenewalsState] = useState<SectionState>('idle');

  const [borrowsError, setBorrowsError] = useState<string | null>(null);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [renewalsError, setRenewalsError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [returnActionBusy, setReturnActionBusy] = useState<number | null>(null);
  const [renewalActionBusy, setRenewalActionBusy] = useState<number | null>(null);

  const quickTasks = useMemo(
    () => [
      {
        title: 'Circulation desk',
        description: 'Help check books in and out with a friendly, calm flow.',
      },
      {
        title: 'Shelving support',
        description: 'Return books to the right shelf and keep sections tidy.',
      },
      {
        title: 'Quiet care',
        description: 'Maintain a peaceful space and guide users politely.',
      },
      {
        title: 'Event support',
        description: 'Assist with reading activities and orientations.',
      },
    ],
    []
  );

  const isWorkingStudentDesk = isWorkingStudent(user);
  const staffLabel = isWorkingStudentDesk ? 'Working Student Desk' : 'Staff Desk';
  const staffSubtitle =
    isWorkingStudentDesk
      ? 'Assist the circulation desk, help students, and keep the library moving smoothly.'
      : 'Support circulation, process requests, and keep daily operations on track.';
  const staffFocusTitle = isWorkingStudentDesk ? 'Working student focus' : 'Staff focus';
  const staffFocusSubtitle =
    isWorkingStudentDesk
      ? 'Your key responsibilities today.'
      : 'Operational priorities for the shift.';

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

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void loadBorrowRequests();
      void loadOverdueRequests();
      void loadReturnRequests();
      void loadRenewalRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

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
      <div className="min-h-screen bg-[color:var(--page-bg)]">
        <Navbar />
        <main className="pt-16">
          <section className="relative overflow-hidden bg-[color:var(--accent)] text-[#1a1b1f]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_60%)]" />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <p className="text-sm uppercase tracking-[0.5em] text-[#6b4a00]">Daily Operations</p>
              <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-[#1a1b1f]">{staffLabel}</h1>
              <p className="mt-4 text-[#4b3200] max-w-2xl">{staffSubtitle}</p>
            </div>
          </section>

          <section className="-mt-10 relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-10">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-3xl border border-line bg-paper shadow-card p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-ink">Circulation snapshot</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Track the queue and keep requests moving.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Pending borrows</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{borrowRequests.length}</p>
                  </div>
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Pending returns</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{returnRequests.length}</p>
                  </div>
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Pending renewals</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{renewalRequests.length}</p>
                  </div>
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Total queue</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">
                      {borrowRequests.length + returnRequests.length + renewalRequests.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Overdue books</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{overdueRequests.length}</p>
                  </div>
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Estimated fines</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">
                      {formatCurrency(totalOverdueFees)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-paper-muted border border-line p-4">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">Role</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{user?.role ?? '-'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-paper shadow-card p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-ink">{staffFocusTitle}</h2>
                <p className="mt-2 text-sm text-ink-muted">{staffFocusSubtitle}</p>
                <div className="mt-6 space-y-4">
                  {quickTasks.map((task) => (
                    <div key={task.title} className="rounded-2xl border border-line bg-paper-muted p-4">
                      <p className="text-sm font-semibold text-ink">{task.title}</p>
                      <p className="mt-1 text-xs text-ink-muted">{task.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-paper shadow-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Overdue books</h2>
                  <p className="text-sm text-ink-muted">
                    Review overdue loans so staff can verify who needs follow-up.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadOverdueRequests}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-[color:var(--surface-muted)]"
                >
                  Refresh
                </button>
              </div>

              {overdueState === 'loading' && (
                <div className="flex items-center gap-3 text-ink-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
                  Loading overdue books...
                </div>
              )}

              {overdueError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {overdueError}
                </div>
              )}

              {overdueState !== 'loading' && overdueRequests.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-paper-muted p-6 text-center text-sm text-ink-muted">
                  No overdue books right now.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {overdueRequests.map((request) => {
                  const fine = Number.parseFloat(request.late_fee_amount ?? '0');
                  const resolvedFine = Number.isFinite(fine) ? fine : 0;

                  return (
                    <div key={request.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{request.book.title}</p>
                          <p className="text-xs text-ink-muted">{request.book.author}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
                          {request.overdue_days ?? 0} day{request.overdue_days === 1 ? '' : 's'} overdue
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted space-y-1">
                        <p>Borrower: {request.user?.full_name ?? 'Unknown'}</p>
                        <p>ID: {request.user?.student_id ?? request.user?.staff_id ?? '-'}</p>
                        <p>Due date: {formatDate(request.due_date)}</p>
                        {request.receipt_number && <p>Receipt: {request.receipt_number}</p>}
                      </div>
                      <div className="rounded-2xl bg-paper-muted border border-line px-4 py-3">
                        <p className="text-[11px] uppercase tracking-widest text-ink-muted">Estimated fine</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{formatCurrency(resolvedFine)}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          Verify the loan status and follow up with the borrower.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-paper shadow-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Borrow requests</h2>
                  <p className="text-sm text-ink-muted">Approve or reject pending borrows.</p>
                </div>
                <button
                  type="button"
                  onClick={loadBorrowRequests}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-[color:var(--surface-muted)]"
                >
                  Refresh
                </button>
              </div>

              {borrowsState === 'loading' && (
                <div className="flex items-center gap-3 text-ink-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
                  Loading borrow requests...
                </div>
              )}

              {borrowsError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {borrowsError}
                </div>
              )}

              {borrowsState !== 'loading' && borrowRequests.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-paper-muted p-6 text-center text-sm text-ink-muted">
                  No pending borrow requests.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {borrowRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{request.book.title}</p>
                        <p className="text-xs text-ink-muted">{request.book.author}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusPill[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted space-y-1">
                      <p>Student: {request.user?.full_name ?? 'Unknown'}</p>
                      <p>ID: {request.user?.student_id ?? '-'}</p>
                      <p>Requested: {formatDate(request.requested_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={actionBusy === request.id}
                        onClick={() => handleBorrowDecision(request.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === request.id}
                        onClick={() => handleBorrowDecision(request.id, false)}
                        className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-paper shadow-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Renewal requests</h2>
                  <p className="text-sm text-ink-muted">Approve or reject requested extensions.</p>
                </div>
                <button
                  type="button"
                  onClick={loadRenewalRequests}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-[color:var(--surface-muted)]"
                >
                  Refresh
                </button>
              </div>

              {renewalsState === 'loading' && (
                <div className="flex items-center gap-3 text-ink-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
                  Loading renewal requests...
                </div>
              )}

              {renewalsError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {renewalsError}
                </div>
              )}

              {renewalsState !== 'loading' && renewalRequests.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-paper-muted p-6 text-center text-sm text-ink-muted">
                  No pending renewal requests.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {renewalRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{request.book.title}</p>
                        <p className="text-xs text-ink-muted">{request.book.author}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${renewalStatusPill[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted space-y-1">
                      <p>Student: {request.user?.full_name ?? 'Unknown'}</p>
                      <p>ID: {request.user?.student_id ?? request.user?.staff_id ?? '-'}</p>
                      <p>Requested: {formatDate(request.requested_at)}</p>
                      <p>Current due date: {formatDate(request.current_due_date)}</p>
                      <p>Projected due date: {formatDate(request.projected_due_date)}</p>
                      <p>
                        Extension: {request.requested_extension_days} day
                        {request.requested_extension_days === 1 ? '' : 's'}
                      </p>
                      {request.receipt_number && <p>Receipt: {request.receipt_number}</p>}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={renewalActionBusy === request.id}
                        onClick={() => handleRenewalDecision(request.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={renewalActionBusy === request.id}
                        onClick={() => handleRenewalDecision(request.id, false)}
                        className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-paper shadow-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Return requests</h2>
                  <p className="text-sm text-ink-muted">Process pending returns.</p>
                </div>
                <button
                  type="button"
                  onClick={loadReturnRequests}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-[color:var(--surface-muted)]"
                >
                  Refresh
                </button>
              </div>

              {returnsState === 'loading' && (
                <div className="flex items-center gap-3 text-ink-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
                  Loading return requests...
                </div>
              )}

              {returnsError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {returnsError}
                </div>
              )}

              {returnsState !== 'loading' && returnRequests.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-paper-muted p-6 text-center text-sm text-ink-muted">
                  No pending return requests.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {returnRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{request.book.title}</p>
                        <p className="text-xs text-ink-muted">{request.book.author}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${returnStatusPill[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted space-y-1">
                      <p>Student: {request.user?.full_name ?? 'Unknown'}</p>
                      <p>ID: {request.user?.student_id ?? '-'}</p>
                      <p>Requested: {formatDate(request.requested_at)}</p>
                      {request.receipt_number && <p>Receipt: {request.receipt_number}</p>}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={returnActionBusy === request.id}
                        onClick={() => handleReturnDecision(request.id, true)}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={returnActionBusy === request.id}
                        onClick={() => handleReturnDecision(request.id, false)}
                        className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
