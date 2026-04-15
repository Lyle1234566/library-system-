import { API_BASE_URL } from "../config/api";
import { AuthTokens, ApiResult } from "../types";
import { tokenStorage } from "./tokenStorage";

type JsonResponse = Record<string, unknown>;

type RequestOptions = RequestInit & {
  auth?: boolean;
  retryOnAuthError?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;
const REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 15000);

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const buildServerReachabilityHint = (): string => {
  if (API_BASE_URL.includes("10.0.2.2")) {
    return "Start Django with `python manage.py runserver 0.0.0.0:8000` and keep the Android emulator using `10.0.2.2`.";
  }

  if (
    API_BASE_URL.includes("127.0.0.1") ||
    API_BASE_URL.includes("localhost") ||
    API_BASE_URL.includes("0.0.0.0")
  ) {
    return "Avoid localhost from a physical device. Use your computer LAN IP and run Django on `0.0.0.0:8000`.";
  }

  return "Confirm the backend is running on the same host/port, the phone and computer share the same network, and the firewall allows port 8000.";
};

const buildTimeoutSignal = (signal?: AbortSignal): { signal?: AbortSignal; cleanup: () => void } => {
  if (typeof AbortController === "undefined") {
    return { signal, cleanup: () => undefined };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
};

const parseJsonResponse = async <T>(
  response: Response
): Promise<{ data: T | null; text: string }> => {
  const text = await response.text();
  if (!text) return { data: null, text: "" };
  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
};

const parseApiError = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const payload = data as JsonResponse;
  const directKeys = [
    "detail",
    "message",
    "role",
    "student_id",
    "staff_id",
    "portal",
    "email",
    "password",
    "password_confirm",
    "new_password",
    "new_password_confirm",
    "code",
    "full_name",
    "non_field_errors",
  ];

  for (const key of directKeys) {
    const value = payload[key];
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

  for (const value of Object.values(payload)) {
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

const normalizeError = (response: Response, data: unknown, text: string): string => {
  const parsed = parseApiError(data);
  if (parsed) return parsed;

  const trimmed = text.trim();
  if (trimmed) {
    if (trimmed.startsWith("<")) {
      return "Unexpected HTML response from server. Check API URL and backend status.";
    }
    return trimmed;
  }

  return `Request failed with status ${response.status}`;
};

const normalizeThrownError = (error: unknown): string => {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (isAbortError(error)) {
    return `Request timed out after ${REQUEST_TIMEOUT_MS}ms. ${buildServerReachabilityHint()}`;
  }
  if (error instanceof TypeError) {
    return `Unable to reach the server at ${API_BASE_URL}. ${buildServerReachabilityHint()}`;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unexpected network error. Please try again.";
};

const buildHeaders = (
  headers: HeadersInit | undefined,
  body: BodyInit | null | undefined,
  token?: string | null
): Headers => {
  const merged = new Headers(headers);
  if (!merged.has("Accept")) {
    merged.set("Accept", "application/json");
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && !merged.has("Content-Type") && body != null) {
    merged.set("Content-Type", "application/json");
  }

  if (token) {
    merged.set("Authorization", `Bearer ${token}`);
  }

  return merged;
};

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = await tokenStorage.getRefreshToken();
    if (!refresh) return null;

    try {
      const { signal, cleanup } = buildTimeoutSignal();
      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refresh }),
        signal,
      }).finally(cleanup);

      const { data } = await parseJsonResponse<{ access?: string; refresh?: string }>(response);
      if (!response.ok || !data?.access) {
        await tokenStorage.clearTokens();
        return null;
      }

      const tokens: AuthTokens = {
        access: data.access,
        refresh: data.refresh ?? refresh,
      };
      await tokenStorage.setTokens(tokens);
      return data.access;
    } catch {
      await tokenStorage.clearTokens();
      return null;
    }
  })();

  const token = await refreshPromise;
  refreshPromise = null;
  return token;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> => {
  try {
    const { auth = false, retryOnAuthError = true, ...requestInit } = options;
    const requestPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${API_BASE_URL}${requestPath}`;

    const execute = async (accessToken?: string | null) => {
      const headers = buildHeaders(requestInit.headers, requestInit.body, accessToken);
      const upstreamSignal = requestInit.signal ?? undefined;
      const { signal, cleanup } = buildTimeoutSignal(upstreamSignal);
      return fetch(url, {
        ...requestInit,
        headers,
        signal,
      }).finally(cleanup);
    };

    let token: string | null = null;
    if (auth) {
      token = await tokenStorage.getAccessToken();
    }

    let response = await execute(token);

    if (response.status === 401 && auth && retryOnAuthError) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        response = await execute(refreshedToken);
      } else {
        await tokenStorage.clearTokens();
      }
    }

    const { data, text } = await parseJsonResponse<T>(response);
    if (!response.ok) {
      return { data: null, error: normalizeError(response, data, text) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeThrownError(error) };
  }
};
