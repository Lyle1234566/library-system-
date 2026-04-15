'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BookCard from '@/components/BookCard';
import CatalogAccessPrompt from '@/components/CatalogAccessPrompt';
import MovingObjectsLayer from '@/components/MovingObjectsLayer';
import { useAuth } from '@/contexts/AuthContext';
import { booksApi, Book, Category } from '@/lib/api';

const fallbackBooks: Book[] = [
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
    is_borrowed_by_user: false,
    has_pending_borrow_request: false,
    has_pending_return_request: false,
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
    is_borrowed_by_user: false,
    has_pending_borrow_request: false,
    has_pending_return_request: false,
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
    is_borrowed_by_user: false,
    has_pending_borrow_request: false,
    has_pending_return_request: false,
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
    is_borrowed_by_user: false,
    has_pending_borrow_request: false,
    has_pending_return_request: false,
  },
];

function BooksPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const searchValue = searchParams.get('search') ?? '';
  const [query, setQuery] = useState(searchValue);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    let isActive = true;

    const fetchBooks = async () => {
      setLoading(true);
      const response = await booksApi.getAll();

      if (!isActive) {
        return;
      }

      if (response.error || !response.data) {
        setError(response.error ?? 'Unable to load books');
        setBooks(fallbackBooks);
      } else {
        setError(null);
        setBooks(response.data);
      }

      setLoading(false);
    };

    fetchBooks();

    return () => {
      isActive = false;
    };
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    let isActive = true;

    const fetchCategories = async () => {
      setCategoriesLoading(true);
      const response = await booksApi.getCategories();

      if (!isActive) {
        return;
      }

      if (response.error || !response.data) {
        setCategoriesError(response.error ?? 'Unable to load categories');
        setCategories([]);
      } else {
        setCategoriesError(null);
        setCategories([...response.data].sort((a, b) => a.name.localeCompare(b.name)));
      }

      setCategoriesLoading(false);
    };

    fetchCategories();

    return () => {
      isActive = false;
    };
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (categories.length > 0) return;
    const uniqueCategories = new Map<number, Category>();
    books.forEach((book) => {
      (book.categories ?? []).forEach((category) => {
        uniqueCategories.set(category.id, category);
      });
    });
    if (uniqueCategories.size > 0) {
      setCategories(
        Array.from(uniqueCategories.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
      setCategoriesError(null);
    }
  }, [books, categories.length]);

  const availableCount = useMemo(
    () => books.filter((book) => book.available).length,
    [books]
  );

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find((category) => category.id === selectedCategoryId)?.name ?? null;
  }, [categories, selectedCategoryId]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((book) => {
      if (
        selectedCategoryId &&
        !(book.categories ?? []).some((category) => category.id === selectedCategoryId)
      ) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const categoryText = (book.categories ?? [])
        .map((category) => category.name)
        .join(' ');
      return [book.title, book.author, book.genre, book.isbn, categoryText].some((value) =>
        value.toLowerCase().includes(normalized)
      );
    });
  }, [books, query, selectedCategoryId]);

  if (authLoading) {
    return (
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-r-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="relative overflow-hidden pt-16">
          <MovingObjectsLayer />
          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0a1221] via-[#0e1629] to-[#0b1324]">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sky-600/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-amber-500/12 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
              <p className="text-sky-200/90 text-xs font-semibold uppercase tracking-[0.35em]">
                Private Catalog
              </p>
              <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">
                Sign in to browse the book collection
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-white/72">
                Library titles, availability, and borrowing actions are visible only to signed-in accounts.
              </p>
            </div>
          </section>

          <section className="relative py-16 sm:py-20">
            <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <CatalogAccessPrompt loginHref="/login?redirect=%2Fbooks" />
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="theme-login min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="relative overflow-hidden pt-16">
        <MovingObjectsLayer />
        <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0a1221] via-[#0e1629] to-[#0b1324]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sky-600/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-amber-500/12 blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-sky-950/30 via-transparent to-amber-950/20" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5 animate-fade-up">
                <p className="text-sky-200/90 text-xs font-semibold uppercase tracking-[0.35em]">
                  Browse Collection
                </p>
                <h1 className="text-4xl sm:text-5xl font-semibold text-balance text-white">
                  Find your next read
                </h1>
                <p className="text-white/75 text-lg max-w-xl">
                  Search by title, author, category, or ISBN and explore every shelf in the
                  collection.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  <span className="rounded-full border border-white/16 bg-white/6 px-4 py-1.5 backdrop-blur-sm">
                    Total {loading ? '...' : books.length} titles
                  </span>
                  <span className="rounded-full border border-white/16 bg-white/6 px-4 py-1.5 backdrop-blur-sm">
                    Available {loading ? '...' : availableCount}
                  </span>
                </div>
              </div>
              <form onSubmit={(event) => event.preventDefault()} className="w-full">
                <div className="rounded-[28px] border border-white/12 bg-white/6 p-4 sm:p-5 md:p-6 shadow-[0_18px_36px_rgba(2,6,23,0.45)] backdrop-blur-xl animate-fade-up delay-100">
                  <label className="text-sm font-semibold text-white/80">Search the catalog</label>
                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 sm:py-3 focus-within:border-sky-300/60 focus-within:ring-2 focus-within:ring-sky-300/25">
                    <svg
                      className="w-5 h-5 text-white/55 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by title, author, or category..."
                      className="w-full min-w-0 bg-transparent text-white placeholder-white/50 focus:outline-none text-base"
                      type="search"
                      inputMode="search"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">
                      {loading ? '...' : filteredBooks.length} result{
                        filteredBooks.length === 1 ? '' : 's'
                      }
                    </span>
                    {selectedCategoryName && (
                      <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-sky-100">
                        Category: {selectedCategoryName}
                      </span>
                    )}
                    {query.trim() && (
                      <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">
                        Search: &quot;{query.trim()}&quot;
                      </span>
                    )}
                    {!query.trim() && (
                      <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">
                        Tip: Use ISBN for exact match
                      </span>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="relative py-16 sm:py-20">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.08),transparent_38%)]" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_36px_rgba(2,6,23,0.35)] backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Categories
                  </p>
                  <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-white">
                    Browse by category
                  </h2>
                  <p className="mt-2 text-sm text-white/70">
                    Filter the catalog by category to find the right shelf faster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                >
                  Clear filter
                </button>
              </div>

              <div className="mt-5">
                {categoriesLoading && (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <div className="h-4 w-4 animate-spin rounded-full border border-white/40 border-t-transparent" />
                    Loading categories...
                  </div>
                )}
                {!categoriesLoading && categoriesError && (
                  <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                    {categoriesError}
                  </div>
                )}
                {!categoriesLoading && categories.length === 0 && !categoriesError && (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-sm text-white/60">
                    No categories available yet.
                  </div>
                )}
                {!categoriesLoading && categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(null)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                        selectedCategoryId === null
                          ? 'border-sky-300/40 bg-sky-500/20 text-sky-100'
                          : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      All categories
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                          selectedCategoryId === category.id
                            ? 'border-sky-300/40 bg-sky-500/20 text-sky-100'
                            : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <span>{category.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Library Catalog
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white">All books</h2>
                <p className="text-sm text-white/70">
                  Browse the full catalog and request a borrow in seconds.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span className="rounded-full border border-white/16 bg-white/6 px-3 py-1">
                  {loading ? '...' : filteredBooks.length} result{
                    filteredBooks.length === 1 ? '' : 's'
                  }
                </span>
                {query.trim() && (
                  <span className="rounded-full border border-white/16 bg-white/6 px-3 py-1">
                    Search: &quot;{query.trim()}&quot;
                  </span>
                )}
              </div>
            </div>

            {loading && (
              <div className="flex justify-center items-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent"></div>
              </div>
            )}

            {error && !loading && (
              <div className="mb-8 flex justify-center">
                <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Showing sample books (Backend not connected)
                </span>
              </div>
            )}

            {!loading && filteredBooks.length === 0 && (
              <div className="rounded-3xl border border-white/12 bg-white/6 px-6 py-14 text-center shadow-[0_20px_36px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                <h2 className="text-2xl font-semibold text-white">
                  No books matched your search
                </h2>
                <p className="text-white/70 mt-2">
                  Try a different title, author, or category.
                </p>
              </div>
            )}

            {!loading && filteredBooks.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7 animate-fade-up delay-100">
                {filteredBooks.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function BooksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0b1324] text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-r-transparent" />
        </div>
      }
    >
      <BooksPageContent />
    </Suspense>
  );
}
