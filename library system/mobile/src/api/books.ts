import {
  ApiResult,
  Book,
  BorrowRequest,
  Category,
  FinePayment,
  FineSummary,
  ReportingFrequency,
  Reservation,
  ReturnRequest,
} from "../types";
import { apiRequest } from "../lib/http";

type BorrowResponse = {
  message?: string;
  book?: Book;
  request?: BorrowRequest;
};

type ReturnResponse = {
  message?: string;
  book?: Book;
  return_request?: ReturnRequest;
};

type RenewResponse = {
  message?: string;
  request?: BorrowRequest;
};

type ReportResponse = {
  message?: string;
  request?: BorrowRequest;
};

type ReservationCreateResponse = {
  message?: string;
  position?: number;
  reservation?: Reservation;
};

type ReservationCancelResponse = {
  message?: string;
  reservation?: Reservation;
};

type FinePaymentActionResponse = {
  message?: string;
  fine_payment?: FinePayment;
};

export type BookFilters = {
  search?: string;
  available?: boolean;
  category?: number | string;
  author?: string;
  grade_level?: string;
  language?: string;
  publication_year?: number;
};

export type BorrowRequestOptions = {
  borrowDays?: number;
  reportingFrequency?: Exclude<ReportingFrequency, "NONE">;
};

const buildQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
};

export const booksApi = {
  async getPublicBooks(filters?: BookFilters): Promise<ApiResult<Book[]>> {
    const query = buildQuery({
      search: filters?.search?.trim(),
      available: filters?.available,
      category: filters?.category,
      author: filters?.author?.trim(),
      grade_level: filters?.grade_level?.trim(),
      language: filters?.language?.trim(),
      publication_year: filters?.publication_year,
    });
    const result = await apiRequest<Book[]>(`/books/books/${query}`, {
      method: "GET",
      auth: false,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load books." };
    }
    return result;
  },

  async getBooks(filters?: BookFilters): Promise<ApiResult<Book[]>> {
    const query = buildQuery({
      search: filters?.search?.trim(),
      available: filters?.available,
      category: filters?.category,
      author: filters?.author?.trim(),
      grade_level: filters?.grade_level?.trim(),
      language: filters?.language?.trim(),
      publication_year: filters?.publication_year,
    });
    const result = await apiRequest<Book[]>(`/books/books/${query}`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load books." };
    }
    return result;
  },

  async getCategories(): Promise<ApiResult<Category[]>> {
    const result = await apiRequest<Category[]>("/books/categories/", {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load categories." };
    }
    return result;
  },

  async getBookById(id: number): Promise<ApiResult<Book>> {
    const result = await apiRequest<Book>(`/books/books/${id}/`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load book details." };
    }
    return result;
  },

  async requestBorrow(
    id: number,
    options?: number | BorrowRequestOptions
  ): Promise<ApiResult<BorrowResponse>> {
    const payload =
      typeof options === "number"
        ? { borrow_days: options }
        : {
            borrow_days: options?.borrowDays,
            reporting_frequency: options?.reportingFrequency,
          };
    const result = await apiRequest<BorrowResponse>(`/books/books/${id}/borrow/`, {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to request borrow." };
    }
    return result;
  },

  async requestReturn(id: number): Promise<ApiResult<ReturnResponse>> {
    const result = await apiRequest<ReturnResponse>(`/books/books/${id}/return/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to request return." };
    }
    return result;
  },

  async getBorrowRequests(status?: string): Promise<ApiResult<BorrowRequest[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await apiRequest<BorrowRequest[]>(`/books/borrow-requests/${query}`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load borrow requests." };
    }
    return result;
  },

  async approveBorrowRequest(id: number): Promise<ApiResult<BorrowRequest>> {
    const result = await apiRequest<BorrowRequest>(`/books/borrow-requests/${id}/approve/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to approve borrow request." };
    }
    return result;
  },

  async rejectBorrowRequest(id: number): Promise<ApiResult<BorrowRequest>> {
    const result = await apiRequest<BorrowRequest>(`/books/borrow-requests/${id}/reject/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to reject borrow request." };
    }
    return result;
  },

  async renewBorrow(id: number): Promise<ApiResult<RenewResponse>> {
    const result = await apiRequest<RenewResponse>(`/books/borrow-requests/${id}/renew/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to renew borrow request." };
    }
    return result;
  },

  async submitBorrowReport(id: number): Promise<ApiResult<ReportResponse>> {
    const result = await apiRequest<ReportResponse>(`/books/borrow-requests/${id}/submit-report/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to submit borrow report." };
    }
    return result;
  },

  async getReturnRequests(status?: string): Promise<ApiResult<ReturnRequest[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await apiRequest<ReturnRequest[]>(`/books/return-requests/${query}`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load return requests." };
    }
    return result;
  },

  async approveReturnRequest(id: number): Promise<ApiResult<ReturnRequest>> {
    const result = await apiRequest<ReturnRequest>(`/books/return-requests/${id}/approve/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to approve return request." };
    }
    return result;
  },

  async rejectReturnRequest(id: number): Promise<ApiResult<ReturnRequest>> {
    const result = await apiRequest<ReturnRequest>(`/books/return-requests/${id}/reject/`, {
      method: "POST",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to reject return request." };
    }
    return result;
  },

  async getHistory(): Promise<ApiResult<BorrowRequest[]>> {
    const result = await apiRequest<BorrowRequest[]>("/books/borrow-requests/history/", {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load reading history." };
    }
    return result;
  },

  async createReservation(bookId: number): Promise<ApiResult<ReservationCreateResponse>> {
    const result = await apiRequest<ReservationCreateResponse>("/books/reservations/", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ book_id: bookId }),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to reserve this book." };
    }
    return result;
  },

  async getReservations(status?: string): Promise<ApiResult<Reservation[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await apiRequest<Reservation[]>(`/books/reservations/${query}`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load reservations." };
    }
    return result;
  },

  async cancelReservation(id: number): Promise<ApiResult<ReservationCancelResponse>> {
    const result = await apiRequest<ReservationCancelResponse>(`/books/reservations/${id}/cancel/`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({}),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to cancel reservation." };
    }
    return result;
  },

  async getFinePayments(status?: string): Promise<ApiResult<FinePayment[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await apiRequest<FinePayment[]>(`/books/fine-payments/${query}`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load fine payments." };
    }
    return result;
  },

  async getFineSummary(): Promise<ApiResult<FineSummary>> {
    const result = await apiRequest<FineSummary>("/books/fine-payments/summary/", {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load fine summary." };
    }
    return result;
  },

  async markFinePaid(
    id: number,
    payload?: { payment_method?: string; payment_reference?: string; notes?: string }
  ): Promise<ApiResult<FinePaymentActionResponse>> {
    const result = await apiRequest<FinePaymentActionResponse>(`/books/fine-payments/${id}/mark-paid/`, {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload ?? {}),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to mark fine as paid." };
    }
    return result;
  },

  async waiveFine(id: number, notes?: string): Promise<ApiResult<FinePaymentActionResponse>> {
    const result = await apiRequest<FinePaymentActionResponse>(`/books/fine-payments/${id}/waive/`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ notes: notes ?? "" }),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to waive fine." };
    }
    return result;
  },
};
