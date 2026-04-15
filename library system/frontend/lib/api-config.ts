const DEV_API_BASE_URL = 'http://localhost:8000/api';

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

function getConfiguredApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return normalizeApiBaseUrl(configured);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL must be set for production builds.');
  }
  return DEV_API_BASE_URL;
}

export const API_BASE_URL = getConfiguredApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
