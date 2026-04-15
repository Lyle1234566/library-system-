'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Book, booksApi, resolveMediaUrl } from '@/lib/api';
import { canBorrowAsPatron } from '@/lib/roles';

interface BookCardProps {
  book: Book;
}

export default function BookCard({ book }: BookCardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [borrowState, setBorrowState] = useState<{
    submitting: boolean;
    error: string | null;
    message: string | null;
  }>({ submitting: false, error: null, message: null });

  const [localBook, setLocalBook] = useState<Book>(book);

  const coverUrl = resolveMediaUrl(localBook.cover_image);
  const bookHref = `/books/${localBook.id}`;

  const categoryNames = localBook.categories?.map((c) => c.name).filter(Boolean) ?? [];
  const categoryLabel = categoryNames.length
    ? `${categoryNames[0]}${categoryNames.length > 1 ? ` +${categoryNames.length - 1}` : ''}`
    : localBook.genre || 'Uncategorized';
  const categoryChipLabel = categoryLabel.toUpperCase();

  const averageRating = localBook.average_rating || 0;
  const reviewCount = localBook.review_count || 0;
  const renderStars = (rating: number) => {
    return '\u2605'.repeat(Math.round(rating)) + '\u2606'.repeat(5 - Math.round(rating));
  };

  const isBorrowedByUser = Boolean(localBook.is_borrowed_by_user);
  const hasPendingRequest = Boolean(localBook.has_pending_borrow_request);
  const isTeacher = user?.role === 'TEACHER';
  const canUseBorrowFlow = canBorrowAsPatron(user);
  const isStudentBorrower = canUseBorrowFlow && !isTeacher;

  const canBorrow = localBook.available && !isBorrowedByUser && !hasPendingRequest;
  const isDisabled =
    borrowState.submitting || authLoading || !canBorrow || (isAuthenticated && !canUseBorrowFlow);

  let buttonLabel = 'Borrow Book';
  if (borrowState.submitting) buttonLabel = 'Requesting...';
  else if (!localBook.available) buttonLabel = 'Not Available';
  else if (isBorrowedByUser) buttonLabel = 'Borrowed';
  else if (hasPendingRequest) buttonLabel = 'Pending';
  else if (isAuthenticated && isStudentBorrower) buttonLabel = 'Open Borrow Form';
  else if (isAuthenticated && !canUseBorrowFlow) buttonLabel = 'Students/Teachers Only';
  else if (!isAuthenticated) buttonLabel = 'Sign in to Borrow';
  const availabilityLabel = localBook.available ? 'Available' : 'Borrowed';

  const totalCopies = localBook.copies_total ?? localBook.copies_available ?? 0;
  const availableCopies = localBook.copies_available ?? 0;
  const publishedYearValue = localBook.published_date
    ? new Date(localBook.published_date).getFullYear()
    : undefined;
  const publishedYear =
    typeof publishedYearValue === 'number' && !Number.isNaN(publishedYearValue)
      ? publishedYearValue
      : '-';

  const handleBorrow = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (borrowState.submitting || !canBorrow) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(bookHref)}`);
      return;
    }

    if (!canUseBorrowFlow) {
      setBorrowState({
        submitting: false,
        error: 'Only students and teachers can borrow books.',
        message: null,
      });
      return;
    }

    if (isStudentBorrower) {
      router.push(bookHref);
      return;
    }

    setBorrowState({ submitting: true, error: null, message: null });

    const { data, error } = await booksApi.requestBorrow(
      localBook.id,
      isTeacher ? { reportingFrequency: 'MONTHLY' } : undefined,
    );

    if (error || !data) {
      setBorrowState({
        submitting: false,
        error: error ?? 'Failed to submit request.',
        message: null,
      });
      return;
    }

    setBorrowState({
      submitting: false,
      error: null,
      message: data.message ?? 'Request submitted successfully.',
    });

    if (data.book) {
      setLocalBook((prev) => ({ ...prev, ...data.book }));
    } else {
      setLocalBook((prev) => ({ ...prev, has_pending_borrow_request: true }));
    }
  };

  const handleCardClick = () => router.push(bookHref);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className="group relative mx-auto flex h-full w-full max-w-full cursor-pointer sm:max-w-[210px]"
    >
      <div className="absolute inset-0 overflow-hidden rounded-[18px]">
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div
            className="absolute h-[300px] w-[120px] animate-[rotation_3s_linear_infinite] [animation-play-state:paused] group-hover:[animation-play-state:running]"
            style={{
              background: 'linear-gradient(90deg, #ff2288, transparent)',
              transform: 'rotate(0deg) translateY(50%)',
            }}
          />
          <div
            className="absolute h-[300px] w-[120px] animate-[rotation-reverse_3s_linear_infinite] [animation-play-state:paused] group-hover:[animation-play-state:running]"
            style={{
              background: 'linear-gradient(90deg, transparent, #2268ff)',
              transform: 'rotate(0deg) translateY(-50%)',
            }}
          />
        </div>
      </div>

      <div className="absolute inset-0 z-10 rounded-[18px] bg-[#171717]/20 backdrop-blur-[50px] transition-opacity duration-500 group-hover:opacity-0" />

      <div className="relative z-20 flex h-full w-full flex-col rounded-[18px] border border-[#d8dce3] bg-[#171717] p-2 text-white shadow-[0_0_3px_1px_rgba(0,0,0,0.53)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1324]">
        <div className="absolute inset-0 rounded-[18px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute left-1/2 top-1/2 h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 bg-white/30 blur-[50px]" />
        </div>

        <div className="relative flex h-full flex-col">
          <div className="relative overflow-hidden rounded-[13px] border border-white/20 bg-[#0a1221]">
            <div className="relative aspect-[3/4]">
              <div className="absolute -bottom-3 left-1/2 h-4 w-[72%] -translate-x-1/2 rounded-full bg-slate-400/25 blur-lg" />
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={localBook.title}
                  fill
                  sizes="(min-width: 1280px) 14vw, (min-width: 1024px) 19vw, (min-width: 640px) 28vw, 88vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
                  <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.4}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.32em]">
                    No Cover
                  </span>
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
                <span
                  title={categoryLabel}
                  className="inline-flex max-w-[62%] items-center rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm"
                >
                  <span className="truncate">{categoryChipLabel}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] backdrop-blur-sm ${
                    localBook.available
                      ? 'border-emerald-300/40 bg-emerald-500/25 text-emerald-100'
                      : 'border-amber-300/40 bg-amber-500/25 text-amber-100'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      localBook.available ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {availabilityLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 px-0.5">
            <h3 className="line-clamp-1 text-[15px] font-semibold leading-tight text-white">
              {localBook.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-white/70">{localBook.author}</p>
            {averageRating > 0 && (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs text-amber-400">{renderStars(averageRating)}</span>
                <span className="text-xs text-white/50">
                  ({averageRating.toFixed(1)}) · {reviewCount} review
                  {reviewCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between px-0.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-white/60">
              <BookOpen className="h-3.5 w-3.5" />
              <span>
                {availableCopies}/{totalCopies} copies
              </span>
            </span>
            <span className="font-medium text-amber-300">{publishedYear}</span>
          </div>

          <div className="mt-2 rounded-[11px] border border-white/20 bg-white/5 p-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/50">
              <span>ISBN</span>
              <span className="max-w-[56%] truncate text-right text-white/80">
                {localBook.isbn || 'N/A'}
              </span>
            </div>
          </div>

          <div className="mt-auto pt-2.5">
            <button
              onClick={handleBorrow}
              disabled={isDisabled}
              className={`
                inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]
                transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
                focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1324]
                disabled:cursor-not-allowed disabled:opacity-60
                ${
                  isDisabled
                    ? 'border border-white/20 bg-white/10 text-white/40'
                    : 'bg-amber-500 text-[#1a1b1f] hover:bg-amber-400'
                }
              `}
            >
              {borrowState.submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {buttonLabel}
            </button>

            {(borrowState.error || borrowState.message) && (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs ${
                  borrowState.error
                    ? 'border-rose-300/30 bg-rose-500/15 text-rose-100'
                    : 'border-emerald-300/30 bg-emerald-500/15 text-emerald-100'
                }`}
              >
                {borrowState.error || borrowState.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
