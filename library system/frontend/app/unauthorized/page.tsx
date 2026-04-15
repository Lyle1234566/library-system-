'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { getUserRoleLabel } from '@/lib/roles';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const roleLabel = getUserRoleLabel(user);

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)]">
      <Navbar />
      <main className="pt-20">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-ink-muted">Access blocked</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold text-ink">Unauthorized</h1>
          <p className="mt-4 text-sm text-ink-muted">
            Your account does not have permission to view this page.
          </p>
          {user && (
            <div className="mt-4 text-xs text-ink-muted">
              Signed in as {user.full_name} ({roleLabel})
            </div>
          )}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-full border border-line px-6 py-2 text-sm font-semibold text-ink hover:bg-[color:var(--surface-muted)]"
            >
              Back to home
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[color:var(--accent)] px-6 py-2 text-sm font-semibold text-white shadow-soft hover:bg-[color:var(--accent-strong)]"
            >
              Sign in again
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
