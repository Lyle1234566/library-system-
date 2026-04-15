'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, BookOpen, Search, Sparkles } from 'lucide-react';
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
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white/8 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-white/8 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
            <p className="text-white/76 text-xs font-semibold uppercase tracking-[0.35em]">
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
        <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,#050d1d_0%,#0a1322_36%,#101726_70%,#07111d_100%)]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.11),transparent_30%),radial-gradient(circle_at_82%_28%,rgba(226,232,240,0.10),transparent_28%),radial-gradient(circle_at_52%_120%,rgba(148,163,184,0.08),transparent_36%)]" />
            <div className="absolute -left-28 top-[-5rem] h-[26rem] w-[26rem] rounded-full bg-white/8 blur-3xl" />
            <div className="absolute right-[-6rem] top-10 h-[24rem] w-[24rem] rounded-full bg-slate-200/8 blur-3xl" />
            <div className="absolute left-1/2 top-0 h-48 w-[38rem] -translate-x-1/2 rounded-full bg-white/6 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_100%)]" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:gap-14">
              <div className="max-w-2xl space-y-7 animate-fade-up">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                  <span className="h-2 w-2 rounded-full bg-white/80 shadow-[0_0_14px_rgba(255,255,255,0.45)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/78">
                    Browse Collection
                  </p>
                </div>
                <div className="space-y-5">
                  <h1 className="max-w-3xl text-balance text-[3.2rem] font-bold leading-[0.9] tracking-[-0.06em] text-transparent sm:text-[4.4rem] lg:text-[5.15rem] bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text">
                    Find your next read
                  </h1>
                  <p className="max-w-xl text-[1.02rem] leading-8 text-slate-200/74 sm:text-[1.08rem]">
                    Search by title, author, category, or ISBN and move through the collection with
                    the speed and clarity of a modern digital shelf.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="group rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-4 shadow-[0_20px_40px_rgba(2,6,23,0.32)] backdrop-blur-2xl transition duration-300 hover:border-white/16 hover:shadow-[0_24px_50px_rgba(255,255,255,0.06)]">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white shadow-[0_12px_26px_rgba(255,255,255,0.05)]">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/58">
                          Total Titles
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                          <p className="text-3xl font-semibold tracking-[-0.04em] text-white">
                            {loading ? '...' : books.length}
                          </p>
                          <span className="pb-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/54">
                            books
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="group rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-4 shadow-[0_20px_40px_rgba(2,6,23,0.32)] backdrop-blur-2xl transition duration-300 hover:border-white/16 hover:shadow-[0_24px_50px_rgba(255,255,255,0.06)]">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white shadow-[0_12px_26px_rgba(255,255,255,0.05)]">
                        <BadgeCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/58">
                          Available
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                          <p className="text-3xl font-semibold tracking-[-0.04em] text-white">
                            {loading ? '...' : availableCount}
                          </p>
                          <span className="pb-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/54">
                            ready now
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <form onSubmit={(event) => event.preventDefault()} className="w-full lg:pt-2">
                <div className="group relative overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.04)_100%)] p-5 shadow-[0_28px_70px_rgba(2,6,23,0.42)] backdrop-blur-2xl transition duration-500 hover:border-white/16 hover:shadow-[0_32px_80px_rgba(255,255,255,0.06)] sm:p-6">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.12),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(148,163,184,0.08),transparent_34%)] opacity-90" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label className="text-sm font-semibold tracking-[0.01em] text-white/88">
                          Search the catalog
                        </label>
                        <p className="mt-1 text-sm leading-6 text-slate-300/64">
                          Narrow titles instantly with smart search across metadata fields.
                        </p>
                      </div>
                      <span className="rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80 shadow-[0_10px_24px_rgba(255,255,255,0.04)]">
                        Live search
                      </span>
                    </div>
                    <div className="mt-5 rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(4,11,24,0.78),rgba(9,19,35,0.88))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.22)] transition duration-300 hover:border-white/18 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05)] focus-within:border-white/28 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_0_8px_rgba(255,255,255,0.05)]">
                      <div className="flex items-center gap-3 rounded-[22px] bg-white/[0.03] px-4 py-4 sm:px-5">
                        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white shadow-[0_10px_24px_rgba(255,255,255,0.05)]">
                          <Search className="h-5 w-5" />
                        </div>
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search by title, author, category, or ISBN..."
                          className="w-full min-w-0 bg-transparent text-[1rem] text-white placeholder:text-slate-300/42 focus:outline-none sm:text-[1.02rem]"
                          type="search"
                          inputMode="search"
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-2 text-slate-200/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.35)]" />
                        <span className="font-semibold uppercase tracking-[0.16em]">
                          {loading ? '...' : filteredBooks.length} result{filteredBooks.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      {selectedCategoryName && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-2 text-white/88 shadow-[0_10px_24px_rgba(255,255,255,0.04)]">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          <span className="font-semibold">Category: {selectedCategoryName}</span>
                        </span>
                      )}
                      {query.trim() ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-2 text-slate-200/80">
                          <Search className="h-3.5 w-3.5 text-white/70" />
                          <span className="font-medium">Search: &quot;{query.trim()}&quot;</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-2 text-white/82 shadow-[0_10px_24px_rgba(255,255,255,0.04)]">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="font-semibold">Tip: Use ISBN for exact match</span>
                        </span>
                      )}
                    </div>
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
                          ? 'border-white/18 bg-white/12 text-white'
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
                            ? 'border-white/18 bg-white/12 text-white'
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
