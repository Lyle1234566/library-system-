'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BellRing, Book, Clock, Loader2, X } from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import { Reservation, booksApi, resolveMediaUrl } from '@/lib/api';

function formatDate(dateString: string | null) {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReservationsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadReservations = async () => {
    setLoading(true);
    const response = await booksApi.getReservations();

    if (response.error || !response.data) {
      setReservations([]);
      setError(response.error ?? 'Failed to load reservations.');
    } else {
      setReservations(response.data);
      setError(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    const initializeReservations = async () => {
      setLoading(true);
      const response = await booksApi.getReservations();

      if (!isActive) {
        return;
      }

      if (response.error || !response.data) {
        setReservations([]);
        setError(response.error ?? 'Failed to load reservations.');
      } else {
        setReservations(response.data);
        setError(null);
      }

      setLoading(false);
    };

    void initializeReservations();

    return () => {
      isActive = false;
    };
  }, []);

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status === 'PENDING' || reservation.status === 'NOTIFIED'),
    [reservations]
  );
  const pastReservations = useMemo(
    () => reservations.filter((reservation) => ['FULFILLED', 'CANCELLED', 'EXPIRED'].includes(reservation.status)),
    [reservations]
  );
  const notifiedReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status === 'NOTIFIED'),
    [reservations]
  );

  const handleCancel = async (reservationId: number) => {
    setCancellingId(reservationId);
    const response = await booksApi.cancelReservation(reservationId);
    setCancellingId(null);

    if (response.error) {
      setError(response.error);
      showToast(response.error, 'error');
      return;
    }

    showToast(response.data?.message ?? 'Reservation cancelled.', 'success');
    await loadReservations();
  };

  const getStatusClasses = (status: Reservation['status']) => {
    const styles = {
      PENDING: 'border-sky-300/30 bg-sky-500/15 text-sky-100',
      NOTIFIED: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-100',
      FULFILLED: 'border-white/15 bg-white/[0.05] text-white/65',
      CANCELLED: 'border-rose-300/30 bg-rose-500/15 text-rose-100',
      EXPIRED: 'border-amber-300/30 bg-amber-500/15 text-amber-100',
    };
    return styles[status];
  };

  return (
    <ProtectedRoute requiredRoles={['STUDENT', 'TEACHER', 'WORKING']}>
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="relative overflow-hidden pt-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
          </div>

          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#091120] via-[#0d172b] to-[#0b1324]">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">My Library</p>
              <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.95fr)]">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Reservations</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                    Track your queue position, respond to availability alerts, and manage active reservations before they expire.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4 backdrop-blur-xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Active</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{activeReservations.length}</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4 backdrop-blur-xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Available</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{notifiedReservations.length}</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4 backdrop-blur-xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Archive</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{pastReservations.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative -mt-10 z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="space-y-6 rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl sm:p-8">
              {error && (
                <div className="rounded-[1.5rem] border border-rose-300/20 bg-rose-500/12 p-4 text-rose-100">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-white/72">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                  Loading reservations...
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-white">Active reservations</h2>
                        <p className="mt-1 text-sm text-white/60">Reservations still waiting in queue or already available for pickup.</p>
                      </div>
                      <Link href="/books" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
                        Browse books
                      </Link>
                    </div>

                    {activeReservations.length === 0 ? (
                      <div className="rounded-[1.8rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
                        <Book className="mx-auto h-12 w-12 text-white/35" />
                        <p className="mt-4 text-lg font-semibold text-white">No active reservations</p>
                        <p className="mt-2 text-sm text-white/60">Reserve unavailable books and they will appear here until claimed or cancelled.</p>
                        <button
                          onClick={() => router.push('/books')}
                          className="mt-5 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#10203a] transition hover:bg-amber-300"
                        >
                          Browse books
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {activeReservations.map((reservation) => (
                          <article
                            key={reservation.id}
                            className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5"
                          >
                            <div className="flex items-start gap-4">
                              <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                                {reservation.book.cover_image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={resolveMediaUrl(reservation.book.cover_image) || ''}
                                    alt={reservation.book.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Book className="h-6 w-6 text-white/35" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${getStatusClasses(reservation.status)}`}>
                                    {reservation.status}
                                  </span>
                                  {reservation.status === 'PENDING' && reservation.current_position !== null && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                                      <Clock className="h-3.5 w-3.5" />
                                      Queue {reservation.current_position}
                                    </span>
                                  )}
                                </div>

                                <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-white">
                                  {reservation.book.title}
                                </h3>
                                <p className="mt-1 text-sm text-white/60">{reservation.book.author}</p>

                                <div className="mt-4 grid gap-2 text-sm text-white/58">
                                  <p>Reserved: {formatDate(reservation.created_at)}</p>
                                  {reservation.notified_at && <p>Notified: {formatDate(reservation.notified_at)}</p>}
                                  {reservation.expires_at && (
                                    <p className="text-emerald-100">Claim before: {formatDate(reservation.expires_at)}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <button
                                onClick={() => router.push(`/books/${reservation.book.id}`)}
                                className="inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-[#10203a] transition hover:bg-amber-300"
                              >
                                {reservation.status === 'NOTIFIED' ? 'Borrow now' : 'Open book'}
                              </button>
                              <button
                                onClick={() => void handleCancel(reservation.id)}
                                disabled={cancellingId === reservation.id}
                                className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {cancellingId === reservation.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="mr-2 h-4 w-4" />
                                )}
                                Cancel
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {pastReservations.length > 0 && (
                    <div className="border-t border-white/10 pt-6">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-semibold text-white">Reservation history</h2>
                          <p className="mt-1 text-sm text-white/60">Completed, cancelled, and expired reservation records.</p>
                        </div>
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70">
                          <BellRing className="mr-2 h-4 w-4 text-sky-200" />
                          Past reservations
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {pastReservations.map((reservation) => (
                          <article
                            key={reservation.id}
                            className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 opacity-80"
                          >
                            <div className="flex items-start gap-4">
                              <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                                {reservation.book.cover_image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={resolveMediaUrl(reservation.book.cover_image) || ''}
                                    alt={reservation.book.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Book className="h-5 w-5 text-white/30" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${getStatusClasses(reservation.status)}`}>
                                    {reservation.status}
                                  </span>
                                </div>
                                <h3 className="mt-3 line-clamp-2 text-base font-semibold text-white">
                                  {reservation.book.title}
                                </h3>
                                <p className="mt-1 text-sm text-white/58">{reservation.book.author}</p>
                                <p className="mt-3 text-sm text-white/54">Reserved: {formatDate(reservation.created_at)}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
