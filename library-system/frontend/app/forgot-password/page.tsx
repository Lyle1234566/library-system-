'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/auth';
import { PASSWORD_REQUIREMENTS_SUMMARY, getPasswordValidationMessage, isValidPassword } from '@/lib/passwordRules';

type ResetPhase = 'request' | 'confirm' | 'done';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ForgotPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedEmail = searchParams?.get('email')?.trim().toLowerCase() ?? '';
  const linkedCode = searchParams?.get('code')?.trim() ?? '';
  const linkedSource = searchParams?.get('source');
  const hasResetLink = Boolean(linkedEmail && linkedCode && linkedSource === 'email');

  const [phase, setPhase] = useState<ResetPhase>(hasResetLink ? 'confirm' : 'request');
  const [email, setEmail] = useState(linkedEmail);
  const [code, setCode] = useState(linkedCode);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [codeLength, setCodeLength] = useState(6);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(15);
  const [debugCode, setDebugCode] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isAutoVerifying, setIsAutoVerifying] = useState(hasResetLink);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [error, setError] = useState('');
  const attemptedLinkVerification = useRef(false);

  const headerDescription = useMemo(() => {
    if (phase === 'done') {
      return 'Your password has been reset successfully.';
    }
    if (phase === 'confirm') {
      if (isCodeVerified) {
        return 'Choose a new password for your account.';
      }
      return 'Enter the reset code and choose a new password.';
    }
    return 'Enter your email address and we\'ll send you a reset code.';
  }, [isCodeVerified, phase]);

  useEffect(() => {
    if (!hasResetLink || attemptedLinkVerification.current) {
      return;
    }

    attemptedLinkVerification.current = true;

    void (async () => {
      const result = await authApi.verifyPasswordResetCode({
        email,
        code,
      });

      setIsAutoVerifying(false);
      if (result.error) {
        setIsCodeVerified(false);
        setError(result.error);
        return;
      }

      setIsCodeVerified(true);
      setMessage(result.message || 'Reset link verified. You can now choose a new password.');
    })();
  }, [code, email, hasResetLink]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await authApi.requestPasswordReset(email);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCode('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
    setIsCodeVerified(false);
    setCodeLength(result.codeLength ?? 6);
    setExpiresInMinutes(result.expiresInMinutes ?? null);
    setDebugCode(result.debugCode ?? '');
    setMessage(result.message);
    setPhase('confirm');
  };

  const handleResendCode = async () => {
    if (!email || !isValidEmail(email) || isLoading || isResendingCode) {
      return;
    }

    setIsResendingCode(true);
    setError('');

    const result = await authApi.requestPasswordReset(email);

    setIsResendingCode(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCode('');
    setIsCodeVerified(false);
    setCodeLength(result.codeLength ?? codeLength);
    setExpiresInMinutes(result.expiresInMinutes ?? expiresInMinutes);
    setDebugCode(result.debugCode ?? '');
    setMessage(result.message || 'A new reset code has been sent.');
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.trim();

    if (!email) {
      setError('Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!normalizedCode) {
      setError('Please enter the reset code');
      return;
    }
    if (normalizedCode.length !== codeLength) {
      setError(`Please enter the ${codeLength}-digit reset code`);
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await authApi.confirmPasswordReset({
      email,
      code: normalizedCode,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage(result.message);
    setDebugCode('');
    setPhase('done');
    router.replace('/forgot-password');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-10 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <span className="text-2xl font-bold text-white">SCSIT Library System</span>
          </Link>
          <h2 className="text-3xl font-bold text-white">Reset your password</h2>
          <p className="mt-2 text-white/70">{headerDescription}</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-card backdrop-blur-md sm:p-8">
          {phase === 'done' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Password Reset Complete</h3>
              <p className="text-white/70 mb-6">{message || 'You can now sign in with your new password.'}</p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0f1c2e] hover:bg-[#e7f1ff] transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          ) : phase === 'confirm' ? (
            <form className="space-y-6" onSubmit={handleConfirmSubmit}>
              {message && (
                <div className="bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 px-4 py-3 rounded-lg text-sm">
                  {message}
                </div>
              )}
              {!!debugCode && (
                <div className="bg-amber-500/15 border border-amber-400/50 text-amber-100 px-4 py-3 rounded-lg text-sm">
                  <p className="font-semibold">Development fallback code</p>
                  <p className="mt-1 tracking-[0.22em] text-base">{debugCode}</p>
                </div>
              )}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {isAutoVerifying && (
                <div className="bg-sky-500/20 border border-sky-400/40 text-sky-100 px-4 py-3 rounded-lg text-sm">
                  Verifying your reset link...
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  readOnly
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white/85 placeholder-white/40 focus:outline-none transition-all cursor-not-allowed"
                  placeholder="Email used for request"
                />
                <p className="mt-2 text-xs text-white/55">
                  Reset code was sent to this email.
                </p>
              </div>

              {!isCodeVerified && (
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-white/90 mb-2">
                    Reset Code
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={codeLength}
                    value={code}
                    onChange={(e) => {
                      const sanitizedCode = e.target.value.replace(/\D/g, '').slice(0, codeLength);
                      setCode(sanitizedCode);
                      setError('');
                    }}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all tracking-[0.3em]"
                    placeholder={`Enter ${codeLength}-digit code`}
                  />
                  {expiresInMinutes && (
                    <p className="mt-2 text-xs text-white/55">
                      Code expires in {expiresInMinutes} minute{expiresInMinutes === 1 ? '' : 's'}.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-white/90 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-3 pr-16 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all"
                    placeholder="Enter a new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/65 hover:text-white"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-white/55">{PASSWORD_REQUIREMENTS_SUMMARY}</p>
              </div>

              <div>
                <label htmlFor="newPasswordConfirm" className="block text-sm font-medium text-white/90 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="newPasswordConfirm"
                    name="newPasswordConfirm"
                    type={showNewPasswordConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPasswordConfirm}
                    onChange={(e) => {
                      setNewPasswordConfirm(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-3 pr-16 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all"
                    placeholder="Re-enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordConfirm((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/65 hover:text-white"
                    aria-label={showNewPasswordConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showNewPasswordConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isAutoVerifying}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-[#0f1c2e] bg-white hover:bg-[#e7f1ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#0f1c2e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>

              {!isCodeVerified && (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading || isResendingCode}
                  className="w-full text-sm text-white/75 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResendingCode ? 'Resending code...' : 'Resend code'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPhase('request');
                  setCode('');
                  setNewPassword('');
                  setNewPasswordConfirm('');
                  setShowNewPassword(false);
                  setShowNewPasswordConfirm(false);
                  setCodeLength(6);
                  setExpiresInMinutes(15);
                  setDebugCode('');
                  setIsCodeVerified(false);
                  setMessage('');
                  setError('');
                  attemptedLinkVerification.current = false;
                  router.replace('/forgot-password');
                }}
                className="w-full text-sm text-white/80 hover:text-white transition-colors"
              >
                Start over
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleRequestSubmit}>
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all"
                  placeholder="Enter your email address"
                />
                <p className="mt-2 text-xs text-white/65">
                  Use the recovery email saved on your library account. If you can still sign in, update
                  it from{' '}
                  <Link href="/profile" className="font-semibold text-white underline-offset-4 hover:underline">
                    Profile
                  </Link>
                  . Otherwise, contact library support to update your email first.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-[#0f1c2e] bg-white hover:bg-[#e7f1ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#0f1c2e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Reset Code'
                )}
              </button>
            </form>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] transition-colors inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Sign In
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-white/70 hover:text-white transition-colors inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-hero text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-r-transparent" />
        </div>
      }
    >
      <ForgotPasswordPageContent />
    </Suspense>
  );
}


