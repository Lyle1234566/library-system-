'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { booksApi, Book } from '@/lib/api';
import BookCard from './BookCard';

export default function FeaturedBooks() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let isActive = true;

    const fetchBooks = async () => {
      setLoading(true);
      const response = await booksApi.getAll();

      if (!isActive) {
        return;
      }

      if (response.error || !response.data) {
        setError(response.error ?? 'Unable to load books.');
        setBooks([]);
      } else {
        setError(null);
        const featuredBooks = [...response.data]
          .sort((left, right) => {
            const leftScore =
              (left.available ? 1000 : 0)
              + (left.review_count ?? 0) * 10
              + Math.round((left.average_rating ?? 0) * 10);
            const rightScore =
              (right.available ? 1000 : 0)
              + (right.review_count ?? 0) * 10
              + Math.round((right.average_rating ?? 0) * 10);

            if (leftScore !== rightScore) {
              return rightScore - leftScore;
            }
            return left.title.localeCompare(right.title);
          })
          .slice(0, 8);

        setBooks(featuredBooks);
      }

      setLoading(false);
    };

    void fetchBooks();

    return () => {
      isActive = false;
    };
  }, [authLoading, isAuthenticated]);

  return (
    <section className="relative pt-6 pb-8 bg-[#0b2134]">
      <div className="absolute inset-0">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-sky-200/10 blur-3xl animate-float-slow" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.12),transparent_45%)]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 animate-fade-up">
            Featured Books
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto animate-fade-up delay-100">
            Discover our curated collection of popular books available for borrowing
          </p>
        </div>

        {authLoading && (
          <div className="flex justify-center items-center py-12 animate-fade-up">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]"></div>
          </div>
        )}

        {/* Loading State */}
        {!authLoading && loading && (
          <div className="flex justify-center items-center py-12 animate-fade-up">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]"></div>
          </div>
        )}

        {/* Books Grid */}
        {!authLoading && !loading && books.length > 0 && (
          <div className="relative">
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 ${
              !isAuthenticated ? 'pointer-events-none select-none' : ''
            }`}>
              {books.slice(0, 8).map((book, index) => (
                <div
                  key={book.id}
                  style={{ animationDelay: `${index * 90 + 120}ms` }}
                  className={`origin-top animate-fade-up transition-transform duration-300 sm:scale-[0.96] lg:scale-[0.94] hover:-translate-y-1 ${
                    !isAuthenticated && index >= 4 ? 'blur-sm' : ''
                  }`}
                >
                  <BookCard book={book} readOnly={!isAuthenticated} />
                </div>
              ))}
            </div>

            {/* Premium overlay for guests */}
            {!isAuthenticated && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(to bottom, rgba(15,27,47,0.92) 0%, rgba(15,27,47,0.55) 35%, rgba(15,27,47,0.1) 60%, transparent 100%)' }}>
                <div className="text-center px-6 -mt-24">
                  <div className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ borderColor: 'rgba(142,219,255,0.35)', background: 'rgba(142,219,255,0.08)', color: '#9fdfff' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#9fdfff' }} />
                    Members Only
                  </div>
                  <h3 className="text-xl font-bold text-white sm:text-2xl" style={{ fontFamily: '"Palatino Linotype", Georgia, serif' }}>
                    Unlock the full collection
                  </h3>
                  <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: 'rgba(180,200,240,0.65)' }}>
                    Sign in to browse all books, check availability, and start borrowing.
                  </p>
                  <div className="mt-5 flex items-center justify-center">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#1a1b1f] transition hover:-translate-y-0.5"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d4af37, #fbbf24)', boxShadow: '0 6px 20px rgba(212,175,55,0.35)' }}
                    >
                      Sign In
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!authLoading && !loading && books.length === 0 && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/12 bg-white/5 px-6 py-10 text-center shadow-[0_20px_36px_rgba(2,6,23,0.34)] backdrop-blur-xl">
            <h3 className="text-xl font-semibold text-white">
              {error ? 'Featured books are unavailable right now' : 'No featured books yet'}
            </h3>
            <p className="mt-2 text-sm text-white/70">
              {error
                ? error
                : 'Add books to the catalog to populate this section.'}
            </p>
          </div>
        )}


        {/* View All Button */}
        {!authLoading && !loading && (
          <div className="text-center mt-12 animate-fade-up delay-300">
            <Link
              href="/books"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-full text-[#1a1b1f] bg-amber-500 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-400 shadow-soft"
            >
              View All Books
              <svg className="ml-4 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
