'use client';

import Link from 'next/link';
import { useState } from 'react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/auth';
import { PASSWORD_REQUIREMENTS_SUMMARY, getPasswordValidationMessage, isValidPassword } from '@/lib/passwordRules';
import { getUserRoleLabel } from '@/lib/roles';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const displayIdLabel = user?.staff_id
    ? user.role === 'LIBRARIAN' || user.role === 'TEACHER'
      ? 'Faculty ID'
      : 'Staff ID'
    : 'Student ID';
  const displayIdValue = user?.staff_id ?? user?.student_id ?? 'N/A';
  const roleLabel = getUserRoleLabel(user).toLowerCase();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!oldPassword) {
      setError('Enter your current password.');
      return;
    }
    if (!newPassword) {
      setError('Enter your new password.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError(getPasswordValidationMessage('New password'));
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    const result = await authApi.changePassword({
      old_password: oldPassword,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage(result.message);
    setOldPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0b1324] text-white">
        <Navbar variant="dark" />
        <main className="pt-16">
          <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0a1221] via-[#0e1629] to-[#0b1324]">
            <div className="absolute inset-0">
              <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/80">
                Security
              </p>
              <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Change your password</h1>
              <p className="mt-3 max-w-2xl text-white/70">
                Update your sign-in password for your {roleLabel || 'library'} account.
                This works for student, librarian, and working accounts while you are signed in.
              </p>
            </div>
          </section>

          <section className="-mt-8 relative z-10 mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[28px] border border-white/15 bg-white/5 p-5 backdrop-blur-xl shadow-2xl shadow-black/30 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">Account</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">{displayIdLabel}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{displayIdValue}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Email</p>
                    <p className="mt-2 text-sm font-medium text-white/80">{user?.email ?? 'No email on file'}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-white/75">
                    If you no longer remember your current password, use the{' '}
                    <Link href="/forgot-password" className="font-semibold text-amber-300 hover:text-amber-200">
                      forgot-password flow
                    </Link>
                    .
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/15 bg-white/5 p-5 backdrop-blur-xl shadow-2xl shadow-black/30 sm:p-8">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  {message && (
                    <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
                      {message}
                    </div>
                  )}
                  {error && (
                    <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="oldPassword" className="block text-sm font-medium text-white/90">
                      Current Password
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="oldPassword"
                        type={showOldPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={oldPassword}
                        onChange={(event) => {
                          setOldPassword(event.target.value);
                          setError('');
                        }}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-16 text-white placeholder-white/35 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
                        placeholder="Enter your current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/55 hover:text-white"
                      >
                        {showOldPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-white/90">
                      New Password
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setError('');
                        }}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-16 text-white placeholder-white/35 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
                        placeholder="Enter your new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/55 hover:text-white"
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-white/50">
                      {PASSWORD_REQUIREMENTS_SUMMARY}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="newPasswordConfirm" className="block text-sm font-medium text-white/90">
                      Confirm New Password
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="newPasswordConfirm"
                        type={showNewPasswordConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPasswordConfirm}
                        onChange={(event) => {
                          setNewPasswordConfirm(event.target.value);
                          setError('');
                        }}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-16 text-white placeholder-white/35 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
                        placeholder="Re-enter your new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasswordConfirm((prev) => !prev)}
                        className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/55 hover:text-white"
                      >
                        {showNewPasswordConfirm ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-[#1a1b1f] transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? 'Updating...' : 'Change Password'}
                    </button>
                    <Link
                      href="/profile"
                      className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Back to Profile
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
