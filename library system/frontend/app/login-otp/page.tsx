'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, RegisterRole } from '@/lib/auth';

type RecoveryDetails = {
  otpSession: string;
  email: string;
  fullName: string;
  role: RegisterRole;
  studentId: string;
  staffId: string;
  flow: 'login' | 'registration';
};

const getRegisterRecoveryHref = (details: RecoveryDetails) => {
  const params = new URLSearchParams({
    recovery: 'otp',
    otp_session: details.otpSession,
    email: details.email,
    full_name: details.fullName,
    account_role: details.role,
    flow: details.flow,
  });

  if (details.studentId) {
    params.set('student_id', details.studentId);
  }
  if (details.staffId) {
    params.set('staff_id', details.staffId);
  }

  return `/register?${params.toString()}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

function LoginOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const verificationFlow = searchParams?.get('flow') === 'registration' ? 'registration' : 'login';
  const otpSentInitial = searchParams?.get('otp_sent') === '1';

  const [details, setDetails] = useState<RecoveryDetails | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(otpSentInitial);
  const hasAutoSent = useRef(false);

  const autoSend = searchParams?.get('auto_send') === '1';
  const emailUpdated = searchParams?.get('email_updated') === '1';

  useEffect(() => {
    const otpSession = searchParams?.get('otp_session') || '';
    const email = searchParams?.get('email') || '';
    const fullName = searchParams?.get('full_name') || '';
    const role = searchParams?.get('account_role') === 'TEACHER' ? 'TEACHER' : 'STUDENT';
    const studentId = searchParams?.get('student_id') || '';
    const staffId = searchParams?.get('staff_id') || '';

    if (!otpSession || !email) {
      router.push('/login');
      return;
    }

    setDetails({
      otpSession,
      email,
      fullName,
      role,
      studentId,
      staffId,
      flow: verificationFlow,
    });
    setError('');
    setNotice(
      emailUpdated
        ? 'Your email was updated. We can send a fresh OTP to the new address now.'
        : verificationFlow === 'registration'
          ? otpSentInitial
            ? 'Your account was created and we already sent the OTP. Verify your email before approval continues.'
            : 'Verify your email first. After that, your account will wait for staff approval.'
          : 'We will verify your email before completing sign in.'
    );
  }, [emailUpdated, otpSentInitial, router, searchParams, verificationFlow]);

  const registerRecoveryHref = useMemo(
    () => (details ? getRegisterRecoveryHref(details) : '/register'),
    [details]
  );

  const handleSendOTP = useCallback(async () => {
    if (!details?.otpSession) {
      return;
    }

    setIsSendingOTP(true);
    setError('');

    try {
      const response = await authApi.sendLoginOtp(details.otpSession);
      if (response.error) {
        setError(response.error);
        return;
      }

      setOtpSent(true);
      setNotice(`OTP sent to ${response.email ?? details.email}. Check your inbox and spam folder.`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to send OTP. Please try again.'));
    } finally {
      setIsSendingOTP(false);
    }
  }, [details?.email, details?.otpSession]);

  useEffect(() => {
    if (!details?.otpSession || !autoSend || hasAutoSent.current) {
      return;
    }

    hasAutoSent.current = true;
    void handleSendOTP();
  }, [autoSend, details?.otpSession, handleSendOTP]);

  const handleVerifyOTP = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!details?.otpSession) {
      return;
    }

    if (!code.trim()) {
      setError('Please enter the OTP code.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await authApi.verifyLoginOtp(details.otpSession, code.trim());
      if (response.error) {
        setError(response.error ?? 'Invalid OTP code. Please try again.');
        return;
      }

      if (response.requiresApproval) {
        router.push('/login?email_verified=1&awaiting_approval=1');
        return;
      }

      if (!response.user || !response.tokens) {
        setError('Invalid OTP code. Please try again.');
        return;
      }

      await setSession(response.user, response.tokens.access, response.tokens.refresh);
      router.push('/my-books');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Invalid OTP code. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!details) {
    return null;
  }

  return (
    <div className="theme-login relative min-h-screen overflow-hidden bg-[#0b1324] text-white">
      <div className="absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl animate-float" />
        <div className="absolute bottom-0 right-0 h-[26rem] w-[26rem] rounded-full bg-amber-500/20 blur-3xl animate-float-slow" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md items-start px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full space-y-6">
          <Link href="/login" className="inline-flex items-center gap-2 text-white/70 hover:text-white">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Login
          </Link>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-8">
            <div className="mb-6 space-y-2">
              <h2 className="text-2xl font-semibold">Email Verification</h2>
              <p className="text-sm text-white/60">
                {verificationFlow === 'registration'
                  ? 'Verify the email address first. Once that is done, the account will stay pending until staff approval.'
                  : 'Before this account can sign in, we need to confirm that the email address really belongs to the student.'}
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-sm text-sky-100">
              OTP will be sent to: <strong>{details.email}</strong>
            </div>

            {notice && (
              <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
                {notice}
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            {!otpSent ? (
              <div className="space-y-4">
                <button
                  onClick={handleSendOTP}
                  disabled={isSendingOTP}
                  className="w-full rounded-2xl bg-amber-500 py-3 text-base font-semibold text-[#1a1b1f] shadow-lg hover:bg-amber-400 disabled:opacity-60"
                >
                  {isSendingOTP ? 'Sending OTP...' : 'Send OTP to Email'}
                </button>

                <Link
                  href={registerRecoveryHref}
                  className="block w-full rounded-2xl border border-white/15 py-3 text-center text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/5"
                >
                  Back to Registration Details
                </Link>
              </div>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium text-white/80">
                    Enter OTP Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="auth-input w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-amber-500 py-3 text-base font-semibold text-[#1a1b1f] shadow-lg hover:bg-amber-400 disabled:opacity-60"
                >
                  {isSubmitting
                    ? 'Verifying...'
                    : verificationFlow === 'registration'
                      ? 'Verify Email'
                      : 'Verify & Login'}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isSendingOTP}
                    className="text-amber-300 hover:text-amber-200 disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                  <Link href={registerRecoveryHref} className="text-white/70 hover:text-white">
                    Back to Registration Details
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginOTPPage() {
  return (
    <Suspense fallback={
      <div className="theme-login relative min-h-screen overflow-hidden bg-[#0b1324] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
          <p className="mt-4 text-white/60">Loading...</p>
        </div>
      </div>
    }>
      <LoginOTPContent />
    </Suspense>
  );
}
