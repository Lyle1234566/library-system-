'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { booksApi, Book } from '@/lib/api';
import BookCard from './BookCard';
import CatalogAccessPrompt from './CatalogAccessPrompt';

export default function FeaturedBooks() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    const fetchBooks = async () => {
      setLoading(true);
      const response = await booksApi.getAll();
      
      if (response.error) {
        setError(response.error);
        // Use sample data if API is not available
        setBooks([
          {
            id: 1,
            title: 'The Great Gatsby',
            author: 'F. Scott Fitzgerald',
            isbn: '9780743273565',
            published_date: '1925-04-10',
            genre: 'Classic',
            cover_image: null,
            cover_back: null,
            copies_total: 3,
            copies_available: 3,
            available: true,
          },
          {
            id: 2,
            title: 'To Kill a Mockingbird',
            author: 'Harper Lee',
            isbn: '9780061120084',
            published_date: '1960-07-11',
            genre: 'Fiction',
            cover_image: null,
            cover_back: null,
            copies_total: 2,
            copies_available: 2,
            available: true,
          },
          {
            id: 3,
            title: '1984',
            author: 'George Orwell',
            isbn: '9780451524935',
            published_date: '1949-06-08',
            genre: 'Dystopian',
            cover_image: null,
            cover_back: null,
            copies_total: 3,
            copies_available: 0,
            available: false,
          },
          {
            id: 4,
            title: 'Pride and Prejudice',
            author: 'Jane Austen',
            isbn: '9780141439518',
            published_date: '1813-01-28',
            genre: 'Romance',
            cover_image: null,
            cover_back: null,
            copies_total: 4,
            copies_available: 4,
            available: true,
          },
        ]);
      } else if (response.data) {
        setBooks(response.data.slice(0, 4)); // Show only first 4 books
      }
      
      setLoading(false);
    };

    fetchBooks();
  }, [authLoading, isAuthenticated]);

  return (
    <section className="relative py-24 bg-[#0f1b2f]">
      <div className="absolute inset-0">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl animate-float-slow" />
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

        {!authLoading && !isAuthenticated && (
          <div className="animate-fade-up">
            <CatalogAccessPrompt
              loginHref="/login?redirect=%2Fbooks"
              title="Sign in to unlock the featured collection"
              description="Featured titles stay hidden until a library account is signed in. Continue to browse real book availability and borrowing options."
              eyebrow="Members Only"
              compact
            />
          </div>
        )}

        {/* Loading State */}
        {isAuthenticated && loading && (
          <div className="flex justify-center items-center py-12 animate-fade-up">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]"></div>
          </div>
        )}

        {/* Error State with Fallback Data */}
        {isAuthenticated && error && !loading && (
          <div className="text-center mb-8 animate-fade-up">
            <p className="text-[color:var(--accent-strong)] text-sm">
              Showing sample books (Backend not connected)
            </p>
          </div>
        )}

        {/* Books Grid */}
        {isAuthenticated && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {books.map((book, index) => (
              <div
                key={book.id}
                style={{ animationDelay: `${index * 90 + 120}ms` }}
                className="animate-fade-up transition-transform duration-300 hover:-translate-y-1"
              >
                <BookCard book={book} />
              </div>
            ))}
          </div>
        )}

        {/* View All Button */}
        {isAuthenticated && (
          <div className="text-center mt-12 animate-fade-up delay-300">
            <Link
              href="/books"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-full text-[#1a1b1f] bg-amber-500 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-400 shadow-soft"
            >
              View All Books
              <svg
                className="ml-4 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
