// Authentication API service module for connecting to Django backend

import { API_BASE_URL } from '@/lib/api-config';

// User interface matching Django model
export interface User {
  id: number;
  student_id: string | null;
  staff_id?: string | null;
  email: string | null;
  email_verified?: boolean;
  full_name: string;
  avatar?: string | null;
  role: 'STUDENT' | 'TEACHER' | 'LIBRARIAN' | 'WORKING' | 'ADMIN' | 'STAFF';
  is_working_student: boolean;
  is_active: boolean;
  date_joined: string;
}

// Auth response types
export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  student_id: string;
  password: string;
  portal?: 'student' | 'teacher' | 'librarian' | 'staff';
}

export type RegisterRole = 'STUDENT' | 'TEACHER';

export interface RegisterData {
  role: RegisterRole;
  student_id?: string;
  staff_id?: string;
  full_name: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface LoginOtpChallenge {
  requires_otp: true;
  otp_session: string;
  email: string;
  full_name: string;
  role: User['role'];
  student_id?: string | null;
  staff_id?: string | null;
  message?: string;
}

export interface AuthResponse {
  user: User | null;
  tokens: AuthTokens | null;
  error: string | null;
  otpChallenge?: LoginOtpChallenge | null;
  requiresApproval?: boolean;
  emailVerified?: boolean;
  message?: string | null;
}

export interface ApiError {
  detail?: string;
  role?: string[];
  student_id?: string[];
  staff_id?: string[];
  portal?: string[];
  email?: string[];
  password?: string[];
  old_password?: string[];
  new_password?: string[];
  new_password_confirm?: string[];
  full_name?: string[];
  non_field_errors?: string[];
}

type AuthTokenResponse = {
  user?: User;
  access?: string;
  refresh?: string;
  requires_otp?: boolean;
  requires_approval?: boolean;
  email_verified?: boolean;
  otp_session?: string;
  email?: string;
  full_name?: string;
  role?: User['role'];
  student_id?: string | null;
  staff_id?: string | null;
  message?: string;
};

type StudentIdCheckResponse = {
  available?: boolean;
  reason?: string;
  message?: string;
};

export type IdentifierAvailabilityResult = {
  available: boolean;
  reason?: string;
  message: string;
};

type RefreshTokenResponse = {
  access?: string;
  refresh?: string;
};

type PasswordResetRequestResponse = {
  message?: string;
  detail?: string;
  code_length?: number;
  expires_in_minutes?: number;
  code?: string;
  email_delivery?: string;
};

type PasswordResetConfirmResponse = {
  message?: string;
  detail?: string;
};

type PasswordResetVerifyResponse = {
  message?: string;
  detail?: string;
};

type PendingStudentsResponse = {
  results?: User[];
  detail?: string;
};

export interface PasswordResetRequestResult {
  message: string;
  error: string | null;
  codeLength?: number;
  expiresInMinutes?: number;
  debugCode?: string;
  emailDelivery?: string;
}

export interface PasswordResetConfirmPayload {
  email: string;
  code: string;
  new_password: string;
  new_password_confirm: string;
}

export interface PasswordResetVerifyPayload {
  email: string;
  code: string;
}

export interface PasswordResetConfirmResult {
  message: string;
  error: string | null;
}

export interface PasswordResetVerifyResult {
  message: string;
  error: string | null;
}

export interface UpdateProfilePayload {
  full_name?: string;
  email?: string | null;
}

export interface UpdateProfileFormResult {
  user: User | null;
  error: string | null;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface ChangePasswordResult {
  message: string;
  error: string | null;
}

export interface PendingStudentsResult {
  data: User[] | null;
  error: string | null;
}

export interface SendLoginOtpResult {
  message: string;
  email?: string;
  error: string | null;
}

export interface UpdatePendingEmailResult {
  message: string;
  email: string | null;
  otpSession: string | null;
  error: string | null;
}

export interface ApproveStudentResult {
  data: User | null;
  error: string | null;
}

export interface ApproveStudentOptions {
  is_working_student?: boolean;
}

// Token storage utilities
export const tokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
  },

  setTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    const rememberMe = tokenStorage.getRememberMe();

    if (rememberMe) {
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      return;
    }

    sessionStorage.setItem('access_token', tokens.access);
    sessionStorage.setItem('refresh_token', tokens.refresh);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  },

  getRememberMe(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('remember_me') === 'true';
  },

  setRememberMe(value: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('remember_me', value.toString());
  },
};

// Parse API error response
const parseApiError = (error: ApiError): string => {
  if (error.detail) return error.detail;
  if (error.role) return `Role: ${error.role.join(', ')}`;
  if (error.student_id) return `Student ID: ${error.student_id.join(', ')}`;
  if (error.staff_id) return `Staff ID: ${error.staff_id.join(', ')}`;
  if (error.portal) return `Portal: ${error.portal.join(', ')}`;
  if (error.email) return `Email: ${error.email.join(', ')}`;
  if (error.password) return `Password: ${error.password.join(', ')}`;
  if (error.old_password) return `Current password: ${error.old_password.join(', ')}`;
  if (error.new_password) return `New password: ${error.new_password.join(', ')}`;
  if (error.new_password_confirm) return `Confirm password: ${error.new_password_confirm.join(', ')}`;
  if (error.full_name) return `Name: ${error.full_name.join(', ')}`;
  if (error.non_field_errors) return error.non_field_errors.join(', ');
  return 'An unexpected error occurred';
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
    return parseApiError(data as ApiError);
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

// Auth API
export const authApi = {
  // Login user with ID (student or staff)
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const { data, text } = await parseJsonResponse<AuthTokenResponse>(response);
      if (!response.ok) {
        return {
          user: null,
          tokens: null,
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
          otpChallenge: null,
          message: null,
        };
      }

      if (data.requires_otp && data.otp_session && data.email && data.full_name && data.role) {
        return {
          user: null,
          tokens: null,
          error: null,
          otpChallenge: {
            requires_otp: true,
            otp_session: data.otp_session,
            email: data.email,
            full_name: data.full_name,
            role: data.role,
            student_id: data.student_id ?? null,
            staff_id: data.staff_id ?? null,
            message: data.message,
          },
          message: data.message ?? null,
        };
      }

      // Store tokens
      if (data.access && data.refresh) {
        tokenStorage.setTokens({ access: data.access, refresh: data.refresh });
      }

      const tokens =
        data.access && data.refresh
          ? { access: data.access, refresh: data.refresh }
          : null;

      return {
        user: data.user || null,
        tokens,
        error: null,
        otpChallenge: null,
        message: data.message ?? null,
      };
    } catch (error) {
      return {
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
        otpChallenge: null,
        message: null,
      };
    }
  },

  // Register a new student or teacher account
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          role: data.role,
          ...(data.student_id ? { student_id: data.student_id } : {}),
          ...(data.staff_id ? { staff_id: data.staff_id } : {}),
          full_name: data.full_name,
          email: data.email || null,
          password: data.password,
          password_confirm: data.password_confirm,
        }),
      });

      const { data: responseData, text } = await parseJsonResponse<AuthTokenResponse>(response);
      if (!response.ok) {
        return {
          user: null,
          tokens: null,
          error: normalizeErrorMessage(response, responseData, text),
        };
      }

      if (responseData === null) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
          otpChallenge: null,
          requiresApproval: false,
          emailVerified: false,
          message: null,
        };
      }

      if (
        responseData.requires_otp &&
        responseData.otp_session &&
        responseData.email &&
        responseData.full_name &&
        responseData.role
      ) {
        return {
          user: responseData.user || null,
          tokens: null,
          error: null,
          otpChallenge: {
            requires_otp: true,
            otp_session: responseData.otp_session,
            email: responseData.email,
            full_name: responseData.full_name,
            role: responseData.role,
            student_id: responseData.student_id ?? null,
            staff_id: responseData.staff_id ?? null,
            message: responseData.message,
          },
          requiresApproval: false,
          emailVerified: false,
          message: responseData.message ?? null,
        };
      }

      // Auto-login after registration if tokens are returned
      if (responseData.access && responseData.refresh) {
        tokenStorage.setTokens({ access: responseData.access, refresh: responseData.refresh });
      }

      const tokens =
        responseData.access && responseData.refresh
          ? { access: responseData.access, refresh: responseData.refresh }
          : null;

      return {
        user: responseData.user || null,
        tokens,
        error: null,
        otpChallenge: null,
        requiresApproval: Boolean(responseData.requires_approval),
        emailVerified: Boolean(responseData.email_verified),
        message: responseData.message ?? null,
      };
    } catch (error) {
      return {
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
        otpChallenge: null,
        requiresApproval: false,
        emailVerified: false,
        message: null,
      };
    }
  },

  // Check if student ID is available
  async checkStudentId(studentId: string): Promise<IdentifierAvailabilityResult> {
    return this.checkAccountIdentifier(studentId, 'STUDENT');
  },

  async checkAccountIdentifier(
    identifier: string,
    role: RegisterRole
  ): Promise<IdentifierAvailabilityResult> {
    try {
      const params = new URLSearchParams({
        identifier,
        role,
      });
      const response = await fetch(
        `${API_BASE_URL}/auth/check-account-identifier/?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      const { data, text } = await parseJsonResponse<StudentIdCheckResponse>(response);
      if (!response.ok) {
        return {
          available: false,
          reason: data?.reason,
          message: normalizeErrorMessage(response, data, text),
        };
      }
      if (data === null) {
        return {
          available: false,
          reason: undefined,
          message: text.trim().startsWith('<')
            ? 'Unexpected response from server. Check the API URL and backend status.'
            : 'Unable to check account ID availability',
        };
      }
      return {
        available: data.available || false,
        reason: data.reason,
        message: data.message || '',
      };
    } catch {
      return {
        available: false,
        reason: undefined,
        message: 'Unable to check account ID availability',
      };
    }
  },

  async sendLoginOtp(otpSession: string): Promise<SendLoginOtpResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login-otp/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ otp_session: otpSession }),
      });

      const { data, text } = await parseJsonResponse<{ message?: string; email?: string }>(response);
      if (!response.ok) {
        return {
          message: '',
          email: undefined,
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          message: '',
          email: undefined,
          error: 'Unexpected response from server.',
        };
      }

      return {
        message: data.message ?? 'OTP code sent to your email.',
        email: data.email,
        error: null,
      };
    } catch (error) {
      return {
        message: '',
        email: undefined,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  async verifyLoginOtp(otpSession: string, code: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login-otp/verify/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          otp_session: otpSession,
          code: code.trim(),
        }),
      });

      const { data, text } = await parseJsonResponse<AuthTokenResponse>(response);
      if (!response.ok) {
        return {
          user: null,
          tokens: null,
          error: normalizeErrorMessage(response, data, text),
          otpChallenge: null,
          requiresApproval: false,
          emailVerified: false,
          message: null,
        };
      }

      if (data === null) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
          otpChallenge: null,
          requiresApproval: false,
          emailVerified: false,
          message: null,
        };
      }

      if (data.requires_approval || data.email_verified) {
        return {
          user: null,
          tokens: null,
          error: null,
          otpChallenge: null,
          requiresApproval: Boolean(data.requires_approval),
          emailVerified: Boolean(data.email_verified),
          message: data.message ?? null,
        };
      }

      if (!data.user || !data.access || !data.refresh) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
          otpChallenge: null,
          requiresApproval: false,
          emailVerified: false,
          message: null,
        };
      }

      return {
        user: data.user,
        tokens: {
          access: data.access,
          refresh: data.refresh,
        },
        error: null,
        otpChallenge: null,
        requiresApproval: false,
        emailVerified: false,
        message: data.message ?? null,
      };
    } catch (error) {
      return {
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
        otpChallenge: null,
        requiresApproval: false,
        emailVerified: false,
        message: null,
      };
    }
  },

  async updatePendingEmail(otpSession: string, email: string): Promise<UpdatePendingEmailResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/update-email/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          otp_session: otpSession,
          email: email.trim(),
        }),
      });

      const { data, text } = await parseJsonResponse<{ message?: string; email?: string; otp_session?: string }>(response);
      if (!response.ok) {
        return {
          message: '',
          email: null,
          otpSession: null,
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          message: '',
          email: null,
          otpSession: null,
          error: 'Unexpected response from server.',
        };
      }

      return {
        message: data.message ?? 'Email updated successfully. Please verify with OTP.',
        email: data.email ?? null,
        otpSession: data.otp_session ?? null,
        error: null,
      };
    } catch (error) {
      return {
        message: '',
        email: null,
        otpSession: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Request a password reset code via email
  async requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/request/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const { data, text } = await parseJsonResponse<PasswordResetRequestResponse>(response);
      if (!response.ok) {
        return {
          message: '',
          error: normalizeErrorMessage(response, data, text),
          codeLength: undefined,
          expiresInMinutes: undefined,
          debugCode: undefined,
          emailDelivery: undefined,
        };
      }

      if (data === null) {
        return {
          message: '',
          error: 'Unexpected response from server.',
          codeLength: undefined,
          expiresInMinutes: undefined,
          debugCode: undefined,
          emailDelivery: undefined,
        };
      }

      return {
        message: data.message ?? 'If that email is registered, a reset code has been sent.',
        error: null,
        codeLength:
          typeof data.code_length === 'number' && Number.isFinite(data.code_length)
            ? data.code_length
            : undefined,
        expiresInMinutes:
          typeof data.expires_in_minutes === 'number' && Number.isFinite(data.expires_in_minutes)
            ? data.expires_in_minutes
            : undefined,
        debugCode:
          typeof data.code === 'string' && data.code.trim()
            ? data.code.trim()
            : undefined,
        emailDelivery:
          typeof data.email_delivery === 'string' && data.email_delivery.trim()
            ? data.email_delivery.trim()
            : undefined,
      };
    } catch (error) {
      return {
        message: '',
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
        codeLength: undefined,
        expiresInMinutes: undefined,
        debugCode: undefined,
        emailDelivery: undefined,
      };
    }
  },

  // Verify reset code before showing the new password form
  async verifyPasswordResetCode(payload: PasswordResetVerifyPayload): Promise<PasswordResetVerifyResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/verify-code/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          code: payload.code.trim(),
        }),
      });

      const { data, text } = await parseJsonResponse<PasswordResetVerifyResponse>(response);
      if (!response.ok) {
        return {
          message: '',
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          message: '',
          error: 'Unexpected response from server.',
        };
      }

      return {
        message: data.message ?? 'Reset code verified.',
        error: null,
      };
    } catch (error) {
      return {
        message: '',
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Confirm reset code and set a new password
  async confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<PasswordResetConfirmResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const { data, text } = await parseJsonResponse<PasswordResetConfirmResponse>(response);
      if (!response.ok) {
        return {
          message: '',
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          message: '',
          error: 'Unexpected response from server.',
        };
      }

      return {
        message: data.message ?? 'Password reset successful.',
        error: null,
      };
    } catch (error) {
      return {
        message: '',
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Update current user profile
  async updateProfile(payload: UpdateProfilePayload): Promise<AuthResponse> {
    try {
      const accessToken = tokenStorage.getAccessToken();

      if (!accessToken) {
        return {
          user: null,
          tokens: null,
          error: 'Not authenticated',
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          return refreshResult;
        }
        return this.updateProfile(payload);
      }

      const { data, text } = await parseJsonResponse<User>(response);
      if (!response.ok) {
        return {
          user: null,
          tokens: null,
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
        };
      }

      return {
        user: data,
        tokens: null,
        error: null,
      };
    } catch (error) {
      return {
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResult> {
    try {
      const accessToken = tokenStorage.getAccessToken();

      if (!accessToken) {
        return {
          message: '',
          error: 'Not authenticated',
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/change-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          return { message: '', error: refreshResult.error };
        }
        return this.changePassword(payload);
      }

      const { data, text } = await parseJsonResponse<{ message?: string }>(response);
      if (!response.ok) {
        return {
          message: '',
          error: normalizeErrorMessage(response, data, text),
        };
      }

      return {
        message: data?.message ?? 'Password changed successfully.',
        error: null,
      };
    } catch (error) {
      return {
        message: '',
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Update profile with avatar upload (multipart/form-data)
  async updateProfileWithAvatar(formData: FormData): Promise<UpdateProfileFormResult> {
    try {
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) {
        return { user: null, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/profile/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (response.status === 401) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          return { user: null, error: refreshResult.error };
        }
        return this.updateProfileWithAvatar(formData);
      }

      const { data, text } = await parseJsonResponse<User>(response);
      if (!response.ok) {
        return { user: null, error: normalizeErrorMessage(response, data, text) };
      }

      if (data === null) {
        return { user: null, error: 'Unexpected response from server.' };
      }

      return { user: data, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // List pending student and teacher accounts
  async getPendingStudents(): Promise<PendingStudentsResult> {
    try {
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) {
        return { data: null, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/pending-accounts/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          return { data: null, error: refreshResult.error };
        }
        return this.getPendingStudents();
      }

      const { data, text } = await parseJsonResponse<PendingStudentsResponse>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }

      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }

      return { data: data.results ?? [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Approve a pending student or teacher account
  async approveStudent(userId: number, options?: ApproveStudentOptions): Promise<ApproveStudentResult> {
    try {
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) {
        return { data: null, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/approve-account/${userId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          is_working_student: Boolean(options?.is_working_student),
        }),
      });

      if (response.status === 401) {
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          return { data: null, error: refreshResult.error };
        }
        return this.approveStudent(userId, options);
      }

      const { data, text } = await parseJsonResponse<User>(response);
      if (!response.ok) {
        return { data: null, error: normalizeErrorMessage(response, data, text) };
      }

      if (data === null) {
        return { data: null, error: 'Unexpected response from server.' };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Refresh access token
  async refreshToken(): Promise<AuthResponse> {
    try {
      const refreshToken = tokenStorage.getRefreshToken();
      
      if (!refreshToken) {
        return {
          user: null,
          tokens: null,
          error: 'No refresh token available',
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      const { data, text } = await parseJsonResponse<RefreshTokenResponse>(response);
      if (!response.ok) {
        tokenStorage.clearTokens();
        return {
          user: null,
          tokens: null,
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
        };
      }

      // Update access token
      if (data.access) {
        const nextRefreshToken = data.refresh ?? refreshToken;
        const tokens = { access: data.access, refresh: nextRefreshToken };
        tokenStorage.setTokens(tokens);
        return {
          user: null,
          tokens,
          error: null,
        };
      }

      return {
        user: null,
        tokens: null,
        error: 'Failed to refresh token',
      };
    } catch (error) {
      return {
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Get current user profile
  async getProfile(): Promise<AuthResponse> {
    try {
      const accessToken = tokenStorage.getAccessToken();
      
      if (!accessToken) {
        return {
          user: null,
          tokens: null,
          error: 'Not authenticated',
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/profile/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        // Try to refresh token
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          return refreshResult;
        }
        // Retry with new token
        return this.getProfile();
      }

      const { data, text } = await parseJsonResponse<User>(response);
      if (!response.ok) {
        return {
          user: null,
          tokens: null,
          error: normalizeErrorMessage(response, data, text),
        };
      }

      if (data === null) {
        return {
          user: null,
          tokens: null,
          error: 'Unexpected response from server.',
        };
      }

      return {
        user: data,
        tokens: null,
        error: null,
      };
    } catch (error) {
      return {
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
      };
    }
  },

  // Logout user
  async logout(): Promise<void> {
    const refresh = tokenStorage.getRefreshToken();

    try {
      if (refresh) {
        const access = tokenStorage.getAccessToken();
        await fetch(`${API_BASE_URL}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      tokenStorage.clearTokens();
    }
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!tokenStorage.getAccessToken();
  },
};

export default authApi;
