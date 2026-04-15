'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { booksApi, BorrowRequest, resolveMediaUrl } from '@/lib/api';

function formatDate(dateString?: string | null) {
  if (!dateString) return 'Unknown';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T00:00:00` : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function HistoryPage() {
  const [history, setHistory] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      const response = await booksApi.getHistory();
      if (response.error || !response.data) {
        setError(response.error ?? 'Unable to load reading history.');
        setHistory([]);
      } else {
        setError(null);
        setHistory(response.data);
      }
      setLoading(false);
    };
    loadHistory();
  }, []);

  return (
    <ProtectedRoute>
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="relative overflow-hidden pt-16 pb-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl" />
          </div>

          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0a1221] via-[#0e1629] to-[#0b1324]">
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
              <p className="text-sm uppercase tracking-[0.4em] text-sky-200/75">My Library</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Reading History</h1>
              <p className="mt-4 max-w-2xl text-white/80">
                All the books you&apos;ve borrowed and returned over time.
              </p>
            </div>
          </section>

          <section className="-mt-12 sm:-mt-16 relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="space-y-8 rounded-[30px] border border-white/12 bg-white/6 p-6 shadow-[0_24px_56px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-10">
              {loading && (
                <div className="flex items-center gap-3 text-white/70">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-sky-500"></div>
                  Loading history...
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-300/35 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {!loading && !error && history.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/20 bg-[#10203a]/65 p-10 text-center">
                  <h3 className="text-lg font-semibold text-white">No history yet</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Start borrowing books to build your reading history.
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
                {!loading && !error && history.map((request) => {
                  const coverUrl = resolveMediaUrl(request.book.cover_image);
                  const lateFeeValue = Number.parseFloat(request.late_fee_amount ?? '0');
                  const hasLateFee = Number.isFinite(lateFeeValue) && lateFeeValue > 0;
                  return (
                    <div
                      key={request.id}
                      className="rounded-3xl border border-white/15 bg-[#0f1b2f]/85 shadow-xl shadow-black/25"
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
                          <div>
                            <h3 className="line-clamp-2 text-base font-semibold text-white">
                              {request.book.title}
                            </h3>
                            <p className="text-sm text-white/70">{request.book.author}</p>
                          </div>
                          <div className="space-y-1 text-xs text-white/65">
                            <p>Borrowed: {formatDate(request.processed_at)}</p>
                            <p>Returned: {formatDate(request.returned_at ?? request.due_date)}</p>
                            {hasLateFee && (
                              <p className="text-amber-100">Late fee: ₱{lateFeeValue.toFixed(2)}</p>
                            )}
                            {request.renewal_count && request.renewal_count > 0 && (
                              <p className="text-emerald-100">Renewed {request.renewal_count} time(s)</p>
                            )}
                          </div>
                          <Link
                            href={`/books/${request.book.id}`}
                            className="inline-block text-xs font-semibold text-sky-300 hover:text-sky-200"
                          >
                            View book -&gt;
                          </Link>
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
