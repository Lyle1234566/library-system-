'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDown, Star } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BorrowSlip from '@/components/BorrowSlip';
import CatalogAccessPrompt from '@/components/CatalogAccessPrompt';
import BookCard from '@/components/BookCard';
import { useAuth } from '@/contexts/AuthContext';
import {
  booksApi,
  Book,
  BookRecommendation,
  BookReview,
  ReportingFrequency,
  resolveMediaUrl,
} from '@/lib/api';
import { canBorrowAsPatron } from '@/lib/roles';

function formatDate(dateString?: string) {
  if (!dateString) {
    return 'Unknown';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type RequestStatusState = {
  bookId: number;
  submitting: boolean;
  error: string | null;
  message: string | null;
};

type CoverState = {
  bookId: number;
  side: 'front' | 'back';
};

function StaticBorrowField({
  value,
  placeholder = 'Not provided',
}: {
  value?: string | null;
  placeholder?: string;
}) {
  const displayValue = value?.trim() ? value : placeholder;
  const isPlaceholder = displayValue === placeholder;

  return (
    <div className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm">
      <span className={isPlaceholder ? 'text-white/45' : 'text-white/80'}>{displayValue}</span>
    </div>
  );
}

function RatingStars({ rating, className = 'h-4 w-4' }: { rating: number; className?: string }) {
  const filledStars = Math.round(Math.max(0, Math.min(5, rating)));

  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`${className} ${
            index < filledStars ? 'fill-[#9fdfff] text-[#9fdfff]' : 'text-white/20'
          }`}
        />
      ))}
    </div>
  );
}

export default function BookDetailsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const bookId = useMemo(() => Number(idParam), [idParam]);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverState, setCoverState] = useState<CoverState | null>(null);
  const [borrowStatus, setBorrowStatus] = useState<RequestStatusState | null>(null);
  const [returnStatus, setReturnStatus] = useState<RequestStatusState | null>(null);
  const [reservationStatus, setReservationStatus] = useState<RequestStatusState | null>(null);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [studentBorrowDurationDays, setStudentBorrowDurationDays] = useState<7 | 14>(14);
  const [studentBorrowFormError, setStudentBorrowFormError] = useState<string | null>(null);
  const [teacherReportingFrequency, setTeacherReportingFrequency] = useState<
    Exclude<ReportingFrequency, 'NONE'>
  >('MONTHLY');
  const [todayReference] = useState(() => new Date());
  const [studentBorrowForm, setStudentBorrowForm] = useState({
    full_name: '',
    student_id: '',
    course_program: '',
    year_level: '',
    email: '',
    call_number: '',
    quantity: '1',
    return_date: '',
    agreed_to_policies: false,
  });

  // Review state
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, reviewText: '' });
  const [editingReview, setEditingReview] = useState<number | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewsExpanded, setReviewsExpanded] = useState(true);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [showBorrowSlip, setShowBorrowSlip] = useState(false);
  const [borrowSlipData, setBorrowSlipData] = useState<{
    studentName: string;
    studentId: string;
    courseYear: string;
    bookTitle: string;
    author: string;
    callNumber: string;
    dateBorrowed: string;
    dueDate: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    let isActive = true;

    const fetchBook = async () => {
      if (!idParam || Number.isNaN(bookId)) {
        setError('Invalid book ID');
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await booksApi.getById(bookId);

      if (!isActive) {
        return;
      }

      if (response.error || !response.data) {
        setError(response.error ?? 'Unable to load book');
        setBook(null);
      } else {
        setError(null);
        setBook(response.data);
      }

      setLoading(false);
    };

    fetchBook();

    return () => {
      isActive = false;
    };
  }, [authLoading, bookId, idParam, isAuthenticated]);

  // Fetch reviews when book is loaded
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchReviews = async () => {
      if (!bookId || Number.isNaN(bookId)) return;
      setReviewsLoading(true);
      const response = await booksApi.getBookReviews(bookId);
      if (response.data) {
        setReviews(response.data);
      }
      setReviewsLoading(false);
    };
    fetchReviews();
  }, [authLoading, bookId, isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchRecommendations = async () => {
      if (!bookId || Number.isNaN(bookId)) {
        return;
      }

      setRecommendationsLoading(true);
      setRecommendationsError(null);
      const response = await booksApi.getSimilarBooks(bookId);
      if (response.error) {
        setRecommendationsError(response.error);
        setRecommendations([]);
      } else {
        setRecommendations(response.data ?? []);
      }
      setRecommendationsLoading(false);
    };

    void fetchRecommendations();
  }, [authLoading, bookId, isAuthenticated]);

  // Get user's existing review
  const userReview = reviews.find((r) => user && r.user.id === user.id);

  // Handle review submission
  const handleSubmitReview = async () => {
    if (!bookId || reviewForm.rating === 0) return;
    setReviewSubmitting(true);
    setReviewError(null);

    let response;
    if (editingReview && userReview) {
      response = await booksApi.updateReview(bookId, userReview.id, reviewForm.rating, reviewForm.reviewText);
    } else {
      response = await booksApi.createReview(bookId, reviewForm.rating, reviewForm.reviewText);
    }

    if (response.error) {
      setReviewError(response.error);
    } else {
      // Refresh reviews
      const reviewsResponse = await booksApi.getBookReviews(bookId);
      if (reviewsResponse.data) {
        setReviews(reviewsResponse.data);
      }
      // Refresh book to get updated average rating
      const bookResponse = await booksApi.getById(bookId);
      if (bookResponse.data) {
        setBook(bookResponse.data);
      }
      setShowReviewForm(false);
      setReviewForm({ rating: 0, reviewText: '' });
      setEditingReview(null);
    }
    setReviewSubmitting(false);
  };

  // Handle delete review
  const handleDeleteReview = async () => {
    if (!bookId || !userReview) return;
    if (!confirm('Are you sure you want to delete your review?')) return;

    const response = await booksApi.deleteReview(bookId, userReview.id);
    if (!response.error) {
      // Refresh reviews
      const reviewsResponse = await booksApi.getBookReviews(bookId);
      if (reviewsResponse.data) {
        setReviews(reviewsResponse.data);
      }
      // Refresh book to get updated average rating
      const bookResponse = await booksApi.getById(bookId);
      if (bookResponse.data) {
        setBook(bookResponse.data);
      }
    }
  };

  // Start editing existing review
  const startEditReview = () => {
    if (userReview) {
      setReviewForm({ rating: userReview.rating, reviewText: userReview.review_text });
      setEditingReview(userReview.id);
      setReviewsExpanded(true);
      setShowReviewForm(true);
    }
  };

  // Cancel review form
  const cancelReviewForm = () => {
    setShowReviewForm(false);
    setReviewForm({ rating: 0, reviewText: '' });
    setEditingReview(null);
    setReviewError(null);
  };

  const coverUrl = resolveMediaUrl(book?.cover_image);
  const coverBackUrl = resolveMediaUrl(book?.cover_back);
  const hasBackCover = Boolean(coverBackUrl);
  const categoryNames = book?.categories?.map((category) => category.name).filter(Boolean) ?? [];
  const displayCategories =
    categoryNames.length > 0 ? categoryNames : book?.genre ? [book.genre] : ['Uncategorized'];
  const categoriesLabel = displayCategories.join(', ');
  const featuredCategory = displayCategories[0];
  const remainingCategoryCount = Math.max(displayCategories.length - 1, 0);
  const availableCopies = book?.copies_available ?? 0;
  const totalCopies = book?.copies_total ?? availableCopies;
  const availabilityPercent =
    totalCopies > 0 ? Math.max(0, Math.min(100, Math.round((availableCopies / totalCopies) * 100))) : 0;
  const averageRating = book?.average_rating ?? 0;
  const reviewCount = book?.review_count ?? reviews.length;
  const hasRatings = averageRating > 0 && reviewCount > 0;
  const reviewCountLabel = `${reviewCount} review${reviewCount === 1 ? '' : 's'}`;
  const publishedLabel = book ? formatDate(book.published_date) : 'Unknown';
  const languageLabel = book?.language?.trim() ? book.language : 'Not specified';
  const gradeLevelLabel = book?.grade_level?.trim() ? book.grade_level : 'General';
  const isbnLabel = book?.isbn?.trim() ? book.isbn : 'Not provided';
  const resolvedBookId = book?.id ?? (Number.isNaN(bookId) ? -1 : bookId);
  const coverSide = coverState?.bookId === resolvedBookId ? coverState.side : 'front';
  const effectiveCoverSide = hasBackCover ? coverSide : 'front';
  const activeBorrowStatus = borrowStatus?.bookId === resolvedBookId ? borrowStatus : null;
  const borrowSubmitting = activeBorrowStatus?.submitting ?? false;
  const borrowError = activeBorrowStatus?.error ?? null;
  const borrowMessage = activeBorrowStatus?.message ?? null;
  const activeReturnStatus = returnStatus?.bookId === resolvedBookId ? returnStatus : null;
  const returnSubmitting = activeReturnStatus?.submitting ?? false;
  const returnError = activeReturnStatus?.error ?? null;
  const returnMessage = activeReturnStatus?.message ?? null;
  const activeReservationStatus = reservationStatus?.bookId === resolvedBookId ? reservationStatus : null;
  const reservationSubmitting = activeReservationStatus?.submitting ?? false;
  const reservationError = activeReservationStatus?.error ?? null;
  const reservationMessage = activeReservationStatus?.message ?? null;
  const borrowedDateInput = useMemo(
    () => formatDateInput(todayReference),
    [todayReference]
  );
  const dueDateInput = useMemo(() => {
    const dueDate = new Date(todayReference);
    dueDate.setDate(dueDate.getDate() + studentBorrowDurationDays);
    return formatDateInput(dueDate);
  }, [studentBorrowDurationDays, todayReference]);

  const handleBorrowRequest = async () => {
    if (!book || borrowSubmitting) {
      return;
    }

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/books/${book.id}`)}`);
      return;
    }

    if (!canBorrowAsPatron(user)) {
      setBorrowStatus({
        bookId: book.id,
        submitting: false,
        error: 'Only students and teachers can request to borrow books.',
        message: null,
      });
      return;
    }

    if (!book.available) {
      setBorrowStatus({
        bookId: book.id,
        submitting: false,
        error: 'This book is currently not available.',
        message: null,
      });
      return;
    }

    if (hasPendingRequest) {
      setBorrowStatus({
        bookId: book.id,
        submitting: false,
        error: 'You already have a pending request for this book.',
        message: null,
      });
      return;
    }

    if (isBorrowedByUser) {
      setBorrowStatus({
        bookId: book.id,
        submitting: false,
        error: 'You have already borrowed this book.',
        message: null,
      });
      return;
    }

    if (user?.role === 'TEACHER') {
      setShowBorrowModal(true);
      return;
    }

    setStudentBorrowForm((prev) => ({
      ...prev,
      full_name: user?.full_name ?? prev.full_name,
      student_id: user?.student_id ?? prev.student_id,
      email: user?.email ?? prev.email,
      quantity: prev.quantity || '1',
      agreed_to_policies: false,
    }));
    setStudentBorrowDurationDays(14);
    setStudentBorrowFormError(null);
    setShowBorrowModal(true);
  };

  const confirmBorrowRequest = async () => {
    if (!book || borrowSubmitting) {
      return;
    }

    const requestBookId = book.id;
    setBorrowStatus({
      bookId: requestBookId,
      submitting: false,
      error: null,
      message: null,
    });

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/books/${book.id}`)}`);
      return;
    }

    if (!canBorrowAsPatron(user)) {
      setBorrowStatus({
        bookId: requestBookId,
        submitting: false,
        error: 'Only students and teachers can request to borrow books.',
        message: null,
      });
      return;
    }

    if (!isTeacher && !studentBorrowForm.agreed_to_policies) {
      setStudentBorrowFormError('Please check the agreement and policies before confirming your request.');
      return;
    }

    setShowBorrowModal(false);
    setBorrowStatus({
      bookId: requestBookId,
      submitting: true,
      error: null,
      message: null,
    });
    const response = await booksApi.requestBorrow(
      book.id,
      user?.role === 'TEACHER'
        ? { reportingFrequency: teacherReportingFrequency }
        : { borrowDays: studentBorrowDurationDays },
    );

    if (response.error || !response.data) {
      setBorrowStatus({
        bookId: requestBookId,
        submitting: false,
        error: response.error ?? 'Unable to submit borrow request.',
        message: null,
      });
      return;
    }

    setBorrowStatus({
      bookId: requestBookId,
      submitting: false,
      error: null,
      message:
        user?.role === 'TEACHER'
          ? `Teacher borrow request submitted with ${teacherReportingFrequency.toLowerCase()} reporting. ${response.data.message ?? ''}`
          : `Borrow request submitted. ${response.data.message ?? ''}`,
    });
    if (response.data.book) {
      setBook(response.data.book);
    } else {
      setBook({
        ...book,
        has_pending_borrow_request: true,
      });
    }

    // Show borrow slip for student-type borrowers, including working students.
    if (isStudentBorrower) {
      const borrowDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + studentBorrowDurationDays);
      
      setBorrowSlipData({
        studentName: studentBorrowForm.full_name || user?.full_name || '',
        studentId: studentBorrowForm.student_id || user?.student_id || '',
        courseYear: studentBorrowForm.course_program && studentBorrowForm.year_level 
          ? `${studentBorrowForm.course_program} - ${studentBorrowForm.year_level}`
          : '',
        bookTitle: book.title,
        author: book.author || 'Unknown Author',
        callNumber: studentBorrowForm.call_number || 'N/A',
        dateBorrowed: borrowDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        dueDate: dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      });
      setShowBorrowSlip(true);
    }
  };

  const handleStudentBorrowFormChange = (
    field: keyof typeof studentBorrowForm,
    value: string | boolean
  ) => {
    setStudentBorrowFormError(null);
    setStudentBorrowForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReturnRequest = async () => {
    if (!book || returnSubmitting) {
      return;
    }

    const borrowedByUser = Boolean(book.is_borrowed_by_user);
    const pendingReturn = Boolean(book.has_pending_return_request);

    const requestBookId = book.id;
    setReturnStatus({
      bookId: requestBookId,
      submitting: false,
      error: null,
      message: null,
    });

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/books/${book.id}`)}`);
      return;
    }

    if (user?.role !== 'STUDENT' && user?.role !== 'TEACHER') {
      setReturnStatus({
        bookId: requestBookId,
        submitting: false,
        error: 'Only students and teachers can request to return books.',
        message: null,
      });
      return;
    }

    if (!borrowedByUser) {
      setReturnStatus({
        bookId: requestBookId,
        submitting: false,
        error: 'No active borrow found for this book.',
        message: null,
      });
      return;
    }

    if (pendingReturn) {
      setReturnStatus({
        bookId: requestBookId,
        submitting: false,
        error: 'Return request already pending.',
        message: null,
      });
      return;
    }

    setReturnStatus({
      bookId: requestBookId,
      submitting: true,
      error: null,
      message: null,
    });
    const response = await booksApi.requestReturn(book.id);

    if (response.error || !response.data) {
      setReturnStatus({
        bookId: requestBookId,
        submitting: false,
        error: response.error ?? 'Unable to submit return request.',
        message: null,
      });
      return;
    }

    setReturnStatus({
      bookId: requestBookId,
      submitting: false,
      error: null,
      message: response.data.message ?? 'Return request submitted.',
    });
    if (response.data.book) {
      setBook(response.data.book);
    } else {
      setBook({
        ...book,
        has_pending_return_request: true,
      });
    }
  };

  const handleReserveRequest = async () => {
    if (!book || reservationSubmitting) {
      return;
    }

    const requestBookId = book.id;
    setReservationStatus({
      bookId: requestBookId,
      submitting: false,
      error: null,
      message: null,
    });

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/books/${book.id}`)}`);
      return;
    }

    if (user?.role !== 'STUDENT' && user?.role !== 'TEACHER') {
      setReservationStatus({
        bookId: requestBookId,
        submitting: false,
        error: 'Only students and teachers can reserve books.',
        message: null,
      });
      return;
    }

    if (book.available) {
      setReservationStatus({
        bookId: requestBookId,
        submitting: false,
        error: 'This book is currently available. Request borrow instead.',
        message: null,
      });
      return;
    }

    setReservationStatus({
      bookId: requestBookId,
      submitting: true,
      error: null,
      message: null,
    });

    const response = await booksApi.createReservation(book.id);
    if (response.error) {
      setReservationStatus({
        bookId: requestBookId,
        submitting: false,
        error: response.error,
        message: null,
      });
      return;
    }

    const queuePosition = response.data?.position;
    setReservationStatus({
      bookId: requestBookId,
      submitting: false,
      error: null,
      message:
        typeof queuePosition === 'number'
          ? `Reservation submitted. You are #${queuePosition} in queue.`
          : response.data?.message ?? 'Reservation submitted successfully.',
    });
  };

  const hasPendingRequest = Boolean(book?.has_pending_borrow_request);
  const hasPendingReturnRequest = Boolean(book?.has_pending_return_request);
  const isBorrowedByUser = Boolean(book?.is_borrowed_by_user);
  const isTeacher = user?.role === 'TEACHER';
  const canUseBorrowingActions = canBorrowAsPatron(user);
  const isStudentBorrower = canUseBorrowingActions && !isTeacher;
  const isBorrowDisabled =
    borrowSubmitting || authLoading || (isAuthenticated && !canUseBorrowingActions);
  const canRequestReturn = Boolean(book && isBorrowedByUser && !hasPendingReturnRequest);
  const isReturnDisabled =
    returnSubmitting || authLoading || !canRequestReturn || (isAuthenticated && !canUseBorrowingActions);
  const canReserve =
    Boolean(book && !book.available && !hasPendingRequest && !isBorrowedByUser);
  const isReserveDisabled =
    reservationSubmitting || authLoading || !canReserve || (isAuthenticated && !canUseBorrowingActions);

  let borrowLabel = 'Request Borrow';
  if (borrowSubmitting) {
    borrowLabel = 'Submitting...';
  } else if (!book?.available) {
    borrowLabel = 'Not Available';
  } else if (isBorrowedByUser) {
    borrowLabel = 'Already Borrowed';
  } else if (hasPendingRequest) {
    borrowLabel = 'Request Pending';
  } else if (isAuthenticated && !canUseBorrowingActions) {
    borrowLabel = 'Students/Teachers Only';
  } else if (!isAuthenticated) {
    borrowLabel = 'Sign in to Request';
  }

  let returnLabel = 'Request Return';
  if (returnSubmitting) {
    returnLabel = 'Submitting...';
  } else if (hasPendingReturnRequest) {
    returnLabel = 'Return Pending';
  } else if (isAuthenticated && !canUseBorrowingActions) {
    returnLabel = 'Students/Teachers Only';
  } else if (!isAuthenticated) {
    returnLabel = 'Sign in to Return';
  }

  let reserveLabel = 'Reserve Book';
  if (reservationSubmitting) {
    reserveLabel = 'Submitting...';
  } else if (hasPendingRequest) {
    reserveLabel = 'Borrow Pending';
  } else if (!book?.available && !isAuthenticated) {
    reserveLabel = 'Sign in to Reserve';
  } else if (isAuthenticated && !canUseBorrowingActions) {
    reserveLabel = 'Students/Teachers Only';
  }

  const hasStatusMessage = Boolean(
    borrowError || borrowMessage || returnError || returnMessage || reservationError || reservationMessage
  );
  const availabilityBadgeClass = book?.available
    ? 'border-sky-300/30 bg-sky-400/18 text-sky-100'
    : 'border-slate-300/30 bg-slate-400/18 text-slate-100';
  const availabilityMessage = book
    ? book.available
      ? `${availableCopies} of ${totalCopies} copies are currently available.`
      : 'All copies are currently borrowed. You can place a reservation to join the queue.'
    : 'Review availability and borrowing information for this title.';
  const actionHelperText = !isAuthenticated
    ? 'Sign in with a student or teacher account to borrow or return this title.'
    : !canUseBorrowingActions
      ? 'Only student and teacher accounts can submit borrow, return, and reservation requests.'
      : isTeacher
        ? 'Teacher borrows have no due date limit, but weekly or monthly reporting is required.'
      : isBorrowedByUser
        ? 'This book is currently borrowed by you. Submit a return request when ready.'
        : book?.available
          ? 'Submit a borrow request and the library team will review it soon.'
      : 'This title is unavailable right now. Submit a reservation to join the queue.';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#071825] text-white">
        <Navbar variant="dark" />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center pt-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-300 border-r-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    const loginHref = `/login?redirect=${encodeURIComponent(
      typeof idParam === 'string' ? `/books/${idParam}` : '/books'
    )}`;

    return (
      <div className="min-h-screen bg-[#071825] text-white">
        <Navbar variant="dark" />
        <main className="pt-14 sm:pt-16">
          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#081c2d] via-[#0d2740] to-[#071825]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-28 right-[-4rem] h-80 w-80 rounded-full bg-sky-300/14 blur-3xl" />
              <div className="absolute -bottom-24 left-[-5rem] h-72 w-72 rounded-full bg-sky-200/12 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
              <p className="text-sky-100/90 text-xs font-semibold uppercase tracking-[0.35em]">
                Private Book View
              </p>
              <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">
                Sign in to open this book profile
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-white/72">
                Book details, availability, and borrow actions stay hidden until a library account is signed in.
              </p>
            </div>
          </section>

          <section className="relative py-16 sm:py-20">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <CatalogAccessPrompt
                loginHref={loginHref}
                title="Sign in to view this title"
                description="Continue with your library account to open the full book record, see availability, and submit borrow requests."
              />
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071825] text-white">
      <Navbar variant="dark" />
      <main className="pt-14 sm:pt-16">
        <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#081c2d] via-[#0d2740] to-[#071825]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-28 right-[-4rem] h-80 w-80 rounded-full bg-sky-300/14 blur-3xl" />
            <div className="absolute -bottom-24 left-[-5rem] h-72 w-72 rounded-full bg-sky-200/12 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(142,219,255,0.14),transparent_42%)]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8">
            <Link
              href="/books"
              className="inline-flex items-center text-sm text-white/70 transition-colors hover:text-white"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to catalog
            </Link>
          </div>
        </section>

        <section className="relative -mt-6 pb-12 sm:-mt-8 sm:pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[30px] border border-white/15 bg-white/5 backdrop-blur-xl p-4 shadow-2xl shadow-black/30 sm:p-6 lg:p-8">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
              </div>
            )}

            {!loading && error && (
              <div className="py-12 text-center">
                <h2 className="text-2xl font-semibold text-white">{error}</h2>
                <p className="mt-2 text-white/70">Please choose another book from the catalog.</p>
                <Link
                  href="/books"
                  className="mt-6 inline-flex items-center rounded-full bg-[#d4b170] px-5 py-2.5 font-semibold text-[#12140f] transition-colors hover:bg-[#e0c182]"
                >
                  Browse collection
                </Link>
              </div>
            )}

            {!loading && !error && book && (
              <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)] xl:gap-8">
                <aside className="lg:pr-2">
                  <div className="space-y-4 lg:sticky lg:top-24">
                    <div className="rounded-[26px] border border-white/15 bg-[#10263d]/82 p-4 shadow-xl shadow-black/20">
                      <div 
                        className="group relative mx-auto aspect-[3/4] max-w-[320px] overflow-visible rounded-[22px] [perspective:2000px] flex items-center justify-center"
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <div 
                          className="relative h-full w-full cursor-pointer transition-transform duration-500 ease-out [transform-style:preserve-3d]"
                          style={{
                            transformOrigin: 'center center',
                            transform: effectiveCoverSide === 'back' ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                          }}
                          onClick={() => {
                            if (hasBackCover) {
                              setCoverState({ 
                                bookId: resolvedBookId, 
                                side: effectiveCoverSide === 'front' ? 'back' : 'front' 
                              });
                            }
                          }}
                        >
                          {/* Front Cover */}
                          <div className="absolute inset-0 overflow-hidden rounded-[22px] border border-white/15 bg-[#0c2135] shadow-[1px_1px_12px_rgba(0,0,0,0.5)] [backface-visibility:hidden]">
                            {coverUrl ? (
                              <Image
                                src={coverUrl}
                                alt={`${book.title} front cover`}
                                fill
                                sizes="(min-width: 1024px) 34vw, 82vw"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <svg className="h-16 w-16 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          
                          {/* Back Cover */}
                          {hasBackCover && (
                            <div className="absolute inset-0 overflow-hidden rounded-[22px] border border-white/15 bg-[#0c2135] shadow-[1px_1px_12px_rgba(0,0,0,0.5)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                              {coverBackUrl ? (
                                <Image
                                  src={coverBackUrl}
                                  alt={`${book.title} back cover`}
                                  fill
                                  sizes="(min-width: 1024px) 34vw, 82vw"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <svg className="h-16 w-16 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3">
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Available copies</span>
                          <span className="font-semibold text-white">
                            {availableCopies} / {totalCopies}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${
                              book.available ? 'bg-sky-300' : 'bg-slate-300'
                            }`}
                            style={{ width: `${availabilityPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 text-center text-sm text-white/60">
                        {hasBackCover ? 'Click book to flip' : 'Front cover only'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Friendly note
                      </p>
                      <p className="mt-1 text-sm text-white/70">{actionHelperText}</p>
                    </div>

                    <div className="rounded-2xl border border-sky-300/24 bg-sky-400/10 px-4 py-3 shadow-lg shadow-black/10">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-100/78">
                        Reader rating
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <RatingStars rating={averageRating} />
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-white">
                            {hasRatings ? `${averageRating.toFixed(1)} out of 5` : 'No ratings yet'}
                          </p>
                          <p className="text-xs text-white/60">
                            {hasRatings ? reviewCountLabel : 'Be the first to review this title.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="space-y-5">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${availabilityBadgeClass}`}
                      >
                        {book.available ? 'Available now' : 'Currently borrowed'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white">
                        {featuredCategory}
                      </span>
                      {remainingCategoryCount > 0 && (
                        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-sm font-medium text-white/70">
                          +{remainingCategoryCount} more
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/60">
                        {book.author || 'Unknown author'}
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{book.title}</h2>
                      <a
                        href="#reviews"
                        aria-label="Open reviews"
                        className="mt-4 inline-flex items-center text-sky-200 transition-colors hover:text-sky-100"
                      >
                        <RatingStars rating={averageRating} className="h-4 w-4" />
                      </a>
                      <p className="mt-4 max-w-2xl text-sm text-white/75 sm:text-base">
                        {availabilityMessage}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Published
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">{publishedLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        ISBN
                      </p>
                      <p className="mt-1 break-all text-base font-semibold text-white">{isbnLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Language
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">{languageLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Grade level
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">{gradeLevelLabel}</p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/15 bg-[#10263d]/82 p-4 sm:p-5">
                    <h3 className="text-xl font-semibold text-white">Collection details</h3>
                    <p className="mt-2 text-sm text-white/70">
                      Explore category placement and current shelf status before sending a request.
                    </p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                          Categories
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2" title={categoriesLabel}>
                          {displayCategories.map((category, index) => (
                            <span
                              key={`${category}-${index}`}
                              className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/15 bg-[#0c2135]/82 px-4 py-3">
                        <div className="flex items-center justify-between text-sm text-white/60">
                          <span>Availability progress</span>
                          <span className="font-semibold text-white">{availabilityPercent}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${
                              book.available ? 'bg-sky-300' : 'bg-slate-300'
                            }`}
                            style={{ width: `${availabilityPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/15 bg-[#0c2135]/82 px-4 py-5 shadow-xl shadow-black/20 sm:px-5">
                    <h3 className="text-lg font-semibold text-white">Borrowing actions</h3>
                    <p className="mt-1 text-sm text-white/70">{actionHelperText}</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      {isBorrowedByUser ? (
                        <button
                          type="button"
                          className={`flex-1 rounded-full px-6 py-3 font-semibold transition-all duration-400 ${
                            isReturnDisabled
                              ? 'cursor-not-allowed bg-white/10 text-white/40'
                              : 'bg-[#d4b170] text-[#12140f] hover:bg-[#e0c182] shadow-[0_14px_56px_-11px_rgba(212,177,112,0.45)]'
                          }`}
                          disabled={isReturnDisabled}
                          onClick={handleReturnRequest}
                        >
                          <span className="inline-block transition-all duration-400 hover:pr-14 relative">
                            {returnLabel}
                            <span className="absolute opacity-0 top-0 -right-5 transition-all duration-700 hover:opacity-100 hover:right-0">now</span>
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`flex-1 rounded-full px-6 py-3 font-semibold transition-all duration-400 ${
                            isBorrowDisabled
                              ? 'cursor-not-allowed bg-white/10 text-white/40'
                              : 'bg-[#d4b170] text-[#12140f] hover:bg-[#e0c182] shadow-[0_14px_56px_-11px_rgba(212,177,112,0.45)]'
                          }`}
                          disabled={isBorrowDisabled}
                          onClick={handleBorrowRequest}
                        >
                          <span className="inline-block transition-all duration-400 hover:pr-14 relative">
                            {borrowLabel}
                            <span className="absolute opacity-0 top-0 -right-5 transition-all duration-700 hover:opacity-100 hover:right-0">now</span>
                          </span>
                        </button>
                      )}
                      {!isBorrowedByUser && !book.available && (
                        <button
                          type="button"
                          className={`flex-1 rounded-full px-6 py-3 font-semibold transition-all duration-400 ${
                            isReserveDisabled
                              ? 'cursor-not-allowed bg-white/10 text-white/40'
                              : 'bg-[#6c8565] text-white hover:bg-[#7b9674] shadow-[0_14px_56px_-11px_rgba(108,133,101,0.45)]'
                          }`}
                          disabled={isReserveDisabled}
                          onClick={handleReserveRequest}
                        >
                          {reserveLabel}
                        </button>
                      )}
                      <Link
                        href="/books"
                        className="flex-1 rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        Browse more
                      </Link>
                    </div>
                  </div>

                  {hasStatusMessage && (
                    <div className="space-y-2">
                      {borrowError && (
                        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                          {borrowError}
                        </div>
                      )}
                      {borrowMessage && (
                        <div className="rounded-2xl border border-sky-300/30 bg-sky-400/15 px-4 py-3 text-sm text-sky-100">
                          <p>{borrowMessage}</p>
                          {isStudentBorrower && borrowSlipData && (
                            <button
                              type="button"
                              onClick={() => setShowBorrowSlip(true)}
                              className="mt-3 inline-flex rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                            >
                              View Borrow Slip
                            </button>
                          )}
                        </div>
                      )}
                      {returnError && (
                        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                          {returnError}
                        </div>
                      )}
                      {returnMessage && (
                        <div className="rounded-2xl border border-sky-300/30 bg-sky-400/15 px-4 py-3 text-sm text-sky-100">
                          {returnMessage}
                        </div>
                      )}
                      {reservationError && (
                        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                          {reservationError}
                        </div>
                      )}
                      {reservationMessage && (
                        <div className="rounded-2xl border border-sky-300/30 bg-sky-400/15 px-4 py-3 text-sm text-sky-100">
                          {reservationMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </section>

        <section className="pb-12">
          <div className="mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-[30px] border border-white/15 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/46">
                    Next reads
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Similar books to explore</h3>
                  <p className="mt-2 max-w-2xl text-sm text-white/62">
                    Suggestions are ranked from shared categories, author overlap, reader activity, and live availability.
                  </p>
                </div>
                <Link
                  href="/books"
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Browse catalog
                </Link>
              </div>

              {recommendationsLoading ? (
                <div className="mt-8 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
                </div>
              ) : recommendationsError ? (
                <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                  Recommendations are unavailable right now: {recommendationsError}
                </div>
              ) : recommendations.length === 0 ? (
                <div className="mt-6 rounded-[1.6rem] border border-dashed border-white/14 bg-white/[0.03] px-5 py-8 text-center">
                  <p className="text-white/72">No similar titles are ready yet for this book.</p>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 justify-items-center gap-x-5 gap-y-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {recommendations.map((item) => (
                    <BookCard key={item.book.id} book={item.book} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Reviews Section */}
        <section id="reviews" className="scroll-mt-24 pb-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[30px] border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setReviewsExpanded((prev) => !prev)}
                  className="flex flex-1 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                  aria-expanded={reviewsExpanded}
                  aria-controls="reviews-panel"
                >
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Reviews ({reviews.length})
                    </h3>
                    <p className="mt-1 text-sm text-white/50">
                      {reviewsExpanded ? 'Hide review details' : 'Show review details'}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-white/65 transition-transform duration-300 ${
                      reviewsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isAuthenticated && !showReviewForm && !userReview && (
                  <button
                    onClick={() => {
                      setReviewsExpanded(true);
                      setShowReviewForm(true);
                    }}
                    className="rounded-full bg-[#d4b170] px-4 py-2 text-sm font-semibold text-[#12140f] transition-colors hover:bg-[#e0c182]"
                  >
                    Write a Review
                  </button>
                )}
              </div>

              <div
                id="reviews-panel"
                className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                  reviewsExpanded ? 'mt-6 grid-rows-[1fr] opacity-100' : 'mt-2 grid-rows-[0fr] opacity-0'
                }`}
                aria-hidden={!reviewsExpanded}
              >
                <div className="min-h-0 overflow-hidden">
              {/* Review Form */}
              {showReviewForm && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h4 className="text-sm font-semibold text-white/80">
                    {editingReview ? 'Edit Your Review' : 'Write Your Review'}
                  </h4>
                  
                  {/* Star Rating Selector */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                      Your Rating
                    </label>
                    <div className="mt-2 flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                          className="text-2xl transition-transform hover:scale-110"
                        >
                          {star <= reviewForm.rating ? (
                            <span className="text-sky-200">★</span>
                          ) : (
                            <span className="text-white/30">☆</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                      Your Review (optional)
                    </label>
                    <textarea
                      value={reviewForm.reviewText}
                      onChange={(e) => setReviewForm({ ...reviewForm, reviewText: e.target.value })}
                      placeholder="Share your thoughts about this book..."
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30"
                    />
                  </div>

                  {/* Error Message */}
                  {reviewError && (
                    <div className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-2 text-sm text-rose-100">
                      {reviewError}
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={cancelReviewForm}
                      className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting || reviewForm.rating === 0}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        reviewSubmitting || reviewForm.rating === 0
                          ? 'cursor-not-allowed bg-white/10 text-white/40'
                          : 'bg-[#d4b170] text-[#12140f] hover:bg-[#e0c182]'
                      }`}
                    >
                      {reviewSubmitting ? 'Submitting...' : editingReview ? 'Update Review' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              )}

              {/* User's Existing Review */}
              {userReview && !showReviewForm && (
                <div className="mt-6 rounded-2xl border border-sky-300/24 bg-sky-400/10 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/82">
                        Your Review
                      </p>
                      <div className="mt-1 text-lg">
                        {'★'.repeat(userReview.rating)}{'☆'.repeat(5 - userReview.rating)}
                      </div>
                      {userReview.review_text && (
                        <p className="mt-2 text-sm text-white/70">{userReview.review_text}</p>
                      )}
                      <p className="mt-2 text-xs text-white/40">
                        Posted on {new Date(userReview.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={startEditReview}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDeleteReview}
                        className="rounded-full border border-rose-300/30 px-3 py-1 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews List */}
              {reviewsLoading ? (
                <div className="mt-8 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="mt-8 text-center text-white/50">
                  <p>No reviews yet. Be the first to review this book!</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {reviews
                    .filter((r) => !user || r.user.id !== user.id)
                    .map((review) => (
                      <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-white">
                              {review.user.full_name || review.user.username}
                            </p>
                            <div className="mt-1 text-sm">
                              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                            </div>
                          </div>
                          <span className="text-xs text-white/40">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {review.review_text && (
                          <p className="mt-2 text-sm text-white/70">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                </div>
              )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {showBorrowModal && isTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-[#10263d] shadow-2xl">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                  Teacher Borrow Request
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Set reporting schedule</h2>
                <p className="mt-2 text-sm text-white/70">
                  Teacher loans do not get a due date. Choose how often this borrow must be
                  reported after approval.
                </p>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-4 py-4 text-sm text-white/80">
                  <p className="font-semibold text-indigo-100">Teacher borrowing rules</p>
                  <p className="mt-2">
                    No day/time limit will be assigned. The borrower must submit a periodic report
                    every week or month while the book remains borrowed.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(['WEEKLY', 'MONTHLY'] as const).map((frequency) => (
                    <button
                      key={frequency}
                      type="button"
                      onClick={() => setTeacherReportingFrequency(frequency)}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        teacherReportingFrequency === frequency
                          ? 'border-indigo-300 bg-indigo-500/20'
                          : 'border-white/15 bg-white/5 hover:border-indigo-300/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {frequency === 'WEEKLY' ? 'Weekly report' : 'Monthly report'}
                          </p>
                          <p className="mt-1 text-xs text-white/60">
                            {frequency === 'WEEKLY'
                              ? 'Teacher submits a check-in every 7 days.'
                              : 'Teacher submits a check-in every 30 days.'}
                          </p>
                        </div>
                        {teacherReportingFrequency === frequency && (
                          <svg className="h-6 w-6 text-indigo-300" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowBorrowModal(false)}
                  className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white/75 transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBorrowRequest}
                  disabled={borrowSubmitting}
                  className={`rounded-full px-6 py-3 font-semibold transition-colors ${
                    borrowSubmitting
                      ? 'cursor-not-allowed bg-white/10 text-white/40'
                      : 'bg-indigo-500 text-white hover:bg-indigo-400'
                  }`}
                >
                  {borrowSubmitting ? 'Submitting...' : 'Submit teacher borrow'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showBorrowModal && !isTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-[#10263d] shadow-2xl">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                  Student Borrowing Form
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  SCSIT Library System Borrowing Form
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  Complete the student borrowing details below. This helps keep accurate circulation records.
                </p>
              </div>
              <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                    Borrower Information
                  </h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Full Name
                      </label>
                      <StaticBorrowField value={studentBorrowForm.full_name} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Borrower Type
                      </label>
                      <StaticBorrowField value="Student" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Student ID Number
                      </label>
                      <StaticBorrowField value={studentBorrowForm.student_id} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Course or Program
                      </label>
                      <StaticBorrowField value={studentBorrowForm.course_program} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Year/Level
                      </label>
                      <StaticBorrowField value={studentBorrowForm.year_level} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Email Address
                      </label>
                      <StaticBorrowField value={studentBorrowForm.email} />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                    Book Information
                  </h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Book Title
                      </label>
                      <input
                        value={book?.title ?? ''}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Author
                      </label>
                      <input
                        value={book?.author ?? ''}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        ISBN
                      </label>
                      <input
                        value={book?.isbn ?? ''}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Call Number
                      </label>
                      <input
                        value={studentBorrowForm.call_number}
                        onChange={(event) =>
                          handleStudentBorrowFormChange('call_number', event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 transition-all focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30"
                        placeholder="Enter call number"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Quantity Borrowed
                      </label>
                      <input
                        value={studentBorrowForm.quantity}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Date Borrowed
                      </label>
                      <input
                        value={borrowedDateInput}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Due Date
                      </label>
                      <input
                        value={dueDateInput}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Borrow Duration
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[7, 14].map((duration) => {
                          const isSelected = studentBorrowDurationDays === duration;
                          return (
                            <button
                              key={duration}
                              type="button"
                              onClick={() => {
                                setStudentBorrowDurationDays(duration as 7 | 14);
                                setStudentBorrowFormError(null);
                              }}
                              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                                isSelected
                                  ? 'border-[#d4b170] bg-[#d4b170]/15 text-[#fff1cf] shadow-[0_0_0_1px_rgba(212,177,112,0.2)]'
                                  : 'border-white/20 bg-white/5 text-white/70 hover:border-[#d4b170]/40 hover:bg-[#d4b170]/10'
                              }`}
                            >
                              {duration} days
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                    Agreement and Policies
                  </h4>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <input
                      type="checkbox"
                      checked={studentBorrowForm.agreed_to_policies}
                      onChange={(event) =>
                        handleStudentBorrowFormChange(
                          'agreed_to_policies',
                          event.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-sky-300 focus:ring-sky-300/30"
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        I agree to the borrowing policies.
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        I understand that student borrow requests are limited to
                        {' '}7 or 14 days, overdue items may incur penalties, and
                        the book must be returned on or before the due date shown above.
                      </p>
                    </div>
                  </label>
                  {studentBorrowFormError && (
                    <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                      {studentBorrowFormError}
                    </div>
                  )}
                </section>

              </div>
              <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row">
                <button
                  onClick={() => setShowBorrowModal(false)}
                  className="flex-1 rounded-full border border-white/20 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBorrowRequest}
                  disabled={borrowSubmitting || !studentBorrowForm.agreed_to_policies}
                  className={`flex-1 rounded-full px-6 py-3 font-semibold transition-colors ${
                    borrowSubmitting || !studentBorrowForm.agreed_to_policies
                      ? 'cursor-not-allowed bg-white/10 text-white/40'
                      : 'bg-[#d4b170] text-[#12140f] hover:bg-[#e0c182]'
                  }`}
                >
                  Agree to Policies and Confirm Request
                </button>
              </div>
            </div>
          </div>
        )}

        {showBorrowSlip && borrowSlipData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-white shadow-2xl">
              <button
                onClick={() => setShowBorrowSlip(false)}
                className="no-print absolute right-4 top-4 z-10 rounded-full bg-gray-800 p-2 text-white hover:bg-gray-700"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <BorrowSlip
                studentName={borrowSlipData.studentName}
                studentId={borrowSlipData.studentId}
                courseYear={borrowSlipData.courseYear}
                bookTitle={borrowSlipData.bookTitle}
                author={borrowSlipData.author}
                callNumber={borrowSlipData.callNumber}
                dateBorrowed={borrowSlipData.dateBorrowed}
                dueDate={borrowSlipData.dueDate}
              />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
