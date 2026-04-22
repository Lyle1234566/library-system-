'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, IdentifierAvailabilityResult, RegisterRole } from '@/lib/auth';
import { getPasswordRequirements, getPasswordValidationMessage, isValidPassword } from '@/lib/passwordRules';

type RegisterFormData = {
  studentId: string;
  fullName: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

type RegisterFormErrors = {
  studentId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
  general?: string;
};

type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'blocked' | 'error';

type RecoveryDetails = {
  otpSession: string;
  email: string;
  fullName: string;
  role: RegisterRole;
  studentId: string;
  staffId: string;
  flow: 'login' | 'registration';
};

type FieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  helper?: string;
  type?: string;
  readOnly?: boolean;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
};

const EMAIL_REQUIRED_MESSAGE = 'Email is required so due-date reminders can be sent.';

const IdCardIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path strokeLinecap="round" d="M7.5 10h4.5M7.5 13.5h3" />
    <circle cx="16.25" cy="11.25" r="1.75" />
  </svg>
);

const UserFieldIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 19a6.5 6.5 0 0 1 13 0" />
  </svg>
);

const MailFieldIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 8 6.5 5 6.5-5" />
  </svg>
);

const LockFieldIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
    <rect x="5.5" y="10.5" width="13" height="9" rx="2.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 10.5v-2a3.5 3.5 0 1 1 7 0v2" />
  </svg>
);

const CheckShieldIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75 6.75 6v5.18A8.25 8.25 0 0 0 12 20.25a8.25 8.25 0 0 0 5.25-9.07V6L12 3.75Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 12.25 1.5 1.5 3-3.25" />
  </svg>
);

const mapAvailabilityResult = (
  result: IdentifierAvailabilityResult,
  idLabel: string
): { state: AvailabilityState; message: string } => {
  if (result.available) {
    return {
      state: 'available',
      message: result.message || `${idLabel} is verified for registration.`,
    };
  }

  if (result.reason === 'taken') {
    return {
      state: 'taken',
      message: result.message || `${idLabel} is already taken.`,
    };
  }

  if (result.reason === 'not_enrolled' || result.reason === 'inactive_enrollment') {
    return {
      state: 'blocked',
      message: result.message || `${idLabel} is not eligible for registration.`,
    };
  }

  return {
    state: 'error',
    message: result.message || `Unable to check ${idLabel.toLowerCase()} right now.`,
  };
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const buildOtpHref = (
  details: RecoveryDetails,
  email: string,
  options?: { autoSend?: boolean; emailUpdated?: boolean }
) => {
  const params = new URLSearchParams({
    otp_session: details.otpSession,
    email,
    full_name: details.fullName,
    account_role: details.role,
    flow: details.flow,
  });

  if (details.studentId) params.set('student_id', details.studentId);
  if (details.staffId) params.set('staff_id', details.staffId);
  if (options?.autoSend) params.set('auto_send', '1');
  if (options?.emailUpdated) params.set('email_updated', '1');

  return `/login-otp?${params.toString()}`;
};

const Field = ({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  error,
  helper,
  type = 'text',
  readOnly = false,
  autoComplete,
  rightSlot,
}: FieldProps) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-[13px] font-medium text-white/80">
      {label}
    </label>
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/55">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {icon}
        </span>
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        autoComplete={autoComplete}
        className={`auth-input w-full rounded-[20px] border bg-white/[0.045] py-3 pl-[4.1rem] pr-24 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus:border-sky-300/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-sky-400/50 ${
          readOnly
            ? 'cursor-not-allowed border-white/10 opacity-75'
            : error
              ? 'border-red-400/60'
              : 'border-white/[0.12] hover:border-sky-400/35'
        }`}
        placeholder={placeholder}
      />
      {rightSlot ? <div className="absolute inset-y-0 right-0 flex items-center pr-4">{rightSlot}</div> : null}
    </div>
    {helper ? <p className="text-xs text-white/50">{helper}</p> : null}
    {error ? <p className="text-xs text-red-300">{error}</p> : null}
  </div>
);

type RegisterPageContentProps = {
  requestedRole: RegisterRole;
  recoveryMode: boolean;
  recoveryDetails: RecoveryDetails;
  authLoading: boolean;
};

function RegisterPageShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const requestedRole: RegisterRole =
    searchParams?.get('role') === 'teacher' ? 'TEACHER' : 'STUDENT';
  const recoveryMode = searchParams?.get('recovery') === 'otp';

  const recoveryDetails = useMemo<RecoveryDetails>(
    () => ({
      otpSession: searchParams?.get('otp_session') || '',
      email: searchParams?.get('email') || '',
      fullName: searchParams?.get('full_name') || '',
      role: searchParams?.get('account_role') === 'TEACHER' ? 'TEACHER' : requestedRole,
      studentId: searchParams?.get('student_id') || '',
      staffId: searchParams?.get('staff_id') || '',
      flow: searchParams?.get('flow') === 'registration' ? 'registration' : 'login',
    }),
    [requestedRole, searchParams]
  );

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  const pageKey = [
    recoveryMode ? 'recovery' : 'register',
    requestedRole,
    recoveryDetails.otpSession,
    recoveryDetails.email,
    recoveryDetails.fullName,
    recoveryDetails.studentId,
    recoveryDetails.staffId,
  ].join(':');

  return (
    <RegisterPageContent
      key={pageKey}
      requestedRole={requestedRole}
      recoveryMode={recoveryMode}
      recoveryDetails={recoveryDetails}
      authLoading={authLoading}
    />
  );
}

function RegisterPageContent({
  requestedRole,
  recoveryMode,
  recoveryDetails,
  authLoading,
}: RegisterPageContentProps) {
  const router = useRouter();
  const { register } = useAuth();
  const initialRegisterRole = recoveryMode ? recoveryDetails.role : requestedRole;
  const initialLockedIdentifier =
    initialRegisterRole === 'TEACHER' ? recoveryDetails.staffId : recoveryDetails.studentId;

  const [formData, setFormData] = useState<RegisterFormData>(() => ({
    studentId: recoveryMode ? initialLockedIdentifier : '',
    fullName: recoveryMode ? recoveryDetails.fullName : '',
    email: recoveryMode ? recoveryDetails.email : '',
    password: '',
    passwordConfirm: '',
  }));
  const [registerRole, setRegisterRole] = useState<RegisterRole>(initialRegisterRole);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>('idle');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const idLabel = registerRole === 'TEACHER' ? 'Faculty ID' : 'Student ID';
  const idPlaceholder =
    registerRole === 'TEACHER' ? 'Enter your faculty ID' : 'Enter your student ID';
  const passwordRequirements = getPasswordRequirements(formData.password);
  const passwordHasValue = formData.password.length > 0;
  const passwordsMatch =
    formData.passwordConfirm.length > 0 && formData.password === formData.passwordConfirm;
  const otpRecoveryHref =
    recoveryMode && recoveryDetails.otpSession
      ? buildOtpHref(recoveryDetails, formData.email.trim() || recoveryDetails.email)
      : '/login';
  const accountLabel = registerRole === 'TEACHER' ? 'Teacher' : 'Student';

  useEffect(() => {
    if (recoveryMode) {
      return;
    }

    const identifier = formData.studentId.trim();
    if (identifier.length < 3) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setAvailabilityState('checking');
      const result = await authApi.checkAccountIdentifier(identifier, registerRole);
      if (cancelled) return;

      const nextResult = mapAvailabilityResult(result, idLabel);

      if (nextResult.state === 'available') {
        setAvailabilityState('available');
        setAvailabilityMessage(nextResult.message);
        setErrors((prev) => ({ ...prev, studentId: undefined }));
        return;
      }

      setAvailabilityState(nextResult.state);
      setAvailabilityMessage(nextResult.message);

      if (nextResult.state === 'taken' || nextResult.state === 'blocked') {
        setErrors((prev) => ({
          ...prev,
          studentId: nextResult.message,
        }));
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [formData.studentId, idLabel, recoveryMode, registerRole]);

  const updateField = (field: keyof RegisterFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));

    if (field === 'studentId') {
      setAvailabilityState('idle');
      setAvailabilityMessage('');
    }
  };

  const setRole = (role: RegisterRole) => {
    if (recoveryMode) return;
    setRegisterRole(role);
    setFormData((prev) => ({ ...prev, studentId: '' }));
    setErrors((prev) => ({ ...prev, studentId: undefined, general: undefined }));
    setAvailabilityState('idle');
    setAvailabilityMessage('');
  };

  const validateForm = () => {
    const nextErrors: RegisterFormErrors = {};

    if (recoveryMode) {
      if (!formData.email.trim()) {
        nextErrors.email = EMAIL_REQUIRED_MESSAGE;
      } else if (!isValidEmail(formData.email.trim())) {
        nextErrors.email = 'Enter a valid email address.';
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }

    if (!formData.studentId.trim()) {
      nextErrors.studentId = `${idLabel} is required.`;
    } else if (formData.studentId.trim().length < 3) {
      nextErrors.studentId = `${idLabel} must be at least 3 characters.`;
    } else if (availabilityState === 'taken' || availabilityState === 'blocked') {
      nextErrors.studentId =
        availabilityMessage ||
        (availabilityState === 'taken'
          ? `${idLabel} is already taken.`
          : `${idLabel} is not eligible for registration.`);
    }

    if (!formData.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }

    if (!formData.email.trim()) {
      nextErrors.email = EMAIL_REQUIRED_MESSAGE;
    } else if (!isValidEmail(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required.';
    } else if (!isValidPassword(formData.password)) {
      nextErrors.password = getPasswordValidationMessage();
    }

    if (!formData.passwordConfirm) {
      nextErrors.passwordConfirm = 'Confirm your password.';
    } else if (formData.password !== formData.passwordConfirm) {
      nextErrors.passwordConfirm = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const confirmIdentifierAvailability = async () => {
    if (recoveryMode) return true;

    const identifier = formData.studentId.trim();
    if (identifier.length < 3) return false;

    setAvailabilityState('checking');
    const result = await authApi.checkAccountIdentifier(identifier, registerRole);

    const nextResult = mapAvailabilityResult(result, idLabel);

    if (nextResult.state === 'available') {
      setAvailabilityState('available');
      setAvailabilityMessage(nextResult.message);
      setErrors((prev) => ({ ...prev, studentId: undefined }));
      return true;
    }

    setAvailabilityState(nextResult.state);
    setAvailabilityMessage(nextResult.message);

    if (nextResult.state === 'taken' || nextResult.state === 'blocked') {
      setErrors((prev) => ({ ...prev, studentId: nextResult.message }));
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || authLoading) return;
    if (!validateForm()) return;

    if (recoveryMode) {
      if (!recoveryDetails.otpSession) {
        setErrors({ general: 'Missing recovery details. Return to login and try again.' });
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      const result = await authApi.updatePendingEmail(recoveryDetails.otpSession, formData.email.trim());
      setIsSubmitting(false);

      if (result.error || !result.email || !result.otpSession) {
        setErrors({ general: result.error || 'Unable to update email right now.' });
        return;
      }

      router.push(
        buildOtpHref(
          { ...recoveryDetails, otpSession: result.otpSession },
          result.email,
          { autoSend: true, emailUpdated: true }
        )
      );
      return;
    }

    const identifierAvailable = await confirmIdentifierAvailability();
    if (!identifierAvailable) return;

    setIsSubmitting(true);
    setErrors({});

    const result = await register({
      role: registerRole,
      ...(registerRole === 'TEACHER'
        ? { staff_id: formData.studentId.trim() }
        : { student_id: formData.studentId.trim() }),
      full_name: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password,
      password_confirm: formData.passwordConfirm,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error || 'Registration failed. Please try again.' });
      return;
    }

    if (result.data?.requires_otp) {
      const params = new URLSearchParams({
        otp_session: result.data.otp_session,
        email: result.data.email,
        full_name: result.data.full_name,
        account_role: result.data.role,
        flow: 'registration',
        otp_sent: '1',
      });
      if (result.data.student_id) {
        params.set('student_id', result.data.student_id);
      }
      if (result.data.staff_id) {
        params.set('staff_id', result.data.staff_id);
      }
      router.push(`/login-otp?${params.toString()}`);
      return;
    }

    router.push('/login?registered=true');
  };

  if (authLoading) {
    return (
      <div className="theme-login flex min-h-screen items-center justify-center bg-[#0b1324] text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="theme-login relative min-h-screen overflow-hidden bg-[#0b1324] text-white">
      <div className="absolute inset-0">
        <div className="absolute -left-24 top-[-7rem] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl animate-float" />
        <div className="absolute bottom-[-4rem] right-[-2rem] h-[28rem] w-[28rem] rounded-full bg-amber-500/20 blur-3xl animate-float-slow" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.24),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_72%,rgba(251,191,36,0.16),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,18,35,0.96),rgba(11,19,36,0.88)_45%,rgba(15,28,49,0.98))]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:88px_88px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1380px] items-center px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,560px)] xl:gap-8">
          <div className="space-y-6 lg:pr-4 animate-fade-up">
            <Link href="/" className="inline-flex items-center gap-3 text-white">
              <Image
                src="/logo-lib-transparent.png"
                alt="SCSIT Library System logo"
                width={72}
                height={72}
                priority
                className="h-14 w-14 object-contain drop-shadow-[0_12px_20px_rgba(2,8,23,0.45)] sm:h-16 sm:w-16"
              />
              <span className="text-xl font-semibold tracking-tight">SCSIT Library System</span>
            </Link>

            <div className="relative overflow-hidden rounded-[38px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_32px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8 xl:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_35%,transparent_65%)]" />
              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-end">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                      {recoveryMode ? 'Registration Recovery' : 'Member Onboarding'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100">
                      {recoveryMode ? 'Verification repair' : `${accountLabel} onboarding`}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <h1 className="max-w-3xl text-4xl font-extrabold leading-[0.93] tracking-tight text-white sm:text-6xl lg:text-[4.15rem] xl:text-[5rem]">
                      {recoveryMode ? (
                        <>
                          Repair the email.
                          <span className="block text-sky-200">Resume OTP verification.</span>
                        </>
                      ) : (
                        <>
                          Join the
                          <span className="block text-amber-200">SCSIT Library System.</span>
                        </>
                      )}
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                      {recoveryMode
                        ? 'If the original registration used an inaccessible address, update it here and continue the OTP step without rebuilding the account.'
                        : registerRole === 'TEACHER'
                          ? 'Register with your faculty ID for a cleaner approval flow, unified access across platforms, and borrowing rules tailored to teacher accounts.'
                          : 'Register with your student ID for a polished onboarding flow, email verification, and staff approval before your first successful sign in.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {(recoveryMode
                      ? ['Saved account', 'Email correction', 'Fresh OTP']
                      : ['Web and mobile', `${accountLabel} profile`, 'Approval workflow']
                    ).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            <div className="text-sm text-white/70">
              {recoveryMode ? (
                <>
                  Need to return?{' '}
                  <Link href={otpRecoveryHref} className="font-semibold text-amber-300 hover:text-amber-200">
                    Back to OTP verification
                  </Link>
                </>
              ) : (
                <>
                  Already approved?{' '}
                  <Link href="/login" className="font-semibold text-amber-300 hover:text-amber-200">
                    Go to sign in
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="animate-fade-up delay-200">
            <div className="relative">
              <div className="absolute inset-x-10 top-4 h-28 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-[1px] shadow-[0_38px_90px_rgba(2,6,23,0.58)]">
                <div className="rounded-[29px] bg-[#0d1628]/96 p-4 backdrop-blur-2xl sm:p-5 lg:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                        {recoveryMode ? 'Recovery desk' : 'Registration desk'}
                      </span>
                      <div>
                        <h2 className="text-[1.7rem] font-semibold text-white sm:text-[1.9rem]">
                          {recoveryMode ? 'Correct the saved email' : 'Complete your account setup'}
                        </h2>
                        <p className="mt-1.5 max-w-md text-xs leading-5 text-white/60 sm:text-sm">
                          {recoveryMode
                            ? 'We kept the registration details below. Change only the email so the student can receive OTP before first login.'
                            : `Create a ${registerRole === 'TEACHER' ? 'teacher' : 'student'} account with the same structure used across the web and mobile library system.`}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-amber-300/20 bg-amber-400/10 px-3.5 py-2 text-xs text-amber-100">
                      {recoveryMode ? 'Email update only' : 'Approval and OTP required'}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-5 text-white/65">
                      {recoveryMode
                        ? 'The original registration details stay locked so the saved account record is preserved.'
                        : `${accountLabel} borrowing rules are applied automatically after approval.`}
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-5 text-white/65">
                      {recoveryMode
                        ? 'Once the new email is saved, the student can continue directly to OTP verification.'
                        : 'Email verification is required before the first successful sign in.'}
                    </div>
                  </div>

                  {!recoveryMode ? (
                    <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-2">
                      <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                        Choose account type
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRole('STUDENT')}
                          className={`rounded-[18px] border px-4 py-2.5 text-xs font-semibold transition-all ${
                            registerRole === 'STUDENT'
                              ? 'border-amber-300/60 bg-amber-400/15 text-amber-100 shadow-[0_12px_26px_rgba(251,191,36,0.12)]'
                              : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:bg-white/[0.06]'
                          }`}
                        >
                          Student account
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('TEACHER')}
                          className={`rounded-[18px] border px-4 py-2.5 text-xs font-semibold transition-all ${
                            registerRole === 'TEACHER'
                              ? 'border-sky-300/60 bg-sky-400/15 text-sky-100 shadow-[0_12px_26px_rgba(56,189,248,0.12)]'
                              : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:bg-white/[0.06]'
                          }`}
                        >
                          Teacher account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[20px] border border-sky-400/30 bg-sky-500/15 px-3.5 py-2.5 text-xs text-sky-100">
                      These details come from the saved registration. Only the email can be changed here.
                    </div>
                  )}

                  <form className="mt-5 space-y-3.5" onSubmit={handleSubmit}>
                    {errors.general ? (
                      <div className="rounded-[20px] border border-red-500/40 bg-red-500/15 px-3.5 py-2.5 text-xs text-red-100">
                        {errors.general}
                      </div>
                    ) : null}

                    <Field
                      id="studentId"
                      label={idLabel}
                      icon={<IdCardIcon />}
                      value={formData.studentId}
                      onChange={(value) => updateField('studentId', value)}
                      placeholder={idPlaceholder}
                      autoComplete="username"
                      readOnly={recoveryMode}
                      error={errors.studentId}
                      helper={
                        recoveryMode
                          ? 'This identifier is locked to the existing registration.'
                          : availabilityMessage ||
                            `Use the ${registerRole === 'TEACHER' ? 'faculty' : 'student'} ID assigned by the school.`
                      }
                      rightSlot={
                        !recoveryMode && availabilityState !== 'idle' ? (
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              availabilityState === 'available'
                                ? 'bg-emerald-400/15 text-emerald-100'
                                : availabilityState === 'taken'
                                  ? 'bg-rose-400/15 text-rose-100'
                                  : availabilityState === 'blocked'
                                    ? 'bg-amber-400/15 text-amber-100'
                                  : availabilityState === 'error'
                                    ? 'bg-amber-400/15 text-amber-100'
                                    : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {availabilityState === 'checking'
                              ? 'Checking'
                              : availabilityState === 'available'
                                ? 'Available'
                                : availabilityState === 'taken'
                                  ? 'Taken'
                                  : availabilityState === 'blocked'
                                    ? 'Blocked'
                                  : 'Retry'}
                          </span>
                        ) : null
                      }
                    />

                    <Field
                      id="fullName"
                      label="Full Name"
                      icon={<UserFieldIcon />}
                      value={formData.fullName}
                      onChange={(value) => updateField('fullName', value)}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      readOnly={recoveryMode}
                      error={errors.fullName}
                      helper={recoveryMode ? 'This matches the original registration details.' : undefined}
                    />

                    <Field
                      id="email"
                      label="Email Address"
                      icon={<MailFieldIcon />}
                      value={formData.email}
                      onChange={(value) => updateField('email', value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      error={errors.email}
                      helper={
                        recoveryMode
                          ? 'Use a real email address the student can access. We will resend OTP after saving.'
                          : 'Required for approval updates, OTP verification, and due-date reminders.'
                      }
                    />

                    {!recoveryMode ? (
                      <>
                        <div className="rounded-[22px] border border-amber-300/20 bg-amber-400/10 px-3.5 py-3 text-xs leading-5 text-white/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                            Create Password
                          </p>
                          <p className="mt-1.5">This will be used to log in to your account.</p>
                        </div>

                        <Field
                          id="password"
                          label="Password"
                          icon={<LockFieldIcon />}
                          value={formData.password}
                          onChange={(value) => updateField('password', value)}
                          placeholder="Enter your password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          error={errors.password}
                          rightSlot={
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white"
                            >
                              {showPassword ? 'Hide' : 'Show'}
                            </button>
                          }
                        />

                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                            Password must have
                          </p>
                          <div className="mt-3 space-y-2">
                            {passwordRequirements.map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 text-sm transition-colors ${
                                  item.met
                                    ? 'text-emerald-100'
                                    : passwordHasValue
                                      ? 'text-white/70'
                                      : 'text-white/50'
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                    item.met
                                      ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100'
                                      : 'border-white/15 bg-white/[0.03] text-transparent'
                                  }`}
                                >
                                  ✓
                                </span>
                                <span>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-[11px] leading-5 text-amber-100/75">
                            Use a strong password that is not easy to guess.
                          </p>
                        </div>

                        <Field
                          id="passwordConfirm"
                          label="Confirm Password"
                          icon={<CheckShieldIcon />}
                          value={formData.passwordConfirm}
                          onChange={(value) => updateField('passwordConfirm', value)}
                          placeholder="Repeat your password"
                          type={showPasswordConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          error={errors.passwordConfirm}
                          helper={passwordsMatch ? 'Passwords match.' : undefined}
                          rightSlot={
                            <button
                              type="button"
                              onClick={() => setShowPasswordConfirm((prev) => !prev)}
                              className="text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white"
                            >
                              {showPasswordConfirm ? 'Hide' : 'Show'}
                            </button>
                          }
                        />

                        <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[11px] leading-5 text-white/55">
                          By creating an account, you agree to follow the library borrowing rules and account
                          policies.
                        </div>
                      </>
                    ) : null}

                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        authLoading ||
                        (!recoveryMode &&
                          (availabilityState === 'taken' || availabilityState === 'blocked'))
                      }
                      className="group relative w-full overflow-hidden rounded-[20px] bg-amber-500 py-3 text-sm font-semibold text-[#1a1b1f] shadow-lg shadow-amber-900/30 transition-all hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300/60 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-3">
                        {isSubmitting
                          ? recoveryMode
                            ? 'Saving email...'
                            : 'Creating account...'
                          : recoveryMode
                            ? 'Update Email & Send OTP'
                            : 'Create my account'}
                      </span>
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    </button>

                    <div className="relative text-center text-xs text-white/50">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <span className="relative bg-[#0d1628] px-3">or</span>
                    </div>

                    <Link
                      href={recoveryMode ? otpRecoveryHref : '/login'}
                      className="block w-full rounded-[20px] border border-white/15 py-3 text-center text-xs font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/5"
                    >
                      {recoveryMode ? 'Back to OTP Verification' : 'Back to Sign In'}
                    </Link>
                  </form>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-white/60">
              <Link href="/" className="inline-flex items-center gap-2 hover:text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-login flex min-h-screen items-center justify-center bg-[#0b1324] text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-r-transparent" />
        </div>
      }
    >
      <RegisterPageShell />
    </Suspense>
  );
}
