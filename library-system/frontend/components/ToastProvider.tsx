'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

type ToastRecord = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextType = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastStyles: Record<
  ToastVariant,
  { panel: string; badge: string; iconWrap: string; iconColor: string; label: string; subtitle: string }
> = {
  success: {
    panel: 'border-emerald-300/20',
    badge: 'bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/20',
    iconWrap: 'bg-emerald-400/14 ring-1 ring-emerald-300/20 shadow-[0_0_40px_rgba(52,211,153,0.16)]',
    iconColor: 'text-emerald-200',
    label: 'Success',
    subtitle: 'Your session update was completed successfully.',
  },
  error: {
    panel: 'border-rose-300/20',
    badge: 'bg-rose-400/15 text-rose-100 ring-1 ring-rose-300/20',
    iconWrap: 'bg-rose-400/14 ring-1 ring-rose-300/20 shadow-[0_0_40px_rgba(251,113,133,0.16)]',
    iconColor: 'text-rose-200',
    label: 'Error',
    subtitle: 'Something went wrong. Please review the message and try again.',
  },
  info: {
    panel: 'border-sky-300/20',
    badge: 'bg-sky-400/15 text-sky-100 ring-1 ring-sky-300/20',
    iconWrap: 'bg-sky-400/14 ring-1 ring-sky-300/20 shadow-[0_0_40px_rgba(56,189,248,0.16)]',
    iconColor: 'text-sky-200',
    label: 'Info',
    subtitle: 'Here is an update about your current action.',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastRecord | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({
      id: Date.now(),
      message,
      variant,
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toast.id ? null : currentToast));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast]
  );

  const activeToastStyles = toast ? toastStyles[toast.variant] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-0 z-[120] flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:px-4 sm:pb-0">
        {toast && activeToastStyles && (
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.26),rgba(2,6,23,0.52))]"
            aria-hidden="true"
          />
        )}

        {toast && activeToastStyles && (
          <div
            className={`pointer-events-auto relative w-full max-w-lg overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,rgba(7,16,32,0.96)_0%,rgba(11,19,36,0.97)_100%)] px-5 py-5 text-white shadow-[0_32px_90px_rgba(2,8,23,0.46)] backdrop-blur-2xl animate-fade-up sm:px-7 sm:py-7 ${activeToastStyles.panel}`}
            role="status"
            aria-live="polite"
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-16 top-0 h-32 w-32 rounded-full bg-sky-400/8 blur-3xl" />
              <div className="absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16 ${activeToastStyles.iconWrap}`}>
                <svg className={`h-8 w-8 ${activeToastStyles.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {toast.variant === 'success' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                  )}
                  {toast.variant === 'error' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                  )}
                  {toast.variant === 'info' && (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8h.01" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 12h1v4h1" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    </>
                  )}
                </svg>
              </div>

              <div className="mt-5 min-w-0">
                <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${activeToastStyles.badge}`}>
                  {activeToastStyles.label}
                </span>
                <p className="mt-4 text-base font-semibold tracking-[0.01em] text-white sm:text-lg">{toast.message}</p>
                <p className="mt-2 text-sm leading-6 text-white/62">{activeToastStyles.subtitle}</p>
              </div>

              <button
                type="button"
                onClick={() => setToast(null)}
                className="mt-6 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/82 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss notification"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
