import {
  ApiResult,
  AuthTokens,
  LoginCredentials,
  LoginOtpChallenge,
  RegisterPayload,
  RegisterRole,
  User,
} from "../types";
import { apiRequest } from "../lib/http";
import { tokenStorage } from "../lib/tokenStorage";

type LoginResponse = {
  user?: User;
  access?: string;
  refresh?: string;
  requires_otp?: boolean;
  otp_session?: string;
  email?: string;
  full_name?: string;
  role?: User["role"];
  student_id?: string | null;
  staff_id?: string | null;
  message?: string;
};

type RegisterResponse = {
  user?: User;
  access?: string;
  refresh?: string;
  requires_otp?: boolean;
  requires_approval?: boolean;
  email_verified?: boolean;
  otp_session?: string;
  email?: string;
  full_name?: string;
  role?: User["role"];
  student_id?: string | null;
  staff_id?: string | null;
  message?: string;
};

type PasswordResetRequestResponse = {
  message?: string;
  code_length?: number;
  expires_in_minutes?: number;
  code?: string;
  email_delivery?: string;
};

type PasswordResetConfirmResponse = {
  message?: string;
};

type PasswordResetVerifyResponse = {
  message?: string;
};

type StudentIdCheckResponse = {
  available?: boolean;
  message?: string;
};

type PendingAccountsResponse = {
  results?: User[];
};

type SendLoginOtpResponse = {
  message?: string;
  email?: string;
};

type VerifyLoginOtpResponse = {
  user?: User;
  access?: string;
  refresh?: string;
  requires_approval?: boolean;
  email_verified?: boolean;
  message?: string;
};

type UpdatePendingEmailResponse = {
  message?: string;
  email?: string;
  otp_session?: string;
};

export type LoginResult = {
  user: User | null;
  tokens: AuthTokens | null;
  otpChallenge: LoginOtpChallenge | null;
  message?: string;
};

export type RegisterResult = {
  user: User | null;
  requiresApproval: boolean;
  otpChallenge: LoginOtpChallenge | null;
  message?: string;
};

export type PasswordResetRequestResult = {
  message: string;
  codeLength?: number;
  expiresInMinutes?: number;
  debugCode?: string;
  emailDelivery?: string;
};

export type PasswordResetConfirmPayload = {
  email: string;
  code: string;
  new_password: string;
  new_password_confirm: string;
};

export type PasswordResetVerifyPayload = {
  email: string;
  code: string;
};

export type PasswordResetConfirmResult = {
  message: string;
};

export type PasswordResetVerifyResult = {
  message: string;
};

export type ApproveAccountOptions = {
  is_working_student?: boolean;
};

export type SendLoginOtpResult = {
  message: string;
  email?: string;
};

export type VerifyLoginOtpResult = {
  user: User | null;
  tokens: AuthTokens | null;
  requiresApproval: boolean;
  emailVerified: boolean;
  message?: string;
};

export type UpdatePendingEmailResult = {
  message: string;
  email: string | null;
  otpSession: string | null;
};

export const authApi = {
  async login(credentials: LoginCredentials): Promise<ApiResult<LoginResult>> {
    const result = await apiRequest<LoginResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Login failed." };
    }

    if (
      result.data.requires_otp &&
      typeof result.data.otp_session === "string" &&
      result.data.email &&
      result.data.full_name &&
      result.data.role
    ) {
      await tokenStorage.clearTokens();

      return {
        data: {
          user: null,
          tokens: null,
          otpChallenge: {
            requires_otp: true,
            otp_session: result.data.otp_session,
            email: result.data.email,
            full_name: result.data.full_name,
            role: result.data.role,
            student_id: result.data.student_id ?? null,
            staff_id: result.data.staff_id ?? null,
            message: result.data.message,
          },
          message: result.data.message,
        },
        error: null,
      };
    }

    if (!result.data.access || !result.data.refresh) {
      return { data: null, error: "Invalid login response from server." };
    }

    await tokenStorage.setTokens({
      access: result.data.access,
      refresh: result.data.refresh,
    });

    if (result.data.user) {
      return {
        data: {
          user: result.data.user,
          tokens: {
            access: result.data.access,
            refresh: result.data.refresh,
          },
          otpChallenge: null,
          message: result.data.message,
        },
        error: null,
      };
    }

    const profile = await authApi.getProfile();
    if (profile.error || !profile.data) {
      await tokenStorage.clearTokens();
      return { data: null, error: profile.error ?? "Unable to load your profile." };
    }

    return {
      data: {
        user: profile.data,
        tokens: {
          access: result.data.access,
          refresh: result.data.refresh,
        },
        otpChallenge: null,
        message: result.data.message,
      },
      error: null,
    };
  },

  async register(payload: RegisterPayload): Promise<ApiResult<RegisterResult>> {
    const result = await apiRequest<RegisterResponse>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({
        role: payload.role,
        ...(payload.student_id ? { student_id: payload.student_id.trim() } : {}),
        ...(payload.staff_id ? { staff_id: payload.staff_id.trim() } : {}),
        full_name: payload.full_name.trim(),
        email: payload.email?.trim() || null,
        password: payload.password,
        password_confirm: payload.password_confirm,
      }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Registration failed." };
    }

    const requiresApproval = !result.data.access || !result.data.refresh;
    if (!requiresApproval) {
      await tokenStorage.setTokens({
        access: result.data.access as string,
        refresh: result.data.refresh as string,
      });
    } else {
      await tokenStorage.clearTokens();
    }

    return {
      data: {
        user: result.data.user ?? null,
        requiresApproval,
        otpChallenge:
          result.data.requires_otp &&
          typeof result.data.otp_session === "string" &&
          result.data.email &&
          result.data.full_name &&
          result.data.role
            ? {
                requires_otp: true,
                otp_session: result.data.otp_session,
                email: result.data.email,
                full_name: result.data.full_name,
                role: result.data.role,
                student_id: result.data.student_id ?? null,
                staff_id: result.data.staff_id ?? null,
                message: result.data.message,
              }
            : null,
        message: result.data.message,
      },
      error: null,
    };
  },

  async getProfile(): Promise<ApiResult<User>> {
    const result = await apiRequest<User>("/auth/profile/", {
      method: "GET",
      auth: true,
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load profile." };
    }

    return result;
  },

  async checkStudentId(studentId: string): Promise<ApiResult<StudentIdCheckResponse>> {
    return this.checkAccountIdentifier(studentId, "STUDENT");
  },

  async checkAccountIdentifier(
    identifier: string,
    role: RegisterRole
  ): Promise<ApiResult<StudentIdCheckResponse>> {
    const result = await apiRequest<StudentIdCheckResponse>(
      `/auth/check-account-identifier/?identifier=${encodeURIComponent(identifier)}&role=${role}`,
      {
        method: "GET",
      }
    );

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to check account ID." };
    }

    return result;
  },

  async getPendingStudents(): Promise<ApiResult<User[]>> {
    const result = await apiRequest<PendingAccountsResponse>("/auth/pending-accounts/", {
      method: "GET",
      auth: true,
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load pending accounts." };
    }

    return { data: result.data.results ?? [], error: null };
  },

  async approveStudent(
    userId: number,
    options?: ApproveAccountOptions
  ): Promise<ApiResult<User>> {
    const result = await apiRequest<User>(`/auth/approve-account/${userId}/`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        is_working_student: Boolean(options?.is_working_student),
      }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to approve account." };
    }

    return result;
  },

  async requestPasswordReset(email: string): Promise<ApiResult<PasswordResetRequestResult>> {
    const result = await apiRequest<PasswordResetRequestResponse>("/auth/password-reset/request/", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to request password reset." };
    }

    return {
      data: {
        message: result.data.message ?? "If that email is registered, a reset code has been sent.",
        codeLength:
          typeof result.data.code_length === "number" && Number.isFinite(result.data.code_length)
            ? result.data.code_length
            : undefined,
        expiresInMinutes:
          typeof result.data.expires_in_minutes === "number" &&
          Number.isFinite(result.data.expires_in_minutes)
            ? result.data.expires_in_minutes
            : undefined,
        debugCode:
          typeof result.data.code === "string" && result.data.code.trim()
            ? result.data.code.trim()
            : undefined,
        emailDelivery:
          typeof result.data.email_delivery === "string" && result.data.email_delivery.trim()
            ? result.data.email_delivery.trim()
            : undefined,
      },
      error: null,
    };
  },

  async confirmPasswordReset(
    payload: PasswordResetConfirmPayload
  ): Promise<ApiResult<PasswordResetConfirmResult>> {
    const result = await apiRequest<PasswordResetConfirmResponse>("/auth/password-reset/confirm/", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email.trim().toLowerCase(),
        code: payload.code.trim(),
        new_password: payload.new_password,
        new_password_confirm: payload.new_password_confirm,
      }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to reset password." };
    }

    return {
      data: {
        message: result.data.message ?? "Password reset successful.",
      },
      error: null,
    };
  },

  async verifyPasswordResetCode(
    payload: PasswordResetVerifyPayload
  ): Promise<ApiResult<PasswordResetVerifyResult>> {
    const result = await apiRequest<PasswordResetVerifyResponse>("/auth/password-reset/verify/", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email.trim().toLowerCase(),
        code: payload.code.trim(),
      }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to verify reset code." };
    }

    return {
      data: {
        message: result.data.message ?? "Reset code verified.",
      },
      error: null,
    };
  },

  async sendLoginOtp(otpSession: string): Promise<ApiResult<SendLoginOtpResult>> {
    const result = await apiRequest<SendLoginOtpResponse>("/auth/login-otp/send/", {
      method: "POST",
      body: JSON.stringify({ otp_session: otpSession }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to send OTP." };
    }

    return {
      data: {
        message: result.data.message ?? "OTP code sent to your email.",
        email: result.data.email,
      },
      error: null,
    };
  },

  async verifyLoginOtp(otpSession: string, code: string): Promise<ApiResult<VerifyLoginOtpResult>> {
    const result = await apiRequest<VerifyLoginOtpResponse>("/auth/login-otp/verify/", {
      method: "POST",
      body: JSON.stringify({
        otp_session: otpSession,
        code: code.trim(),
      }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to verify OTP." };
    }

    if (result.data.requires_approval || result.data.email_verified) {
      return {
        data: {
          user: null,
          tokens: null,
          requiresApproval: Boolean(result.data.requires_approval),
          emailVerified: Boolean(result.data.email_verified),
          message: result.data.message,
        },
        error: null,
      };
    }

    if (!result.data.user || !result.data.access || !result.data.refresh) {
      return { data: null, error: "Invalid OTP verification response from server." };
    }

    return {
      data: {
        user: result.data.user,
        tokens: {
          access: result.data.access,
          refresh: result.data.refresh,
        },
        requiresApproval: false,
        emailVerified: false,
        message: result.data.message,
      },
      error: null,
    };
  },

  async updatePendingEmail(otpSession: string, email: string): Promise<ApiResult<UpdatePendingEmailResult>> {
    const result = await apiRequest<UpdatePendingEmailResponse>("/auth/update-email/", {
      method: "POST",
      body: JSON.stringify({
        otp_session: otpSession,
        email: email.trim().toLowerCase(),
      }),
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to update email." };
    }

    return {
      data: {
        message: result.data.message ?? "Email updated successfully.",
        email: result.data.email ?? null,
        otpSession: result.data.otp_session ?? null,
      },
      error: null,
    };
  },

  async logout(): Promise<void> {
    const refresh = await tokenStorage.getRefreshToken();

    try {
      if (refresh) {
        await apiRequest<{ message?: string }>("/auth/logout/", {
          method: "POST",
          auth: true,
          retryOnAuthError: false,
          body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      await tokenStorage.clearTokens();
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const accessToken = await tokenStorage.getAccessToken();
    return Boolean(accessToken);
  },
};
