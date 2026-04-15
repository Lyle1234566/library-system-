import axios from "axios";
import { ApiResult } from "../types";
import { axiosClient } from "../lib/axios";

type PasswordResetRequestResponse = {
  message?: string;
  code_length?: number;
  expires_in_minutes?: number;
  code?: string;
  email_delivery?: string;
};

type PasswordResetVerifyResponse = {
  message?: string;
};

type PasswordResetConfirmResponse = {
  message?: string;
};

export type PasswordResetRequestResult = {
  message: string;
  codeLength?: number;
  expiresInMinutes?: number;
  debugCode?: string;
  emailDelivery?: string;
};

export type PasswordResetVerifyPayload = {
  email: string;
  code: string;
};

export type PasswordResetVerifyResult = {
  message: string;
};

export type PasswordResetConfirmPayload = {
  email: string;
  code: string;
  new_password: string;
  new_password_confirm: string;
};

export type PasswordResetConfirmResult = {
  message: string;
};

type ErrorPayload = Record<string, unknown>;

const parseErrorPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const directKeys = [
    "detail",
    "message",
    "email",
    "code",
    "new_password",
    "new_password_confirm",
    "non_field_errors",
  ];

  const record = payload as ErrorPayload;
  for (const key of directKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string");
      if (typeof first === "string" && first.trim()) {
        return first;
      }
    }
  }

  for (const value of Object.values(record)) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string");
      if (typeof first === "string" && first.trim()) {
        return first;
      }
    }
  }

  return null;
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const responsePayload = error.response?.data;
    const parsed = parseErrorPayload(responsePayload);
    if (parsed) return parsed;

    if (error.code === "ECONNABORTED") {
      return "The request timed out. Please try again.";
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

export const passwordResetApi = {
  async requestCode(email: string): Promise<ApiResult<PasswordResetRequestResult>> {
    try {
      const response = await axiosClient.post<PasswordResetRequestResponse>("/forgot-password/", {
        email: email.trim().toLowerCase(),
      });

      return {
        data: {
          message: response.data.message ?? "If that email is registered, a reset code has been sent.",
          codeLength:
            typeof response.data.code_length === "number" && Number.isFinite(response.data.code_length)
              ? response.data.code_length
              : undefined,
          expiresInMinutes:
            typeof response.data.expires_in_minutes === "number" &&
            Number.isFinite(response.data.expires_in_minutes)
              ? response.data.expires_in_minutes
              : undefined,
          debugCode:
            typeof response.data.code === "string" && response.data.code.trim()
              ? response.data.code.trim()
              : undefined,
          emailDelivery:
            typeof response.data.email_delivery === "string" && response.data.email_delivery.trim()
              ? response.data.email_delivery.trim()
              : undefined,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: toErrorMessage(error, "Unable to request password reset."),
      };
    }
  },

  async verifyCode(payload: PasswordResetVerifyPayload): Promise<ApiResult<PasswordResetVerifyResult>> {
    try {
      const response = await axiosClient.post<PasswordResetVerifyResponse>("/verify-code/", {
        email: payload.email.trim().toLowerCase(),
        code: payload.code.trim(),
      });

      return {
        data: {
          message: response.data.message ?? "Reset code verified.",
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: toErrorMessage(error, "Unable to verify reset code."),
      };
    }
  },

  async resetPassword(
    payload: PasswordResetConfirmPayload
  ): Promise<ApiResult<PasswordResetConfirmResult>> {
    try {
      const response = await axiosClient.post<PasswordResetConfirmResponse>("/reset-password/", {
        email: payload.email.trim().toLowerCase(),
        code: payload.code.trim(),
        new_password: payload.new_password,
        new_password_confirm: payload.new_password_confirm,
      });

      return {
        data: {
          message: response.data.message ?? "Password reset successful.",
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: toErrorMessage(error, "Unable to reset password."),
      };
    }
  },
};
