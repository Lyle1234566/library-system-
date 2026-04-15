'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Features from '@/components/Features';
import { useAuth } from '@/contexts/AuthContext';

const systemModules = [
  {
    title: 'Student Workspace',
    details: 'Search books, submit borrow requests, and monitor your request status in real time.',
  },
  {
    title: 'Librarian Desk',
    details: 'Approve accounts, manage catalog actions, and handle borrow and return workflows.',
  },
  {
    title: 'Staff Operations',
    details: 'Process circulation tasks quickly, verify returns, and keep records accurate.',
  },
  {
    title: 'Account Center',
    details: 'Secure profile updates, role-based access, and full borrowing history tracking.',
  },
];

export default function FeaturesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  return (
    <div className="min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl animate-float" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl animate-float-slow" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_70%,rgba(251,191,36,0.14),transparent_50%)]" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60 animate-fade-up">Platform Features</p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold animate-fade-up delay-100">
              Everything built into your library system
            </h1>
            <p className="mt-4 text-white/70 max-w-2xl animate-fade-up delay-200">
              Your system includes role-based tools for students, staff, and librarians, designed
              for fast circulation and clear tracking.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {systemModules.map((module, index) => (
                <article
                  key={module.title}
                  style={{ animationDelay: `${index * 90 + 120}ms` }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl animate-fade-up transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
                >
                  <h2 className="text-lg font-semibold text-white">{module.title}</h2>
                  <p className="mt-2 text-sm text-white/70">{module.details}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <Features showBookFeatures />

        {!authLoading && !isAuthenticated && (
          <section className="relative pb-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-2xl animate-fade-up">
                <h3 className="text-2xl font-semibold text-white">Start using these features now</h3>
                <p className="mt-2 text-sm text-white/70">
                  Create an account, explore books, and experience the full borrowing flow.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-[#1a1b1f] transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-400"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/books"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    Browse books
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
