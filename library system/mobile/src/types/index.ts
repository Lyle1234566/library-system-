export type UserRole = "STUDENT" | "TEACHER" | "LIBRARIAN" | "WORKING" | "ADMIN" | "STAFF";
export type Portal = "student" | "teacher" | "librarian" | "staff";
export type ReportingFrequency = "NONE" | "WEEKLY" | "MONTHLY";
export type RegisterRole = "STUDENT" | "TEACHER";

export interface User {
  id: number;
  username: string;
  student_id: string | null;
  staff_id: string | null;
  email: string | null;
  full_name: string;
  avatar: string | null;
  role: UserRole;
  is_working_student: boolean;
  is_active: boolean;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  student_id: string;
  password: string;
  portal?: Portal;
}

export interface LoginOtpChallenge {
  requires_otp: true;
  otp_session: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_id?: string | null;
  staff_id?: string | null;
  message?: string;
}

export interface RegisterPayload {
  role: RegisterRole;
  student_id?: string;
  staff_id?: string;
  full_name: string;
  email?: string;
  password: string;
  password_confirm: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  published_date: string;
  genre: string;
  description?: string;
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
}

export interface BorrowRequestUser {
  id: number;
  student_id: string | null;
  staff_id?: string | null;
  full_name: string;
  role: UserRole;
  is_working_student?: boolean;
}

export interface BorrowRequest {
  id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";
  requested_at: string;
  processed_at: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  late_fee_amount?: string;
  overdue_days?: number;
  renewal_count?: number;
  max_renewals?: number;
  last_renewed_at?: string | null;
  requested_borrow_days?: number;
  reporting_frequency?: ReportingFrequency;
  last_reported_at?: string | null;
  next_report_due_date?: string | null;
  is_report_due?: boolean;
  report_overdue_days?: number;
  processed_by: BorrowRequestUser | null;
}

export interface ReturnRequest {
  id: number;
  borrow_request_id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_at: string;
  processed_at: string | null;
  processed_by: BorrowRequestUser | null;
}

export interface Reservation {
  id: number;
  book: Book;
  user: BorrowRequestUser | null;
  status: "PENDING" | "NOTIFIED" | "FULFILLED" | "CANCELLED" | "EXPIRED";
  created_at: string;
  notified_at?: string | null;
  expires_at?: string | null;
  position: number;
  current_position?: number | null;
}

export interface FinePayment {
  id: number;
  borrow_request_id: number;
  receipt_number?: string | null;
  book: Book;
  user: BorrowRequestUser | null;
  amount: string;
  status: "PENDING" | "PAID" | "WAIVED";
  payment_method?: string;
  payment_reference?: string;
  paid_at?: string | null;
  notes?: string;
  created_at: string;
}

export interface FineSummary {
  unpaid_total: string;
  pending_count: number;
  block_threshold: string;
  is_borrow_blocked: boolean;
}

export interface NotificationItem {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}
