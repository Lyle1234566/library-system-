// API configuration and service layer for connecting to Django backend

import { API_BASE_URL, API_ORIGIN } from '@/lib/api-config';
import { authApi, tokenStorage } from '@/lib/auth';

export { API_BASE_URL, API_ORIGIN };

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (typeof window === 'undefined') {
    return headers;
  }

  const token = tokenStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const buildMultipartHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (typeof window === 'undefined') {
    return headers;
  }

  const token = tokenStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const fetchWithAuthRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  let response = await fetch(input, init);

  if (response.status !== 401 || typeof window === 'undefined') {
    return response;
  }

  const currentToken = tokenStorage.getAccessToken();
  if (!currentToken) {
    return response;
  }

  const refreshResult = await authApi.refreshToken();
  if (refreshResult.error || !refreshResult.tokens?.access) {
    return response;
  }

  const nextHeaders = new Headers(init?.headers ?? {});
  nextHeaders.set('Authorization', `Bearer ${refreshResult.tokens.access}`);

  response = await fetch(input, {
    ...init,
    headers: nextHeaders,
  });

  return response;
};

const parseJsonResponse = async <T>(
  response: Response
): Promise<{ data: T | null; text: string }> => {
  const text = await response.text();
  if (!text) {
    return { data: null, text: '' };
  }
  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
};

const normalizeErrorMessage = (response: Response, data: unknown, text: string): string => {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === 'string') {
      return record.detail;
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
  }
  const trimmed = text.trim();
  if (trimmed) {
    if (trimmed.startsWith('<')) {
      return 'Unexpected response from server. Check the API URL and backend status.';
    }
    return trimmed;
  }
  return `HTTP error! status: ${response.status}`;
};

export function resolveMediaUrl(mediaPath?: string | null): string | null {
  if (!mediaPath) {
    return null;
  }
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    return mediaPath;
  }
  if (mediaPath.startsWith('/')) {
    return `${API_ORIGIN}${mediaPath}`;
  }
  return `${API_ORIGIN}/${mediaPath}`;
}

export interface Category {
  id: number;
  name: string;
}

export type UserRole = 'STUDENT' | 'TEACHER' | 'LIBRARIAN' | 'WORKING' | 'ADMIN' | 'STAFF';
export type ReportingFrequency = 'NONE' | 'WEEKLY' | 'MONTHLY';

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  published_date: string;
  genre: string;
  description?: string;
  location_shelf?: string;
  language?: string;
  grade_level?: string;
  categories?: Category[];
  cover_image: string | null;
  cover_back: string | null;
  copies_total?: number;
  copies_available: number;
  available: boolean;
  is_borrowed_by_user?: boolean;
  has_pending_borrow_request?: boolean;
  has_pending_return_request?: boolean;
  average_rating?: number;
  review_count?: number;
  user_review?: {
    id: number;
    rating: number;
    review_text: string;
  } | null;
}

export interface BookRecommendation {
  book: Book;
  reason: string;
}

export interface PersonalizedBookRecommendations {
  for_you: BookRecommendation[];
  popular_now: BookRecommendation[];
  based_on_history: boolean;
}

export interface BookInput {
  title: string;
  author: string;
  isbn: string;
  published_date: string;
  genre: string;
  description?: string;
  location_shelf?: string;
  language?: string;
  grade_level?: string;
  cover_image: string | null;
  cover_back: string | null;
  copies_available: number;
  category_ids?: number[];
}

export interface User {
  id: number;
  email: string | null;
  email_verified?: boolean;
  full_name: string;
  avatar?: string | null;
  role: UserRole;
  is_working_student?: boolean;
  student_id?: string | null;
  staff_id?: string | null;
  is_active: boolean;
  date_joined: string;
}

export interface BorrowRequestUser {
  id: number;
  student_id: string | null;
  staff_id?: string | null;
  full_name: string;
  avatar?: string | null;
  role: UserRole;
  is_working_student?: boolean;
}

export interface BorrowRequest {
  id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  requested_at: string;
  processed_at: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  late_fee_amount?: string;
  overdue_days?: number;
  processed_by: BorrowRequestUser | null;
  renewal_count?: number;
  max_renewals?: number;
  remaining_renewals?: number;
  can_renew?: boolean;
  renewal_block_reason?: string | null;
  renewal_duration_days?: number;
  pending_renewal_request_id?: number | null;
  pending_renewal_requested_at?: string | null;
  last_renewed_at?: string | null;
  requested_borrow_days?: number;
  reporting_frequency?: ReportingFrequency;
  last_reported_at?: string | null;
  next_report_due_date?: string | null;
  is_report_due?: boolean;
  report_overdue_days?: number;
}

export interface BorrowRequestOptions {
  borrowDays?: number;
  reportingFrequency?: Exclude<ReportingFrequency, 'NONE'>;
}

export interface ReturnRequest {
  id: number;
  borrow_request_id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_at: string;
  processed_at: string | null;
  processed_by: BorrowRequestUser | null;
}

export interface RenewalRequest {
  id: number;
  borrow_request_id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_extension_days: number;
  current_due_date: string | null;
  projected_due_date: string | null;
  requested_at: string;
  processed_at: string | null;
  processed_by: BorrowRequestUser | null;
}

export interface BookReview {
  id: number;
  user: {
    id: number;
    username: string;
    full_name: string;
    avatar: string | null;
  };
  book: Book;
  rating: number;
  review_text: string;
  created_at: string;
  updated_at: string;
}

export interface UserReview {
  id: number;
  rating: number;
  review_text: string;
}

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Reservation {
  id: number;
  book: {
    id: number;
    title: string;
    author: string;
    cover_image: string | null;
  };
  status: 'PENDING' | 'NOTIFIED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  created_at: string;
  notified_at: string | null;
  expires_at: string | null;
  position: number;
  current_position: number | null;
}

type NotificationListResponse = {
  results?: Notification[];
  unread_count?: number;
};

type NotificationUnreadCountResponse = {
  unread_count?: number;
};

export interface FinePayment {
  id: number;
  borrow_request_id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  amount: string;
  status: 'PENDING' | 'PAID' | 'WAIVED';
  payment_method: string;
  payment_reference: string;
  paid_at: string | null;
  processed_by: BorrowRequestUser | null;
  notes: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface EnrollmentSummary {
  total_records: number;
  active_records: number;
  inactive_records: number;
  latest_term: string | null;
  last_updated_at: string | null;
  template_columns: string[];
}

export interface EnrollmentImportResult extends EnrollmentSummary {
  message: string;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  skipped_rows: string[];
}

export interface ContactMessagePayload {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface PublicLibraryStats {
  books_cataloged: number;
  active_students: number;
  average_pickup_minutes: number;
  borrow_success_rate: number;
}

interface FinePaymentActionResponse {
  message: string;
  fine_payment: FinePayment;
}

export async function approveBorrowRequest(id: number): Promise<ApiResponse<BorrowRequest>> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/borrow-requests/${id}/approve/`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<BorrowRequest>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function rejectBorrowRequest(id: number): Promise<ApiResponse<BorrowRequest>> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/borrow-requests/${id}/reject/`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<BorrowRequest>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function approveReturnRequest(id: number): Promise<ApiResponse<ReturnRequest>> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/return-requests/${id}/approve/`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<ReturnRequest>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function rejectReturnRequest(id: number): Promise<ApiResponse<ReturnRequest>> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/return-requests/${id}/reject/`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<ReturnRequest>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getReturnRequests(status?: string): Promise<ApiResponse<ReturnRequest[]>> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/return-requests/${query}`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<ReturnRequest[]>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function approveRenewalRequest(
  id: number,
): Promise<ApiResponse<{ message: string; renewal_request: RenewalRequest; request: BorrowRequest }>> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/renewal-requests/${id}/approve/`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<{
      message: string;
      renewal_request: RenewalRequest;
      request: BorrowRequest;
    }>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function rejectRenewalRequest(
  id: number,
): Promise<ApiResponse<{ message: string; renewal_request: RenewalRequest }>> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/renewal-requests/${id}/reject/`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<{
      message: string;
      renewal_request: RenewalRequest;
    }>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getRenewalRequests(status?: string): Promise<ApiResponse<RenewalRequest[]>> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/renewal-requests/${query}`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    const { data, text } = await parseJsonResponse<RenewalRequest[]>(response);
    if (!response.ok) {
      return { data: null, error: normalizeErrorMessage(response, data, text) };
    }
    if (data === null) {
      return { data: null, error: 'Unexpected response from server.' };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const booksApi = {
  async getCategories(): Promise<ApiResponse<Category[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/categories/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<Category[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createCategory(payload: { name: string }): Promise<ApiResponse<Category>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/categories/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      const { data, text } = await parseJsonResponse<Category>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getAll(): Promise<ApiResponse<Book[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<Book[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getPublicStats(): Promise<ApiResponse<PublicLibraryStats>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/public-stats/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<PublicLibraryStats>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getById(id: number): Promise<ApiResponse<Book>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<Book>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getSimilarBooks(id: number): Promise<ApiResponse<BookRecommendation[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/recommendations/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{ results: BookRecommendation[] }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data: data?.results ?? [], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getRecommendations(): Promise<ApiResponse<PersonalizedBookRecommendations>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/recommendations/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<PersonalizedBookRecommendations>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getBorrowRequests(status?: string): Promise<ApiResponse<BorrowRequest[]>> {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/borrow-requests/${query}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<BorrowRequest[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async requestBorrow(
    id: number,
    options?: number | BorrowRequestOptions,
  ): Promise<ApiResponse<{ message: string; book: Book; request: BorrowRequest }>> {
    try {
      const payload =
        typeof options === 'number'
          ? { borrow_days: options }
          : {
              borrow_days: options?.borrowDays,
              reporting_frequency: options?.reportingFrequency,
            };
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/borrow/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      const { data, text } = await parseJsonResponse<{
        message: string;
        book: Book;
        request: BorrowRequest;
      }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async requestReturn(id: number): Promise<ApiResponse<{ message: string; book: Book; return_request: ReturnRequest }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/return/`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{
        message: string;
        book: Book;
        return_request: ReturnRequest;
      }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async create(book: BookInput | FormData): Promise<ApiResponse<Book>> {
    try {
      const isMultipart = book instanceof FormData;
      const headers = isMultipart
        ? (() => {
            const multipartHeaders: Record<string, string> = {
              'Accept': 'application/json',
            };
            if (typeof window !== 'undefined') {
              const token = tokenStorage.getAccessToken();
              if (token) {
                multipartHeaders.Authorization = `Bearer ${token}`;
              }
            }
            return multipartHeaders;
          })()
        : buildHeaders();
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/`, {
        method: 'POST',
        headers,
        body: isMultipart ? book : JSON.stringify(book),
      });
      const { data, text } = await parseJsonResponse<Book>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async update(id: number, book: Partial<BookInput>): Promise<ApiResponse<Book>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/`, {
        method: 'PATCH',
        headers: buildHeaders(),
        body: JSON.stringify(book),
      });
      const { data, text } = await parseJsonResponse<Book>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async delete(id: number): Promise<ApiResponse<null>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async search(query: string): Promise<ApiResponse<Book[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/?search=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<Book[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getAvailable(): Promise<ApiResponse<Book[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/?available=true`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<Book[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async setCopiesTotal(id: number, copiesTotal: number): Promise<ApiResponse<{ message: string; book: Book }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${id}/set-copies-total/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ copies_total: copiesTotal }),
      });
      const { data, text } = await parseJsonResponse<{ message: string; book: Book }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async approveBorrowRequest(id: number): Promise<ApiResponse<BorrowRequest>> {
    return approveBorrowRequest(id);
  },

  async rejectBorrowRequest(id: number): Promise<ApiResponse<BorrowRequest>> {
    return rejectBorrowRequest(id);
  },

  async approveReturnRequest(id: number): Promise<ApiResponse<ReturnRequest>> {
    return approveReturnRequest(id);
  },

  async rejectReturnRequest(id: number): Promise<ApiResponse<ReturnRequest>> {
    return rejectReturnRequest(id);
  },

  async getReturnRequests(status?: string): Promise<ApiResponse<ReturnRequest[]>> {
    return getReturnRequests(status);
  },

  async approveRenewalRequest(
    id: number,
  ): Promise<ApiResponse<{ message: string; renewal_request: RenewalRequest; request: BorrowRequest }>> {
    return approveRenewalRequest(id);
  },

  async rejectRenewalRequest(
    id: number,
  ): Promise<ApiResponse<{ message: string; renewal_request: RenewalRequest }>> {
    return rejectRenewalRequest(id);
  },

  async getRenewalRequests(status?: string): Promise<ApiResponse<RenewalRequest[]>> {
    return getRenewalRequests(status);
  },

  async renewBorrow(
    id: number,
  ): Promise<ApiResponse<{ message: string; request: BorrowRequest; renewal_request: RenewalRequest }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/borrow-requests/${id}/renew/`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{
        message: string;
        request: BorrowRequest;
        renewal_request: RenewalRequest;
      }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async submitBorrowReport(id: number): Promise<ApiResponse<{ message: string; request: BorrowRequest }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/borrow-requests/${id}/submit-report/`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{ message: string; request: BorrowRequest }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getHistory(): Promise<ApiResponse<BorrowRequest[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/borrow-requests/history/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<BorrowRequest[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getFinePayments(status?: string): Promise<ApiResponse<FinePayment[]>> {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/fine-payments/${query}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<FinePayment[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async markFinePaid(
    id: number,
    payload?: { payment_method?: string; payment_reference?: string; notes?: string }
  ): Promise<ApiResponse<FinePaymentActionResponse>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/fine-payments/${id}/mark-paid/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload ?? {}),
      });
      const { data, text } = await parseJsonResponse<FinePaymentActionResponse>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async waiveFine(id: number, notes?: string): Promise<ApiResponse<FinePaymentActionResponse>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/fine-payments/${id}/waive/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ notes: notes ?? '' }),
      });
      const { data, text } = await parseJsonResponse<FinePaymentActionResponse>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createReservation(bookId: number): Promise<ApiResponse<{ message: string; position: number }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/reservations/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ book_id: bookId }),
      });
      const { data, text } = await parseJsonResponse<{ message: string; position: number }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getReservations(status?: string): Promise<ApiResponse<Reservation[]>> {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/reservations/${query}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<Reservation[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async cancelReservation(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/reservations/${id}/cancel/`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{ message: string }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async exportReport(type: string): Promise<Blob | null> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/export-reports/?type=${encodeURIComponent(type)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenStorage.getAccessToken()}`,
          'Accept': 'text/csv',
        },
      });
      if (!response.ok) {
        return null;
      }
      return await response.blob();
    } catch {
      return null;
    }
  },

  // Book Reviews
  async getBookReviews(bookId: number): Promise<ApiResponse<BookReview[]>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${bookId}/reviews/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<BookReview[]>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createReview(bookId: number, rating: number, reviewText: string): Promise<ApiResponse<BookReview>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${bookId}/reviews/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ rating, review_text: reviewText }),
      });
      const { data, text } = await parseJsonResponse<BookReview>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async updateReview(bookId: number, reviewId: number, rating: number, reviewText: string): Promise<ApiResponse<BookReview>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${bookId}/reviews/${reviewId}/`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({ rating, review_text: reviewText }),
      });
      const { data, text } = await parseJsonResponse<BookReview>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async deleteReview(bookId: number, reviewId: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/books/books/${bookId}/reviews/${reviewId}/`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });
      if (!response.ok) {
        const { data, text } = await parseJsonResponse<{ message: string }>(response);
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data: { message: 'Review deleted successfully' }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

export const contactApi = {
  async sendMessage(payload: ContactMessagePayload): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/contact/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      const { data, text } = await parseJsonResponse<{ message: string }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

export const enrollmentApi = {
  async getSummary(): Promise<ApiResponse<EnrollmentSummary>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/enrollment-records/import/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<EnrollmentSummary>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async importCsv(file: File, academicTerm?: string): Promise<ApiResponse<EnrollmentImportResult>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (academicTerm?.trim()) {
        formData.append('academic_term', academicTerm.trim());
      }

      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/enrollment-records/import/`, {
        method: 'POST',
        headers: buildMultipartHeaders(),
        body: formData,
      });
      const { data, text } = await parseJsonResponse<EnrollmentImportResult>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

export const notificationsApi = {
  async getNotifications(options?: { unread?: boolean; limit?: number }): Promise<ApiResponse<NotificationListResponse>> {
    try {
      const params = new URLSearchParams();
      if (options?.unread) {
        params.set('unread', 'true');
      }
      if (typeof options?.limit === 'number') {
        params.set('limit', String(options.limit));
      }
      const query = params.toString();
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/notifications/${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<NotificationListResponse>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return {
        data: {
          results: data?.results || [],
          unread_count: data?.unread_count || 0,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getUnreadCount(): Promise<ApiResponse<NotificationUnreadCountResponse>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/notifications/unread-count/`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<NotificationUnreadCountResponse>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data: { unread_count: data?.unread_count || 0 }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async markAsRead(notificationId: number): Promise<ApiResponse<{ message: string; unread_count: number }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/notifications/${notificationId}/mark-read/`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{ message: string; unread_count: number }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async markAllAsRead(): Promise<ApiResponse<{ message: string; unread_count: number }>> {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/auth/notifications/mark-all-read/`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      const { data, text } = await parseJsonResponse<{ message: string; unread_count: number }>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

export default booksApi;
