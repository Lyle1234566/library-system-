import { NativeModules, Platform } from "react-native";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const isLoopbackHost = (value: string | null | undefined) =>
  Boolean(value && LOOPBACK_HOSTS.has(value.toLowerCase()));

const extractDevHost = (): string | null => {
  const scriptUrl = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptUrl) return null;

  const match = scriptUrl.match(/^[a-z]+:\/\/([^/:]+)/i);
  const host = match?.[1]?.trim();
  if (!host) return null;

  if (isLoopbackHost(host)) {
    return null;
  }

  return host;
};

const resolveReachableHost = (devHost: string | null): string => {
  if (devHost) {
    return devHost;
  }

  if (Platform.OS === "android") {
    // Android emulator maps localhost to 10.0.2.2
    return "10.0.2.2";
  }

  return "127.0.0.1";
};

const normalizeConfiguredApiUrl = (value: string | undefined, devHost: string | null): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (isLoopbackHost(url.hostname)) {
      url.hostname = resolveReachableHost(devHost);
    }
    return trimTrailingSlash(url.toString());
  } catch {
    return trimTrailingSlash(value);
  }
};

const resolveDefaultApiUrl = (devHost: string | null): string => {
  const reachableHost = resolveReachableHost(devHost);
  return `http://${reachableHost}:8000/api`;
};

const devHost = extractDevHost();
const envApiUrl = normalizeConfiguredApiUrl(process.env.EXPO_PUBLIC_API_URL?.trim(), devHost);
const defaultApiUrl = resolveDefaultApiUrl(devHost);

const resolveApiBaseUrl = (): string => {
  if (envApiUrl) {
    return envApiUrl;
  }

  if (__DEV__ && devHost) {
    return defaultApiUrl;
  }

  return defaultApiUrl;
};

export const API_BASE_URL = trimTrailingSlash(resolveApiBaseUrl());
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export const resolveMediaUrl = (mediaPath?: string | null): string | null => {
  if (!mediaPath) return null;
  if (mediaPath.startsWith("http://") || mediaPath.startsWith("https://")) {
    return mediaPath;
  }
  if (mediaPath.startsWith("/")) {
    return `${API_ORIGIN}${mediaPath}`;
  }
  return `${API_ORIGIN}/${mediaPath}`;
};
