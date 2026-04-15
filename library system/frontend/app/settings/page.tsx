'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi } from '@/lib/api';
import { authApi, tokenStorage } from '@/lib/auth';
import { getUserRoleLabel } from '@/lib/roles';

function formatDate(dateString?: string | null) {
  if (!dateString) {
    return 'Unknown';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [draftFullName, setDraftFullName] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(() => tokenStorage.getRememberMe());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const fullName = draftFullName ?? user?.full_name ?? '';
  const email = draftEmail ?? user?.email ?? '';

  useEffect(() => {
    let isActive = true;

    const loadUnreadCount = async () => {
      const response = await notificationsApi.getUnreadCount();
      if (!isActive || response.error || !response.data) {
        return;
      }
      setUnreadCount(response.data.unread_count ?? 0);
    };

    void loadUnreadCount();

    return () => {
      isActive = false;
    };
  }, []);

  const accountSummary = useMemo(() => {
    return [
      {
        label: 'Role',
        value: getUserRoleLabel(user),
      },
      {
        label: 'Member since',
        value: formatDate(user?.date_joined),
      },
      {
        label: 'Recovery email',
        value: user?.email ? 'Configured' : 'Required',
      },
      {
        label: 'Email verification',
        value: user?.email_verified ? 'Verified' : 'Pending',
      },
    ];
  }, [user]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFullName) {
      setError('Full name is required.');
      return;
    }

    if (!trimmedEmail) {
      setError('Email is required so approval updates, due-date reminders, and password reset codes can be delivered.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const response = await authApi.updateProfile({
      full_name: trimmedFullName,
      email: trimmedEmail,
    });

    setSubmitting(false);

    if (response.error) {
      setError(response.error);
      showToast(response.error, 'error');
      return;
    }

    await refreshUser();
    setDraftFullName(null);
    setDraftEmail(null);
    setMessage('Settings saved. Your account details and contact email are up to date.');
    showToast('Settings saved successfully.', 'success');
  };

  const handleRememberMeToggle = () => {
    const nextValue = !rememberMe;
    tokenStorage.setRememberMe(nextValue);
    setRememberMe(nextValue);
    showToast(
      nextValue
        ? 'This browser will keep your library session after you sign in.'
        : 'This browser will clear your session when it is closed.',
      'info'
    );
  };

  return (
    <ProtectedRoute>
      <div className="theme-login min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="relative overflow-hidden pt-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 top-12 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute right-0 top-1/3 h-[30rem] w-[30rem] rounded-full bg-amber-400/10 blur-3xl" />
          </div>

          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#091120] via-[#0d172b] to-[#0b1324]">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">Account Center</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Account settings and security
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                Keep your recovery email current, manage how this device stores your session, and
                review the parts of your account that affect reminders and approvals.
              </p>
            </div>
          </section>

          <section className="relative -mt-10 z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.95fr)]">
              <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,19,36,0.94)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.46)] backdrop-blur-2xl sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/14 text-sky-200">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Profile and contact details</h2>
                    <p className="mt-2 text-sm leading-7 text-white/68">
                      These details are used for approval status, due-date reminders, password recovery, and account identification.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSave} className="mt-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/52">
                        Full name
                      </span>
                      <input
                        value={fullName}
                        onChange={(event) => {
                          setDraftFullName(event.target.value);
                          setMessage(null);
                        }}
                        className="w-full rounded-[1.2rem] border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-sky-300/40 focus:bg-white/[0.07]"
                        placeholder="Enter your full name"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/52">
                        Email address
                      </span>
                      <input
                        value={email}
                        onChange={(event) => {
                          setDraftEmail(event.target.value);
                          setMessage(null);
                        }}
                        className="w-full rounded-[1.2rem] border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-sky-300/40 focus:bg-white/[0.07]"
                        placeholder="name@example.com"
                        type="email"
                      />
                    </label>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/68">
                    Use an email address you can open today. OTP codes, due-date reminders, and password reset links are delivered there first.
                  </div>

                  {error && (
                    <div className="rounded-[1.2rem] border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-[1.2rem] border border-emerald-300/25 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100">
                      {message}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#10203a] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Save settings
                    </button>
                    <Link
                      href="/profile"
                      className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/82 transition hover:bg-white/10 hover:text-white"
                    >
                      Open full profile
                    </Link>
                  </div>
                </form>
              </div>

              <div className="space-y-6">
                <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_24px_70px_rgba(2,8,23,0.44)] backdrop-blur-2xl">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-200">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Security and session</h2>
                      <p className="mt-2 text-sm leading-7 text-white/66">
                        Review how this device keeps your session and move quickly into password and notification tools.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Keep me signed in on this device</p>
                        <p className="mt-1 text-sm leading-6 text-white/60">
                          When enabled, your next successful login will persist across browser restarts on this device.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRememberMeToggle}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                          rememberMe ? 'bg-emerald-400' : 'bg-white/14'
                        }`}
                        aria-pressed={rememberMe}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                            rememberMe ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/change-password"
                      className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/16 hover:bg-white/[0.07]"
                    >
                      <KeyRound className="h-5 w-5 text-amber-200" />
                      <h3 className="mt-3 text-sm font-semibold text-white">Change password</h3>
                      <p className="mt-1 text-sm text-white/60">Update your password while you are signed in.</p>
                    </Link>

                    <Link
                      href="/notifications"
                      className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/16 hover:bg-white/[0.07]"
                    >
                      <Bell className="h-5 w-5 text-sky-200" />
                      <h3 className="mt-3 text-sm font-semibold text-white">Notifications</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Review unread approvals, reminders, and reservation updates.
                      </p>
                    </Link>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(11,20,37,0.92)_0%,rgba(12,22,41,0.97)_100%)] p-6 shadow-[0_24px_70px_rgba(2,8,23,0.44)] backdrop-blur-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/14 text-amber-100">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Account readiness</h2>
                      <p className="text-sm text-white/60">Key details that affect access, reminders, and recovery.</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {accountSummary.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                      >
                        <span className="text-sm text-white/58">{item.label}</span>
                        <span className="text-sm font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[1.4rem] border border-sky-300/18 bg-sky-500/[0.08] p-4">
                    <p className="text-sm font-semibold text-white">Notification center</p>
                    <p className="mt-1 text-sm text-white/64">
                      You currently have {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'} waiting.
                    </p>
                    <Link
                      href="/notifications"
                      className="mt-4 inline-flex items-center rounded-full bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/88 transition hover:bg-white/[0.12]"
                    >
                      Review notifications
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
